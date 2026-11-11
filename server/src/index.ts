import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDb } from './db/connection.js';
import { seed } from './db/seed.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';
import { attachSocket } from './realtime/socket.js';

const db = openDb(config.dbFile);
const created = seed(db, { days: config.seedDays });
const container = createContainer(db);
const here = path.dirname(fileURLToPath(import.meta.url));
const app = createApp(container, { staticDir: process.env.STATIC_DIR ?? path.resolve(here, '../../client/dist') });
const server = http.createServer(app);
attachSocket(server, container.events);

// Expired holds are also ignored lazily in every query; this sweeper just frees them and tells clients.
const sweeper = setInterval(() => container.holds.purgeExpired(), 5_000);

server.listen(config.port, () => {
  console.log(`AbhiBus seat-booking API on http://localhost:${config.port} (seeded ${created} new trips, hold TTL ${config.holdTtlMs / 1000}s)`);
});

const shutdown = () => {
  clearInterval(sweeper);
  server.close(() => { db.close(); process.exit(0); });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
