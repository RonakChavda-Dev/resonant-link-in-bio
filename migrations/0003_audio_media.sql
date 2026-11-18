-- Allow audio uploads (profile music) alongside images.
-- Images stay limited to 5 MB; audio files may be up to 10 MB.
ALTER TABLE media DROP CONSTRAINT media_type_valid;
ALTER TABLE media DROP CONSTRAINT media_size_valid;
ALTER TABLE media ADD CONSTRAINT media_type_valid CHECK (
  content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav')
);
ALTER TABLE media ADD CONSTRAINT media_size_valid CHECK (
  byte_size > 0 AND byte_size <= CASE WHEN content_type LIKE 'audio/%' THEN 10485760 ELSE 5242880 END
);
