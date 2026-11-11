# ---- build stage: compile server (tsc) and client (vite) ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
# better-sqlite3 ships prebuilt binaries and esbuild resolves its platform binary
# via optionalDependencies, so no install scripts are needed.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime stage: production deps + built artifacts only ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=4000 DB_FILE=/data/abhibus.db STATIC_DIR=/app/client/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --ignore-scripts -w server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
