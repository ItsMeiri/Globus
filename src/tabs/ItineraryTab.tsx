import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, Crosshair, GripVertical, Heart, MapPin, MoreHorizontal, Route, StickyNote, Trash2, Wand2 } from 'lucide-react';
import { SAVED, type Day, type Place, type PlanItem, type Trip } from '../types';
import { useStore, useUI } from '../store';
import { InlineEdit, Menu, Stars } from '../components/ui';
import { PlaceSearch } from '../components/PlaceSearch';
import { notify } from '../components/dialogs';
import { autoPlan, findContainer, makeItem, moveItem, optimizeOrder, routeDistance, suggestionsFor } from '../lib/tripLogic';
import { CATEGORY_META, dayColor, distanceKm, formatDate, formatKm, formatMinutes, formatTime, money, travelEstimate } from '../lib/utils';

export function ItineraryTab({ trip, catalog }: { trip: Trip; catalog: Place[] }) {
  const mutate = useStore((s) => s.mutate);
  const { activeDayId, setActiveDay } = useUI();
  const [dragging, setDragging] = useState<PlanItem | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const suggestions = useMemo(() => suggestionsFor(trip, catalog), [trip, catalog]);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging(trip.days.flatMap((d) => d.items).find((i) => i.id === id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    mutate(trip.id, (t) => {
      const day = t.days.find((d) => d.id === overId);
      if (day) {
        moveItem(t, String(active.id), overId, day.items.length);
        return;
      }
      const to = findContainer(t, overId);
      if (!to || to === SAVED) return;
      const list = t.days.find((d) => d.id === to)!.items;
      moveItem(t, String(active.id), to, list.findIndex((i) => i.id === overId));
    });
  };

  const runAutoPlan = () => {
    let planned = false;
    mutate(trip.id, (t) => {
      planned = autoPlan(t, suggestions);
    });
    if (!planned) notify('Nothing to plan yet', 'Save some places in Explore first, and Auto-plan will group them into days by location.');
  };

  const jumpTo = (d: Day) => {
    setActiveDay(activeDayId === d.id ? null : d.id);
    if (collapsed.has(d.id)) {
      const n = new Set(collapsed);
      n.delete(d.id);
      setCollapsed(n);
    }
    document.getElementById(`day-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalStops = trip.days.reduce((n, d) => n + d.items.length, 0);
  const allCollapsed = collapsed.size === trip.days.length;

  return (
    <div className="itinerary">
      <div className="itin-bar">
        <div className="day-strip" role="toolbar" aria-label="Jump to day">
          {trip.days.map((d, i) => (
            <button
              key={d.id}
              className={`day-chip ${activeDayId === d.id ? 'on' : ''}`}
              style={{ '--day': dayColor(i) } as React.CSSProperties}
              onClick={() => jumpTo(d)}
              title={`Day ${i + 1}: show on map`}
            >
              <span className="day-chip-wd">{formatDate(d.date, { weekday: 'short' })}</span>
              <span className="day-chip-num">{formatDate(d.date, { day: 'numeric' })}</span>
              <span className="day-chip-dots">
                {Array.from({ length: Math.min(d.items.length, 4) }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
            </button>
          ))}
        </div>
        <div className="itin-actions">
          <button
            className="icon-btn sm"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(trip.days.map((d) => d.id)))}
            aria-label={allCollapsed ? 'Expand all days' : 'Collapse all days'}
            title={allCollapsed ? 'Expand all days' : 'Collapse all days'}
          >
            {allCollapsed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
          </button>
          <button className="btn sm primary" onClick={runAutoPlan} title={trip.saved.length ? 'Group your saved places into days by location' : 'Fill your days with top-rated places'}>
            <Wand2 size={14} /> Auto-plan
          </button>
        </div>
      </div>

      <div className="itin-summary">
        <span>
          <strong>{totalStops}</strong> stops over <strong>{trip.days.length}</strong> days
        </span>
        {trip.saved.length > 0 && (
          <Link to={`/trip/${trip.id}/explore?view=saved`} className="saved-pill">
            <Heart size={13} fill="currentColor" /> {trip.saved.length} saved {trip.saved.length === 1 ? 'place' : 'places'} to schedule <ChevronRight size={14} />
          </Link>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="days">
          {trip.days.map((d, i) => (
            <DaySection
              key={d.id}
              trip={trip}
              day={d}
              index={i}
              catalog={catalog}
              suggestions={suggestions}
              collapsed={collapsed.has(d.id)}
              onToggle={() => {
                const n = new Set(collapsed);
                n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                setCollapsed(n);
              }}
            />
          ))}
        </div>
        <DragOverlay>{dragging && <StopCard trip={trip} item={dragging} color="var(--accent)" overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function DaySection({
  trip,
  day,
  index,
  catalog,
  suggestions,
  collapsed,
  onToggle,
}: {
  trip: Trip;
  day: Day;
  index: number;
  catalog: Place[];
  suggestions: Place[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const mutate = useStore((s) => s.mutate);
  const { activeDayId, setActiveDay } = useUI();
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const color = dayColor(index);
  const km = routeDistance(day.items);
  const visitMin = day.items.reduce((s, i) => s + (i.place.duration ?? 60), 0);
  const cost = day.items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const active = activeDayId === day.id;

  const optimize = () =>
    mutate(trip.id, (t) => {
      const d = t.days.find((x) => x.id === day.id)!;
      d.items = optimizeOrder(d.items);
    });

  return (
    <section id={`day-${day.id}`} className={`day ${active ? 'day-active' : ''}`} style={{ '--day': color } as React.CSSProperties}>
      <header className="day-head">
        <button className="day-badge" onClick={onToggle} aria-expanded={!collapsed} aria-label={`Day ${index + 1}, ${collapsed ? 'expand' : 'collapse'}`}>
          <span>{formatDate(day.date, { weekday: 'short' })}</span>
          <strong>{formatDate(day.date, { day: 'numeric' })}</strong>
        </button>
        <div className="grow">
          <div className="day-title-row">
            <h3>Day {index + 1}</h3>
            <span className="muted small">{formatDate(day.date, { month: 'long', day: 'numeric' })}</span>
          </div>
          <InlineEdit
            className="day-subtitle"
            value={day.title ?? ''}
            placeholder="Name this day"
            onChange={(v) => mutate(trip.id, (t) => void (t.days.find((x) => x.id === day.id)!.title = v))}
          />
          {day.items.length > 0 && (
            <div className="day-meta">
              <span>
                <MapPin size={12} /> {day.items.length} {day.items.length === 1 ? 'stop' : 'stops'}
              </span>
              {km > 0 && (
                <span>
                  <Route size={12} /> {formatKm(km)}
                </span>
              )}
              <span>
                <Clock size={12} /> ~{formatMinutes(visitMin)}
              </span>
              {cost > 0 && <span>{money(cost, trip.currency, true)}</span>}
            </div>
          )}
        </div>
        <div className="day-actions">
          {day.items.length > 2 && (
            <button className="btn xs" onClick={optimize} title="Reorder stops to minimize travel">
              <Wand2 size={12} /> Optimize
            </button>
          )}
          <button className={`icon-btn sm ${active ? 'on' : ''}`} title="Show only this day on the map" aria-pressed={active} onClick={() => setActiveDay(active ? null : day.id)}>
            <Crosshair size={15} />
          </button>
          <button className="icon-btn sm" onClick={onToggle} aria-label={collapsed ? 'Expand day' : 'Collapse day'}>
            <ChevronDown size={16} className={`chev ${collapsed ? 'rot' : ''}`} />
          </button>
        </div>
      </header>
      {collapsed ? (
        day.items.length > 0 && <div className="day-collapsed">{day.items.map((i) => i.place.name).join(' · ')}</div>
      ) : (
        <>
          <div ref={setNodeRef} className={`timeline ${isOver ? 'drop-over' : ''} ${day.items.length ? '' : 'empty'}`}>
            <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {day.items.map((it, i) => (
                <div key={it.id}>
                  {i > 0 && <TravelSegment from={day.items[i - 1].place} to={it.place} />}
                  <SortableStop trip={trip} item={it} color={color} number={i + 1} />
                </div>
              ))}
            </SortableContext>
            {day.items.length === 0 && <div className="drop-hint">Nothing planned yet. Add a stop below or drag one here.</div>}
          </div>
          <PlaceSearch
            catalog={catalog}
            near={trip.destination}
            suggestions={[...trip.saved.map((s) => s.place), ...suggestions]}
            placeholder="Add a stop"
            onPick={(p) =>
              mutate(trip.id, (t) => {
                const d = t.days.find((x) => x.id === day.id)!;
                const savedIdx = t.saved.findIndex((s) => s.place.id === p.id);
                d.items.push(savedIdx >= 0 ? t.saved.splice(savedIdx, 1)[0] : makeItem(p));
              })
            }
          />
        </>
      )}
    </section>
  );
}

function TravelSegment({ from, to }: { from: Place; to: Place }) {
  const km = distanceKm(from, to);
  const t = travelEstimate(km);
  const icon = t.mode === 'walk' ? '🚶' : t.mode === 'transit' ? '🚇' : '🚗';
  const url = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${t.mode === 'walk' ? 'walking' : t.mode === 'transit' ? 'transit' : 'driving'}`;
  return (
    <a className="segment" href={url} target="_blank" rel="noreferrer" title="Open directions">
      <span>{icon}</span> {formatMinutes(t.minutes)} · {formatKm(km)}
    </a>
  );
}

function SortableStop({ trip, item, color, number }: { trip: Trip; item: PlanItem; color: string; number: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} className="stop" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <span className="stop-marker" style={{ background: color }}>
        {number}
      </span>
      <StopCard trip={trip} item={item} color={color} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function StopCard({
  trip,
  item,
  color,
  handleProps,
  overlay,
}: {
  trip: Trip;
  item: PlanItem;
  color: string;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const mutate = useStore((s) => s.mutate);
  const { focusOn, setHover } = useUI();
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[item.place.category];
  const update = (patch: Partial<PlanItem>) =>
    mutate(trip.id, (t) => {
      const found = t.days.flatMap((d) => d.items).find((i) => i.id === item.id);
      if (found) Object.assign(found, patch);
    });
  const remove = () => mutate(trip.id, (t) => t.days.forEach((d) => (d.items = d.items.filter((i) => i.id !== item.id))));
  const moveTo = (container: string) => mutate(trip.id, (t) => moveItem(t, item.id, container, Infinity));

  return (
    <div
      className={`stop-card ${open ? 'open' : ''} ${overlay ? 'stop-overlay' : ''}`}
      style={overlay ? ({ '--day': color } as React.CSSProperties) : undefined}
      onMouseEnter={() => setHover(item.id)}
      onMouseLeave={() => setHover(null)}
    >
      <div className="stop-head">
        <button className="stop-main" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="stop-name">{item.place.name}</span>
          <span className="stop-meta">
            <span style={{ color: meta.color }}>
              {meta.emoji} {meta.label}
            </span>
            <Stars rating={item.place.rating} />
            {item.place.duration && <span>~{formatMinutes(item.place.duration)}</span>}
            {item.cost ? <span>{money(item.cost, trip.currency, true)}</span> : null}
          </span>
          {item.note && !open && <span className="stop-note">{item.note}</span>}
        </button>
        {item.time && <span className="time-chip">{formatTime(item.time)}</span>}
        {!overlay && (
          <>
            <Menu
              trigger={(toggle) => (
                <button className="icon-btn xs" onClick={toggle} aria-label={`Actions for ${item.place.name}`}>
                  <MoreHorizontal size={15} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <button onClick={() => (close(), focusOn({ lat: item.place.lat, lng: item.place.lng, id: item.id }))}>
                    <MapPin size={14} /> Show on map
                  </button>
                  <button onClick={() => (close(), setOpen(true))}>
                    <StickyNote size={14} /> Edit time, cost & note
                  </button>
                  <div className="menu-sep">Move to</div>
                  {trip.days.map((d, i) =>
                    d.items.some((x) => x.id === item.id) ? null : (
                      <button key={d.id} onClick={() => (close(), moveTo(d.id))}>
                        <span className="dot" style={{ background: dayColor(i) }} /> Day {i + 1} · {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </button>
                    ),
                  )}
                  <button onClick={() => (close(), moveTo(SAVED))}>
                    <Heart size={14} /> Back to saved places
                  </button>
                  <div className="menu-sep" />
                  <button className="danger" onClick={() => (close(), remove())}>
                    <Trash2 size={14} /> Remove from trip
                  </button>
                </>
              )}
            </Menu>
            <button className="drag-handle" aria-label={`Drag ${item.place.name}`} {...handleProps}>
              <GripVertical size={16} />
            </button>
          </>
        )}
      </div>
      {open && !overlay && (
        <div className="stop-edit">
          <div className="stop-fields">
            <label className="mini-field">
              <Clock size={13} />
              <input type="time" value={item.time ?? ''} onChange={(e) => update({ time: e.target.value || undefined })} aria-label="Time" />
            </label>
            <label className="mini-field">
              <span>{trip.currency}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost"
                value={item.cost ?? ''}
                onChange={(e) => update({ cost: e.target.value ? Number(e.target.value) : undefined })}
                aria-label="Cost"
              />
            </label>
            <button className="btn xs ghost" onClick={() => focusOn({ lat: item.place.lat, lng: item.place.lng, id: item.id })}>
              <MapPin size={12} /> Map
            </button>
          </div>
          <textarea rows={2} placeholder="Tickets, opening hours, what to order…" value={item.note ?? ''} onChange={(e) => update({ note: e.target.value })} aria-label="Note" />
          {item.place.description && <p className="stop-desc">{item.place.description}</p>}
        </div>
      )}
    </div>
  );
}
