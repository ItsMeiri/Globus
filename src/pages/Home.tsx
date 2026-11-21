import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, Copy, Download, Luggage, MapPin, MoreHorizontal, Plus, Search, Sparkles, Trash2, Upload, Users } from 'lucide-react';
import type { Destination, Trip } from '../types';
import { Logo, ThemeToggle } from '../components/AppHeader';
import { Rail } from '../components/Shell';
import { CreateTripModal } from '../components/CreateTripModal';
import { toDestination } from '../components/DestinationPicker';
import { Empty, Menu, ProgressBar } from '../components/ui';
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
  const next = upcoming[0];
  const shown = filter === 'upcoming' ? upcoming.slice(next ? 1 : 0) : past;

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const id = importTrip(await readTripFile(f));
      navigate(`/trip/${id}`);
    } catch (e) {
      notify('Couldn’t import that file', (e as Error).message);
    }
  };
  const loadDemo = () => navigate(`/trip/${importTrip(buildDemoTrip())}`);
  const importBtn = (
    <button className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Import a trip file" title="Import a trip file">
      <Upload size={18} />
    </button>
  );

  return (
    <div className="shell">
      <Rail items={[{ to: '/', label: 'Trips', icon: Luggage, active: true }]} footer={importBtn} />
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />

      <div className="shell-main">
        <header className="appbar home-appbar">
          <span className="only-phone">
            <Logo />
          </span>
          <h1 className="appbar-title only-wide">My trips</h1>
          <div className="grow" />
          <span className="only-phone row">
            {importBtn}
            <ThemeToggle />
          </span>
          <button className="btn primary sm only-wide" onClick={() => setModal({})}>
            <Plus size={16} /> New trip
          </button>
        </header>

        <main className="home-body">
          <form
            className="where-card"
            onSubmit={(e) => {
              e.preventDefault();
              setModal({ q });
            }}
          >
            <div>
              <h2>Where to next?</h2>
              <p className="muted">Plan days, shortlist places, track bookings and split costs.</p>
            </div>
            <div className="where-search">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a destination" aria-label="Destination" />
              <button className="btn primary sm">Plan trip</button>
            </div>
          </form>

          {next && (
            <section className="home-section">
              <div className="section-head">
                <h2>Up next</h2>
              </div>
              <NextTripCard trip={next} />
            </section>
          )}

          {(!next || upcoming.length > 1 || past.length > 0) && (
          <section className="home-section">
            <div className="section-head">
              <h2>{next && filter === 'upcoming' ? 'Later' : 'Trips'}</h2>
              <div className="seg">
                <button className={filter === 'upcoming' ? 'on' : ''} onClick={() => setFilter('upcoming')}>
                  Upcoming <span className="count">{upcoming.length}</span>
                </button>
                <button className={filter === 'past' ? 'on' : ''} onClick={() => setFilter('past')}>
                  Past <span className="count">{past.length}</span>
                </button>
              </div>
            </div>
            {shown.length === 0 ? (
              trips.length === 0 ? (
                <Empty emoji="🧳" title="No trips yet">
                  <div className="row gap">
                    <button className="btn primary" onClick={() => setModal({})}>
                      <Plus size={16} /> Plan a trip
                    </button>
                    <button className="btn" onClick={loadDemo}>
                      <Sparkles size={16} /> Try a sample Paris trip
                    </button>
                  </div>
                </Empty>
              ) : (
                <p className="muted small list-empty">{filter === 'upcoming' ? 'No other upcoming trips.' : 'No past trips yet.'}</p>
              )
            ) : (
              <div className="trip-list">
                {shown.map((t) => (
                  <TripRow key={t.id} trip={t} />
                ))}
              </div>
            )}
          </section>
          )}

          <section className="home-section">
            <div className="section-head">
              <h2>Start from a guide</h2>
              <span className="muted small">Curated places, tips and local info</span>
            </div>
            <div className="guide-scroller">
              {DESTINATIONS.map((d) => (
                <button key={d.id} className="guide-card" onClick={() => setModal({ dest: toDestination(d) })}>
                  <span className="guide-thumb" style={{ background: coverGradient(d.hue) }}>
                    {d.emoji}
                  </span>
                  <strong>{d.name}</strong>
                  <small>{d.country}</small>
                </button>
              ))}
            </div>
          </section>

          {trips.length > 0 && (
            <button className="link demo-link" onClick={loadDemo}>
              <Sparkles size={14} /> Add the sample Paris trip
            </button>
          )}
          <footer className="footer">Trips are saved in this browser · Map data © OpenStreetMap contributors</footer>
        </main>
      </div>

      <button className="fab-new only-phone" onClick={() => setModal({})} aria-label="New trip">
        <Plus size={24} />
      </button>

      {modal && <CreateTripModal onClose={() => setModal(null)} initial={modal.dest} initialQuery={modal.q} />}
    </div>
  );
}

