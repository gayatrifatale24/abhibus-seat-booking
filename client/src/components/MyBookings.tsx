import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Booking } from '../types';
import { BookingTicket } from './BookingTicket';

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.bookings().then((r) => setBookings(r.bookings)).catch((e) => setError(e.message)); }, []);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this ticket? Refund follows the cancellation policy.')) return;
    setBusy(id);
    try {
      const updated = await api.cancel(id);
      setBookings((bs) => bs?.map((b) => (b.id === id ? updated : b)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h2>My bookings</h2>
      <p className="muted small">Cancellation policy: 90% refund 24h+ before departure, 50% between 6–24h, none after that.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      {!bookings ? <p>Loading…</p> : bookings.length === 0 ? <div className="empty">No bookings yet.</div> : (
        <div className="stack">{bookings.map((b) => <BookingTicket key={b.id} booking={b} onCancel={() => cancel(b.id)} cancelling={busy === b.id} />)}</div>
      )}
    </section>
  );
}
