import type { DB } from '../db/connection.js';
import type { Booking, Passenger } from '../types.js';

interface BookingRow {
  id: string; tripId: number; userId: number; status: Booking['status']; passengers: string;
  totalFare: number; contactPhone: string; createdAt: number; cancelledAt: number | null;
}
const COLS = `id, trip_id AS tripId, user_id AS userId, status, passengers, total_fare AS totalFare,
  contact_phone AS contactPhone, created_at AS createdAt, cancelled_at AS cancelledAt`;

export function createBookingRepository(db: DB) {
  const bookedSeats = db.prepare('SELECT seat_no AS seatNo FROM booking_seats WHERE trip_id = ? AND active = 1');
  const insertBooking = db.prepare(`INSERT INTO bookings (id, trip_id, user_id, status, passengers, total_fare, contact_phone, created_at)
    VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)`);
  const insertSeat = db.prepare('INSERT INTO booking_seats (booking_id, trip_id, seat_no) VALUES (?, ?, ?)');
  const byId = db.prepare(`SELECT ${COLS} FROM bookings WHERE id = ?`);
  const byUser = db.prepare(`SELECT ${COLS} FROM bookings WHERE user_id = ? ORDER BY created_at DESC`);
  const seatsOf = db.prepare('SELECT seat_no AS seatNo FROM booking_seats WHERE booking_id = ? ORDER BY seat_no');
  const cancel = db.prepare(`UPDATE bookings SET status = 'CANCELLED', cancelled_at = ? WHERE id = ? AND status = 'CONFIRMED'`);
  const releaseSeats = db.prepare('UPDATE booking_seats SET active = 0 WHERE booking_id = ?');

  const hydrate = (r: BookingRow): Booking => ({
    ...r,
    passengers: JSON.parse(r.passengers) as Passenger[],
    seats: (seatsOf.all(r.id) as { seatNo: string }[]).map((s) => s.seatNo),
  });

  return {
    bookedSeatNos: (tripId: number) => new Set((bookedSeats.all(tripId) as { seatNo: string }[]).map((r) => r.seatNo)),
    create: (b: { id: string; tripId: number; userId: number; seats: string[]; passengers: Passenger[]; totalFare: number; contactPhone: string; createdAt: number }) => {
      insertBooking.run(b.id, b.tripId, b.userId, JSON.stringify(b.passengers), b.totalFare, b.contactPhone, b.createdAt);
      for (const s of b.seats) insertSeat.run(b.id, b.tripId, s);
    },
    findById: (id: string) => {
      const r = byId.get(id) as BookingRow | undefined;
      return r ? hydrate(r) : undefined;
    },
    findByUser: (userId: number) => (byUser.all(userId) as BookingRow[]).map(hydrate),
    cancel: (id: string, at: number) => {
      const changed = cancel.run(at, id).changes;
      if (changed) releaseSeats.run(id);
      return changed > 0;
    },
  };
}
export type BookingRepository = ReturnType<typeof createBookingRepository>;
