import bcrypt from 'bcryptjs';
import { openDb, type DB } from '../src/db/connection.js';
import { seed } from '../src/db/seed.js';
import { createContainer } from '../src/container.js';

export const TODAY = '2026-11-11';
export const TOMORROW = '2026-11-12';
/** 10:00 IST on TODAY. */
export const T0 = Date.parse(`${TODAY}T10:00:00+05:30`);

export function setup(opts: { file?: string; ttlMs?: number } = {}) {
  const db = openDb(opts.file ?? ':memory:');
  seed(db, { days: 3, today: TODAY, seed: 7 });
  const clock = { now: T0 };
  const c = createContainer(db, { now: () => clock.now, holdTtlMs: opts.ttlMs ?? 5 * 60_000, jwtSecret: 'test-secret' });
  const users = [1, 2, 3, 4, 5].map((i) => createUser(db, `user${i}@test.dev`));
  return { db, c, clock, users };
}

export function createUser(db: DB, email: string) {
  const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(email.split('@')[0], email, bcrypt.hashSync('secret123', 4));
  return Number(r.lastInsertRowid);
}

/** A future trip plus `n` of its currently-available seat numbers. */
export function freeSeats(c: ReturnType<typeof setup>['c'], n: number, from = 'Hyderabad', to = 'Bengaluru') {
  const trip = c.trips.search(from, to, TOMORROW)[0];
  const seats = c.trips.getTrip(trip.id).seats.filter((s) => s.status === 'AVAILABLE').slice(0, n).map((s) => s.seatNo);
  if (seats.length < n) throw new Error('not enough free seats in fixture');
  return { tripId: trip.id, seats };
}
