-- Listening preferences for onboarding and ranking. Metadata only — no audio URLs.

CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "language_mode" TEXT NOT NULL DEFAULT 'prefer',
    "wifi_only_downloads" BOOLEAN NOT NULL DEFAULT true,
    "auto_download_recommendations" BOOLEAN NOT NULL DEFAULT false,
    "download_starter_pack" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed_at" TIMESTAMPTZ,
    "onboarding_version" INTEGER NOT NULL DEFAULT 0,
    "starter_track_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "user_favorite_artists" (
    "user_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,

    CONSTRAINT "user_favorite_artists_pkey" PRIMARY KEY ("user_id","artist_id")
);

CREATE TABLE "user_favorite_categories" (
    "user_id" UUID NOT NULL,
    "category_slug" TEXT NOT NULL,

    CONSTRAINT "user_favorite_categories_pkey" PRIMARY KEY ("user_id","category_slug")
);

CREATE TABLE "user_preferred_languages" (
    "user_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,

    CONSTRAINT "user_preferred_languages_pkey" PRIMARY KEY ("user_id","language_code")
);

CREATE TABLE "user_preferred_moods" (
    "user_id" UUID NOT NULL,
    "mood_slug" TEXT NOT NULL,

    CONSTRAINT "user_preferred_moods_pkey" PRIMARY KEY ("user_id","mood_slug")
);

CREATE INDEX "user_favorite_artists_artist_id_idx" ON "user_favorite_artists"("artist_id");

ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_favorite_artists" ADD CONSTRAINT "user_favorite_artists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_preferences"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_favorite_artists" ADD CONSTRAINT "user_favorite_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_favorite_categories" ADD CONSTRAINT "user_favorite_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_preferences"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_preferred_languages" ADD CONSTRAINT "user_preferred_languages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_preferences"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_preferred_moods" ADD CONSTRAINT "user_preferred_moods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_preferences"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
