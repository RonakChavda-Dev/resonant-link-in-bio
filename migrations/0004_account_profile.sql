-- Account profile (avatar, short bio, social links) and account preferences.
-- The account profile is private to the owner unless they copy it into a page
-- or opt in to showing their avatar next to their comments.
ALTER TABLE users
  ADD COLUMN avatar_media_id uuid REFERENCES media (id) ON DELETE SET NULL,
  ADD COLUMN bio text NOT NULL DEFAULT '',
  ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Copy avatar, bio and social links into a new page's intro/socials blocks.
  ADD COLUMN pref_prefill_pages boolean NOT NULL DEFAULT true,
  -- Comments switched on for newly created pages.
  ADD COLUMN pref_new_page_comments boolean NOT NULL DEFAULT false,
  -- Show the account avatar beside comments this user posts (public when on).
  ADD COLUMN pref_comment_avatar boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT users_bio_len CHECK (length(bio) <= 160),
  ADD CONSTRAINT users_social_links_shape CHECK (jsonb_typeof(social_links) = 'array' AND jsonb_array_length(social_links) <= 12);
