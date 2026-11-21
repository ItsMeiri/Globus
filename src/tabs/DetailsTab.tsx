import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Lightbulb, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Reservation, ReservationType, Trip } from '../types';
import { useStore } from '../store';
import { Avatar, Empty, Modal, ProgressBar } from '../components/ui';
import { DestinationPicker } from '../components/DestinationPicker';
import { getCurated } from '../data/destinations';
import { fetchForecast, weatherInfo } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { packingFromTemplate } from '../lib/tripLogic';
import { CURRENCIES, RESERVATION_META, TRAVELER_COLORS, daysBetween, eachDate, formatDate, money, today, uid } from '../lib/utils';

export function DetailsTab({ trip }: { trip: Trip }) {
  const planned = trip.days.reduce((n, d) => n + d.items.length, 0);
  const spent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const nights = daysBetween(trip.startDate, trip.endDate);
  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Days" value={String(trip.days.length)} sub={`${nights} night${nights === 1 ? '' : 's'}`} />
        <Stat label="Places planned" value={String(planned)} sub={`${trip.saved.length} saved`} to={`/trip/${trip.id}/itinerary`} />
        <Stat label="Bookings" value={String(trip.reservations.length)} sub="reservations" />
        <Stat
          label="Spent"
          value={money(spent, trip.currency, true)}
          sub={trip.budget ? `of ${money(trip.budget, trip.currency, true)}` : 'no budget set'}
          to={`/trip/${trip.id}/budget`}
        />
      </div>
      <TripInfoCard trip={trip} />
      <WeatherCard trip={trip} />
      <ReservationsCard trip={trip} />
      <div className="grid-2">
        <TravelersCard trip={trip} />
        <PackingCard trip={trip} />
      </div>
      <NotesCard trip={trip} />
      <GuideCard trip={trip} />
    </div>
  );
}

function Stat({ label, value, sub, to }: { label: string; value: string; sub?: string; to?: string }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="stat card">
      {body}
    </Link>
  ) : (
    <div className="stat card">{body}</div>
  );
}

