import { useMemo, useState } from 'react';
import { Loader2, MapPin, Search, Sparkles } from 'lucide-react';
import type { Destination } from '../types';
import { DESTINATIONS } from '../data/destinations';
import { searchCities } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';

export function toDestination(d: Destination & { places?: unknown }): Destination {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { places: _p, ...rest } = d;
  return rest;
}

export function DestinationPicker({
  value,
  onSelect,
  autoFocus,
  initialQuery = '',
}: {
  value?: Destination;
  onSelect: (d: Destination) => void;
  autoFocus?: boolean;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(!!initialQuery);
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 300);

  const curated = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DESTINATIONS.slice(0, 6);
    return DESTINATIONS.filter((d) => d.name.toLowerCase().includes(s) || d.country.toLowerCase().includes(s));
  }, [q]);

  const remote = useAsync(dq.length >= 2 ? `geo:${dq}` : null, (signal) => searchCities(dq, signal));
  const remoteFiltered = (remote.data ?? []).filter(
    (r) => !curated.some((c) => c.name.toLowerCase() === r.name.toLowerCase() && Math.abs(c.lat - r.lat) < 0.5),
  );
  const options: Destination[] = [...curated.map(toDestination), ...remoteFiltered];

  const choose = (d: Destination) => {
    onSelect(d);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="dest-picker">
      {value && !open ? (
        <button type="button" className="dest-selected" onClick={() => setOpen(true)}>
          <span className="dest-emoji">{value.emoji}</span>
          <span>
            <strong>{value.name}</strong>
            <small>{value.country}</small>
          </span>
          <span className="link">Change</span>
        </button>
      ) : (
        <div className="search-input">
          <Search size={18} />
          <input
            autoFocus={autoFocus || !!value}
            placeholder="Where to? e.g. Paris, Tokyo, Cape Town"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && options[active]) {
                e.preventDefault();
                choose(options[active]);
              } else if (e.key === 'Escape' && value) setOpen(false);
            }}
          />
          {remote.loading && <Loader2 size={16} className="spin" />}
        </div>
      )}
      {open && (
        <ul className="dest-options" role="listbox">
          {options.map((d, i) => (
            <li key={d.id}>
              <button
                type="button"
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
              >
                <span className="dest-emoji">{d.emoji}</span>
                <span className="grow">
                  <strong>{d.name}</strong>
                  <small>{d.country}</small>
                </span>
                {d.curated ? (
                  <span className="pill pill-accent">
                    <Sparkles size={12} /> Guide
                  </span>
                ) : (
                  <MapPin size={14} className="muted" />
                )}
              </button>
            </li>
          ))}
          {!options.length && !remote.loading && <li className="dest-none">{dq.length >= 2 ? 'No places found' : 'Type to search any city'}</li>}
          {remote.error != null && <li className="dest-none">City search is offline — showing built-in guides only.</li>}
        </ul>
      )}
    </div>
  );
}
