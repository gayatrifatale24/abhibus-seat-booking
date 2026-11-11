import { useState, type FormEvent } from 'react';
import { todayIST } from '../lib/format';

export interface SearchQuery { from: string; to: string; date: string }

interface Props {
  cities: string[];
  initial?: Partial<SearchQuery>;
  onSearch: (q: SearchQuery) => void;
  loading?: boolean;
}

export function SearchForm({ cities, initial, onSearch, loading }: Props) {
  const [from, setFrom] = useState(initial?.from ?? 'Hyderabad');
  const [to, setTo] = useState(initial?.to ?? 'Bengaluru');
  const [date, setDate] = useState(initial?.date ?? todayIST());
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError('Choose both cities');
    if (from === to) return setError('From and To cannot be the same city');
    setError(null);
    onSearch({ from, to, date });
  };

  return (
    <form className="search" onSubmit={submit} aria-label="Search buses">
      <label className="search__field">
        <span>From</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From">
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button type="button" className="search__swap" aria-label="Swap cities" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
      <label className="search__field">
        <span>To</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To">
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="search__field">
        <span>Date of journey</span>
        <input type="date" value={date} min={todayIST()} onChange={(e) => setDate(e.target.value)} aria-label="Date of journey" required />
      </label>
      <button className="btn btn--primary search__submit" disabled={loading}>{loading ? 'Searching…' : 'Search buses'}</button>
      {error && <p role="alert" className="search__error">{error}</p>}
    </form>
  );
}
