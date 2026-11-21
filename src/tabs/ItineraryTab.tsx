import { useMemo, useState } from 'react';
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
import { ChevronDown, Clock, Crosshair, GripVertical, Heart, MapPin, MoreHorizontal, Route, StickyNote, Trash2, Wand2 } from 'lucide-react';
import { SAVED, type Day, type Place, type PlanItem, type Trip } from '../types';
import { useStore, useUI } from '../store';
import { InlineEdit, Menu, Stars } from '../components/ui';
import { PlaceSearch } from '../components/PlaceSearch';
import { clusterIntoDays, findContainer, makeItem, moveItem, optimizeOrder, routeDistance } from '../lib/tripLogic';
import { CATEGORY_META, dayColor, distanceKm, formatDate, formatKm, formatMinutes, money, travelEstimate } from '../lib/utils';

export function ItineraryTab({ trip, catalog }: { trip: Trip; catalog: Place[] }) {
  const mutate = useStore((s) => s.mutate);
  const [dragging, setDragging] = useState<PlanItem | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const usedIds = useMemo(() => new Set([...trip.saved, ...trip.days.flatMap((d) => d.items)].map((i) => i.place.id)), [trip]);
  const suggestions = useMemo(
    () => [...catalog].filter((p) => !usedIds.has(p.id)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [catalog, usedIds],
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging([...trip.saved, ...trip.days.flatMap((d) => d.items)].find((i) => i.id === id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    mutate(trip.id, (t) => {
      const isContainer = overId === SAVED || t.days.some((d) => d.id === overId);
      if (isContainer) {
        const list = overId === SAVED ? t.saved : t.days.find((d) => d.id === overId)!.items;
        moveItem(t, String(active.id), overId, list.length);
      } else {
        const to = findContainer(t, overId);
        if (!to) return;
        const list = to === SAVED ? t.saved : t.days.find((d) => d.id === to)!.items;
        moveItem(t, String(active.id), to, list.findIndex((i) => i.id === overId));
      }
    });
  };

  const autoPlan = () => {
    const pool = trip.saved.length ? null : suggestions.slice(0, Math.min(suggestions.length, trip.days.length * 4));
    if (!trip.saved.length && !pool?.length) {
      alert('Save some places from the Explore tab first, then auto-plan will organize them into days.');
      return;
    }
    mutate(trip.id, (t) => {
      const items = pool ? pool.map(makeItem) : t.saved;
      // aim for at least ~2 stops per day rather than one lonely stop each
      const k = Math.min(t.days.length, Math.max(1, Math.ceil(items.length / 2)));
      const groups = clusterIntoDays(items, k);
      // give the busiest clusters to the emptiest days
      const order = t.days.map((d, i) => ({ d, i })).sort((a, b) => a.d.items.length - b.d.items.length);
      groups.sort((a, b) => b.length - a.length).forEach((g, gi) => order[gi] && order[gi].d.items.push(...g));
      if (!pool) t.saved = [];
    });
  };

  const totalPlaces = trip.days.reduce((n, d) => n + d.items.length, 0);
  const allCollapsed = collapsed.size === trip.days.length;

  return (
    <div className="itinerary">
      <div className="toolbar">
        <div className="muted small grow" title="Drag stops to reorder them or move them between days">
          {totalPlaces} stops · {trip.days.length} days
        </div>
        <button className="btn sm" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(trip.days.map((d) => d.id)))}>
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
        <button className="btn sm primary" onClick={autoPlan} title={trip.saved.length ? 'Organize your saved places into days by location' : 'Fill your days with top-rated places nearby'}>
          <Wand2 size={14} /> Auto-plan
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <SavedList trip={trip} catalog={catalog} suggestions={suggestions} />
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
        <DragOverlay>{dragging && <ItemCard trip={trip} item={dragging} color="var(--accent)" overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Droppable({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'drop-over' : ''}`}>
      {children}
    </div>
  );
}

function SavedList({ trip, catalog, suggestions }: { trip: Trip; catalog: Place[]; suggestions: Place[] }) {
  const mutate = useStore((s) => s.mutate);
  const [open, setOpen] = useState(true);
  return (
    <section className="day saved-list">
      <header className="day-head">
        <button className="day-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={16} className={open ? '' : 'rot'} />
        </button>
        <Heart size={16} className="heart" />
        <div className="grow">
          <h3>Places to visit</h3>
          <div className="muted small">{trip.saved.length} saved · ideas not yet scheduled</div>
        </div>
      </header>
      {open && (
        <>
          <Droppable id={SAVED} className="day-items">
            <SortableContext items={trip.saved.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {trip.saved.map((it) => (
                <SortableItem key={it.id} trip={trip} item={it} color="#e2366b" />
              ))}
            </SortableContext>
            {trip.saved.length === 0 && <div className="drop-hint">Save places from Explore, or drag stops here to unschedule them</div>}
          </Droppable>
          <PlaceSearch
            catalog={catalog}
            near={trip.destination}
            suggestions={suggestions}
            placeholder="Add a place to your list"
            onPick={(p) => mutate(trip.id, (t) => void t.saved.push(makeItem(p)))}
          />
        </>
      )}
    </section>
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
    <section className={`day ${active ? 'day-active' : ''}`} style={{ '--day': color } as React.CSSProperties}>
      <header className="day-head">
        <button className="day-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label="Toggle day">
          <ChevronDown size={16} className={collapsed ? 'rot' : ''} />
        </button>
        <span className="day-dot" />
        <div className="grow">
          <div className="day-title-row">
            <h3>
              {formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <span className="muted small">Day {index + 1}</span>
          </div>
          <InlineEdit
            className="day-subtitle"
            value={day.title ?? ''}
            placeholder="Add a subtitle"
            onChange={(v) => mutate(trip.id, (t) => void (t.days.find((x) => x.id === day.id)!.title = v))}
          />
          {day.items.length > 0 && (
            <div className="day-meta">
              <span>{day.items.length} stops</span>
              {km > 0 && (
                <span>
                  <Route size={12} /> {formatKm(km)}
                </span>
              )}
              <span>
                <Clock size={12} /> ~{formatMinutes(visitMin)} of visits
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
          <button className={`icon-btn sm ${active ? 'on' : ''}`} title="Show only this day on map" aria-pressed={active} onClick={() => setActiveDay(active ? null : day.id)}>
            <Crosshair size={14} />
          </button>
        </div>
      </header>
      {!collapsed && (
        <>
          <Droppable id={day.id} className="day-items">
            <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {day.items.map((it, i) => (
                <div key={it.id}>
                  {i > 0 && <TravelSegment from={day.items[i - 1].place} to={it.place} />}
                  <SortableItem trip={trip} item={it} color={color} number={i + 1} />
                </div>
              ))}
            </SortableContext>
            {day.items.length === 0 && <div className="drop-hint">Drag places here or add one below</div>}
          </Droppable>
          <PlaceSearch
            catalog={catalog}
            near={trip.destination}
            suggestions={[...trip.saved.map((s) => s.place), ...suggestions]}
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
      {collapsed && day.items.length > 0 && (
        <div className="day-collapsed">
          {day.items.map((i) => i.place.name).join(' · ')}
        </div>
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

function SortableItem({ trip, item, color, number }: { trip: Trip; item: PlanItem; color: string; number?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}>
      <ItemCard trip={trip} item={item} color={color} number={number} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ItemCard({
  trip,
  item,
  color,
  number,
  handleProps,
  overlay,
}: {
  trip: Trip;
  item: PlanItem;
  color: string;
  number?: number;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const mutate = useStore((s) => s.mutate);
  const { focusOn, setHover } = useUI();
  const [showNote, setShowNote] = useState(!!item.note);
  const meta = CATEGORY_META[item.place.category];
  const update = (patch: Partial<PlanItem>) =>
    mutate(trip.id, (t) => {
      const list = [...t.saved, ...t.days.flatMap((d) => d.items)];
      Object.assign(list.find((i) => i.id === item.id)!, patch);
    });
  const remove = () =>
    mutate(trip.id, (t) => {
      t.saved = t.saved.filter((i) => i.id !== item.id);
      t.days.forEach((d) => (d.items = d.items.filter((i) => i.id !== item.id)));
    });
  const moveTo = (container: string) => mutate(trip.id, (t) => moveItem(t, item.id, container, Infinity));

  return (
    <div className={`item ${overlay ? 'item-overlay' : ''}`} onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover(null)}>
      <button className="drag-handle" aria-label={`Drag ${item.place.name}`} {...handleProps}>
        <GripVertical size={16} />
      </button>
      <span className="item-num" style={{ background: color }}>
        {number ?? meta.emoji}
      </span>
      <div className="item-body">
        <div className="item-top">
          <button className="item-name" onClick={() => focusOn({ lat: item.place.lat, lng: item.place.lng, id: item.id })}>
            {item.place.name}
          </button>
          <Menu
            trigger={(toggle) => (
              <button className="icon-btn xs" onClick={toggle} aria-label="Item actions">
                <MoreHorizontal size={14} />
              </button>
            )}
          >
            {(close) => (
              <>
                <button onClick={() => (close(), focusOn({ lat: item.place.lat, lng: item.place.lng, id: item.id }))}>
                  <MapPin size={14} /> Show on map
                </button>
                <button onClick={() => (close(), setShowNote(true))}>
                  <StickyNote size={14} /> Add note
                </button>
                <div className="menu-sep">Move to</div>
                {trip.saved.every((s) => s.id !== item.id) && (
                  <button onClick={() => (close(), moveTo(SAVED))}>
                    <Heart size={14} /> Places to visit
                  </button>
                )}
                {trip.days.map((d, i) =>
                  d.items.some((x) => x.id === item.id) ? null : (
                    <button key={d.id} onClick={() => (close(), moveTo(d.id))}>
                      <span className="dot" style={{ background: dayColor(i) }} /> Day {i + 1} · {formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </button>
                  ),
                )}
                <div className="menu-sep" />
                <button className="danger" onClick={() => (close(), remove())}>
                  <Trash2 size={14} /> Remove
                </button>
              </>
            )}
          </Menu>
        </div>
        <div className="item-meta">
          <span className="cat" style={{ color: meta.color }}>
            {meta.emoji} {meta.label}
          </span>
          <Stars rating={item.place.rating} />
          {item.place.duration && <span>~{formatMinutes(item.place.duration)}</span>}
        </div>
        {!overlay && (
          <div className="item-fields">
            <label className="mini-field">
              <Clock size={12} />
              <input type="time" value={item.time ?? ''} onChange={(e) => update({ time: e.target.value || undefined })} aria-label="Time" />
            </label>
            <label className="mini-field">
              <span className="muted">{trip.currency}</span>
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
            {!showNote && (
              <button className="link small" onClick={() => setShowNote(true)}>
                + Note
              </button>
            )}
          </div>
        )}
        {showNote && !overlay && (
          <textarea
            className="item-note"
            rows={2}
            autoFocus={!item.note}
            placeholder="Tickets, opening hours, what to order…"
            value={item.note ?? ''}
            onChange={(e) => update({ note: e.target.value })}
            onBlur={() => !item.note && setShowNote(false)}
          />
        )}
      </div>
    </div>
  );
}

