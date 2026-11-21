import { describe, expect, it } from 'vitest';
import { SAVED, type Place, type Trip } from '../types';
import { balances, clusterIntoDays, createTrip, makeItem, moveItem, optimizeOrder, rebuildDays, routeDistance, settleUp } from './tripLogic';
import { eachDate } from './utils';

const dest = { id: 'x', name: 'Testville', country: 'Nowhere', lat: 0, lng: 0, hue: 10, emoji: '📍' };
const place = (id: string, lat: number, lng: number): Place => ({ id, name: id, category: 'sight', lat, lng });

function trip(): Trip {
  return createTrip({ destination: dest, startDate: '2027-03-01', endDate: '2027-03-03', travelers: ['A', 'B', 'C'] });
}

describe('dates', () => {
  it('creates one day per date, inclusive', () => {
    const t = trip();
    expect(t.days.map((d) => d.date)).toEqual(['2027-03-01', '2027-03-02', '2027-03-03']);
    expect(eachDate('2027-12-30', '2028-01-02')).toHaveLength(4);
  });

  it('keeps items on surviving dates and returns orphaned items to saved', () => {
    const t = trip();
    t.days[0].items.push(makeItem(place('a', 0, 0)));
    t.days[2].items.push(makeItem(place('c', 0, 0)));
    const r = rebuildDays('2027-02-28', '2027-03-02', t.days, t.saved);
    expect(r.days.map((d) => d.date)).toEqual(['2027-02-28', '2027-03-01', '2027-03-02']);
    expect(r.days[1].items[0].place.id).toBe('a');
    expect(r.saved.map((i) => i.place.id)).toEqual(['c']);
  });
});

describe('moveItem', () => {
  it('reorders within a day like arrayMove', () => {
    const t = trip();
    const items = ['a', 'b', 'c'].map((id) => makeItem(place(id, 0, 0)));
    t.days[0].items = items;
    moveItem(t, items[0].id, t.days[0].id, 2);
    expect(t.days[0].items.map((i) => i.place.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves across containers including the saved list', () => {
    const t = trip();
    const it = makeItem(place('a', 0, 0));
    t.saved.push(it);
    moveItem(t, it.id, t.days[1].id, 0);
    expect(t.saved).toHaveLength(0);
    expect(t.days[1].items[0].id).toBe(it.id);
    moveItem(t, it.id, SAVED, Infinity);
    expect(t.saved[0].id).toBe(it.id);
  });
});

describe('routing', () => {
  it('optimizeOrder keeps the first stop and does not lengthen the route', () => {
    const items = [place('s', 0, 0), place('far', 0, 0.09), place('near', 0, 0.01), place('mid', 0, 0.05)].map(makeItem);
    const out = optimizeOrder(items);
    expect(out[0].place.id).toBe('s');
    expect(out.map((i) => i.place.id)).toEqual(['s', 'near', 'mid', 'far']);
    expect(routeDistance(out)).toBeLessThanOrEqual(routeDistance(items));
  });

  it('clusterIntoDays groups nearby places and returns n groups', () => {
    const west = [place('w1', 0, 0), place('w2', 0, 0.001), place('w3', 0.001, 0)];
    const east = [place('e1', 0, 1), place('e2', 0, 1.001), place('e3', 0.001, 1)];
    const groups = clusterIntoDays([...west, ...east].map(makeItem), 3);
    expect(groups).toHaveLength(3);
    expect(groups.flat()).toHaveLength(6);
    for (const g of groups) {
      const sides = new Set(g.map((i) => i.place.id[0]));
      expect(sides.size).toBeLessThanOrEqual(1);
    }
  });
});

describe('budget', () => {
  it('computes balances and settles up', () => {
    const t = trip();
    const [a, b, c] = t.travelers.map((x) => x.id);
    const exps = [
      { id: '1', title: 'Hotel', amount: 300, category: 'lodging' as const, paidBy: a, splitWith: [a, b, c] },
      { id: '2', title: 'Dinner', amount: 60, category: 'food' as const, paidBy: b, splitWith: [b, c] },
    ];
    const bal = balances(exps, t.travelers);
    expect(bal[a]).toBeCloseTo(200);
    expect(bal[b]).toBeCloseTo(-70);
    expect(bal[c]).toBeCloseTo(-130);
    const tr = settleUp(bal);
    expect(tr.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(200);
    expect(tr.every((x) => x.to === a)).toBe(true);
  });
});
