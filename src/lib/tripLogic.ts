import { SAVED, type Day, type Destination, type Expense, type PackingItem, type Place, type PlanItem, type Traveler, type Trip } from '../types';
import { TRAVELER_COLORS, distanceKm, eachDate, uid } from './utils';

/** Rebuild the day list for a date range, keeping items on dates that still exist.
 *  Items on dates that fall out of range are moved back to the saved list. */
export function rebuildDays(start: string, end: string, days: Day[], saved: PlanItem[]): { days: Day[]; saved: PlanItem[] } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = eachDate(start, end);
  const keep = new Set(dates);
  const orphaned = days.filter((d) => !keep.has(d.date)).flatMap((d) => d.items);
  return {
    days: dates.map((date) => byDate.get(date) ?? { id: uid('d_'), date, items: [] }),
    saved: [...saved, ...orphaned],
  };
}

export function findContainer(trip: Trip, itemId: string): string | undefined {
  if (trip.saved.some((i) => i.id === itemId)) return SAVED;
  return trip.days.find((d) => d.items.some((i) => i.id === itemId))?.id;
}

export function getList(trip: Trip, containerId: string): PlanItem[] | undefined {
  if (containerId === SAVED) return trip.saved;
  return trip.days.find((d) => d.id === containerId)?.items;
}

/** Mutates the trip: moves an item to a container at an index (index past end = append). */
export function moveItem(trip: Trip, itemId: string, toContainer: string, toIndex: number): void {
  const from = findContainer(trip, itemId);
  if (!from) return;
  const src = getList(trip, from)!;
  const dst = getList(trip, toContainer);
  if (!dst) return;
  const fromIndex = src.findIndex((i) => i.id === itemId);
  const [item] = src.splice(fromIndex, 1);
  const idx = Math.max(0, Math.min(toIndex, dst.length));
  dst.splice(idx, 0, item);
}

/** Nearest-neighbour ordering, followed by a 2-opt pass. The first stop stays first. */
export function optimizeOrder<T extends { place: { lat: number; lng: number } }>(items: T[]): T[] {
  if (items.length < 3) return items.slice();
  const rest = items.slice(1);
  const route = [items[0]];
  while (rest.length) {
    const last = route[route.length - 1];
    let best = 0;
    let bestD = Infinity;
    rest.forEach((it, i) => {
      const d = distanceKm(last.place, it.place);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    route.push(rest.splice(best, 1)[0]);
  }
  // 2-opt improvement on an open path
  const dist = (a: T, b: T) => distanceKm(a.place, b.place);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const before = dist(route[i - 1], route[i]) + (k + 1 < route.length ? dist(route[k], route[k + 1]) : 0);
        const after = dist(route[i - 1], route[k]) + (k + 1 < route.length ? dist(route[i], route[k + 1]) : 0);
        if (after + 1e-9 < before) {
          const seg = route.slice(i, k + 1).reverse();
          route.splice(i, seg.length, ...seg);
          improved = true;
        }
      }
    }
  }
  return route;
}

export function routeDistance(items: { place: { lat: number; lng: number } }[]): number {
  let km = 0;
  for (let i = 1; i < items.length; i++) km += distanceKm(items[i - 1].place, items[i].place);
  return km;
}

/** Group places into `n` geographic clusters (simple k-means), each sorted into a route. */
export function clusterIntoDays<T extends { place: Place }>(items: T[], n: number): T[][] {
  if (n <= 0) return [];
  if (items.length === 0) return Array.from({ length: n }, () => []);
  const k = Math.min(n, items.length);
  // seed with farthest-point sampling for stable, spread-out centers
  const centers: { lat: number; lng: number }[] = [items[0].place];
  while (centers.length < k) {
    let best = items[0].place;
    let bestD = -1;
    for (const it of items) {
      const d = Math.min(...centers.map((c) => distanceKm(c, it.place)));
      if (d > bestD) {
        bestD = d;
        best = it.place;
      }
    }
    centers.push(best);
  }
  let groups: T[][] = [];
  for (let iter = 0; iter < 12; iter++) {
    groups = centers.map(() => []);
    for (const it of items) {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const d = distanceKm(c, it.place);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      groups[bi].push(it);
    }
    groups.forEach((g, i) => {
      if (g.length) {
        centers[i] = {
          lat: g.reduce((s, x) => s + x.place.lat, 0) / g.length,
          lng: g.reduce((s, x) => s + x.place.lng, 0) / g.length,
        };
      }
    });
  }
  // balance: move items from overloaded days to the lightest day
  const cap = Math.ceil(items.length / k) + 1;
  for (const g of groups) {
    while (g.length > cap) {
      const lightest = groups.reduce((a, b) => (b.length < a.length ? b : a));
      if (lightest.length >= g.length - 1) break;
      lightest.push(g.pop()!);
    }
  }
  const sorted = groups.map((g) => optimizeOrder(g));
  while (sorted.length < n) sorted.push([]);
  return sorted;
}

