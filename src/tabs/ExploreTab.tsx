import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, Check, Heart, Loader2, MapPin, Search, Wand2 } from 'lucide-react';
import type { Place, PlaceCategory, Trip } from '../types';
import { useStore, useUI } from '../store';
import { Empty, InlineEdit, Menu, Stars } from '../components/ui';
import { PlaceSearch } from '../components/PlaceSearch';
import { notify } from '../components/dialogs';
import { getCurated } from '../data/destinations';
import { autoPlan, makeItem, suggestionsFor } from '../lib/tripLogic';
import { CATEGORY_META, dayColor, distanceKm, formatDate, formatKm, formatMinutes, priceLabel } from '../lib/utils';

type Sort = 'rating' | 'distance' | 'name';
type Catalog = { places: Place[]; loading: boolean; error: boolean; curated: boolean };

export function ExploreTab({ trip, catalog }: { trip: Trip; catalog: Catalog }) {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'saved' ? 'saved' : 'discover';
  const setView = (v: 'discover' | 'saved') => setParams(v === 'saved' ? { view: 'saved' } : {}, { replace: true });

  return (
    <div className="explore">
      <div className="explore-top">
        <div className="seg seg-lg" role="tablist" aria-label="Explore views">
          <button role="tab" aria-selected={view === 'discover'} className={view === 'discover' ? 'on' : ''} onClick={() => setView('discover')}>
            Discover
          </button>
          <button role="tab" aria-selected={view === 'saved'} className={view === 'saved' ? 'on' : ''} onClick={() => setView('saved')}>
            <Heart size={14} fill={view === 'saved' ? 'currentColor' : 'none'} /> Saved <span className="count">{trip.saved.length}</span>
          </button>
        </div>
      </div>
      {view === 'discover' ? <Discover trip={trip} catalog={catalog} onShowSaved={() => setView('saved')} /> : <SavedPlaces trip={trip} catalog={catalog.places} />}
    </div>
  );
}

function useDayActions(trip: Trip) {
  const mutate = useStore((s) => s.mutate);
  const toggleSave = (p: Place) =>
    mutate(trip.id, (t) => {
      const i = t.saved.findIndex((x) => x.place.id === p.id);
      if (i >= 0) t.saved.splice(i, 1);
      else t.saved.push(makeItem(p));
    });
  const addToDay = (p: Place, dayId: string) =>
    mutate(trip.id, (t) => {
      const d = t.days.find((x) => x.id === dayId)!;
      const si = t.saved.findIndex((x) => x.place.id === p.id);
      d.items.push(si >= 0 ? t.saved.splice(si, 1)[0] : makeItem(p));
    });
  return { toggleSave, addToDay };
}

