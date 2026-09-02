import type { FastifyInstance } from "fastify";

import { v1HealthRoutes } from "../health.js";
import { albumsRoutes } from "./albums.js";
import { artistsRoutes } from "./artists.js";
import { authRoutes } from "./auth.js";
import { discoveryRoutes } from "./discovery.js";
import { downloadsRoutes } from "./downloads.js";
import { libraryRoutes } from "./library.js";
import { licensesRoutes } from "./licenses.js";
import { playlistsRoutes } from "./playlists.js";
import { providersRoutes } from "./providers.js";
import { reportRoutes } from "./reports.js";
import { searchRoutes } from "./search.js";
import { tracksRoutes } from "./tracks.js";
import { usersRoutes } from "./users.js";
import { onboardingRoutes } from "./onboarding.js";
import { recommendationRoutes } from "./recommendations.js";

export async function v1Routes(app: FastifyInstance): Promise<void> {
  await app.register(v1HealthRoutes);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(onboardingRoutes);
  await app.register(recommendationRoutes);
  await app.register(searchRoutes);
  await app.register(tracksRoutes);
  await app.register(artistsRoutes);
  await app.register(albumsRoutes);
  await app.register(playlistsRoutes);
  await app.register(libraryRoutes);
  await app.register(downloadsRoutes);
  await app.register(providersRoutes);
  await app.register(licensesRoutes);
  await app.register(discoveryRoutes);
  await app.register(reportRoutes);
}
