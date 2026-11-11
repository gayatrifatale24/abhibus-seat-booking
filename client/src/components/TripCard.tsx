import { memo } from 'react';
import type { TripSummary } from '../types';
import { formatDuration, formatFare, formatTime, nextDay } from '../lib/format';

export const TripCard = memo(function TripCard({ trip, onSelect }: { trip: TripSummary; onSelect: (t: TripSummary) => void }) {
  const soldOut = trip.availableSeats <= 0;
  const few = !soldOut && trip.availableSeats <= 8;
  return (
    <article className="trip" aria-label={`${trip.operator} ${formatTime(trip.departure)}`}>
      <div className="trip__op">
        <h3>{trip.operator}</h3>
        <p className="muted">{trip.busName}</p>
        <span className={`rating ${trip.rating >= 4.2 ? 'rating--good' : ''}`} title="Rating">★ {trip.rating.toFixed(1)}</span>
      </div>
      <div className="trip__times">
        <div>
          <strong className="trip__time">{formatTime(trip.departure)}</strong>
          <p className="muted">{trip.boardingPoint}</p>
        </div>
        <div className="trip__dur">
          <span>{formatDuration(trip.durationMins)}</span>
          <span className="trip__line" aria-hidden />
        </div>
        <div>
          <strong className="trip__time">
            {formatTime(trip.arrival)}
            {nextDay(trip.departure, trip.arrival) && <sup className="trip__nextday">+1</sup>}
          </strong>
          <p className="muted">{trip.droppingPoint}</p>
        </div>
      </div>
      <div className="trip__amenities">
        {trip.amenities.slice(0, 4).map((a) => <span key={a} className="chip">{a}</span>)}
        {trip.amenities.length > 4 && <span className="chip chip--more">+{trip.amenities.length - 4}</span>}
      </div>
      <div className="trip__cta">
        <p className="muted small">Starts from</p>
        <p className="trip__fare">{formatFare(trip.minFare)}</p>
        <p className={`small ${few ? 'warn' : 'muted'}`}>{soldOut ? 'Sold out' : `${trip.availableSeats} seats left`}</p>
        <button className="btn btn--primary" onClick={() => onSelect(trip)} disabled={soldOut}>
          {soldOut ? 'Sold out' : 'View seats'}
        </button>
      </div>
    </article>
  );
});