function DayMenu({ trip, onPick, label = 'Add to day', primary }: { trip: Trip; onPick: (dayId: string) => void; label?: string; primary?: boolean }) {
  return (
    <Menu
      trigger={(toggle) => (
        <button className={`btn xs ${primary ? 'primary' : ''}`} onClick={toggle}>
          <CalendarPlus size={12} /> {label}
        </button>
      )}
    >
      {(close) =>
        trip.days.map((d, i) => (
          <button key={d.id} onClick={() => (close(), onPick(d.id))}>
            <span className="dot" style={{ background: dayColor(i) }} /> Day {i + 1} · {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
            <span className="muted small">{d.items.length ? ` (${d.items.length})` : ''}</span>
          </button>
        ))
      }
    </Menu>
  );
}

/* ---------- Discover ---------- */

function Discover({ trip, catalog, onShowSaved }: { trip: Trip; catalog: Catalog; onShowSaved: () => void }) {
  const { focusOn, setHover } = useUI();
  const { toggleSave, addToDay } = useDayActions(trip);
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(catalog.curated ? 'rating' : 'distance');
  const guide = getCurated(trip.destination.id);

  const savedIds = useMemo(() => new Set(trip.saved.map((i) => i.place.id)), [trip.saved]);
  const dayByPlace = useMemo(() => {
    const m = new Map<string, number>();
    trip.days.forEach((d, i) => d.items.forEach((it) => m.set(it.place.id, i)));
    return m;
  }, [trip.days]);

  const cats = useMemo(() => {
    const counts = new Map<PlaceCategory, number>();
    catalog.places.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog.places]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = catalog.places.filter((p) => (cat === 'all' || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s)));
    const center = trip.destination;
    return out.sort((a, b) =>
      sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : sort === 'distance' ? distanceKm(center, a) - distanceKm(center, b) : a.name.localeCompare(b.name),
    );
  }, [catalog.places, cat, q, sort, trip.destination]);

  return (
    <>
      <p className="explore-intro">
        <strong>
          {trip.destination.emoji} {trip.destination.name}
        </strong>{' '}
        <span className="muted">{guide?.tagline ?? `Notable places around ${trip.destination.name}`}. Tap ♥ to shortlist a place.</span>
      </p>

      <div className="explore-controls">
        <div className="search-input sm grow">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${trip.destination.name}`} aria-label="Search places" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="rating">Top rated</option>
          <option value="distance">Closest to center</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      <div className="chip-row" role="toolbar" aria-label="Categories">
        <button className={`cat-chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          All <span className="count">{catalog.places.length}</span>
        </button>
        {cats.map(([c, n]) => (
          <button key={c} className={`cat-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {CATEGORY_META[c].emoji} {CATEGORY_META[c].label} <span className="count">{n}</span>
          </button>
        ))}
      </div>

      {catalog.loading && (
        <div className="loading-line">
          <Loader2 size={16} className="spin" /> Finding places around {trip.destination.name}…
        </div>
      )}
      {catalog.error && !catalog.places.length && (
        <Empty emoji="🛰️" title="Couldn’t load places">
          The OpenStreetMap discovery service is unreachable. You can still add stops in the Itinerary by searching.
        </Empty>
      )}
      {!catalog.loading && !catalog.error && list.length === 0 && (
        <Empty emoji="🔎" title="No places match">
          Try another category or search term.
        </Empty>
      )}

      <div className="place-grid">
        {list.map((p) => {
          const meta = CATEGORY_META[p.category];
          const saved = savedIds.has(p.id);
          const day = dayByPlace.get(p.id);
          return (
            <article key={p.id} className="place-card" onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
              <div className="place-card-top" style={{ '--cat': meta.color } as React.CSSProperties}>
                <span className="place-emoji">{meta.emoji}</span>
                {day !== undefined ? (
                  <span className="planned-badge" style={{ background: dayColor(day) }}>
                    <Check size={12} /> Day {day + 1}
                  </span>
                ) : (
                  <button className={`heart-btn ${saved ? 'on' : ''}`} onClick={() => toggleSave(p)} aria-pressed={saved} aria-label={saved ? `Remove ${p.name} from saved` : `Save ${p.name}`}>
                    <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
              <div className="place-card-body">
                <h4>{p.name}</h4>
                <div className="stop-meta">
                  <span style={{ color: meta.color }}>{meta.label}</span>
                  <Stars rating={p.rating} />
                  {p.price !== undefined && <span>{priceLabel(p.price)}</span>}
                  {p.duration && <span>~{formatMinutes(p.duration)}</span>}
                </div>
                {p.description && <p className="place-desc">{p.description}</p>}
                <div className="place-card-actions">
                  <button className="btn xs ghost" onClick={() => focusOn({ lat: p.lat, lng: p.lng, id: p.id })} title="Show on map">
                    <MapPin size={12} /> {formatKm(distanceKm(trip.destination, p))}
                  </button>
                  <div className="grow" />
                  {day === undefined && <DayMenu trip={trip} onPick={(id) => addToDay(p, id)} />}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {trip.saved.length > 0 && (
        <button className="saved-float" onClick={onShowSaved}>
          <Heart size={15} fill="currentColor" /> {trip.saved.length} saved · Review
        </button>
      )}
      {!catalog.curated && catalog.places.length > 0 && <p className="muted small center">Places from OpenStreetMap contributors.</p>}
    </>
  );
}

/* ---------- Saved shortlist ---------- */

function SavedPlaces({ trip, catalog }: { trip: Trip; catalog: Place[] }) {
  const mutate = useStore((s) => s.mutate);
  const { focusOn, setHover } = useUI();
  const { addToDay } = useDayActions(trip);
  const suggestions = useMemo(() => suggestionsFor(trip, catalog), [trip, catalog]);

  const planAll = () => {
    let ok = false;
    mutate(trip.id, (t) => {
      if (t.saved.length) ok = autoPlan(t, []);
    });
    if (ok) notify('Saved places scheduled', 'They were grouped into days by location. Check the Itinerary to fine-tune the order.');
  };

  return (
    <div className="saved">
      <div className="saved-head">
        <div className="grow">
          <h3>Your shortlist</h3>
          <p className="muted small">Places you’re considering. Schedule each one on a day, or let Auto-plan group them by neighborhood.</p>
        </div>
        {trip.saved.length > 0 && (
          <button className="btn sm primary" onClick={planAll}>
            <Wand2 size={14} /> Plan into days
          </button>
        )}
      </div>

      <PlaceSearch catalog={catalog} near={trip.destination} suggestions={suggestions} placeholder="Add a place to your shortlist" onPick={(p) => mutate(trip.id, (t) => void (t.saved.some((s) => s.place.id === p.id) || t.saved.push(makeItem(p))))} />

      {trip.saved.length === 0 ? (
        <Empty emoji="💡" title="No saved places yet">
          Tap ♥ on places in Discover, or search above, to build a shortlist of options.
        </Empty>
      ) : (
        <ul className="saved-list">
          {trip.saved.map((it) => {
            const meta = CATEGORY_META[it.place.category];
            return (
              <li key={it.id} className="saved-row" onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)}>
                <span className="saved-thumb" style={{ '--cat': meta.color } as React.CSSProperties}>
                  {meta.emoji}
                </span>
                <div className="grow">
                  <button className="stop-name link-plain" onClick={() => focusOn({ lat: it.place.lat, lng: it.place.lng, id: it.id })}>
                    {it.place.name}
                  </button>
                  <div className="stop-meta">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <Stars rating={it.place.rating} />
                    {it.place.duration && <span>~{formatMinutes(it.place.duration)}</span>}
                    <span>{formatKm(distanceKm(trip.destination, it.place))} from center</span>
                  </div>
                  <InlineEdit
                    className="saved-note"
                    value={it.note ?? ''}
                    placeholder="Add a note"
                    onChange={(v) => mutate(trip.id, (t) => void (t.saved.find((x) => x.id === it.id)!.note = v || undefined))}
                  />
                </div>
                <div className="saved-actions">
                  <DayMenu trip={trip} label="Schedule" primary onPick={(id) => addToDay(it.place, id)} />
                  <button className="icon-btn sm heart-on" onClick={() => mutate(trip.id, (t) => void (t.saved = t.saved.filter((x) => x.id !== it.id)))} aria-label={`Remove ${it.place.name} from saved`} title="Remove from saved">
                    <Heart size={16} fill="currentColor" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
