import type { Destination, Place, PlaceCategory } from '../types';
import { hueFromString } from './utils';

/* All endpoints below are free and key-less. Failures are handled by callers. */

export interface GeoResult extends Destination {}

const COUNTRY_EMOJI = (code?: string) =>
  code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : '📍';

/** City search via Open-Meteo geocoding. */
export async function searchCities(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    id: `geo-${r.id}`,
    name: r.name,
    country: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lng: r.longitude,
    timezone: r.timezone,
    hue: hueFromString(r.name),
    emoji: COUNTRY_EMOJI(r.country_code),
  }));
}

/** Point-of-interest search near a location via OpenStreetMap Nominatim. */
export async function searchPlaces(q: string, near: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const d = 0.35;
  const viewbox = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(',');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1`;
  const res = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Place search failed');
  const data = await res.json();
  return data.map((r: any) => ({
    id: `osm-${r.osm_type}-${r.osm_id}`,
    name: r.name || r.display_name.split(',')[0],
    category: osmCategory(r.category, r.type),
    lat: Number(r.lat),
    lng: Number(r.lon),
    address: r.display_name.split(',').slice(1, 4).join(',').trim(),
  }));
}

function osmCategory(cls: string, type: string): PlaceCategory {
  if (['museum', 'gallery'].includes(type)) return 'museum';
  if (['restaurant', 'fast_food', 'food_court', 'marketplace'].includes(type)) return 'food';
  if (['cafe', 'ice_cream', 'bakery'].includes(type)) return 'cafe';
  if (['bar', 'pub', 'nightclub', 'theatre', 'cinema'].includes(type)) return 'nightlife';
  if (['park', 'garden', 'beach', 'nature_reserve', 'peak', 'viewpoint'].includes(type) || cls === 'natural' || cls === 'leisure') return 'nature';
  if (cls === 'shop' || type === 'mall') return 'shopping';
  if (['hotel', 'hostel', 'guest_house', 'apartment'].includes(type)) return 'lodging';
  if (['attraction', 'monument', 'castle', 'memorial', 'place_of_worship', 'artwork', 'ruins'].includes(type) || cls === 'historic') return 'sight';
  if (['zoo', 'aquarium', 'theme_park'].includes(type)) return 'activity';
  return 'other';
}

/** Discover notable places around a non-curated destination via the Overpass API. */
export async function discoverPlaces(center: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const r = 6000;
  const around = `(around:${r},${center.lat},${center.lng})`;
  const query = `[out:json][timeout:20];
(
  nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]["name"]["wikidata"]${around};
  nwr["historic"~"^(castle|monument|memorial|ruins)$"]["name"]["wikidata"]${around};
  nwr["leisure"~"^(park|garden)$"]["name"]["wikidata"]${around};
  nwr["amenity"~"^(restaurant|cafe|bar|marketplace)$"]["name"]["wikidata"]${around};
);
out center 80;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    signal,
  });
  if (!res.ok) throw new Error('Discovery failed');
  const data = await res.json();
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const el of data.elements ?? []) {
    const name: string | undefined = el.tags?.['name:en'] || el.tags?.name;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || seen.has(name)) continue;
    seen.add(name);
    const t = el.tags;
    const type = t.tourism || t.historic || t.leisure || t.amenity;
    const cls = t.tourism ? 'tourism' : t.historic ? 'historic' : t.leisure ? 'leisure' : 'amenity';
    out.push({
      id: `osm-${el.type}-${el.id}`,
      name,
      category: osmCategory(cls, type),
      lat,
      lng,
      description: t.description || t['addr:street'] ? [t.description, t['addr:street']].filter(Boolean).join(' · ') : undefined,
    });
  }
  return out;
}

/* ---------- Weather (Open-Meteo) ---------- */

export interface DailyWeather {
  date: string;
  code: number;
  max: number;
  min: number;
  rain: number;
}

export async function fetchForecast(lat: number, lng: number, signal?: AbortSignal): Promise<DailyWeather[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Weather failed');
  const d = (await res.json()).daily;
  return d.time.map((date: string, i: number) => ({
    date,
    code: d.weather_code[i],
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    rain: d.precipitation_probability_max?.[i] ?? 0,
  }));
}

export function weatherInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Clear' };
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' };
  if (code === 3) return { emoji: '☁️', label: 'Overcast' };
  if (code <= 48) return { emoji: '🌫️', label: 'Fog' };
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle' };
  if (code <= 67) return { emoji: '🌧️', label: 'Rain' };
  if (code <= 77) return { emoji: '🌨️', label: 'Snow' };
  if (code <= 82) return { emoji: '🌧️', label: 'Showers' };
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers' };
  return { emoji: '⛈️', label: 'Thunderstorm' };
}
