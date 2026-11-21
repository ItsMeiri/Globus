import { useMemo, useState } from 'react';
import { CalendarPlus, Check, Heart, Loader2, MapPin, Search } from 'lucide-react';
import type { Place, PlaceCategory, Trip } from '../types';
import { useStore, useUI } from '../store';
import { Empty, Menu, Stars } from '../components/ui';
import { getCurated } from '../data/destinations';
import { makeItem } from '../lib/tripLogic';
import { CATEGORY_META, coverGradient, dayColor, distanceKm, formatDate, formatKm, formatMinutes, priceLabel } from '../lib/utils';

type Sort = 'rating' | 'distance' | 'name';

export function ExploreTab({ trip, catalog }: { trip: Trip; catalog: { places: Place[]; loading: boolean; error: boolean; curated: boolean } }) {
  const mutate = useStore((s) => s.mutate);
  const { focusOn, setHover } = useUI();
  const [cat, setCat] = useState<PlaceCategory | 'all' | 'saved'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(catalog.curated ? 'rating' : 'distance');
  const guide = getCurated(trip.destination.id);

  const savedByPlace = useMemo(() => new Map(trip.saved.map((i) => [i.place.id, i])), [trip.saved]);
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
    let out = catalog.places.filter((p) => {
      if (cat === 'saved') return savedByPlace.has(p.id) || dayByPlace.has(p.id);
      if (cat !== 'all' && p.category !== cat) return false;
      return !s || p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
    });
    if (cat === 'saved' && s) out = out.filter((p) => p.name.toLowerCase().includes(s));
    const center = trip.destination;
    return [...out].sort((a, b) =>
      sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : sort === 'distance' ? distanceKm(center, a) - distanceKm(center, b) : a.name.localeCompare(b.name),
    );
  }, [catalog.places, cat, q, sort, trip.destination, savedByPlace, dayByPlace]);

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

  return (
    <div className="explore">
      <div className="explore-hero" style={{ background: coverGradient(trip.destination.hue) }}>
        <div>
          <div className="eyebrow">Explore</div>
          <h2>
            {trip.destination.emoji} {trip.destination.name}
          </h2>
          <p>{guide?.tagline ?? `Discover notable places around ${trip.destination.name}`}</p>
        </div>
      </div>

      <div className="explore-controls">
        <div className="search-input sm grow">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search places in ${trip.destination.name}`} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="rating">Top rated</option>
          <option value="distance">Closest to center</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      <div className="chip-row" role="toolbar" aria-label="Categories">
        <button className={`cat-chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          ✨ All <span className="count">{catalog.places.length}</span>
        </button>
        <button className={`cat-chip ${cat === 'saved' ? 'on' : ''}`} onClick={() => setCat('saved')}>
          ❤️ In my trip
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
          The OpenStreetMap discovery service is unreachable. You can still add places from the Itinerary tab by searching.
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
          const saved = savedByPlace.has(p.id);
          const day = dayByPlace.get(p.id);
          return (
            <article key={p.id} className="place-card" onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
              <div className="place-card-top" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)` }}>
                <span className="place-emoji">{meta.emoji}</span>
                <button className={`heart-btn ${saved ? 'on' : ''}`} onClick={() => toggleSave(p)} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save place'} disabled={day !== undefined}>
                  <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
                </button>
                {day !== undefined && (
                  <span className="planned-badge" style={{ background: dayColor(day) }}>
                    <Check size={12} /> Day {day + 1}
                  </span>
                )}
              </div>
              <div className="place-card-body">
                <h4>{p.name}</h4>
                <div className="item-meta">
                  <span className="cat" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <Stars rating={p.rating} />
                  {p.price !== undefined && <span>{priceLabel(p.price)}</span>}
                  {p.duration && <span>~{formatMinutes(p.duration)}</span>}
                </div>
                {p.description && <p className="place-desc">{p.description}</p>}
                <div className="place-card-actions">
                  <button className="btn xs ghost" onClick={() => focusOn({ lat: p.lat, lng: p.lng, id: p.id })}>
                    <MapPin size={12} /> {formatKm(distanceKm(trip.destination, p))}
                  </button>
                  <div className="grow" />
                  <Menu
                    trigger={(toggle) => (
                      <button className="btn xs" onClick={toggle}>
                        <CalendarPlus size={12} /> Add to day
                      </button>
                    )}
                  >
                    {(close) =>
                      trip.days.map((d, i) => (
                        <button key={d.id} onClick={() => (close(), addToDay(p, d.id))}>
                          <span className="dot" style={{ background: dayColor(i) }} /> Day {i + 1} · {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                          <span className="muted small">{d.items.length ? ` (${d.items.length})` : ''}</span>
                        </button>
                      ))
                    }
                  </Menu>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!catalog.curated && catalog.places.length > 0 && <p className="muted small center">Places from OpenStreetMap contributors.</p>}
    </div>
  );
}
