import { useMemo, useState } from 'react';
import type { BusType, TripSummary } from '../types';
import { TripCard } from './TripCard';

type Sort = 'departure' | 'fare' | 'rating' | 'duration';
const SORTERS: Record<Sort, (a: TripSummary, b: TripSummary) => number> = {
  departure: (a, b) => a.departure.localeCompare(b.departure),
  fare: (a, b) => a.minFare - b.minFare,
  rating: (a, b) => b.rating - a.rating,
  duration: (a, b) => a.durationMins - b.durationMins,
};

export function TripResults({ trips, onSelect }: { trips: TripSummary[]; onSelect: (t: TripSummary) => void }) {
  const [sort, setSort] = useState<Sort>('departure');
  const [type, setType] = useState<BusType | 'ALL'>('ALL');
  const [nightOnly, setNightOnly] = useState(false);

  // Derived list is memoised so typing elsewhere doesn't re-sort; cards are memo()'d too.
  const visible = useMemo(
    () =>
      trips
        .filter((t) => type === 'ALL' || t.busType === type)
        .filter((t) => !nightOnly || Number(t.departure.slice(11, 13)) >= 18)
        .sort(SORTERS[sort]),
    [trips, sort, type, nightOnly],
  );

  return (
    <section className="results">
      <div className="results__bar">
        <p><strong>{visible.length}</strong> buses found</p>
        <div className="results__filters">
          <div className="segmented" role="group" aria-label="Bus type">
            {(['ALL', 'SLEEPER', 'SEATER'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={type === t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                {t === 'ALL' ? 'All' : t === 'SLEEPER' ? 'Sleeper' : 'Seater'}
              </button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={nightOnly} onChange={(e) => setNightOnly(e.target.checked)} /> After 6 PM</label>
          <label className="sort">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
              <option value="departure">Departure</option>
              <option value="fare">Cheapest</option>
              <option value="rating">Top rated</option>
              <option value="duration">Fastest</option>
            </select>
          </label>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="empty">No buses match. Try another date or remove filters.</div>
      ) : (
        <div className="results__list">{visible.map((t) => <TripCard key={t.id} trip={t} onSelect={onSelect} />)}</div>
      )}
    </section>
  );
}
