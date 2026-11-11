import type { Booking } from '../types';
import { formatDate, formatFare, formatTime } from '../lib/format';

export function BookingTicket({ booking, onCancel, cancelling }: { booking: Booking; onCancel?: () => void; cancelling?: boolean }) {
  const t = booking.trip;
  const cancelled = booking.status === 'CANCELLED';
  return (
    <article className={`ticket ${cancelled ? 'ticket--cancelled' : ''}`}>
      <div className="ticket__main">
        <p className="muted small">PNR <strong>{booking.id}</strong></p>
        <h3>{t.fromCity} → {t.toCity}</h3>
        <p>{formatDate(t.departure)} · {formatTime(t.departure)} – {formatTime(t.arrival)}</p>
        <p className="muted">{t.operator} · {t.busName}</p>
        <p className="muted small">Boarding: {t.boardingPoint} · Drop: {t.droppingPoint}</p>
      </div>
      <div className="ticket__side">
        <span className={`badge ${cancelled ? 'badge--grey' : 'badge--green'}`}>{booking.status}</span>
        <p>Seats <strong>{booking.seats.join(', ')}</strong></p>
        <p className="ticket__fare">{formatFare(booking.totalFare)}</p>
        {booking.refundAmount !== undefined && <p className="small">Refund {formatFare(booking.refundAmount)} ({booking.refundPercent}%)</p>}
        {onCancel && !cancelled && (
          <button className="btn btn--ghost" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel ticket'}</button>
        )}
      </div>
    </article>
  );
}
