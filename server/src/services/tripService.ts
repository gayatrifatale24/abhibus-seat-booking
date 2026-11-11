import { notFound } from '../errors.js';
import type { TripRepository } from '../repositories/tripRepository.js';
import type { HoldRepository } from '../repositories/holdRepository.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { SeatView } from '../types.js';

export function createTripService(deps: { trips: TripRepository; holds: HoldRepository; bookings: BookingRepository; now: () => number }) {
  const { trips, holds, bookings, now } = deps;
  return {
    cities: () => trips.cities(),
    routes: () => trips.routes(),
    search(from: string, to: string, date: string) {
      const at = now();
      return trips
        .search(from, to, date, at)
        // Hide buses that have already left (matters when searching for "today").
        .filter((t) => Date.parse(t.departure) > at)
        .map(({ bookedSeats, heldSeats, ...t }) => ({
        ...t,
        availableSeats: t.totalSeats - bookedSeats - heldSeats,
      }));
    },
    /** Trip + seat map. `userId` (optional) lets us mark the caller's own held seats. */
    getTrip(tripId: number, userId?: number) {
      const trip = trips.findById(tripId);
      if (!trip) throw notFound('Trip');
      const booked = bookings.bookedSeatNos(tripId);
      const active = holds.activeForTrip(tripId, now());
      const heldBy = new Map(active.map((h) => [h.seatNo, h]));
      const seats: SeatView[] = trips.seats(tripId).map((s) => {
        const h = heldBy.get(s.seatNo);
        return {
          ...s,
          status: booked.has(s.seatNo) ? 'BOOKED' : h ? 'HELD' : 'AVAILABLE',
          heldByYou: !!h && h.userId === userId,
        };
      });
      const mine = active.filter((h) => h.userId === userId);
      const myHold = mine.length
        ? { holdId: mine[0].holdId, expiresAt: mine[0].expiresAt, seats: mine.map((h) => h.seatNo).sort() }
        : null;
      return { trip, seats, myHold };
    },
  };
}
export type TripService = ReturnType<typeof createTripService>;
