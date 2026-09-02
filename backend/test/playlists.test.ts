import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistProviderTrack } from "../src/catalog/persist.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { FakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

describe("playlists", () => {
  let app: FastifyInstance;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
    } catch (error) {
      if (requireDb) {
        throw error;
      }
    }
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates, reorders, and deletes playlist track references without storing audio", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `pl-${tag}@example.com`,
        username: `pl_${tag}`,
        password: "correct-horse-battery",
        displayName: "Lister",
      },
    });
    const token = registered.json().tokens.accessToken as string;
    const auth = { authorization: `Bearer ${token}` };

    const horizon = await persistProviderTrack(
      "fake",
      (await new FakeProvider().getTrack("fake-1"))!,
    );
    const harbor = await persistProviderTrack(
      "fake",
      (await new FakeProvider().getTrack("fake-2"))!,
    );

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/playlists",
      headers: auth,
      payload: { title: "Open mix", visibility: "private" },
    });
    expect(created.statusCode).toBe(201);
    const playlistId = created.json().id as string;

    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/v1/playlists/${playlistId}`,
      headers: auth,
      payload: { title: "Open mix (edit)" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().title).toBe("Open mix (edit)");

    for (const trackId of [horizon.track.id, harbor.track.id]) {
      const added = await app.inject({
        method: "POST",
        url: `/api/v1/playlists/${playlistId}/tracks`,
        headers: auth,
        payload: { trackId },
      });
      expect(added.statusCode).toBe(200);
    }

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/playlists/${playlistId}/tracks`,
      headers: auth,
      payload: { trackId: horizon.track.id },
    });
    expect(duplicate.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/playlists",
      headers: auth,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().playlists).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: playlistId })]),
    );

    const reordered = await app.inject({
      method: "PATCH",
      url: `/api/v1/playlists/${playlistId}/tracks`,
      headers: auth,
      payload: { trackIds: [harbor.track.id, horizon.track.id] },
    });
    expect(reordered.statusCode).toBe(200);
    const tracks = reordered.json().tracks as Array<{
      trackId: string;
      position: number;
      track: { id: string; title: string };
    }>;
    expect(tracks.map((row) => row.trackId)).toEqual([
      harbor.track.id,
      horizon.track.id,
    ]);
    expect(tracks[0]?.track.title).toBe("Harbor Lights");
    expect(JSON.stringify(reordered.json())).not.toMatch(/\/api\/v1\/audio/);
    expect(JSON.stringify(reordered.json())).not.toMatch(/\.mp3/);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/playlists/${playlistId}/tracks/${harbor.track.id}`,
      headers: auth,
    });
    expect(removed.statusCode).toBe(204);

    const afterRemove = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
      headers: auth,
    });
    expect(afterRemove.json().tracks).toHaveLength(1);
    expect(afterRemove.json().tracks[0].trackId).toBe(horizon.track.id);
    expect(afterRemove.json().tracks[0].position).toBe(0);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/playlists/${playlistId}`,
      headers: auth,
    });
    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
      headers: auth,
    });
    expect(missing.statusCode).toBe(404);
  });

  it("syncs favorites as track references", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `fav-${tag}@example.com`,
        username: `fav_${tag}`,
        password: "correct-horse-battery",
        displayName: "Fan",
      },
    });
    const token = registered.json().tokens.accessToken as string;
    const auth = { authorization: `Bearer ${token}` };
    const horizon = await persistProviderTrack(
      "fake",
      (await new FakeProvider().getTrack("fake-1"))!,
    );

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/library/favorites/${horizon.track.id}`,
      headers: auth,
    });
    expect(put.statusCode).toBe(204);

    const library = await app.inject({
      method: "GET",
      url: "/api/v1/library",
      headers: auth,
    });
    expect(library.statusCode).toBe(200);
    const favorites = library.json().favorites as Array<{
      trackId: string;
      track: { id: string; title: string };
    }>;
    expect(favorites.some((row) => row.trackId === horizon.track.id)).toBe(true);
    expect(favorites[0]?.track.title).toBeDefined();
    expect(JSON.stringify(library.json())).not.toMatch(/\/api\/v1\/audio/);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/library/favorites",
      headers: auth,
    });
    expect(listed.json().favorites).toHaveLength(1);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/library/favorites/${horizon.track.id}`,
      headers: auth,
    });
    expect(removed.statusCode).toBe(204);

    const empty = await app.inject({
      method: "GET",
      url: "/api/v1/library/favorites",
      headers: auth,
    });
    expect(empty.json().favorites).toEqual([]);
  });

  it("shares a hashed token, lets a recipient fork refs, and never uploads audio", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const owner = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `share-${tag}@example.com`,
        username: `share_${tag}`,
        password: "correct-horse-battery",
        displayName: "Lister",
      },
    });
    const ownerToken = owner.json().tokens.accessToken as string;
    const ownerAuth = { authorization: `Bearer ${ownerToken}` };

    const guest = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `fork-${tag}@example.com`,
        username: `fork_${tag}`,
        password: "correct-horse-battery",
        displayName: "Guest",
      },
    });
    const guestAuth = {
      authorization: `Bearer ${guest.json().tokens.accessToken as string}`,
    };

    const horizon = await persistProviderTrack(
      "fake",
      (await new FakeProvider().getTrack("fake-1"))!,
    );

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/playlists",
      headers: ownerAuth,
      payload: { title: "Open mix", visibility: "private" },
    });
    expect(created.statusCode).toBe(201);
    const playlistId = created.json().id as string;

    await app.inject({
      method: "POST",
      url: `/api/v1/playlists/${playlistId}/tracks`,
      headers: ownerAuth,
      payload: { trackId: horizon.track.id },
    });

    const hidden = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
      headers: guestAuth,
    });
    expect(hidden.statusCode).toBe(404);

    const share = await app.inject({
      method: "POST",
      url: `/api/v1/playlists/${playlistId}/share`,
      headers: ownerAuth,
    });
    expect(share.statusCode).toBe(200);
    const shareToken = share.json().token as string;
    expect(shareToken.length).toBeGreaterThanOrEqual(40);
    expect(shareToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(share.json().path).toBe(`/playlists/shared/${shareToken}`);
    expect(JSON.stringify(share.json())).not.toMatch(
      /playbackUrl|downloadUrl|\.mp3|\/api\/v1\/audio/,
    );

    const lookup = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/shared/${shareToken}`,
    });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().title).toBe("Open mix");
    expect(lookup.json().tracks).toHaveLength(1);
    expect(lookup.json().tracks[0].trackId).toBe(horizon.track.id);
    expect(JSON.stringify(lookup.json())).not.toMatch(
      /playbackUrl|downloadUrl|\.mp3|\/api\/v1\/audio/,
    );

    const unlistedById = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
      headers: guestAuth,
    });
    expect(unlistedById.statusCode).toBe(404);

    const ownerById = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
      headers: ownerAuth,
    });
    expect(ownerById.statusCode).toBe(200);

    const guestPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/playlists/${playlistId}`,
      headers: guestAuth,
      payload: { title: "Hijacked" },
    });
    expect(guestPatch.statusCode).toBe(404);

    const guestForkById = await app.inject({
      method: "POST",
      url: `/api/v1/playlists/${playlistId}/fork`,
      headers: guestAuth,
    });
    expect(guestForkById.statusCode).toBe(404);

    const forked = await app.inject({
      method: "POST",
      url: `/api/v1/playlists/shared/${shareToken}/fork`,
      headers: guestAuth,
    });
    expect(forked.statusCode).toBe(201);
    expect(forked.json().forkOfPlaylistId).toBe(playlistId);
    expect(forked.json().visibility).toBe("private");
    expect(forked.json().owner.id).toBe(guest.json().user.id);
    expect(forked.json().tracks.map((row: { trackId: string }) => row.trackId)).toEqual(
      [horizon.track.id],
    );
    expect(JSON.stringify(forked.json())).not.toMatch(
      /playbackUrl|downloadUrl|\.mp3|\/api\/v1\/audio/,
    );

    const revoked = await app.inject({
      method: "DELETE",
      url: `/api/v1/playlists/${playlistId}/shares`,
      headers: ownerAuth,
    });
    expect(revoked.statusCode).toBe(204);

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/shared/${shareToken}`,
    });
    expect(missing.statusCode).toBe(404);

    const cannotFork = await app.inject({
      method: "POST",
      url: `/api/v1/playlists/shared/${shareToken}/fork`,
      headers: guestAuth,
    });
    expect(cannotFork.statusCode).toBe(404);
  });

  it("lets anyone read a public playlist by id and still forbids mutations", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const owner = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `pub-${tag}@example.com`,
        username: `pub_${tag}`,
        password: "correct-horse-battery",
        displayName: "Owner",
      },
    });
    const ownerAuth = {
      authorization: `Bearer ${owner.json().tokens.accessToken as string}`,
    };
    const guest = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `pubg-${tag}@example.com`,
        username: `pubg_${tag}`,
        password: "correct-horse-battery",
        displayName: "Guest",
      },
    });
    const guestAuth = {
      authorization: `Bearer ${guest.json().tokens.accessToken as string}`,
    };

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/playlists",
      headers: ownerAuth,
      payload: { title: "Public mix", visibility: "public" },
    });
    const playlistId = created.json().id as string;

    const visible = await app.inject({
      method: "GET",
      url: `/api/v1/playlists/${playlistId}`,
    });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().title).toBe("Public mix");
    expect(JSON.stringify(visible.json())).not.toMatch(/playbackUrl|\.mp3/);

    const mutate = await app.inject({
      method: "DELETE",
      url: `/api/v1/playlists/${playlistId}`,
      headers: guestAuth,
    });
    expect(mutate.statusCode).toBe(404);
  });
});
