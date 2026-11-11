import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import type { Container } from './container.js';
import { createRouter } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { config } from './config.js';

export function createApp(c: Container, opts: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '50kb' }));
  app.use('/api', createRouter(c));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));

  // In production (Docker) the built React app is served from the same origin.
  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir));
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
