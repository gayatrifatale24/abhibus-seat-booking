import { randomBytes } from 'node:crypto';
import type { DB } from '../db/connection.js';
import { AppError, notFound } from '../errors.js';
import type { TripRepository } from '../repositories/tripRepository.js';
import type { HoldRepository } from '../repositories/holdRepository.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { SeatEvents } from '../realtime/events.js';
import type { Passenger } from '../types.js';

interface Deps { db: DB; trips: TripRepository; holds: HoldRepository; bookings: BookingRepository; events: SeatEvents; now: () => number }

const newBookingId = () => `AB${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

/** Simple, explicit cancellation policy (documented in README). */
export function refundFor(totalFare: number, departureMs: number, nowMs: number) {
  const hoursLeft = (departureMs - nowMs) / 3_600_000;
  const pct = hoursLeft >= 24 ? 90 : hoursLeft >= 6 ? 50 : 0;
  return { refundPercent: pct, refundAmount: Math.round((totalFare * pct) / 100) };
}

export function createBookingService(d: Deps) {
  function confirm(userId: number, input: { holdId: string; passengers: Passenger[]; contactPhone: string }) {
    const now = d.now();
    const tx = d.db.transaction(() => {
      const rows = d.holds.byHoldId(input.holdId);
      if (!rows.length) throw new AppError(410, 'HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
      if (rows[0].userId !== userId) throw new AppError(403, 'FORBIDDEN', 'This hold belongs to someone else');
      if (rows[0].expiresAt <= now) {
        d.holds.deleteByHoldId(input.holdId);
        throw new AppError(410, 'HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
      }
      const tripId = rows[0].tripId;
      const heldSeats = rows.map((r) => r.seatNo).sort();
      const paxSeats = input.passengers.map((p) => p.seatNo).sort();
      if (heldSeats.join(',') !== paxSeats.join(',')) {
        throw new AppError(400, 'PASSENGER_SEAT_MISMATCH', 'Provide exactly one passenger per held seat', { heldSeats });
      }
      const seatInfo = d.trips.seats(tripId);
      const ladies = new Set(seatInfo.filter((s) => s.ladiesOnly).map((s) => s.seatNo));
      const wrong = input.passengers.filter((p) => ladies.has(p.seatNo) && p.gender !== 'F').map((p) => p.seatNo);
      if (wrong.length) {
        throw new AppError(400, 'LADIES_SEAT', `Seat(s) ${wrong.join(', ')} are reserved for female passengers`, { seats: wrong });
      }
      const fares = new Map(seatInfo.map((s) => [s.seatNo, s.fare]));
      const totalFare = heldSeats.reduce((sum, s) => sum + (fares.get(s) ?? 0), 0);
      const id = newBookingId();
      d.bookings.create({ id, tripId, userId, seats: heldSeats, passengers: input.passengers, totalFare, contactPhone: input.contactPhone, createdAt: now });
      d.holds.deleteByHoldId(input.holdId);
      return { id, tripId, heldSeats };
    });
    const { id, tripId, heldSeats } = tx.immediate();
    d.events.publish(tripId, heldSeats.map((seatNo) => ({ seatNo, status: 'BOOKED' as const })), now);
    return withTrip(d.bookings.findById(id)!);
  }

  function cancel(userId: number, bookingId: string) {
    const b = d.bookings.findById(bookingId);
    if (!b || b.userId !== userId) throw notFound('Booking');
    if (b.status === 'CANCELLED') throw new AppError(409, 'ALREADY_CANCELLED', 'This booking is already cancelled');
    const trip = d.trips.findById(b.tripId)!;
    const now = d.now();
    if (Date.parse(trip.departure) <= now) throw new AppError(409, 'TRIP_DEPARTED', 'Cannot cancel after departure');
    d.bookings.cancel(bookingId, now);
    d.events.publish(b.tripId, b.seats.map((seatNo) => ({ seatNo, status: 'AVAILABLE' as const })), now);
    return { ...withTrip(d.bookings.findById(bookingId)!), ...refundFor(b.totalFare, Date.parse(trip.departure), now) };
  }

  function withTrip<T extends { tripId: number }>(b: T) {
    return { ...b, trip: d.trips.findById(b.tripId) };
  }

  return {
    confirm,
    cancel,
    listMine: (userId: number) => d.bookings.findByUser(userId).map(withTrip),
    get(userId: number, id: string) {
      const b = d.bookings.findById(id);
      if (!b || b.userId !== userId) throw notFound('Booking');
      return withTrip(b);
    },
  };
}
export type BookingService = ReturnType<typeof createBookingService>;
