import type { ExpenseCategory, PlaceCategory, ReservationType } from '../types';

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/* ---------- Dates (always local YYYY-MM-DD strings) ---------- */

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function eachDate(start: string, end: string): string[] {
  const n = daysBetween(start, end);
  if (!(n >= 0)) return [start];
  return Array.from({ length: Math.min(n, 89) + 1 }, (_, i) => addDays(start, i));
}

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!s) return '';
  return parseDate(s).toLocaleDateString(undefined, opts);
}

export function formatRange(start: string, end: string): string {
  if (!start) return 'Dates not set';
  const a = parseDate(start);
  const b = parseDate(end || start);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const right = b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return start === end ? right : `${left} – ${right}`;
}

export function tripStatus(start: string, end: string): { label: string; kind: 'upcoming' | 'ongoing' | 'past' } {
  const t = today();
  if (t < start) {
    const n = daysBetween(t, start);
    return { label: n === 1 ? 'Tomorrow' : `In ${n} days`, kind: 'upcoming' };
  }
  if (t > end) return { label: 'Completed', kind: 'past' };
  return { label: `Day ${daysBetween(start, t) + 1}`, kind: 'ongoing' };
}

/* ---------- Money ---------- */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'THB', 'TRY', 'AUD', 'CAD', 'CHF', 'ILS', 'MXN', 'INR', 'CNY', 'BRL', 'ZAR', 'SEK', 'NOK', 'DKK', 'NZD', 'SGD', 'KRW', 'AED'];

export function money(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: compact || ['JPY', 'KRW'].includes(currency) ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
}

/* ---------- Geo ---------- */

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function travelEstimate(km: number): { mode: 'walk' | 'transit' | 'drive'; minutes: number } {
  if (km < 1.6) return { mode: 'walk', minutes: Math.max(1, Math.round((km / 4.8) * 60)) };
  if (km < 25) return { mode: 'transit', minutes: Math.round((km / 18) * 60 + 6) };
  return { mode: 'drive', minutes: Math.round((km / 60) * 60 + 10) };
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ---------- Display metadata ---------- */

export const CATEGORY_META: Record<PlaceCategory, { label: string; emoji: string; color: string }> = {
  sight: { label: 'Sights', emoji: '🏛️', color: '#6366f1' },
  museum: { label: 'Museums', emoji: '🖼️', color: '#8b5cf6' },
  food: { label: 'Food', emoji: '🍜', color: '#f97316' },
  cafe: { label: 'Cafés', emoji: '☕', color: '#a16207' },
  nightlife: { label: 'Nightlife', emoji: '🍸', color: '#db2777' },
  nature: { label: 'Nature', emoji: '🌳', color: '#16a34a' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#0891b2' },
  activity: { label: 'Activities', emoji: '🎟️', color: '#e11d48' },
  lodging: { label: 'Lodging', emoji: '🏨', color: '#0d9488' },
  other: { label: 'Other', emoji: '📍', color: '#64748b' },
};

export const RESERVATION_META: Record<ReservationType, { label: string; emoji: string }> = {
  flight: { label: 'Flight', emoji: '✈️' },
  lodging: { label: 'Lodging', emoji: '🏨' },
  car: { label: 'Rental car', emoji: '🚗' },
  train: { label: 'Train / Bus', emoji: '🚆' },
  restaurant: { label: 'Restaurant', emoji: '🍽️' },
  activity: { label: 'Activity', emoji: '🎟️' },
  other: { label: 'Other', emoji: '📎' },
};

export const EXPENSE_META: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
  lodging: { label: 'Lodging', emoji: '🏨', color: '#0d9488' },
  transport: { label: 'Transport', emoji: '🚕', color: '#2563eb' },
  food: { label: 'Food & drink', emoji: '🍽️', color: '#f97316' },
  activities: { label: 'Activities', emoji: '🎟️', color: '#db2777' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#7c3aed' },
  other: { label: 'Other', emoji: '💳', color: '#64748b' },
};

export const DAY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7'];
export const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

export const TRAVELER_COLORS = ['#e2366b', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export function priceLabel(p?: number): string {
  if (p === undefined) return '';
  return p === 0 ? 'Free' : '$'.repeat(p);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

export function coverGradient(hue: number): string {
  return `linear-gradient(135deg, hsl(${hue} 82% 60%) 0%, hsl(${(hue + 14) % 360} 74% 47%) 55%, hsl(${(hue + 28) % 360} 68% 34%) 100%)`;
}

export function hueFromString(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
