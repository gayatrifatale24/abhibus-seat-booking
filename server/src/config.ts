export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  jwtExpiresIn: '12h' as const,
  /** Seat hold time-to-live in milliseconds (default 5 minutes). */
  holdTtlMs: Number(process.env.HOLD_TTL_MS ?? 5 * 60 * 1000),
  /** Max seats a single hold may contain. */
  maxSeatsPerHold: 6,
  dbFile: process.env.DB_FILE ?? 'abhibus.db',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  seedDays: 14,
};
