-- OpenTune Phase 19: query indexes for home, search enablement, and public playlists.
-- Search still goes through MusicProvider connectors (not SQL LIKE / pg_trgm).
-- Do not store audio or media URLs.

CREATE INDEX "tracks_deleted_at_created_at_idx" ON "tracks"("deleted_at", "created_at" DESC);

CREATE INDEX "providers_is_enabled_idx" ON "providers"("is_enabled");

CREATE INDEX "playlists_visibility_deleted_at_idx" ON "playlists"("visibility", "deleted_at");
