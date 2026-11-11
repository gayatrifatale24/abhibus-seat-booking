import { describe, expect, it } from 'vitest';
import { setup, freeSeats } from './helpers.js';
import type { SeatsChangedEvent } from '../src/realtime/events.js';

describe('seat holds', () => {
  it('holds seats and shows them as HELD (and heldByYou only to the holder)', () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 2);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    expect(hold.seats).toEqual([...seats].sort());
    expect(hold.expiresAt).toBeGreaterThan(Date.now() - 1e12);

    const mine = c.trips.getTrip(tripId, users[0]);
    const theirs = c.trips.getTrip(tripId, users[1]);
    for (const s of seats) {
      expect(mine.seats.find((x) => x.seatNo === s)).toMatchObject({ status: 'HELD', heldByYou: true });
      expect(theirs.seats.find((x) => x.seatNo === s)).toMatchObject({ status: 'HELD', heldByYou: false });
    }
    expect(mine.myHold?.holdId).toBe(hold.holdId);
    expect(theirs.myHold).toBeNull();
  });

  it('rejects a second user trying to hold an already-held seat', () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 1);
    c.holds.holdSeats(users[0], tripId, seats);
    expect(() => c.holds.holdSeats(users[1], tripId, seats)).toThrowError(/held by another traveller/);
  });

  it('is all-or-nothing: a partially conflicting request holds nothing', () => {
    const { c, users } = setup();
    const { tripId, seats: [a, b] } = freeSeats(c, 2);
    c.holds.holdSeats(users[0], tripId, [b]);
    expect(() => c.holds.holdSeats(users[1], tripId, [a, b])).toThrow();
    const seatA = c.trips.getTrip(tripId).seats.find((s) => s.seatNo === a)!;
    expect(seatA.status).toBe('AVAILABLE');
  });

  it('frees seats after the TTL so someone else can hold them, and broadcasts it', () => {
    const { c, clock, users } = setup({ ttlMs: 60_000 });
    const { tripId, seats } = freeSeats(c, 1);
    c.holds.holdSeats(users[0], tripId, seats);

    clock.now += 59_000;
    expect(() => c.holds.holdSeats(users[1], tripId, seats)).toThrow();

    const events: SeatsChangedEvent[] = [];
    c.events.onSeatsChanged((e) => events.push(e));
    clock.now += 2_000; // now past expiry
    expect(c.trips.getTrip(tripId).seats.find((s) => s.seatNo === seats[0])!.status).toBe('AVAILABLE');
    expect(c.holds.purgeExpired()).toBe(1);
    expect(events).toEqual([{ tripId, changes: [{ seatNo: seats[0], status: 'AVAILABLE' }], at: expect.any(Number) }]);

    expect(() => c.holds.holdSeats(users[1], tripId, seats)).not.toThrow();
  });

  it('lets another user take an expired seat even before the sweeper has run (lazy expiry)', () => {
    const { c, clock, users } = setup({ ttlMs: 60_000 });
    const { tripId, seats } = freeSeats(c, 1);
    c.holds.holdSeats(users[0], tripId, seats);
    clock.now += 61_000; // expired, but purgeExpired() deliberately NOT called
    const h = c.holds.holdSeats(users[1], tripId, seats);
    expect(c.trips.getTrip(tripId, users[1]).myHold?.holdId).toBe(h.holdId);
  });

  it("replaces the user's previous hold on the same trip and releases the old seats", () => {
    const { c, users } = setup();
    const { tripId, seats: [a, b] } = freeSeats(c, 2);
    const first = c.holds.holdSeats(users[0], tripId, [a]);
    const events: SeatsChangedEvent[] = [];
    c.events.onSeatsChanged((e) => events.push(e));
    const second = c.holds.holdSeats(users[0], tripId, [b]);
    expect(second.holdId).not.toBe(first.holdId);
    const view = c.trips.getTrip(tripId, users[0]);
    expect(view.seats.find((s) => s.seatNo === a)!.status).toBe('AVAILABLE');
    expect(view.myHold?.seats).toEqual([b]);
    expect(events[0].changes).toEqual([{ seatNo: a, status: 'AVAILABLE' }, { seatNo: b, status: 'HELD' }]);
  });

  it('keeps the old hold if the replacement fails', () => {
    const { c, users } = setup();
    const { tripId, seats: [a, b] } = freeSeats(c, 2);
    c.holds.holdSeats(users[0], tripId, [a]);
    c.holds.holdSeats(users[1], tripId, [b]);
    expect(() => c.holds.holdSeats(users[0], tripId, [b])).toThrow();
    expect(c.trips.getTrip(tripId, users[0]).myHold?.seats).toEqual([a]);
  });

  it('validates seat numbers, seat count and departed trips', () => {
    const { c, users, clock } = setup();
    const { tripId, seats } = freeSeats(c, 1);
    expect(() => c.holds.holdSeats(users[0], tripId, ['Z99'])).toThrowError(/Unknown seat/);
    expect(() => c.holds.holdSeats(users[0], tripId, [])).toThrowError(/at least one/);
    expect(() => c.holds.holdSeats(users[0], tripId, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'])).toThrowError(/at most 6/);
    clock.now += 3 * 24 * 3_600_000;
    expect(() => c.holds.holdSeats(users[0], tripId, seats)).toThrowError(/departed/);
  });

  it('only the owner can release a hold', () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 1);
    const h = c.holds.holdSeats(users[0], tripId, seats);
    expect(() => c.holds.releaseHold(users[1], h.holdId)).toThrowError(/someone else/);
    expect(c.holds.releaseHold(users[0], h.holdId).released).toEqual(seats);
  });
});