export function makeItem(place: Place): PlanItem {
  return { id: uid('i_'), place };
}

/* ---------- Budget ---------- */

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function balances(expenses: Expense[], travelers: Traveler[]): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(travelers.map((t) => [t.id, 0]));
  for (const e of expenses) {
    const split = e.splitWith.filter((id) => id in bal);
    if (!e.paidBy || !(e.paidBy in bal) || split.length === 0) continue;
    bal[e.paidBy] += e.amount;
    const share = e.amount / split.length;
    for (const id of split) bal[id] -= share;
  }
  return bal;
}

/** Greedy settlement: minimal-ish set of transfers to zero out balances. */
export function settleUp(bal: Record<string, number>): Transfer[] {
  const debtors = Object.entries(bal).filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amt * 100) / 100 });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return out;
}

/* ---------- Packing ---------- */

export const PACKING_TEMPLATE: Record<string, string[]> = {
  Essentials: ['Passport / ID', 'Wallet & cards', 'Phone & charger', 'Travel insurance info', 'Keys'],
  Clothing: ['Underwear & socks', 'T-shirts', 'Pants / shorts', 'Light jacket', 'Comfortable walking shoes', 'Sleepwear'],
  Toiletries: ['Toothbrush & toothpaste', 'Deodorant', 'Sunscreen', 'Medications', 'Shampoo'],
  Tech: ['Power adapter', 'Power bank', 'Headphones'],
  Extras: ['Reusable water bottle', 'Day bag', 'Sunglasses', 'Snacks for the flight'],
};

export function packingFromTemplate(existing: PackingItem[]): PackingItem[] {
  const have = new Set(existing.map((p) => p.text.toLowerCase()));
  const add: PackingItem[] = [];
  for (const [group, items] of Object.entries(PACKING_TEMPLATE)) {
    for (const text of items) if (!have.has(text.toLowerCase())) add.push({ id: uid('p_'), text, done: false, group });
  }
  return [...existing, ...add];
}

/* ---------- Creation ---------- */

export interface NewTripInput {
  name?: string;
  destination: Destination;
  startDate: string;
  endDate: string;
  travelers?: string[];
  currency?: string;
  budget?: number;
}

export function createTrip(input: NewTripInput): Trip {
  const { days } = rebuildDays(input.startDate, input.endDate, [], []);
  const names = input.travelers?.filter((n) => n.trim()).length ? input.travelers!.filter((n) => n.trim()) : ['You'];
  const now = Date.now();
  return {
    id: uid('t_'),
    name: input.name?.trim() || `Trip to ${input.destination.name}`,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    currency: input.currency || input.destination.currency || 'USD',
    budget: input.budget,
    notes: '',
    travelers: names.map((name, i) => ({ id: uid('u_'), name: name.trim(), color: TRAVELER_COLORS[i % TRAVELER_COLORS.length] })),
    days,
    saved: [],
    reservations: [],
    expenses: [],
    packing: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Top-rated catalog places not already in the trip. */
export function suggestionsFor(trip: Trip, catalog: Place[]): Place[] {
  const used = new Set([...trip.saved, ...trip.days.flatMap((d) => d.items)].map((i) => i.place.id));
  return catalog.filter((p) => !used.has(p.id)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}

/** Mutates the trip: schedules saved places into days by location, or, with nothing saved,
 *  fills days with the given fallback places. Returns false when there is nothing to plan. */
export function autoPlan(t: Trip, fallback: Place[]): boolean {
  const useSaved = t.saved.length > 0;
  const items = useSaved ? t.saved : fallback.slice(0, t.days.length * 4).map(makeItem);
  if (!items.length || !t.days.length) return false;
  // aim for at least ~2 stops per day rather than one lonely stop each
  const k = Math.min(t.days.length, Math.max(1, Math.ceil(items.length / 2)));
  const groups = clusterIntoDays(items, k);
  // give the busiest clusters to the emptiest days
  const order = [...t.days].sort((a, b) => a.items.length - b.items.length);
  groups.sort((a, b) => b.length - a.length).forEach((g, gi) => order[gi]?.items.push(...g));
  if (useSaved) t.saved = [];
  return true;
}
