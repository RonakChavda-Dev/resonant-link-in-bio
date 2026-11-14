// Profile data access. Every function that touches a profile takes the
// authenticated user id and filters by owner_id in SQL (object-level
// authorization); callers never pass a bare profile id to a write.
import { data, type RouterContextProvider } from "react-router";
import { db } from "./db.server";
import type { Sql } from "postgres";

type JSONValue = Parameters<Sql["json"]>[0];
import { describeIssues, documentSchema, referencedMedia, upgradeDocument, upgradeTrusted, type ProfileDocument } from "~/lib/blocks";
import { handleProblem, normalizeHandle } from "~/lib/handles";

type Ctx = Readonly<RouterContextProvider>;

export const MAX_PROFILES_PER_USER = 5;

export interface ProfileSummary {
  id: string;
  handle: string;
  status: "draft" | "published" | "unpublished";
  draft: ProfileDocument;
  draft_version: number;
  published_version: number | null;
  published_at: Date | null;
  updated_at: Date;
  comments_enabled: boolean;
  indexable: boolean;
}

export interface OwnedProfile extends ProfileSummary {
  has_unpublished_changes: boolean;
}

const asJson = (doc: ProfileDocument) => doc as unknown as JSONValue;

export async function listProfiles(context: Ctx, ownerId: string): Promise<OwnedProfile[]> {
  return db(context)<OwnedProfile[]>`
    SELECT id, handle, status, draft, draft_version, published_version, published_at, updated_at,
           comments_enabled, indexable,
           (published IS DISTINCT FROM draft) AS has_unpublished_changes
    FROM profiles WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC`;
}

/** Load a profile the user owns, or 404 (never revealing other users' ids). */
export async function getOwnedProfile(context: Ctx, ownerId: string, profileId: string): Promise<OwnedProfile> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) throw data("Not found", { status: 404 });
  const [row] = await db(context)<OwnedProfile[]>`
    SELECT id, handle, status, draft, draft_version, published_version, published_at, updated_at,
           comments_enabled, indexable,
           (published IS DISTINCT FROM draft) AS has_unpublished_changes
    FROM profiles WHERE id = ${profileId} AND owner_id = ${ownerId}`;
  if (!row) throw data("Not found", { status: 404 });
  return row;
}

export type HandleCheck = { ok: true; handle: string } | { ok: false; error: string };

