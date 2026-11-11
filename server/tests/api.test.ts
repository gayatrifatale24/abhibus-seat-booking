import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { setup, freeSeats, TODAY, TOMORROW } from './helpers.js';
import { createApp } from '../src/app.js';
import { attachSocket } from '../src/realtime/socket.js';
import { DEMO_USER } from '../src/db/seed.js';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

function start() {
  const ctx = setup();
  const server = http.createServer(createApp(ctx.c));
  const io = attachSocket(server, ctx.c.events);
  server.listen(0);
  cleanups.push(() => { io.close(); server.close(); });
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { ...ctx, server, url };
}

const login = async (server: http.Server) =>
  (await request(server).post('/api/auth/login').send({ email: DEMO_USER.email, password: DEMO_USER.password })).body.token as string;

describe('REST API', () => {
  it('auth: register, login, me, bad credentials, protected routes', async () => {
    const { server } = start();
    const reg = await request(server).post('/api/auth/register').send({ name: 'Gayatri', email: 'g@test.dev', password: 'secret123' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();
    expect(reg.body.user).not.toHaveProperty('passwordHash');

    const dup = await request(server).post('/api/auth/register').send({ name: 'Gayatri', email: 'g@test.dev', password: 'secret123' });
    expect(dup.status).toBe(409);

    const bad = await request(server).post('/api/auth/login').send({ email: 'g@test.dev', password: 'nope' });
    expect(bad.status).toBe(401);

    const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.body.user.email).toBe('g@test.dev');

    expect((await request(server).get('/api/bookings')).status).toBe(401);
    expect((await request(server).get('/api/bookings').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('search validates input and hides buses that already departed', async () => {
    const { server } = start();
    expect((await request(server).get('/api/trips/search?from=Hyderabad&to=Bengaluru&date=12-11-2026')).status).toBe(400);
    const today = await request(server).get(`/api/trips/search?from=Hyderabad&to=Bengaluru&date=${TODAY}`);
    // Test clock is 10:00 IST: nothing departing before that should be listed.
    for (const t of today.body.trips) expect(Date.parse(t.departure)).toBeGreaterThan(Date.parse(`${TODAY}T10:00:00+05:30`));
    const res = await request(server).get(`/api/trips/search?from=hyderabad&to=bengaluru&date=${TOMORROW}`);
    expect(res.status).toBe(200);
    expect(res.body.trips.length).toBeGreaterThan(0);
    expect(res.body.trips[0]).toMatchObject({ fromCity: 'Hyderabad', toCity: 'Bengaluru', availableSeats: expect.any(Number) });
  });

  it('full flow: hold -> confirm -> list -> cancel', async () => {
    const { server, c } = start();
    const token = await login(server);
    const auth = { Authorization: `Bearer ${token}` };
    const { tripId, seats } = freeSeats(c, 2);

    const hold = await request(server).post(`/api/trips/${tripId}/holds`).set(auth).send({ seats });
    expect(hold.status).toBe(201);

    const trip = await request(server).get(`/api/trips/${tripId}`).set(auth);
    expect(trip.body.myHold.holdId).toBe(hold.body.holdId);

    const badPhone = await request(server).post('/api/bookings').set(auth).send({
      holdId: hold.body.holdId, contactPhone: '12345',
      passengers: seats.map((seatNo) => ({ seatNo, name: 'Asha', age: 29, gender: 'F' })),
    });
    expect(badPhone.status).toBe(400);
    expect(badPhone.body.error.code).toBe('VALIDATION_ERROR');

    const booked = await request(server).post('/api/bookings').set(auth).send({
      holdId: hold.body.holdId, contactPhone: '9876543210',
      passengers: seats.map((seatNo) => ({ seatNo, name: 'Asha', age: 29, gender: 'F' })),
    });
    expect(booked.status).toBe(201);
    expect(booked.body.trip.id).toBe(tripId);

    const list = await request(server).get('/api/bookings').set(auth);
    expect(list.body.bookings.map((b: { id: string }) => b.id)).toContain(booked.body.id);

    const cancel = await request(server).post(`/api/bookings/${booked.body.id}/cancel`).set(auth);
    expect(cancel.status).toBe(200);
    expect(cancel.body).toMatchObject({ status: 'CANCELLED', refundPercent: 90 });
  });

  it('unknown routes and trips return JSON 404s', async () => {
    const { server } = start();
    expect((await request(server).get('/api/nope')).status).toBe(404);
    const t = await request(server).get('/api/trips/999999');
    expect(t.status).toBe(404);
    expect(t.body.error.code).toBe('NOT_FOUND');
  });
});

describe('real-time seat updates (Socket.IO)', () => {
  const connect = (url: string) =>
    new Promise<Socket>((resolve) => {
      const s = ioClient(url, { transports: ['websocket'] });
      cleanups.push(() => s.close());
      s.on('connect', () => resolve(s));
    });

  it('a second tab watching the trip sees holds, bookings and releases instantly', async () => {
    const { server, url, c } = start();
    const token = await login(server);
    const { tripId, seats } = freeSeats(c, 1);

    const watcher = await connect(url);
    const other = await connect(url);
    watcher.emit('join:trip', tripId);
    other.emit('join:trip', tripId + 1); // different trip: must NOT receive this trip's events
    await new Promise((r) => setTimeout(r, 50));

    const received: unknown[] = [];
    const leaked: unknown[] = [];
    watcher.on('seats:changed', (e) => received.push(e));
    other.on('seats:changed', (e) => leaked.push(e));

    const hold = await request(server).post(`/api/trips/${tripId}/holds`).set('Authorization', `Bearer ${token}`).send({ seats });
    await request(server).delete(`/api/holds/${hold.body.holdId}`).set('Authorization', `Bearer ${token}`);
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toEqual([
      expect.objectContaining({ tripId, changes: [{ seatNo: seats[0], status: 'HELD' }] }),
      expect.objectContaining({ tripId, changes: [{ seatNo: seats[0], status: 'AVAILABLE' }] }),
    ]);
    expect(leaked).toHaveLength(0);
  });
});
