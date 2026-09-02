-- Source-router order: Audius 1, Jamendo 2, FMA 3. Metadata only.

ALTER TABLE "providers" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX "providers_is_enabled_priority_idx" ON "providers"("is_enabled", "priority");

UPDATE "providers" SET "priority" = 1 WHERE "slug" = 'audius';
UPDATE "providers" SET "priority" = 2 WHERE "slug" = 'jamendo';
UPDATE "providers" SET "priority" = 3 WHERE "slug" = 'fma';
UPDATE "providers" SET "priority" = 0 WHERE "slug" = 'fake';
