import { randomUUID } from 'node:crypto';
import type { DB } from '../db/connection.js';
import { AppError, notFound } from '../errors.js';
import type { TripRepository } from '../repositories/tripRepository.js';
import type { HoldRepository } from '../repositories/holdRepository.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { SeatEvents, SeatChange } from '../realtime/events.js';

interface Deps {
  db: DB;
  trips: TripRepository;
  holds: HoldRepository;
  bookings: BookingRepository;
  events: SeatEvents;
  now: () => number;
  ttlMs: number;
  maxSeats: number;
}

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && String((e as { code: string }).code).startsWith('SQLITE_CONSTRAINT');

export function createHoldService(d: Deps) {
  /**
   * Atomically place a hold on `seatNos` for `userId`.
   * - All-or-nothing: either every requested seat is held or none is.
   * - Replaces the user's previous hold on the same trip (one active cart per trip).
   * - Runs in a single IMMEDIATE transaction; the seat_holds PRIMARY KEY (trip_id, seat_no)
   *   guarantees two holds can never coexist on a seat even under concurrency.
   */
  function holdSeats(userId: number, tripId: number, seatNos: string[]) {
    const unique = [...new Set(seatNos)];
    if (unique.length === 0) throw new AppError(400, 'NO_SEATS', 'Select at least one seat');
    if (unique.length > d.maxSeats) throw new AppError(400, 'TOO_MANY_SEATS', `You can hold at most ${d.maxSeats} seats`);
    const trip = d.trips.findById(tripId);
    if (!trip) throw notFound('Trip');
    if (Date.parse(trip.departure) <= d.now()) throw new AppError(409, 'TRIP_DEPARTED', 'This bus has already departed');
    const seatMap = new Map(d.trips.seats(tripId).map((s) => [s.seatNo, s]));
    const invalid = unique.filter((s) => !seatMap.has(s));
    if (invalid.length) throw new AppError(400, 'INVALID_SEATS', `Unknown seat(s): ${invalid.join(', ')}`, { seats: invalid });

    const now = d.now();
    const holdId = randomUUID();
    const expiresAt = now + d.ttlMs;

    const tx = d.db.transaction(() => {
      // Release this user's previous hold(s) on the trip first (cart replacement).
      const released: string[] = [];
      for (const oldId of d.holds.userHoldIdsOnTrip(tripId, userId)) {
        released.push(...d.holds.byHoldId(oldId).map((h) => h.seatNo));
        d.holds.deleteByHoldId(oldId);
      }
      const booked = d.bookings.bookedSeatNos(tripId);
      const alreadyBooked = unique.filter((s) => booked.has(s));
      if (alreadyBooked.length) {
        throw new AppError(409, 'SEAT_UNAVAILABLE', `Seat(s) already booked: ${alreadyBooked.join(', ')}`, { seats: alreadyBooked });
      }
      for (const seatNo of unique) {
        d.holds.deleteExpiredForSeat(tripId, seatNo, now);
        try {
          d.holds.insert(tripId, seatNo, holdId, userId, expiresAt);
        } catch (e) {
          if (isUniqueViolation(e)) {
            throw new AppError(409, 'SEAT_UNAVAILABLE', `Seat ${seatNo} is currently held by another traveller`, { seats: [seatNo] });
          }
          throw e;
        }
      }
      return released;
    });

    const released = tx.immediate();
    const changes: SeatChange[] = [
      ...released.filter((s) => !unique.includes(s)).map((seatNo) => ({ seatNo, status: 'AVAILABLE' as const })),
      ...unique.map((seatNo) => ({ seatNo, status: 'HELD' as const })),
    ];
    d.events.publish(tripId, changes, now);
    const totalFare = unique.reduce((sum, s) => sum + seatMap.get(s)!.fare, 0);
    return { holdId, tripId, seats: unique.sort(), expiresAt, totalFare };
  }

  function releaseHold(userId: number, holdId: string) {
    const rows = d.holds.byHoldId(holdId);
    if (!rows.length) throw notFound('Hold');
    if (rows[0].userId !== userId) throw new AppError(403, 'FORBIDDEN', 'This hold belongs to someone else');
    d.holds.deleteByHoldId(holdId);
    d.events.publish(rows[0].tripId, rows.map((r) => ({ seatNo: r.seatNo, status: 'AVAILABLE' as const })));
    return { released: rows.map((r) => r.seatNo) };
  }

  /** Called periodically: drop expired holds and broadcast the freed seats. */
  function purgeExpired() {
    const rows = d.holds.purgeExpired(d.now());
    const byTrip = new Map<number, string[]>();
    for (const r of rows) byTrip.set(r.tripId, [...(byTrip.get(r.tripId) ?? []), r.seatNo]);
    for (const [tripId, seats] of byTrip) {
      d.events.publish(tripId, seats.map((seatNo) => ({ seatNo, status: 'AVAILABLE' as const })));
    }
    return rows.length;
  }

  return { holdSeats, releaseHold, purgeExpired };
}
export type HoldService = ReturnType<typeof createHoldService>;