function tripProgress(trip: Trip) {
  const plannedDays = trip.days.filter((d) => d.items.length > 0).length;
  const packed = trip.packing.filter((p) => p.done).length;
  return { plannedDays, packed };
}

function NextTripCard({ trip }: { trip: Trip }) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const { plannedDays, packed } = tripProgress(trip);
  return (
    <Link to={`/trip/${trip.id}`} className="next-card">
      <div className="next-cover" style={{ background: coverGradient(trip.destination.hue) }}>
        <span className="next-emoji">{trip.destination.emoji}</span>
        <span className={`badge badge-${status.kind}`}>{status.label}</span>
      </div>
      <div className="next-body">
        <div className="row between">
          <div className="grow">
            <h3>{trip.name}</h3>
            <div className="muted small row-icons">
              <span>
                <MapPin size={13} /> {trip.destination.name}, {trip.destination.country}
              </span>
              <span>
                <CalendarDays size={13} /> {formatRange(trip.startDate, trip.endDate)}
              </span>
            </div>
          </div>
          <ChevronRight size={20} className="muted" />
        </div>
        <div className="next-stats">
          <div>
            <span className="stat-label">Days planned</span>
            <strong>
              {plannedDays}/{trip.days.length}
            </strong>
            <ProgressBar value={plannedDays} max={trip.days.length} />
          </div>
          <div>
            <span className="stat-label">Packed</span>
            <strong>{trip.packing.length ? `${packed}/${trip.packing.length}` : '—'}</strong>
            <ProgressBar value={packed} max={trip.packing.length} color="var(--success)" />
          </div>
          <div>
            <span className="stat-label">Bookings</span>
            <strong>{trip.reservations.length}</strong>
            <span className="muted small">
              {trip.saved.length} saved {trip.saved.length === 1 ? 'place' : 'places'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const { deleteTrip, duplicateTrip } = useStore();
  const navigate = useNavigate();
  const status = tripStatus(trip.startDate, trip.endDate);
  const planned = trip.days.reduce((n, d) => n + d.items.length, 0);
  return (
    <div className="trip-row">
      <Link to={`/trip/${trip.id}`} className="trip-row-link">
        <span className="trip-thumb" style={{ background: coverGradient(trip.destination.hue) }}>
          {trip.destination.emoji}
        </span>
        <span className="grow">
          <strong>{trip.name}</strong>
          <span className="muted small row-icons">
            <span>{formatRange(trip.startDate, trip.endDate)}</span>
            <span>
              <Users size={12} /> {trip.travelers.length}
            </span>
            <span>
              <MapPin size={12} /> {planned} stops
            </span>
          </span>
        </span>
        <span className={`badge badge-soft badge-${status.kind}`}>{status.label}</span>
      </Link>
      <Menu
        trigger={(toggle) => (
          <button className="icon-btn sm" onClick={toggle} aria-label={`Actions for ${trip.name}`}>
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
  );
}
