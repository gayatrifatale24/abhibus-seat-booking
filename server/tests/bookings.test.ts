import { describe, expect, it } from 'vitest';
import { setup, freeSeats, TOMORROW } from './helpers.js';
import { refundFor } from '../src/services/bookingService.js';

const pax = (seats: string[]) => seats.map((seatNo, i) => ({ seatNo, name: `Passenger ${i + 1}`, age: 30, gender: 'F' as const }));

describe('bookings', () => {
  it('confirms a hold into a booking, marks seats BOOKED and clears the hold', () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 2);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    const booking = c.bookings.confirm(users[0], { holdId: hold.holdId, passengers: pax(seats), contactPhone: '9876543210' });
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.totalFare).toBe(hold.totalFare);
    const view = c.trips.getTrip(tripId, users[0]);
    expect(seats.map((s) => view.seats.find((x) => x.seatNo === s)!.status)).toEqual(['BOOKED', 'BOOKED']);
    expect(view.myHold).toBeNull();
    // Booked seats can't be held by anyone.
    expect(() => c.holds.holdSeats(users[1], tripId, [seats[0]])).toThrowError(/already booked/);
  });

  it('rejects an expired hold with 410', () => {
    const { c, users, clock } = setup({ ttlMs: 1_000 });
    const { tripId, seats } = freeSeats(c, 1);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    clock.now += 1_001;
    expect(() => c.bookings.confirm(users[0], { holdId: hold.holdId, passengers: pax(seats), contactPhone: '9876543210' }))
      .toThrowError(expect.objectContaining({ status: 410, code: 'HOLD_EXPIRED' }));
  });

  it("rejects confirming someone else's hold and passenger/seat mismatch", () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 2);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    expect(() => c.bookings.confirm(users[1], { holdId: hold.holdId, passengers: pax(seats), contactPhone: '9876543210' }))
      .toThrowError(expect.objectContaining({ status: 403 }));
    expect(() => c.bookings.confirm(users[0], { holdId: hold.holdId, passengers: pax([seats[0]]), contactPhone: '9876543210' }))
      .toThrowError(expect.objectContaining({ code: 'PASSENGER_SEAT_MISMATCH' }));
  });

  it('enforces ladies-only seats at confirmation', () => {
    const { c, users } = setup();
    const trip = c.trips.search('Hyderabad', 'Bengaluru', TOMORROW).find((t) => {
      const s = c.trips.getTrip(t.id).seats.find((x) => x.ladiesOnly);
      return s && s.status === 'AVAILABLE';
    })!;
    const ladiesSeat = c.trips.getTrip(trip.id).seats.find((x) => x.ladiesOnly)!.seatNo;
    const hold = c.holds.holdSeats(users[0], trip.id, [ladiesSeat]);
    expect(() => c.bookings.confirm(users[0], { holdId: hold.holdId, contactPhone: '9876543210', passengers: [{ seatNo: ladiesSeat, name: 'Ravi', age: 30, gender: 'M' }] }))
      .toThrowError(expect.objectContaining({ code: 'LADIES_SEAT' }));
    expect(c.bookings.confirm(users[0], { holdId: hold.holdId, contactPhone: '9876543210', passengers: [{ seatNo: ladiesSeat, name: 'Asha', age: 30, gender: 'F' }] }).status)
      .toBe('CONFIRMED');
  });

  it('cancelling releases seats and applies the refund policy', () => {
    const { c, users } = setup();
    const { tripId, seats } = freeSeats(c, 1);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    const b = c.bookings.confirm(users[0], { holdId: hold.holdId, passengers: pax(seats), contactPhone: '9876543210' });
    const cancelled = c.bookings.cancel(users[0], b.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.refundAmount).toBeGreaterThan(0);
    expect(c.trips.getTrip(tripId).seats.find((s) => s.seatNo === seats[0])!.status).toBe('AVAILABLE');
    expect(() => c.bookings.cancel(users[0], b.id)).toThrowError(/already cancelled/);
    expect(() => c.bookings.cancel(users[1], b.id)).toThrowError(/not found/);
    // The freed seat can be booked again.
    expect(() => c.holds.holdSeats(users[1], tripId, seats)).not.toThrow();
  });

  it('refund policy: 90% >=24h, 50% >=6h, 0% otherwise', () => {
    const dep = Date.parse(`${TOMORROW}T22:00:00+05:30`);
    const h = 3_600_000;
    expect(refundFor(1000, dep, dep - 30 * h)).toEqual({ refundPercent: 90, refundAmount: 900 });
    expect(refundFor(1000, dep, dep - 10 * h)).toEqual({ refundPercent: 50, refundAmount: 500 });
    expect(refundFor(1000, dep, dep - 1 * h)).toEqual({ refundPercent: 0, refundAmount: 0 });
  });

  it('database unique index blocks double booking even if service logic were bypassed', () => {
    const { c, db, users } = setup();
    const { tripId, seats } = freeSeats(c, 1);
    const hold = c.holds.holdSeats(users[0], tripId, seats);
    c.bookings.confirm(users[0], { holdId: hold.holdId, passengers: pax(seats), contactPhone: '9876543210' });
    db.prepare(`INSERT INTO bookings (id, trip_id, user_id, status, passengers, total_fare, contact_phone, created_at)
      VALUES ('ROGUE', ?, ?, 'CONFIRMED', '[]', 0, '0', 0)`).run(tripId, users[1]);
    expect(() => db.prepare('INSERT INTO booking_seats (booking_id, trip_id, seat_no) VALUES (?, ?, ?)').run('ROGUE', tripId, seats[0]))
      .toThrowError(/UNIQUE constraint failed/);
  });
});
