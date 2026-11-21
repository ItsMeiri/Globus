import type { Place, Trip } from '../types';
import { getCurated } from '../data/destinations';
import { discoverPlaces } from './api';
import { useAsync } from './hooks';

const cache = new Map<string, Place[]>();

/** Places to explore for a trip: the built-in guide, or OpenStreetMap discovery for other cities. */
export function useCatalog(trip: Trip | undefined): { places: Place[]; loading: boolean; error: boolean; curated: boolean } {
  const curated = getCurated(trip?.destination.id);
  const key = trip && !curated ? `disc:${trip.destination.lat.toFixed(3)},${trip.destination.lng.toFixed(3)}` : null;
  const res = useAsync(key, async (signal) => {
    if (cache.has(key!)) return cache.get(key!)!;
    const places = await discoverPlaces(trip!.destination, signal);
    cache.set(key!, places);
    return places;
  });
  if (curated) return { places: curated.places, loading: false, error: false, curated: true };
  return { places: res.data ?? [], loading: res.loading, error: !!res.error, curated: false };
}
