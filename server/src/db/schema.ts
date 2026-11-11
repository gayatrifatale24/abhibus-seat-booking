import type Database from 'better-sqlite3';

export function migrate(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      bus_type TEXT NOT NULL CHECK (bus_type IN ('SLEEPER','SEATER')),
      bus_name TEXT NOT NULL,
      from_city TEXT NOT NULL,
      to_city TEXT NOT NULL,
      travel_date TEXT NOT NULL,
      departure TEXT NOT NULL,
      arrival TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      base_fare INTEGER NOT NULL,
      amenities TEXT NOT NULL,
      rating REAL NOT NULL,
      boarding_point TEXT NOT NULL,
      dropping_point TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trips_search ON trips(from_city, to_city, travel_date);
    CREATE TABLE IF NOT EXISTS seats (
      trip_id INTEGER NOT NULL REFERENCES trips(id),
      seat_no TEXT NOT NULL,
      deck TEXT NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      kind TEXT NOT NULL,
      fare INTEGER NOT NULL,
      ladies_only INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (trip_id, seat_no)
    );
    -- One row per held seat. The PRIMARY KEY makes a second concurrent hold
    -- on the same seat impossible at the storage layer.
    CREATE TABLE IF NOT EXISTS seat_holds (
      trip_id INTEGER NOT NULL,
      seat_no TEXT NOT NULL,
      hold_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (trip_id, seat_no),
      FOREIGN KEY (trip_id, seat_no) REFERENCES seats(trip_id, seat_no)
    );
    CREATE INDEX IF NOT EXISTS idx_holds_hold_id ON seat_holds(hold_id);
    CREATE INDEX IF NOT EXISTS idx_holds_expiry ON seat_holds(expires_at);
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK (status IN ('CONFIRMED','CANCELLED')),
      passengers TEXT NOT NULL,
      total_fare INTEGER NOT NULL,
      contact_phone TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cancelled_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS booking_seats (
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      trip_id INTEGER NOT NULL,
      seat_no TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (booking_id, seat_no)
    );
    -- A seat can be in at most one ACTIVE booking: the last line of defence
    -- against double booking even if application logic has a bug.
    CREATE UNIQUE INDEX IF NOT EXISTS uq_active_seat ON booking_seats(trip_id, seat_no) WHERE active = 1;
  `);
}