export async function checkHandle(context: Ctx, raw: string, exceptProfileId?: string): Promise<HandleCheck> {
  const handle = normalizeHandle(raw);
  const problem = handleProblem(handle);
  if (problem) return { ok: false, error: problem };
  const sql = db(context);
  const [taken] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM profiles WHERE handle = ${handle} AND id IS DISTINCT FROM ${exceptProfileId ?? null}::uuid
    UNION ALL
    SELECT 1 FROM retired_handles WHERE handle = ${handle} AND retired_at > now() - interval '30 days'
    LIMIT 1`;
  if (taken) return { ok: false, error: "That handle is taken. Try another." };
  return { ok: true, handle };
}

export type DocCheck = { ok: true; doc: ProfileDocument } | { ok: false; errors: string[] };

/** Authoritative validation: schema + every referenced upload belongs to the owner. */
export async function validateDocument(context: Ctx, ownerId: string, input: unknown): Promise<DocCheck> {
  input = upgradeDocument(input);
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: describeIssues(parsed.error, input as { blocks?: { type?: string }[] }) };
  }
  const mediaIds = referencedMedia(parsed.data);
  if (mediaIds.length) {
    const rows = await db(context)<{ id: string }[]>`
      SELECT id FROM media WHERE owner_id = ${ownerId} AND id = ANY(${mediaIds}::uuid[])`;
    if (rows.length !== mediaIds.length) {
      return { ok: false, errors: ["One or more images are missing. Re-upload them and try again."] };
    }
  }
  return { ok: true, doc: parsed.data };
}

export async function countProfiles(context: Ctx, ownerId: string): Promise<number> {
  const [row] = await db(context)<{ n: number }[]>`SELECT count(*)::int AS n FROM profiles WHERE owner_id = ${ownerId}`;
  return row.n;
}

export async function createProfile(context: Ctx, ownerId: string, handle: string, doc: ProfileDocument) {
  const [row] = await db(context)<{ id: string }[]>`
    INSERT INTO profiles (owner_id, handle, draft)
    VALUES (${ownerId}, ${handle}, ${db(context).json(asJson(doc))})
    ON CONFLICT (handle) DO NOTHING
    RETURNING id`;
  return row?.id ?? null;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true }
  | { ok: false; errors: string[] };

export async function saveDraft(
  context: Ctx,
  ownerId: string,
  profileId: string,
  input: unknown,
  baseVersion: number,
): Promise<SaveResult> {
  const check = await validateDocument(context, ownerId, input);
  if (!check.ok) return { ok: false, errors: check.errors };
  const sql = db(context);
  // Optimistic concurrency: refuse to overwrite a newer draft from another tab.
  const [row] = await sql<{ draft_version: number }[]>`
    UPDATE profiles SET draft = ${sql.json(asJson(check.doc))}, draft_version = draft_version + 1, updated_at = now()
    WHERE id = ${profileId} AND owner_id = ${ownerId} AND draft_version = ${baseVersion}
    RETURNING draft_version`;
  if (!row) return { ok: false, conflict: true };
  return { ok: true, version: row.draft_version };
}

export async function publishProfile(context: Ctx, ownerId: string, profileId: string) {
  const profile = await getOwnedProfile(context, ownerId, profileId);
  const check = await validateDocument(context, ownerId, profile.draft);
  if (!check.ok) return { ok: false as const, errors: check.errors };
  const sql = db(context);
  const version = (profile.published_version ?? 0) + 1;
  await sql.begin(async (tx) => {
    await tx`
      UPDATE profiles
      SET published = ${tx.json(asJson(check.doc))}, draft = ${tx.json(asJson(check.doc))},
          published_version = ${version}, published_at = now(), status = 'published', updated_at = now()
      WHERE id = ${profileId} AND owner_id = ${ownerId}`;
    await tx`
      INSERT INTO profile_revisions (profile_id, version, document)
      VALUES (${profileId}, ${version}, ${tx.json(asJson(check.doc))})`;
  });
  return { ok: true as const, version };
}

export async function unpublishProfile(context: Ctx, ownerId: string, profileId: string) {
  await db(context)`
    UPDATE profiles SET status = 'unpublished', updated_at = now()
    WHERE id = ${profileId} AND owner_id = ${ownerId} AND status = 'published'`;
}

export async function updateProfileSettings(
  context: Ctx,
  ownerId: string,
  profileId: string,
  settings: { handle?: string; commentsEnabled?: boolean; indexable?: boolean },
) {
  const sql = db(context);
  const profile = await getOwnedProfile(context, ownerId, profileId);
  await sql.begin(async (tx) => {
    if (settings.handle && settings.handle !== profile.handle) {
      if (profile.status !== "draft") {
        await tx`INSERT INTO retired_handles (handle) VALUES (${profile.handle}) ON CONFLICT (handle) DO UPDATE SET retired_at = now()`;
      }
      await tx`UPDATE profiles SET handle = ${settings.handle}, updated_at = now() WHERE id = ${profileId} AND owner_id = ${ownerId}`;
    }
    if (settings.commentsEnabled !== undefined) {
      await tx`UPDATE profiles SET comments_enabled = ${settings.commentsEnabled}, updated_at = now() WHERE id = ${profileId} AND owner_id = ${ownerId}`;
    }
    if (settings.indexable !== undefined) {
      await tx`UPDATE profiles SET indexable = ${settings.indexable}, updated_at = now() WHERE id = ${profileId} AND owner_id = ${ownerId}`;
    }
  });
}

export async function deleteProfile(context: Ctx, ownerId: string, profileId: string) {
  const sql = db(context);
  const profile = await getOwnedProfile(context, ownerId, profileId);
  await sql.begin(async (tx) => {
    if (profile.status !== "draft") {
      await tx`INSERT INTO retired_handles (handle) VALUES (${profile.handle}) ON CONFLICT (handle) DO UPDATE SET retired_at = now()`;
    }
    await tx`DELETE FROM profiles WHERE id = ${profileId} AND owner_id = ${ownerId}`;
  });
}

// --- Public reads ---------------------------------------------------------------

export interface PublicProfile {
  id: string;
  owner_id: string;
  handle: string;
  published: ProfileDocument;
  published_version: number;
  published_at: Date;
  comments_enabled: boolean;
  indexable: boolean;
}

export type PublicLookup =
  | { kind: "published"; profile: PublicProfile }
  | { kind: "gone" }
  | { kind: "missing" };

/** Only the published snapshot is ever selected for public rendering. */
export async function findPublicProfile(context: Ctx, handle: string): Promise<PublicLookup> {
  const sql = db(context);
  const [row] = await sql<(PublicProfile & { status: string })[]>`
    SELECT id, owner_id, handle, status, published, published_version, published_at, comments_enabled, indexable
    FROM profiles WHERE handle = ${handle}`;
  if (row?.status === "published" && row.published) {
    const { status: _status, ...profile } = row;
    return { kind: "published", profile: { ...profile, published: upgradeTrusted(profile.published) } };
  }
  if (row?.status === "unpublished") return { kind: "gone" };
  if (!row) {
    const [retired] = await sql`
      SELECT 1 FROM retired_handles WHERE handle = ${handle} AND retired_at > now() - interval '30 days'`;
    if (retired) return { kind: "gone" };
  }
  return { kind: "missing" };
}
