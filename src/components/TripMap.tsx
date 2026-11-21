import { Fragment, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Heart } from 'lucide-react';
import type { Place, Trip } from '../types';
import { useStore, useUI } from '../store';
import { CATEGORY_META, dayColor, formatDate } from '../lib/utils';
import { makeItem } from '../lib/tripLogic';

const iconCache = new Map<string, L.DivIcon>();
function pin(label: string, color: string, variant: 'num' | 'saved' | 'dot', highlight = false): L.DivIcon {
  const key = `${label}|${color}|${variant}|${highlight}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = variant === 'dot' ? 26 : 30;
    icon = L.divIcon({
      className: '',
      html: `<div class="map-pin map-pin-${variant}${highlight ? ' hl' : ''}" style="--c:${color}"><span>${label}</span></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, variant === 'dot' ? size / 2 : size],
      popupAnchor: [0, variant === 'dot' ? -size / 2 : -size],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitBounds({ points, depKey }: { points: [number, number][]; depKey: string }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (last.current === depKey) return;
    last.current = depKey;
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [depKey, points, map]);
  return null;
}

function FocusHandler() {
  const map = useMap();
  const focus = useUI((s) => s.focus);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function TripMap({ trip, catalog, fitKey }: { trip: Trip; catalog?: Place[]; fitKey: string }) {
  const theme = useStore((s) => s.theme);
  const mutate = useStore((s) => s.mutate);
  const { hoverId, activeDayId } = useUI();

  const savedIds = useMemo(() => new Set(trip.saved.map((i) => i.place.id)), [trip.saved]);
  const plannedIds = useMemo(() => new Set(trip.days.flatMap((d) => d.items.map((i) => i.place.id))), [trip.days]);

  const points = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    const days = activeDayId ? trip.days.filter((d) => d.id === activeDayId) : trip.days;
    days.forEach((d) => d.items.forEach((i) => pts.push([i.place.lat, i.place.lng])));
    if (!activeDayId) trip.saved.forEach((i) => pts.push([i.place.lat, i.place.lng]));
    if (pts.length === 0 && catalog?.length) catalog.slice(0, 40).forEach((p) => pts.push([p.lat, p.lng]));
    if (pts.length === 0) pts.push([trip.destination.lat, trip.destination.lng]);
    return pts;
  }, [trip, catalog, activeDayId]);

  const tiles =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const save = (p: Place) => mutate(trip.id, (t) => void t.saved.push(makeItem(p)));

  return (
    <MapContainer center={[trip.destination.lat, trip.destination.lng]} zoom={12} className="map" zoomControl={false} scrollWheelZoom>
      <TileLayer
        key={theme}
        url={tiles}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <FitBounds points={points} depKey={`${fitKey}|${activeDayId}|${catalog ? catalog.length : 0}`} />
      <FocusHandler />
      <InvalidateOnResize />

      {catalog
        ?.filter((p) => !savedIds.has(p.id) && !plannedIds.has(p.id))
        .map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(CATEGORY_META[p.category].emoji, CATEGORY_META[p.category].color, 'dot', hoverId === p.id)}>
            <Popup>
              <div className="popup">
                <strong>{p.name}</strong>
                <small>{CATEGORY_META[p.category].label}</small>
                {p.description && <p>{p.description}</p>}
                <button className="btn sm primary" onClick={() => save(p)}>
                  <Heart size={14} /> Save
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

      {trip.saved.map((it) => (
        <Marker key={it.id} position={[it.place.lat, it.place.lng]} icon={pin('♥', '#e2366b', 'saved', hoverId === it.id || hoverId === it.place.id)} opacity={activeDayId ? 0.35 : 1}>
          <Popup>
            <div className="popup">
              <strong>{it.place.name}</strong>
              <small>Saved place</small>
              {it.place.description && <p>{it.place.description}</p>}
              <AddToDay tripId={trip.id} itemId={it.id} />
            </div>
          </Popup>
        </Marker>
      ))}

      {trip.days.map((d, di) => {
        const dim = activeDayId && activeDayId !== d.id;
        const color = dayColor(di);
        return (
          <Fragment key={d.id}>
            {d.items.length > 1 && (
              <Polyline positions={d.items.map((i) => [i.place.lat, i.place.lng])} pathOptions={{ color, weight: dim ? 2 : 4, opacity: dim ? 0.25 : 0.85, dashArray: '6 8' }} />
            )}
            {d.items.map((it, ii) => (
              <Marker
                key={it.id}
                position={[it.place.lat, it.place.lng]}
                icon={pin(String(ii + 1), color, 'num', hoverId === it.id || hoverId === it.place.id)}
                opacity={dim ? 0.35 : 1}
                zIndexOffset={dim ? 0 : 500}
              >
                <Popup>
                  <div className="popup">
                    <strong>{it.place.name}</strong>
                    <small>
                      Day {di + 1} · {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {it.time && ` · ${it.time}`}
                    </small>
                    {it.place.description && <p>{it.place.description}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

function AddToDay({ tripId, itemId }: { tripId: string; itemId: string }) {
  const trip = useStore((s) => s.trips.find((t) => t.id === tripId));
  const mutate = useStore((s) => s.mutate);
  if (!trip) return null;
  return (
    <select
      className="sm"
      value=""
      onChange={(e) => {
        const dayId = e.target.value;
        mutate(tripId, (t) => {
          const idx = t.saved.findIndex((i) => i.id === itemId);
          const day = t.days.find((d) => d.id === dayId);
          if (idx >= 0 && day) day.items.push(t.saved.splice(idx, 1)[0]);
        });
      }}
    >
      <option value="" disabled>
        Add to day…
      </option>
      {trip.days.map((d, i) => (
        <option key={d.id} value={d.id}>
          Day {i + 1} — {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </option>
      ))}
    </select>
  );
}
