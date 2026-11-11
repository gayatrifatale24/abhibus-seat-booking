import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Hold, Seat, SeatsChangedEvent, Trip } from '../types';

/**
 * Owns everything about one trip's seat map:
 *  - initial load over REST
 *  - live deltas over Socket.IO (room per trip)
 *  - the current user's hold (create / replace / release), with protection
 *    against out-of-order responses when seats are clicked quickly.
 */
export function useTripSeats(tripId: number, userId: number | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState(false);
  const reqSeq = useRef(0);
  // The user's *intended* selection, updated synchronously on every click so that
  // fast consecutive clicks build on each other instead of on a stale `hold`.
  const [selected, setSelected] = useState<string[]>([]);
  const selRef = useRef<string[]>([]);
  const syncSelection = (h: Hold | null) => {
    selRef.current = h?.seats ?? [];
    setSelected(selRef.current);
  };

  const load = useCallback(async () => {
    try {
      const d = await api.trip(tripId);
      setTrip(d.trip);
      setSeats(d.seats);
      setHold(d.myHold);
      syncSelection(d.myHold);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tripId]);

  // Reload when the user changes (login reveals "your" held seats).
  useEffect(() => { load(); }, [load, userId]);

  useEffect(() => {
    const socket = getSocket();
    const join = () => { socket.emit('join:trip', tripId); setLive(true); };
    const onDisconnect = () => setLive(false);
    const onChange = (e: SeatsChangedEvent) => {
      if (e.tripId !== tripId) return;
      const byNo = new Map(e.changes.map((c) => [c.seatNo, c.status]));
      setSeats((prev) => prev.map((s) => (byNo.has(s.seatNo) ? { ...s, status: byNo.get(s.seatNo)! } : s)));
    };
    if (socket.connected) join();
    socket.on('connect', join); // also re-joins after a reconnect
    socket.on('disconnect', onDisconnect);
    socket.on('seats:changed', onChange);
    return () => {
      socket.emit('leave:trip', tripId);
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('seats:changed', onChange);
    };
  }, [tripId]);

  /** Replace the hold with exactly `next` seats (empty -> release). */
  const setSelection = useCallback(
    async (next: string[]) => {
      const seq = ++reqSeq.current;
      setPending(true);
      setError(null);
      try {
        if (next.length === 0) {
          if (holdRef.current) await api.release(holdRef.current.holdId);
          if (seq === reqSeq.current) setHold(null);
        } else {
          const h = await api.hold(tripId, next);
          // Ignore responses that arrive after a newer click was sent.
          if (seq === reqSeq.current) setHold(h);
        }
      } catch (e) {
        if (seq !== reqSeq.current) return;
        setError(e instanceof ApiError ? e.message : 'Could not update your seats');
        await load(); // resync with server truth
      } finally {
        if (seq === reqSeq.current) setPending(false);
      }
    },
    [tripId, load],
  );

  const toggleSeat = useCallback(
    (seatNo: string) => {
      const current = selRef.current;
      const next = current.includes(seatNo) ? current.filter((s) => s !== seatNo) : [...current, seatNo];
      selRef.current = next;
      setSelected(next);
      return setSelection(next);
    },
    [setSelection],
  );

  const expireHold = useCallback(() => {
    setHold(null);
    syncSelection(null);
    setError('Your seat hold expired. Please pick your seats again.');
    load();
  }, [load]);

  return { trip, seats, hold, selected, error, pending, live, toggleSeat, clearHold: () => { syncSelection(null); return setSelection([]); }, expireHold, reload: load, setError };
}
