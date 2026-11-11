import { describe, expect, it } from 'vitest';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import request from 'supertest';
import { setup, freeSeats, createUser, T0 } from './helpers.js';
import { createApp } from '../src/app.js';

describe('concurrency: no double holds / double bookings', () => {
  it('30 simultaneous HTTP hold requests for the same seat -> exactly one wins', async () => {
    const { c, db } = setup();
    const server = http.createServer(createApp(c)).listen(0);
    const { tripId, seats: [seat] } = freeSeats(c, 1);
    const tokens = Array.from({ length: 30 }, (_, i) => {
      createUser(db, `racer${i}@test.dev`);
      return c.auth.login(`racer${i}@test.dev`, 'secret123').token;
    });

    const results = await Promise.all(
      tokens.map((t) => request(server).post(`/api/trips/${tripId}/holds`).set('Authorization', `Bearer ${t}`).send({ seats: [seat] })),
    );
    server.close();

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(29);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM seat_holds WHERE trip_id = ? AND seat_no = ?').get(tripId, seat) as { n: number };
    expect(rows.n).toBe(1);
  });

  it('overlapping multi-seat requests never leave a seat with two holders', async () => {
    const { c, db } = setup();
    const server = http.createServer(createApp(c)).listen(0);
    const { tripId, seats: pool } = freeSeats(c, 4);
    // Every pair from the 4-seat pool, 3 times over: lots of partial overlaps.
    const pairs: string[][] = [];
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
    const reqs = [...pairs, ...pairs, ...pairs].map((p, i) => {
      createUser(db, `p${i}@test.dev`);
      const t = c.auth.login(`p${i}@test.dev`, 'secret123').token;
      return request(server).post(`/api/trips/${tripId}/holds`).set('Authorization', `Bearer ${t}`).send({ seats: p });
    });
    const results = await Promise.all(reqs);
    server.close();

    const winners = results.filter((r) => r.status === 201).map((r) => r.body.seats as string[]);
    const held = winners.flat();
    expect(new Set(held).size).toBe(held.length); // no seat appears in two winning holds
    expect(winners.length).toBeLessThanOrEqual(2); // at most 2 disjoint pairs fit in 4 seats
    const dbRows = db.prepare('SELECT seat_no FROM seat_holds WHERE trip_id = ?').all(tripId) as { seat_no: string }[];
    expect(dbRows.map((r) => r.seat_no).sort()).toEqual([...held].sort());
  });

  it('8 threads with separate DB connections (like separate API instances) racing for one seat -> exactly one wins', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abhibus-'));
    const file = path.join(dir, 'race.db');
    const { c, db } = setup({ file });
    const { tripId, seats } = freeSeats(c, 1);
    const userIds = Array.from({ length: 8 }, (_, i) => createUser(db, `thread${i}@test.dev`));
    db.close();

    const flag = new SharedArrayBuffer(8);
    const gate = new Int32Array(flag);
    const workers = userIds.map(
      (userId) =>
        new Worker(new URL('./fixtures/holdWorker.ts', import.meta.url), {
          workerData: { file, userId, tripId, seats, now: T0, flag },
          execArgv: ['--import', 'tsx'],
        }),
    );
    const results = workers.map(
      (w) => new Promise<{ ok: boolean; code?: string }>((resolve, reject) => { w.once('message', resolve); w.once('error', reject); }),
    );
    // Wait until every worker has opened its connection and is parked on the gate, then fire.
    while (Atomics.load(gate, 1) < workers.length) await new Promise((r) => setTimeout(r, 10));
    Atomics.store(gate, 0, 1);
    Atomics.notify(gate, 0);

    const out = await Promise.all(results);
    await Promise.all(workers.map((w) => w.terminate()));
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    expect(out.filter((r) => !r.ok).every((r) => r.code === 'SEAT_UNAVAILABLE')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 30_000);
});
