import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
/** One shared connection for the whole app (same origin; Vite proxies /socket.io in dev). */
export function getSocket(): Socket {
  if (!socket) socket = io({ transports: ['websocket', 'polling'] });
  return socket;
}
