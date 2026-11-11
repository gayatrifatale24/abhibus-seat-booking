import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTripSeats } from '../hooks/useTripSeats';
import { api, ApiError } from '../lib/api';
import { formatDate, formatDuration, formatFare, formatTime } from '../lib/format';
import type { Booking } from '../types';
import { SeatMap } from './SeatMap';
import { HoldTimer } from './HoldTimer';
import { PassengerForm } from './PassengerForm';

interface Props { tripId: number; onBack: () => void; onBooked: (b: Booking) => void; requireLogin: () => void }

export function SeatSelection({ tripId, onBack, onBooked, requireLogin }: Props) {
  const { user } = useAuth();
  const s = useTripSeats(tripId, user?.id);
  const [submitting, setSubmitting] = useState(false);

  const fareOf = useMemo(() => new Map(s.seats.map((x) => [x.seatNo, x.fare])), [s.seats]);
  const total = s.selected.reduce((sum, no) => sum + (fareOf.get(no) ?? 0), 0);
  const available = s.seats.filter((x) => x.status === 'AVAILABLE').length;

  const onToggle = (seatNo: string) => {
    if (!user) return requireLogin();
    if (!s.selected.includes(seatNo) && s.selected.length >= 6) return s.setError('You can select up to 6 seats');
    s.toggleSeat(seatNo);
  };

  const confirm = async (passengers: Parameters<typeof api.confirm>[1], phone: string) => {
    if (!s.hold) return;
    setSubmitting(true);
    try {
      onBooked(await api.confirm(s.hold.holdId, passengers, phone));
    } catch (e) {
      s.setError(e instanceof ApiError ? e.message : 'Booking failed');
      if (e instanceof ApiError && e.status === 410) s.expireHold();
    } finally {
      setSubmitting(false);
    }
  };

  if (!s.trip) return <div className="card pad">{s.error ?? 'Loading seat layout…'}</div>;
  const t = s.trip;
  const holdReady = s.hold && !s.pending && s.hold.seats.join() === [...s.selected].sort().join();

  return (
    <div className="select">
      <button className="link back" onClick={onBack}>← Back to results</button>
      <header className="card select__head">
        <div>
          <h2>{t.operator}</h2>
          <p className="muted">{t.busName}</p>
        </div>
        <div className="select__route">
          <strong>{formatTime(t.departure)}</strong> {t.fromCity} <span className="muted">({t.boardingPoint})</span>
          <span className="select__arrow">→</span>
          <strong>{formatTime(t.arrival)}</strong> {t.toCity} <span className="muted">({t.droppingPoint})</span>
          <p className="muted small">{formatDate(t.departure)} · {formatDuration(t.durationMins)}</p>
        </div>
        <span className={`live ${s.live ? 'live--on' : ''}`} title="Seat availability updates in real time">
          <span className="live__dot" /> {s.live ? 'Live' : 'Connecting…'}
        </span>
      </header>

      <div className="select__body">
        <div className="card pad">
          <p className="muted small">{available} seats available · click a seat to hold it for 5 minutes</p>
          <SeatMap seats={s.seats} selected={s.selected} onToggle={onToggle} disabled={submitting} />
        </div>

        <aside className="card pad summary" aria-label="Booking summary">
          <h3>Your booking</h3>
          {s.error && <p className="alert" role="alert">{s.error}</p>}
          {s.selected.length === 0 ? (
            <p className="muted">{user ? 'Pick up to 6 seats from the layout.' : 'Log in, then pick your seats.'}</p>
          ) : (
            <>
              <dl className="summary__rows">
                <dt>Seats</dt><dd>{[...s.selected].sort().join(', ')}</dd>
                <dt>Fare</dt><dd>{formatFare(total)}</dd>
              </dl>
              {s.hold && <HoldTimer expiresAt={s.hold.expiresAt} onExpire={s.expireHold} />}
              {s.pending && <p className="muted small">Locking seats…</p>}
              {holdReady && (
                <>
                  <PassengerForm seats={s.hold!.seats} ladiesSeats={s.seats.filter((x) => x.ladiesOnly).map((x) => x.seatNo)} defaultName={user?.name} submitting={submitting} onSubmit={confirm} />
                  <button className="link small" onClick={s.clearHold}>Release seats</button>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
