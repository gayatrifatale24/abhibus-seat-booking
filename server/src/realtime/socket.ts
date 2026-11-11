import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { SeatEvents } from './events.js';
import { config } from '../config.js';

/**
 * Socket.IO adapter. Clients `join:trip` when they open a seat map and receive
 * `seats:changed` deltas for that trip only (room per trip keeps fan-out small).
 */
export function attachSocket(server: HttpServer, events: SeatEvents) {
  const io = new Server(server, { cors: { origin: config.corsOrigin } });
  io.on('connection', (socket) => {
    socket.on('join:trip', (tripId: unknown) => {
      const id = Number(tripId);
      if (Number.isInteger(id) && id > 0) socket.join(`trip:${id}`);
    });
    socket.on('leave:trip', (tripId: unknown) => socket.leave(`trip:${Number(tripId)}`));
  });
  events.onSeatsChanged((e) => io.to(`trip:${e.tripId}`).emit('seats:changed', e));
  return io;
}
