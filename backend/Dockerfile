# syntax=docker/dockerfile:1
# Metadata API only. Do not add object storage, media volumes, or ffmpeg.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S opentune && adduser -S -G opentune opentune
COPY --from=build --chown=opentune:opentune /app/node_modules ./node_modules
COPY --from=build --chown=opentune:opentune /app/dist ./dist
COPY --from=build --chown=opentune:opentune /app/src/generated ./dist/generated
COPY --from=build --chown=opentune:opentune /app/prisma ./prisma
COPY --from=build --chown=opentune:opentune /app/prisma.config.ts ./
COPY --from=build --chown=opentune:opentune /app/package.json ./
USER opentune
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
