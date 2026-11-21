import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import type { Destination } from '../types';
import { Modal } from './ui';
import { DestinationPicker } from './DestinationPicker';
import { useStore } from '../store';
import { CURRENCIES, addDays, daysBetween, today } from '../lib/utils';

export function CreateTripModal({ onClose, initial, initialQuery }: { onClose: () => void; initial?: Destination; initialQuery?: string }) {
  const addTrip = useStore((s) => s.addTrip);
  const navigate = useNavigate();
  const [dest, setDest] = useState<Destination | undefined>(initial);
  const [start, setStart] = useState(addDays(today(), 30));
  const [end, setEnd] = useState(addDays(today(), 34));
  const [name, setName] = useState('');
  const [travelers, setTravelers] = useState<string[]>(['You']);
  const [newTraveler, setNewTraveler] = useState('');
  const [currency, setCurrency] = useState<string>('');
  const [budget, setBudget] = useState('');

  const nights = Math.max(0, daysBetween(start, end));
  const valid = !!dest && !!start && !!end && end >= start && nights <= 89;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !dest) return;
    const id = addTrip({
      name,
      destination: dest,
      startDate: start,
      endDate: end,
      travelers: newTraveler.trim() ? [...travelers, newTraveler] : travelers,
      currency: currency || dest.currency || 'USD',
      budget: budget ? Number(budget) : undefined,
    });
    onClose();
    navigate(`/trip/${id}`);
  };

  const addPerson = () => {
    if (!newTraveler.trim()) return;
    setTravelers([...travelers, newTraveler.trim()]);
    setNewTraveler('');
  };

  return (
    <Modal title="Plan a new trip" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Destination</span>
          <DestinationPicker value={dest} onSelect={setDest} autoFocus={!initial} initialQuery={initialQuery} />
        </label>
        <div className="row-2">
          <label className="field">
            <span>Start date</span>
            <input
              type="date"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                setStart(v);
                if (v && end < v) setEnd(addDays(v, Math.max(nights, 1)));
              }}
              required
            />
          </label>
          <label className="field">
            <span>End date</span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        <p className="hint">
          {nights + 1} day{nights ? 's' : ''}, {nights} night{nights === 1 ? '' : 's'}
          {nights > 89 && ' — trips are limited to 90 days'}
        </p>
        <label className="field">
          <span>Trip name (optional)</span>
          <input value={name} placeholder={dest ? `Trip to ${dest.name}` : 'Summer getaway'} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Travelers</span>
          <div className="chips">
            {travelers.map((t, i) => (
              <span className="chip" key={i}>
                {t}
                {travelers.length > 1 && (
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTravelers(travelers.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            <span className="chip-input">
              <input
                value={newTraveler}
                placeholder="Add a tripmate"
                onChange={(e) => setNewTraveler(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPerson();
                  }
                }}
              />
              <button type="button" className="icon-btn sm" onClick={addPerson} aria-label="Add tripmate">
                <Plus size={14} />
              </button>
            </span>
          </div>
        </div>
        <div className="row-2">
          <label className="field">
            <span>Budget (optional)</span>
            <input type="number" min="0" inputMode="decimal" value={budget} placeholder="e.g. 2500" onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={currency || dest?.currency || 'USD'} onChange={(e) => setCurrency(e.target.value)}>
              {[...new Set([dest?.currency, ...CURRENCIES].filter(Boolean) as string[])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid}>
            Start planning
          </button>
        </div>
      </form>
    </Modal>
  );
}
