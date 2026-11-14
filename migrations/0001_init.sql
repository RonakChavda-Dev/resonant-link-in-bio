-- Resonant initial schema.
-- Applied by scripts/migrate.mjs inside a transaction. Never edit an applied
-- migration; add a new numbered file instead.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored already trimmed + lowercased by the application.
  email            text NOT NULL,
  display_name     text NOT NULL,
  -- PHC-formatted Argon2id hash. Never plaintext.
  password_hash    text NOT NULL,
  email_verified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254 AND position('@' IN email) > 1),
  CONSTRAINT users_display_name_len CHECK (length(display_name) BETWEEN 1 AND 60)
);
CREATE UNIQUE INDEX users_email_key ON users (email);

-- Server-managed sessions. The cookie holds a random token; only its SHA-256
-- digest is stored here, so a database read does not yield usable cookies.
CREATE TABLE sessions (
  id            text PRIMARY KEY,            -- hex(sha256(token))
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  csrf_token    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  -- Coarse, user-facing label such as "Firefox on Windows". No raw UA or IP.
  client_label  text NOT NULL DEFAULT 'Unknown device'
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE password_reset_tokens (
  id          text PRIMARY KEY,              -- hex(sha256(token))
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  handle             text NOT NULL,
  -- draft: never published. published: live. unpublished: was live, now hidden (410).
  status             text NOT NULL DEFAULT 'draft',
  draft              jsonb NOT NULL,
  draft_version      integer NOT NULL DEFAULT 1,
  published          jsonb,
  published_version  integer,
  published_at       timestamptz,
  comments_enabled   boolean NOT NULL DEFAULT false,
  indexable          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_handle_format CHECK (handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  CONSTRAINT profiles_status_valid CHECK (status IN ('draft', 'published', 'unpublished')),
  CONSTRAINT profiles_published_consistent CHECK (status <> 'published' OR published IS NOT NULL)
);
CREATE UNIQUE INDEX profiles_handle_key ON profiles (handle);
CREATE INDEX profiles_owner_idx ON profiles (owner_id);

-- Immutable snapshots of every publish, for history and rollback.
CREATE TABLE profile_revisions (
  profile_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  version     integer NOT NULL,
  document    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, version)
);

-- Handles of deleted profiles answer 410 and cannot be claimed for a cooling-off period.
CREATE TABLE retired_handles (
  handle      text PRIMARY KEY,
  retired_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Media (objects live in R2; this is the authorization + metadata record)
-- ---------------------------------------------------------------------------
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  object_key    text NOT NULL UNIQUE,
  content_type  text NOT NULL,
  byte_size     integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_type_valid CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  CONSTRAINT media_size_valid CHECK (byte_size > 0 AND byte_size <= 5242880)
);
CREATE INDEX media_owner_idx ON media (owner_id);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body        text NOT NULL,
  -- visible: shown publicly. hidden: hidden by the profile owner.
  status      text NOT NULL DEFAULT 'visible',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_body_len CHECK (length(body) BETWEEN 1 AND 1000),
  CONSTRAINT comments_status_valid CHECK (status IN ('visible', 'hidden'))
);
CREATE INDEX comments_profile_idx ON comments (profile_id, created_at DESC);
CREATE INDEX comments_author_idx ON comments (author_id);

CREATE TABLE comment_reports (
  comment_id   uuid NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reporter_id),
  CONSTRAINT comment_reports_reason_valid CHECK (reason IN ('spam', 'abuse', 'other'))
);

-- ---------------------------------------------------------------------------
-- Analytics: aggregated daily counters only. No IP address, user agent,
-- cookie or visitor identifier is stored.
-- ---------------------------------------------------------------------------
CREATE TABLE analytics_daily (
  profile_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  day            date NOT NULL,
  metric         text NOT NULL,
  block_id       text NOT NULL DEFAULT '',
  referrer_host  text NOT NULL DEFAULT '',
  count          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, day, metric, block_id, referrer_host),
  CONSTRAINT analytics_metric_valid CHECK (metric IN ('view', 'click'))
);

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed windows). Keys contain HMAC digests, never raw IPs.
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);
