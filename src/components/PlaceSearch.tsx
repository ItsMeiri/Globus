import { useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Plus } from 'lucide-react';
import type { Place } from '../types';
import { searchPlaces } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { CATEGORY_META } from '../lib/utils';

export function PlaceSearch({
  catalog,
  near,
  onPick,
  placeholder = 'Add a place',
  suggestions,
}: {
  catalog: Place[];
  near: { lat: number; lng: number };
  onPick: (p: Place) => void;
  placeholder?: string;
  /** Shown when the input is focused and empty */
  suggestions?: Place[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q.trim(), 400);

  const local = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return (suggestions ?? []).slice(0, 5);
    return catalog.filter((p) => p.name.toLowerCase().includes(s) || CATEGORY_META[p.category].label.toLowerCase().includes(s)).slice(0, 6);
  }, [q, catalog, suggestions]);

  const remote = useAsync(dq.length >= 3 ? `place:${dq}:${near.lat.toFixed(2)}` : null, (signal) => searchPlaces(dq, near, signal));
  const remoteOnly = (remote.data ?? []).filter((r) => !local.some((l) => l.name.toLowerCase() === r.name.toLowerCase()));

  const pick = (p: Place) => {
    onPick(p);
    setQ('');
    inputRef.current?.blur();
    setOpen(false);
  };

  const all = [...local, ...remoteOnly];
  return (
    <div className="place-search">
      <div className="search-input sm">
        <MapPin size={16} />
        <input
          ref={inputRef}
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && all[0]) {
              e.preventDefault();
              pick(all[0]);
            }
            if (e.key === 'Escape') inputRef.current?.blur();
          }}
        />
        {remote.loading && <Loader2 size={14} className="spin" />}
      </div>
      {open && (all.length > 0 || q.trim().length >= 3) && (
        <ul className="dest-options">
          {!q.trim() && local.length > 0 && <li className="dest-group">Suggestions</li>}
          {all.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <span className="dest-emoji">{CATEGORY_META[p.category].emoji}</span>
                <span className="grow">
                  <strong>{p.name}</strong>
                  <small>{p.address || CATEGORY_META[p.category].label}</small>
                </span>
                <Plus size={14} className="muted" />
              </button>
            </li>
          ))}
          {all.length === 0 && !remote.loading && <li className="dest-none">{remote.error ? 'Search unavailable offline' : 'No matches nearby'}</li>}
        </ul>
      )}
    </div>
  );
}
