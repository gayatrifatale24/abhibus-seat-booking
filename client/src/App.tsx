import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import { formatDate } from './lib/format';
import type { Booking, TripSummary } from './types';
import { SearchForm, type SearchQuery } from './components/SearchForm';
import { TripResults } from './components/TripResults';
import { SeatSelection } from './components/SeatSelection';
import { LoginModal } from './components/LoginModal';
import { MyBookings } from './components/MyBookings';
import { BookingTicket } from './components/BookingTicket';

type View = { name: 'search' } | { name: 'seats'; tripId: number } | { name: 'done'; booking: Booking } | { name: 'bookings' };

export default function App() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>({ name: 'search' });
  const [cities, setCities] = useState<string[]>([]);
  const [query, setQuery] = useState<SearchQuery | null>(null);
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => { api.cities().then((r) => setCities(r.cities)).catch(() => setError('Cannot reach the API. Is the server running?')); }, []);

  const search = useCallback(async (q: SearchQuery) => {
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      setTrips((await api.search(q.from, q.to, q.date)).trips);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const backToResults = () => { setView({ name: 'search' }); if (query) search(query); };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'search' })}>
          <span className="brand__logo">abhi</span><span className="brand__bus">bus</span>
          <span className="brand__tag">seat booking prototype</span>
        </button>
        <nav className="topbar__nav">
          {user ? (
            <>
              <button className="link" onClick={() => setView({ name: 'bookings' })}>My bookings</button>
              <span className="avatar" title={user.email}>{user.name.slice(0, 1).toUpperCase()}</span>
              <button className="link" onClick={logout}>Log out</button>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={() => setShowLogin(true)}>Log in</button>
          )}
        </nav>
      </header>

      <main className="container">
        {view.name === 'search' && (
          <>
            <section className="hero">
              <h1>Book bus tickets with live seat availability</h1>
              <p>Seats you pick are locked for 5 minutes and update instantly for every traveller.</p>
              {cities.length > 0 && <SearchForm cities={cities} initial={query ?? undefined} onSearch={search} loading={loading} />}
            </section>
            {error && <p className="alert" role="alert">{error}</p>}
            {query && trips && (
              <>
                <h2 className="results__title">{query.from} → {query.to} <span className="muted">· {formatDate(query.date)}</span></h2>
                <TripResults trips={trips} onSelect={(t) => setView({ name: 'seats', tripId: t.id })} />
              </>
            )}
          </>
        )}
        {view.name === 'seats' && (
          <SeatSelection
            tripId={view.tripId}
            onBack={backToResults}
            onBooked={(b) => setView({ name: 'done', booking: b })}
            requireLogin={() => setShowLogin(true)}
          />
        )}
        {view.name === 'done' && (
          <section className="done">
            <div className="done__icon" aria-hidden>✓</div>
            <h2>Booking confirmed</h2>
            <p className="muted">Your e-ticket is below and in My bookings.</p>
            <BookingTicket booking={view.booking} />
            <div className="row">
              <button className="btn btn--primary" onClick={() => setView({ name: 'bookings' })}>View my bookings</button>
              <button className="btn btn--ghost" onClick={() => setView({ name: 'search' })}>Book another</button>
            </div>
          </section>
        )}
        {view.name === 'bookings' && (user ? <MyBookings /> : <p>Please log in.</p>)}
      </main>
      <footer className="footer muted small">Prototype for the AbhiBus Full Stack Developer application · sample data only</footer>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
