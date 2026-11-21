import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Trip } from './types';
import { createTrip, rebuildDays, type NewTripInput } from './lib/tripLogic';
import { uid } from './lib/utils';

interface TripState {
  trips: Trip[];
  theme: 'light' | 'dark';
  addTrip: (input: NewTripInput) => string;
  importTrip: (trip: Trip) => string;
  /** Clone the trip, let the recipe mutate the clone, and save it. */
  mutate: (id: string, recipe: (draft: Trip) => void) => void;
  setDates: (id: string, start: string, end: string) => void;
  deleteTrip: (id: string) => void;
  duplicateTrip: (id: string) => string | undefined;
  toggleTheme: () => void;
}

export const useStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: [],
      theme:
        document.documentElement.dataset.theme === 'dark' ||
        (document.documentElement.dataset.theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
          ? 'dark'
          : 'light',

      addTrip: (input) => {
        const trip = createTrip(input);
        set({ trips: [trip, ...get().trips] });
        return trip.id;
      },

      importTrip: (trip) => {
        const copy: Trip = { ...structuredClone(trip), id: uid('t_'), updatedAt: Date.now() };
        set({ trips: [copy, ...get().trips] });
        return copy.id;
      },

      mutate: (id, recipe) =>
        set({
          trips: get().trips.map((t) => {
            if (t.id !== id) return t;
            const draft = structuredClone(t);
            recipe(draft);
            draft.updatedAt = Date.now();
            return draft;
          }),
        }),

      setDates: (id, start, end) =>
        get().mutate(id, (t) => {
          if (end < start) end = start;
          const r = rebuildDays(start, end, t.days, t.saved);
          t.startDate = start;
          t.endDate = end;
          t.days = r.days;
          t.saved = r.saved;
        }),

      deleteTrip: (id) => set({ trips: get().trips.filter((t) => t.id !== id) }),

      duplicateTrip: (id) => {
        const src = get().trips.find((t) => t.id === id);
        if (!src) return;
        const copy = structuredClone(src);
        copy.id = uid('t_');
        copy.name = `${src.name} (copy)`;
        copy.createdAt = copy.updatedAt = Date.now();
        set({ trips: [copy, ...get().trips] });
        return copy.id;
      },

      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'globus-store', version: 1 },
  ),
);

export const useTrip = (id: string | undefined) => useStore((s) => s.trips.find((t) => t.id === id));

/* Ephemeral UI state shared between the trip panels and the map */
interface UIState {
  focus: { lat: number; lng: number; id?: string; ts: number } | null;
  hoverId: string | null;
  activeDayId: string | null;
  focusOn: (p: { lat: number; lng: number; id?: string }) => void;
  setHover: (id: string | null) => void;
  setActiveDay: (id: string | null) => void;
}

export const useUI = create<UIState>()((set) => ({
  focus: null,
  hoverId: null,
  activeDayId: null,
  focusOn: (p) => set({ focus: { ...p, ts: Date.now() } }),
  setHover: (hoverId) => set({ hoverId }),
  setActiveDay: (activeDayId) => set({ activeDayId }),
}));
