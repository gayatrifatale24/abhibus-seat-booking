import type { DB } from './db/connection.js';
import { config } from './config.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createTripRepository } from './repositories/tripRepository.js';
import { createHoldRepository } from './repositories/holdRepository.js';
import { createBookingRepository } from './repositories/bookingRepository.js';
import { createAuthService } from './services/authService.js';
import { createTripService } from './services/tripService.js';
import { createHoldService } from './services/holdService.js';
import { createBookingService } from './services/bookingService.js';
import { SeatEvents } from './realtime/events.js';

export interface ContainerOptions { now?: () => number; holdTtlMs?: number; jwtSecret?: string }

/** Composition root: wires repositories -> services. Tests inject a fake clock / short TTL here. */
export function createContainer(db: DB, opts: ContainerOptions = {}) {
  const now = opts.now ?? Date.now;
  const events = new SeatEvents();
  const users = createUserRepository(db);
  const trips = createTripRepository(db);
  const holds = createHoldRepository(db);
  const bookings = createBookingRepository(db);
  return {
    db,
    events,
    auth: createAuthService(users, { secret: opts.jwtSecret ?? config.jwtSecret, expiresIn: config.jwtExpiresIn }),
    trips: createTripService({ trips, holds, bookings, now }),
    holds: createHoldService({ db, trips, holds, bookings, events, now, ttlMs: opts.holdTtlMs ?? config.holdTtlMs, maxSeats: config.maxSeatsPerHold }),
    bookings: createBookingService({ db, trips, holds, bookings, events, now }),
  };
}
export type Container = ReturnType<typeof createContainer>;
