// Comments: signed-in authors only, owner moderation, author deletion, reports.
// Public listings select the author's display name only — never email.
import type { RouterContextProvider } from "react-router";
import { db } from "./db.server";

type Ctx = Readonly<RouterContextProvider>;

import { COMMENT_MAX } from "~/lib/limits";
export { COMMENT_MAX };

export interface PublicComment {
  id: string;
  body: string;
  created_at: Date;
  author_id: string;
  author_name: string;
}

export async function listVisibleComments(context: Ctx, profileId: string, limit = 50): Promise<PublicComment[]> {
  return db(context)<PublicComment[]>`
    SELECT c.id, c.body, c.created_at, c.author_id, u.display_name AS author_name
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.profile_id = ${profileId} AND c.status = 'visible'
    ORDER BY c.created_at DESC
    LIMIT ${limit}`;
}

export interface ModerationComment extends PublicComment {
  status: "visible" | "hidden";
  reports: number;
}

/** Owner view; caller must already have verified profile ownership. */
export async function listCommentsForOwner(context: Ctx, profileId: string): Promise<ModerationComment[]> {
  return db(context)<ModerationComment[]>`
    SELECT c.id, c.body, c.created_at, c.author_id, u.display_name AS author_name, c.status,
           (SELECT count(*)::int FROM comment_reports r WHERE r.comment_id = c.id) AS reports
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.profile_id = ${profileId}
    ORDER BY reports DESC, c.created_at DESC
    LIMIT 100`;
}

/** Normalise and screen comment text. Returns [clean, problem]. */
export function screenComment(input: string): [string, string | null] {
  const body = input.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return [body, "Write something first."];
  if (body.length > COMMENT_MAX) return [body, `Keep comments under ${COMMENT_MAX} characters.`];
  const links = body.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 2) return [body, "Comments can include at most two links."];
  return [body, null];
}

export async function createComment(context: Ctx, profileId: string, authorId: string, body: string) {
  const sql = db(context);
  // Reject exact duplicates posted by the same person within 10 minutes.
  const [dupe] = await sql`
    SELECT 1 FROM comments WHERE profile_id = ${profileId} AND author_id = ${authorId} AND body = ${body}
      AND created_at > now() - interval '10 minutes'`;
  if (dupe) return { ok: false as const, error: "You just posted that." };
  await sql`INSERT INTO comments (profile_id, author_id, body) VALUES (${profileId}, ${authorId}, ${body})`;
  return { ok: true as const };
}

/** Author may delete their own comment; profile owner may delete any on their page. */
export async function deleteComment(context: Ctx, commentId: string, userId: string) {
  const rows = await db(context)`
    DELETE FROM comments c USING profiles p
    WHERE c.id = ${commentId} AND p.id = c.profile_id AND (c.author_id = ${userId} OR p.owner_id = ${userId})
    RETURNING c.id`;
  return rows.length > 0;
}

export async function setCommentStatus(context: Ctx, commentId: string, ownerId: string, status: "visible" | "hidden") {
  const rows = await db(context)`
    UPDATE comments c SET status = ${status}
    FROM profiles p
    WHERE c.id = ${commentId} AND p.id = c.profile_id AND p.owner_id = ${ownerId}
    RETURNING c.id`;
  if (status === "visible" && rows.length) {
    await db(context)`DELETE FROM comment_reports WHERE comment_id = ${commentId}`;
  }
  return rows.length > 0;
}

export async function reportComment(context: Ctx, commentId: string, reporterId: string, reason: "spam" | "abuse" | "other") {
  await db(context)`
    INSERT INTO comment_reports (comment_id, reporter_id, reason)
    SELECT ${commentId}, ${reporterId}, ${reason}
    WHERE EXISTS (SELECT 1 FROM comments WHERE id = ${commentId} AND status = 'visible')
    ON CONFLICT (comment_id, reporter_id) DO NOTHING`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
