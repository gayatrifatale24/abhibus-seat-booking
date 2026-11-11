import type { DB } from '../db/connection.js';

export interface HoldRow { tripId: number; seatNo: string; holdId: string; userId: number; expiresAt: number }

export function createHoldRepository(db: DB) {
  const activeForTrip = db.prepare(`SELECT trip_id AS tripId, seat_no AS seatNo, hold_id AS holdId, user_id AS userId, expires_at AS expiresAt
    FROM seat_holds WHERE trip_id = ? AND expires_at > ?`);
  const byHoldId = db.prepare(`SELECT trip_id AS tripId, seat_no AS seatNo, hold_id AS holdId, user_id AS userId, expires_at AS expiresAt
    FROM seat_holds WHERE hold_id = ?`);
  const insert = db.prepare('INSERT INTO seat_holds (trip_id, seat_no, hold_id, user_id, expires_at) VALUES (?, ?, ?, ?, ?)');
  const deleteExpiredForSeat = db.prepare('DELETE FROM seat_holds WHERE trip_id = ? AND seat_no = ? AND expires_at <= ?');
  const deleteByHoldId = db.prepare('DELETE FROM seat_holds WHERE hold_id = ?');
  const userHoldIdsOnTrip = db.prepare('SELECT DISTINCT hold_id AS holdId FROM seat_holds WHERE trip_id = ? AND user_id = ?');
  const expired = db.prepare('SELECT trip_id AS tripId, seat_no AS seatNo, hold_id AS holdId FROM seat_holds WHERE expires_at <= ?');
  const deleteExpired = db.prepare('DELETE FROM seat_holds WHERE expires_at <= ?');

  return {
    activeForTrip: (tripId: number, now: number) => activeForTrip.all(tripId, now) as HoldRow[],
    byHoldId: (holdId: string) => byHoldId.all(holdId) as HoldRow[],
    insert: (tripId: number, seatNo: string, holdId: string, userId: number, expiresAt: number) =>
      insert.run(tripId, seatNo, holdId, userId, expiresAt),
    deleteExpiredForSeat: (tripId: number, seatNo: string, now: number) => deleteExpiredForSeat.run(tripId, seatNo, now),
    deleteByHoldId: (holdId: string) => deleteByHoldId.run(holdId).changes,
    userHoldIdsOnTrip: (tripId: number, userId: number) => (userHoldIdsOnTrip.all(tripId, userId) as { holdId: string }[]).map((r) => r.holdId),
    /** Remove all expired holds; returns what was removed so callers can broadcast it. */
    purgeExpired: (now: number) => {
      const rows = expired.all(now) as { tripId: number; seatNo: string; holdId: string }[];
      if (rows.length) deleteExpired.run(now);
      return rows;
    },
  };
}
export type HoldRepository = ReturnType<typeof createHoldRepository>;
