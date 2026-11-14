-- Google sign-in (OpenID Connect). Accounts created through Google have no
-- password until the owner sets one in Settings.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE oauth_accounts (
  provider    text NOT NULL,
  subject     text NOT NULL,            -- the provider's stable user id ("sub")
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email       text NOT NULL,            -- email at link time (for the owner's reference)
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject),
  CONSTRAINT oauth_provider_valid CHECK (provider IN ('google'))
);
CREATE UNIQUE INDEX oauth_accounts_user_provider_key ON oauth_accounts (user_id, provider);
