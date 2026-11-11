import { EventEmitter } from 'node:events';
import type { SeatStatus } from '../types.js';

export interface SeatChange { seatNo: string; status: SeatStatus }
export interface SeatsChangedEvent { tripId: number; changes: SeatChange[]; at: number }

/**
 * Domain event bus. Services publish here and know nothing about transport;
 * the Socket.IO adapter (realtime/socket.ts) subscribes and fans out to clients.
 * Swapping this for Kafka/Redis pub-sub in a multi-instance deployment would
 * not touch the services.
 */
export class SeatEvents extends EventEmitter {
  publish(tripId: number, changes: SeatChange[], at = Date.now()) {
    if (changes.length) this.emit('seats:changed', { tripId, changes, at } satisfies SeatsChangedEvent);
  }
  onSeatsChanged(fn: (e: SeatsChangedEvent) => void) {
    this.on('seats:changed', fn);
    return () => this.off('seats:changed', fn);
  }
}