function TripInfoCard({ trip }: { trip: Trip }) {
  const { setDates, mutate } = useStore();
  const [changingDest, setChangingDest] = useState(false);

  const changeDates = (start: string, end: string) => {
    if (!start || !end) return;
    const keep = new Set(eachDate(start, end < start ? start : end));
    const lost = trip.days.filter((d) => !keep.has(d.date)).reduce((n, d) => n + d.items.length, 0);
    if (lost && !confirm(`${lost} planned place${lost === 1 ? '' : 's'} fall outside the new dates and will move back to “Places to visit”. Continue?`)) return;
    setDates(trip.id, start, end < start ? start : end);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h3>Trip details</h3>
      </div>
      <div className="form">
        <div className="row-3">
          <label className="field">
            <span>Start</span>
            <input type="date" value={trip.startDate} onChange={(e) => changeDates(e.target.value, trip.endDate)} />
          </label>
          <label className="field">
            <span>End</span>
            <input type="date" value={trip.endDate} min={trip.startDate} onChange={(e) => changeDates(trip.startDate, e.target.value)} />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={trip.currency} onChange={(e) => mutate(trip.id, (t) => void (t.currency = e.target.value))}>
              {[...new Set([trip.currency, ...CURRENCIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          <span>Destination</span>
          {changingDest ? (
            <DestinationPicker
              autoFocus
              onSelect={(d) => {
                mutate(trip.id, (t) => {
                  t.destination = d;
                  if (d.currency && !t.expenses.length) t.currency = d.currency;
                });
                setChangingDest(false);
              }}
            />
          ) : (
            <button type="button" className="dest-selected" onClick={() => setChangingDest(true)}>
              <span className="dest-emoji">{trip.destination.emoji}</span>
              <span>
                <strong>{trip.destination.name}</strong>
                <small>{trip.destination.country}</small>
              </span>
              <span className="link">
                <Pencil size={12} /> Change
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function WeatherCard({ trip }: { trip: Trip }) {
  const t = today();
  const horizon = daysBetween(t, trip.startDate);
  const inRange = trip.endDate >= t && horizon <= 15;
  const { lat, lng } = trip.destination;
  const res = useAsync(`wx:${lat},${lng}`, (signal) => fetchForecast(lat, lng, signal));
  const days = (res.data ?? []).filter((d) => (inRange ? d.date >= trip.startDate && d.date <= trip.endDate : true)).slice(0, inRange ? 16 : 7);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Weather {inRange ? 'during your trip' : `in ${trip.destination.name} now`}</h3>
        {!inRange && trip.endDate >= t && <span className="muted small">Trip forecast appears 16 days before you go</span>}
      </div>
      {res.loading && <div className="wx-row skeleton-row" />}
      {res.error != null && <p className="muted small">Weather is unavailable right now.</p>}
      {days.length > 0 && (
        <div className="wx-row">
          {days.map((d) => {
            const w = weatherInfo(d.code);
            return (
              <div className="wx-day" key={d.date} title={w.label}>
                <span className="wx-date">{formatDate(d.date, { weekday: 'short' })}</span>
                <span className="wx-emoji">{w.emoji}</span>
                <span className="wx-temp">
                  {Math.round(d.max)}° <small>{Math.round(d.min)}°</small>
                </span>
                {d.rain > 0 && <span className="wx-rain">💧{d.rain}%</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Reservations ---------- */

function ReservationsCard({ trip }: { trip: Trip }) {
  const mutate = useStore((s) => s.mutate);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const sorted = [...trip.reservations].sort((a, b) => (a.start ?? '9').localeCompare(b.start ?? '9'));
  const newRes = (type: ReservationType) => setEditing({ id: '', type, title: '' });

  return (
    <section className="card">
      <div className="card-head">
        <h3>Reservations & bookings</h3>
      </div>
      <div className="res-types">
        {(Object.keys(RESERVATION_META) as ReservationType[]).map((t) => (
          <button key={t} className="res-type" onClick={() => newRes(t)}>
            <span>{RESERVATION_META[t].emoji}</span>
            {RESERVATION_META[t].label}
          </button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <p className="muted small">Add flights, hotels, car rentals and more to keep confirmations in one place.</p>
      ) : (
        <ul className="res-list">
          {sorted.map((r) => (
            <li key={r.id} className="res-item">
              <span className="res-emoji">{RESERVATION_META[r.type].emoji}</span>
              <div className="grow">
                <div className="res-title">{r.title || RESERVATION_META[r.type].label}</div>
                <div className="res-meta">
                  {r.start && <span>{fmtDT(r.start)}</span>}
                  {r.end && <span>→ {fmtDT(r.end)}</span>}
                  {r.location && <span>📍 {r.location}</span>}
                  {r.confirmation && <span className="mono">#{r.confirmation}</span>}
                </div>
                {r.notes && <div className="res-notes">{r.notes}</div>}
              </div>
              {r.cost ? <span className="res-cost">{money(r.cost, trip.currency)}</span> : null}
              <button className="icon-btn sm" onClick={() => setEditing(r)} aria-label="Edit reservation">
                <Pencil size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ReservationModal
          value={editing}
          currency={trip.currency}
          onClose={() => setEditing(null)}
          onDelete={
            editing.id
              ? () => {
                  mutate(trip.id, (t) => void (t.reservations = t.reservations.filter((r) => r.id !== editing.id)));
                  setEditing(null);
                }
              : undefined
          }
          onSave={(r) => {
            mutate(trip.id, (t) => {
              if (r.id) t.reservations = t.reservations.map((x) => (x.id === r.id ? r : x));
              else t.reservations.push({ ...r, id: uid('r_') });
            });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function fmtDT(v: string) {
  const [d, time] = v.split('T');
  return `${formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}${time ? ` ${time}` : ''}`;
}

function ReservationModal({
  value,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  value: Reservation;
  currency: string;
  onClose: () => void;
  onSave: (r: Reservation) => void;
  onDelete?: () => void;
}) {
  const [r, setR] = useState<Reservation>(value);
  const set = <K extends keyof Reservation>(k: K, v: Reservation[K]) => setR({ ...r, [k]: v });
  const meta = RESERVATION_META[r.type];
  const labels: Record<ReservationType, [string, string, string]> = {
    flight: ['Departure', 'Arrival', 'e.g. TLV → CDG, AF1621'],
    lodging: ['Check-in', 'Check-out', 'Hotel name'],
    car: ['Pick-up', 'Drop-off', 'Rental company'],
    train: ['Departure', 'Arrival', 'e.g. Eurostar London → Paris'],
    restaurant: ['Time', 'Ends', 'Restaurant name'],
    activity: ['Starts', 'Ends', 'Tour or ticket'],
    other: ['Starts', 'Ends', 'Title'],
  };
  const [startL, endL, ph] = labels[r.type];
  return (
    <Modal title={`${value.id ? 'Edit' : 'Add'} ${meta.label.toLowerCase()}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...r, title: r.title.trim() || meta.label });
        }}
      >
        <div className="row-2">
          <label className="field">
            <span>Type</span>
            <select value={r.type} onChange={(e) => set('type', e.target.value as ReservationType)}>
              {(Object.keys(RESERVATION_META) as ReservationType[]).map((t) => (
                <option key={t} value={t}>
                  {RESERVATION_META[t].emoji} {RESERVATION_META[t].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Confirmation #</span>
            <input value={r.confirmation ?? ''} onChange={(e) => set('confirmation', e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Title</span>
          <input autoFocus value={r.title} placeholder={ph} onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="row-2">
          <label className="field">
            <span>{startL}</span>
            <input type="datetime-local" value={r.start ?? ''} onChange={(e) => set('start', e.target.value)} />
          </label>
          {r.type !== 'restaurant' && (
            <label className="field">
              <span>{endL}</span>
              <input type="datetime-local" value={r.end ?? ''} min={r.start} onChange={(e) => set('end', e.target.value)} />
            </label>
          )}
        </div>
        <div className="row-2">
          <label className="field">
            <span>Location / address</span>
            <input value={r.location ?? ''} onChange={(e) => set('location', e.target.value)} />
          </label>
          <label className="field">
            <span>Cost ({currency})</span>
            <input type="number" min="0" step="0.01" value={r.cost ?? ''} onChange={(e) => set('cost', e.target.value ? Number(e.target.value) : undefined)} />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={r.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="btn ghost danger" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Travelers ---------- */

function TravelersCard({ trip }: { trip: Trip }) {
  const mutate = useStore((s) => s.mutate);
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    mutate(trip.id, (t) => void t.travelers.push({ id: uid('u_'), name: name.trim(), color: TRAVELER_COLORS[t.travelers.length % TRAVELER_COLORS.length] }));
    setName('');
  };
  return (
    <section className="card">
      <div className="card-head">
        <h3>Tripmates</h3>
        <span className="muted small">{trip.travelers.length}</span>
      </div>
      <ul className="traveler-list">
        {trip.travelers.map((p) => (
          <li key={p.id}>
            <Avatar t={p} />
            <input
              className="bare"
              value={p.name}
              aria-label="Traveler name"
              onChange={(e) => mutate(trip.id, (t) => void (t.travelers.find((x) => x.id === p.id)!.name = e.target.value))}
            />
            {trip.travelers.length > 1 && (
              <button
                className="icon-btn sm"
                aria-label={`Remove ${p.name}`}
                onClick={() => {
                  const used = trip.expenses.some((e) => e.paidBy === p.id || e.splitWith.includes(p.id));
                  if (used && !confirm(`${p.name} appears in expenses. Remove anyway?`)) return;
                  mutate(trip.id, (t) => {
                    t.travelers = t.travelers.filter((x) => x.id !== p.id);
                    t.expenses.forEach((e) => {
                      e.splitWith = e.splitWith.filter((id) => id !== p.id);
                      if (e.paidBy === p.id) e.paidBy = undefined;
                    });
                  });
                }}
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input value={name} placeholder="Add a tripmate" onChange={(e) => setName(e.target.value)} />
        <button className="btn sm" disabled={!name.trim()}>
          <Plus size={14} /> Add
        </button>
      </form>
    </section>
  );
}

/* ---------- Packing ---------- */

function PackingCard({ trip }: { trip: Trip }) {
  const mutate = useStore((s) => s.mutate);
  const [text, setText] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const done = trip.packing.filter((p) => p.done).length;
  const groups = [...new Set(trip.packing.map((p) => p.group))];
  return (
    <section className="card">
      <div className="card-head">
        <h3>Packing list</h3>
        <span className="muted small">
          {done}/{trip.packing.length} packed
        </span>
      </div>
      {trip.packing.length > 0 && <ProgressBar value={done} max={trip.packing.length} color="var(--success)" />}
      {trip.packing.length === 0 ? (
        <Empty emoji="🎒" title="Nothing on the list yet">
          <button className="btn sm" onClick={() => mutate(trip.id, (t) => void (t.packing = packingFromTemplate(t.packing)))}>
            <Lightbulb size={14} /> Use suggested list
          </button>
        </Empty>
      ) : (
        <div className="packing">
          {groups.map((g) => {
            const items = trip.packing.filter((p) => p.group === g && (!hideDone || !p.done));
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="packing-group">{g}</div>
                {items.map((p) => (
                  <div key={p.id} className={`check-row ${p.done ? 'done' : ''}`}>
                    <button
                      className="check"
                      aria-pressed={p.done}
                      aria-label={p.text}
                      onClick={() => mutate(trip.id, (t) => void (t.packing.find((x) => x.id === p.id)!.done = !p.done))}
                    >
                      {p.done && <Check size={12} />}
                    </button>
                    <span className="grow">{p.text}</span>
                    <button className="icon-btn xs" aria-label={`Remove ${p.text}`} onClick={() => mutate(trip.id, (t) => void (t.packing = t.packing.filter((x) => x.id !== p.id)))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          mutate(trip.id, (t) => void t.packing.push({ id: uid('p_'), text: text.trim(), done: false, group: 'My items' }));
          setText('');
        }}
      >
        <input value={text} placeholder="Add an item" onChange={(e) => setText(e.target.value)} />
        <button className="btn sm" disabled={!text.trim()}>
          <Plus size={14} />
        </button>
      </form>
      {trip.packing.length > 0 && (
        <label className="toggle-line">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide packed items
        </label>
      )}
    </section>
  );
}

/* ---------- Notes & guide ---------- */

function NotesCard({ trip }: { trip: Trip }) {
  const mutate = useStore((s) => s.mutate);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Notes</h3>
        <span className="muted small">Saved automatically</span>
      </div>
      <textarea
        className="notes"
        rows={5}
        value={trip.notes}
        placeholder="Visa requirements, ideas, things to remember…"
        onChange={(e) => mutate(trip.id, (t) => void (t.notes = e.target.value))}
      />
    </section>
  );
}

function GuideCard({ trip }: { trip: Trip }) {
  const guide = getCurated(trip.destination.id);
  const d = guide ?? trip.destination;
  const local = d.timezone
    ? new Date().toLocaleTimeString(undefined, { timeZone: d.timezone, hour: '2-digit', minute: '2-digit' })
    : undefined;
  return (
    <section className="card guide">
      <div className="card-head">
        <h3>
          {d.emoji} About {d.name}
        </h3>
      </div>
      {d.description && <p>{d.description}</p>}
      <div className="facts">
        {d.currency && <Fact label="Currency" value={d.currency} />}
        {d.language && <Fact label="Language" value={d.language} />}
        {local && <Fact label="Local time" value={`${local}`} />}
        {d.bestTime && <Fact label="Best time to visit" value={d.bestTime} />}
        <Fact label="Coordinates" value={`${d.lat.toFixed(2)}, ${d.lng.toFixed(2)}`} />
      </div>
      {d.tips && d.tips.length > 0 && (
        <>
          <h4>
            <Lightbulb size={14} /> Local tips
          </h4>
          <ul className="tips">
            {d.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {!guide && (
        <p className="muted small">
          <CalendarDays size={12} /> No built-in guide for this city yet — the Explore tab finds places from OpenStreetMap.
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
