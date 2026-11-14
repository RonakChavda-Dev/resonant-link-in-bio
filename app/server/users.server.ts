import type { RouterContextProvider } from "react-router";
import { appSecret, db } from "./db.server";
import { hmacHex } from "./crypto.server";

type Ctx = Readonly<RouterContextProvider>;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return null;
}

export function displayNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a display name.";
  if (trimmed.length > 60) return "Keep your display name under 60 characters.";
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return "Your display name contains invalid characters.";
  return null;
}

/** Keyed digest of an email for rate-limit keys (no raw addresses in that table). */
export async function emailKey(context: Ctx, email: string) {
  return (await hmacHex(appSecret(context), `email:${email}`)).slice(0, 32);
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
}

export async function findUserByEmail(context: Ctx, email: string): Promise<UserRow | undefined> {
  const [row] = await db(context)<UserRow[]>`
    SELECT id, email, display_name, password_hash FROM users WHERE email = ${email}`;
  return row;
}

export async function findUserById(context: Ctx, id: string): Promise<UserRow | undefined> {
  const [row] = await db(context)<UserRow[]>`
    SELECT id, email, display_name, password_hash FROM users WHERE id = ${id}`;
  return row;
}
