import type { DB } from '../db/connection.js';
import type { Seat, Trip } from '../types.js';

const TRIP_COLS = `id, operator, bus_type AS busType, bus_name AS busName, from_city AS fromCity, to_city AS toCity,
  travel_date AS travelDate, departure, arrival, duration_mins AS durationMins, base_fare AS baseFare,
  amenities, rating, boarding_point AS boardingPoint, dropping_point AS droppingPoint`;

type TripRow = Omit<Trip, 'amenities'> & { amenities: string };
const toTrip = (r: TripRow): Trip => ({ ...r, amenities: JSON.parse(r.amenities) });

export interface TripSearchRow extends Trip { totalSeats: number; bookedSeats: number; heldSeats: number; minFare: number }

export function createTripRepository(db: DB) {
  const search = db.prepare(`
    SELECT ${TRIP_COLS},
      (SELECT COUNT(*) FROM seats s WHERE s.trip_id = t.id) AS totalSeats,
      (SELECT MIN(fare) FROM seats s WHERE s.trip_id = t.id) AS minFare,
      (SELECT COUNT(*) FROM booking_seats b WHERE b.trip_id = t.id AND b.active = 1) AS bookedSeats,
      (SELECT COUNT(*) FROM seat_holds h WHERE h.trip_id = t.id AND h.expires_at > @now) AS heldSeats
    FROM trips t
    WHERE from_city = @from COLLATE NOCASE AND to_city = @to COLLATE NOCASE AND travel_date = @date
    ORDER BY departure`);
  const byId = db.prepare(`SELECT ${TRIP_COLS} FROM trips WHERE id = ?`);
  const seats = db.prepare(`SELECT trip_id AS tripId, seat_no AS seatNo, deck, row, col, kind, fare, ladies_only AS ladiesOnly
    FROM seats WHERE trip_id = ? ORDER BY deck, row, col`);
  const cities = db.prepare(`SELECT DISTINCT from_city AS city FROM trips UNION SELECT DISTINCT to_city FROM trips ORDER BY 1`);
  const routes = db.prepare(`SELECT DISTINCT from_city AS fromCity, to_city AS toCity FROM trips ORDER BY 1, 2`);

  return {
    search: (from: string, to: string, date: string, now: number) =>
      (search.all({ from, to, date, now }) as (TripRow & Omit<TripSearchRow, keyof Trip>)[]).map((r) => ({ ...toTrip(r), totalSeats: r.totalSeats, bookedSeats: r.bookedSeats, heldSeats: r.heldSeats, minFare: r.minFare })),
    findById: (id: number) => {
      const r = byId.get(id) as TripRow | undefined;
      return r ? toTrip(r) : undefined;
    },
    seats: (tripId: number) =>
      (seats.all(tripId) as (Omit<Seat, 'ladiesOnly'> & { ladiesOnly: number })[]).map((s) => ({ ...s, ladiesOnly: !!s.ladiesOnly })),
    cities: () => (cities.all() as { city: string }[]).map((c) => c.city),
    routes: () => routes.all() as { fromCity: string; toCity: string }[],
  };
}
export type TripRepository = ReturnType<typeof createTripRepository>;
