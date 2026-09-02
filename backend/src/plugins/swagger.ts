import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "OpenTune API",
        version: "0.1.0",
        description:
          "Metadata mediator for legally available open/licensed music. " +
          "This API never proxies, caches, stores, transcodes, or redistributes audio or video. " +
          "Playback and download URLs come from original providers and are fetched by the client.",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "health", description: "Liveness probes" },
        { name: "auth", description: "Authentication (Phase 4)" },
        { name: "users", description: "User profiles (Phase 4)" },
        { name: "search", description: "Aggregated search (Phase 7)" },
        { name: "tracks", description: "Track metadata (Phase 7)" },
        { name: "artists", description: "Artist metadata (Phase 7 / 15)" },
        { name: "albums", description: "Album metadata (Phase 7 / 15)" },
        { name: "playlists", description: "Playlists (Phases 13–14)" },
        { name: "library", description: "Library and favorites (Phase 13)" },
        { name: "downloads", description: "Download source descriptors (Phase 11)" },
        { name: "providers", description: "Music providers (Phases 5–6, 17)" },
        { name: "licenses", description: "SPDX licenses (Phase 7)" },
        { name: "discovery", description: "Home and discovery (Phases 7, 16)" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
