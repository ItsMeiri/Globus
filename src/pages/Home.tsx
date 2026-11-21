import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Copy, Download, MoreHorizontal, Plus, Search, Sparkles, Trash2, Upload, Users } from 'lucide-react';
import type { Destination, Trip } from '../types';
import { AppHeader } from '../components/AppHeader';
import { CreateTripModal } from '../components/CreateTripModal';
import { toDestination } from '../components/DestinationPicker';
import { Empty, Menu } from '../components/ui';
import { askConfirm, notify } from '../components/dialogs';
import { CAN_DOWNLOAD } from '../lib/env';
import { DESTINATIONS } from '../data/destinations';
import { useStore } from '../store';
import { buildDemoTrip } from '../lib/demo';
import { exportTripJSON, readTripFile } from '../lib/io';
import { coverGradient, formatRange, today, tripStatus } from '../lib/utils';

export function Home() {
  const trips = useStore((s) => s.trips);
  const importTrip = useStore((s) => s.importTrip);
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ dest?: Destination; q?: string } | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const fileRef = useRef<HTMLInputElement>(null);

  const { upcoming, past } = useMemo(() => {
    const t = today();
    const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { upcoming: sorted.filter((x) => x.endDate >= t), past: sorted.filter((x) => x.endDate < t).reverse() };
  }, [trips]);
  const shown = filter === 'upcoming' ? upcoming : past;

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const id = importTrip(await readTripFile(f));
      navigate(`/trip/${id}`);
    } catch (e) {
      notify('Couldn’t import that file', (e as Error).message);
    }
  };

  return (
    <div className="home">
      <AppHeader>
        <nav className="header-actions">
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </nav>
      </AppHeader>

      <section className="hero">
        <div className="hero-inner">
          <h1>
            Plan your next <span className="grad-text">adventure</span>
          </h1>
          <p>Build itineraries, discover places, track bookings and split costs — all in one place.</p>
          <form
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              setModal({ q });
            }}
          >
            <Search size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where do you want to go?" aria-label="Destination" />
            <button className="btn primary">Start planning</button>
          </form>
          {trips.length === 0 && (
            <button className="link hero-demo" onClick={() => navigate(`/trip/${importTrip(buildDemoTrip())}`)}>
              <Sparkles size={14} /> Or explore a sample Paris trip
            </button>
          )}
        </div>
      </section>

      <main className="container">
        <section>
          <div className="section-head">
            <h2>Your trips</h2>
            <div className="seg">
              <button className={filter === 'upcoming' ? 'on' : ''} onClick={() => setFilter('upcoming')}>
                Upcoming <span className="count">{upcoming.length}</span>
              </button>
              <button className={filter === 'past' ? 'on' : ''} onClick={() => setFilter('past')}>
                Past <span className="count">{past.length}</span>
              </button>
            </div>
            <button className="btn primary sm" onClick={() => setModal({})}>
              <Plus size={16} /> New trip
            </button>
          </div>
          {shown.length === 0 ? (
            <Empty emoji={filter === 'upcoming' ? '🧳' : '📸'} title={filter === 'upcoming' ? 'No upcoming trips yet' : 'No past trips'}>
              {filter === 'upcoming' && (
                <div className="row gap">
                  <button className="btn primary" onClick={() => setModal({})}>
                    <Plus size={16} /> Plan a trip
                  </button>
                  <button className="btn ghost" onClick={() => navigate(`/trip/${importTrip(buildDemoTrip())}`)}>
                    <Sparkles size={16} /> Load sample trip
                  </button>
                </div>
              )}
            </Empty>
          ) : (
            <div className="trip-grid">
              {shown.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>Get inspired</h2>
            <span className="muted">Destinations with built-in travel guides</span>
          </div>
          <div className="inspo-grid">
            {DESTINATIONS.map((d) => (
              <button key={d.id} className="inspo-card" style={{ background: coverGradient(d.hue) }} onClick={() => setModal({ dest: toDestination(d) })}>
                <span className="inspo-emoji">{d.emoji}</span>
                <span className="inspo-text">
                  <strong>{d.name}</strong>
                  <small>{d.tagline}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer">
        Globus · Your trips are saved in this browser · Map data © OpenStreetMap contributors
      </footer>

      {modal && <CreateTripModal onClose={() => setModal(null)} initial={modal.dest} initialQuery={modal.q} />}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { deleteTrip, duplicateTrip } = useStore();
  const navigate = useNavigate();
  const status = tripStatus(trip.startDate, trip.endDate);
  const planned = trip.days.reduce((n, d) => n + d.items.length, 0);
  return (
    <article className="trip-card">
      <Link to={`/trip/${trip.id}`} className="trip-card-cover" style={{ background: coverGradient(trip.destination.hue) }}>
        <span className="trip-card-emoji">{trip.destination.emoji}</span>
        <span className={`badge badge-${status.kind}`}>{status.label}</span>
      </Link>
      <div className="trip-card-body">
        <div className="row between">
          <Link to={`/trip/${trip.id}`} className="trip-card-title">
            {trip.name}
          </Link>
          <Menu
            trigger={(toggle) => (
              <button className="icon-btn sm" onClick={toggle} aria-label="Trip actions">
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close();
                    const id = duplicateTrip(trip.id);
                    if (id) navigate(`/trip/${id}`);
                  }}
                >
                  <Copy size={14} /> Duplicate
                </button>
                {CAN_DOWNLOAD && (
                  <button
                    onClick={() => {
                      close();
                      exportTripJSON(trip);
                    }}
                  >
                    <Download size={14} /> Export
                  </button>
                )}
                <button
                  className="danger"
                  onClick={async () => {
                    close();
                    if (await askConfirm({ title: `Delete “${trip.name}”?`, message: 'This cannot be undone.', confirmLabel: 'Delete trip', danger: true })) deleteTrip(trip.id);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
          </Menu>
        </div>
        <div className="muted small">
          {trip.destination.name}, {trip.destination.country}
        </div>
        <div className="trip-card-meta">
          <span>
            <CalendarDays size={14} /> {formatRange(trip.startDate, trip.endDate)}
          </span>
          <span>
            <Users size={14} /> {trip.travelers.length}
          </span>
          <span>📍 {planned} planned</span>
        </div>
      </div>
    </article>
  );
}
