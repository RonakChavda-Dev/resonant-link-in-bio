// Account profile + preferences data access. Every query is scoped to the
// signed-in user's id; avatar ids must be images the user uploaded.
import type { RouterContextProvider } from "react-router";
import type { Sql } from "postgres";
import { db } from "./db.server";
import { storedSocialLinks, type AccountPreferences, type AccountProfile, type SocialLink } from "~/lib/account";

type Ctx = Readonly<RouterContextProvider>;
type JSONValue = Parameters<Sql["json"]>[0];

export async function getAccount(context: Ctx, userId: string): Promise<{ profile: AccountProfile; preferences: AccountPreferences }> {
  const [row] = await db(context)<
    {
      display_name: string;
      avatar_media_id: string | null;
      bio: string;
      social_links: unknown;
      pref_prefill_pages: boolean;
      pref_new_page_comments: boolean;
      pref_comment_avatar: boolean;
    }[]
  >`
    SELECT display_name, avatar_media_id, bio, social_links,
           pref_prefill_pages, pref_new_page_comments, pref_comment_avatar
    FROM users WHERE id = ${userId}`;
  if (!row) throw new Error("Account not found");
  return {
    profile: {
      displayName: row.display_name,
      avatar: row.avatar_media_id,
      bio: row.bio,
      socials: storedSocialLinks(row.social_links),
    },
    preferences: {
      prefillPages: row.pref_prefill_pages,
      newPageComments: row.pref_new_page_comments,
      commentAvatar: row.pref_comment_avatar,
    },
  };
}

/** True when the media id is an image owned by this user. */
export async function ownsImage(context: Ctx, userId: string, mediaId: string): Promise<boolean> {
  const [row] = await db(context)`
    SELECT 1 FROM media WHERE id = ${mediaId} AND owner_id = ${userId} AND content_type LIKE 'image/%'`;
  return !!row;
}

export async function updateAccountProfile(
  context: Ctx,
  userId: string,
  input: { displayName: string; avatar: string | null; bio: string; socials: SocialLink[] },
) {
  const sql = db(context);
  await sql`
    UPDATE users SET
      display_name = ${input.displayName},
      avatar_media_id = ${input.avatar},
      bio = ${input.bio},
      social_links = ${sql.json(input.socials as unknown as JSONValue)},
      updated_at = now()
    WHERE id = ${userId}`;
}

export async function updatePreferences(context: Ctx, userId: string, prefs: AccountPreferences) {
  await db(context)`
    UPDATE users SET
      pref_prefill_pages = ${prefs.prefillPages},
      pref_new_page_comments = ${prefs.newPageComments},
      pref_comment_avatar = ${prefs.commentAvatar},
      updated_at = now()
    WHERE id = ${userId}`;
}
