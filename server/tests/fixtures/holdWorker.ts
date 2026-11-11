import { parentPort, workerData } from 'node:worker_threads';
import { openDb } from '../../src/db/connection.js';
import { createContainer } from '../../src/container.js';

/**
 * Runs in its own thread with its OWN SQLite connection to the same database file,
 * simulating a separate API instance. All workers block on a shared flag and are
 * released at the same instant so their hold attempts genuinely race.
 */
const { file, userId, tripId, seats, now, flag } = workerData as {
  file: string; userId: number; tripId: number; seats: string[]; now: number; flag: SharedArrayBuffer;
};
const db = openDb(file);
const c = createContainer(db, { now: () => now, jwtSecret: 'x' });
const gate = new Int32Array(flag);
Atomics.add(gate, 1, 1); // signal ready
Atomics.wait(gate, 0, 0); // wait for the starting gun
try {
  const h = c.holds.holdSeats(userId, tripId, seats);
  parentPort!.postMessage({ ok: true, userId, holdId: h.holdId });
} catch (e) {
  const err = e as { code?: string; message: string };
  parentPort!.postMessage({ ok: false, userId, code: err.code, message: err.message });
} finally {
  db.close();
}
