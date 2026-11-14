// Argon2id password hashing (RFC 9106) using @noble/hashes — audited, pure
// JavaScript, so it runs in Workers without dynamic WebAssembly compilation.
// Parameters follow the OWASP Password Storage Cheat Sheet minimum
// (m=19 MiB, t=2, p=1). Measured at roughly 200–250 ms of CPU per hash, which
// requires the Workers Paid plan CPU limits. Hashes are stored in PHC format so
// parameters can be raised later; `needsRehash` reports outdated hashes.
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { base64url, fromBase64url, randomBytes, timingSafeEqual } from "./crypto.server";

const PARAMS = { m: 19456, t: 2, p: 1 } as const;
const HASH_LEN = 32;

function phcB64(bytes: Uint8Array) {
  return base64url(bytes); // PHC uses unpadded base64; url-safe alphabet is fine for our own parser.
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await argon2idAsync(password, salt, { ...PARAMS, dkLen: HASH_LEN });
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${phcB64(salt)}$${phcB64(hash)}`;
}

interface Parsed {
  m: number;
  t: number;
  p: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function parse(encoded: string): Parsed | null {
  const parts = encoded.split("$");
  // ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash]
  if (parts.length !== 6 || parts[1] !== "argon2id" || parts[2] !== "v=19") return null;
  const params = Object.fromEntries(
    parts[3].split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, Number(v)];
    }),
  );
  const { m, t, p } = params as Record<string, number>;
  if (![m, t, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  // Refuse absurd parameters from a tampered row (DoS guard).
  if (m > 65536 || t > 10 || p > 4) return null;
  try {
    return { m, t, p, salt: fromBase64url(parts[4]), hash: fromBase64url(parts[5]) };
  } catch {
    return null;
  }
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  const parsed = parse(encoded);
  if (!parsed) return false;
  const candidate = await argon2idAsync(password, parsed.salt, {
    m: parsed.m,
    t: parsed.t,
    p: parsed.p,
    dkLen: parsed.hash.length,
  });
  return timingSafeEqual(candidate, parsed.hash);
}

export function needsRehash(encoded: string): boolean {
  const parsed = parse(encoded);
  return !parsed || parsed.m < PARAMS.m || parsed.t < PARAMS.t;
}

/**
 * A real hash of a random password, computed once per isolate. Verifying
 * against it when an account does not exist keeps login timing similar for
 * known and unknown emails.
 */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(base64url(randomBytes(18)));
  await verifyPassword(await dummyHash, password);
}

const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "1234567890",
  "12345678910", "qwertyuiop", "qwerty1234", "iloveyou12", "letmein123", "welcome123",
  "admin12345", "abc1234567", "1q2w3e4r5t", "passw0rd12", "football12", "monkey1234",
  "sunshine12", "princess12", "dragon1234", "baseball12", "superman12", "trustno1234",
  "0123456789", "1111111111", "aaaaaaaaaa", "resonant123", "resonant1234",
]);

import { PASSWORD_MAX, PASSWORD_MIN } from "~/lib/limits";
export { PASSWORD_MAX, PASSWORD_MIN };

/** Returns a user-facing problem with the password, or null if acceptable. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Try a longer phrase.";
  if (/^(.)\1+$/.test(password)) return "Avoid repeating a single character.";
  if (email && lower.includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4)
    return "Avoid using your email address in the password.";
  return null;
}
