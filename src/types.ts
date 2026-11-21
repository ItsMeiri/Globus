export type PlaceCategory =
  | 'sight'
  | 'museum'
  | 'food'
  | 'cafe'
  | 'nightlife'
  | 'nature'
  | 'shopping'
  | 'activity'
  | 'lodging'
  | 'other';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  description?: string;
  rating?: number;
  /** Suggested time to spend, in minutes */
  duration?: number;
  /** 0 = free, 1-4 = $ to $$$$ */
  price?: number;
  address?: string;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  currency?: string;
  language?: string;
  timezone?: string;
  hue: number;
  emoji: string;
  tagline?: string;
  description?: string;
  bestTime?: string;
  tips?: string[];
  /** true when the destination comes from the built-in guide */
  curated?: boolean;
}

export interface CuratedDestination extends Destination {
  places: Place[];
}

/** A place placed somewhere in the trip (saved list or a day) */
export interface PlanItem {
  id: string;
  place: Place;
  time?: string;
  note?: string;
  cost?: number;
}

export interface Day {
  id: string;
  date: string; // YYYY-MM-DD
  title?: string;
  items: PlanItem[];
}

export interface Traveler {
  id: string;
  name: string;
  color: string;
}

export type ReservationType = 'flight' | 'lodging' | 'car' | 'train' | 'restaurant' | 'activity' | 'other';

export interface Reservation {
  id: string;
  type: ReservationType;
  title: string;
  confirmation?: string;
  start?: string; // datetime-local
  end?: string;
  location?: string;
  cost?: number;
  notes?: string;
}

export type ExpenseCategory =
  | 'lodging'
  | 'transport'
  | 'food'
  | 'activities'
  | 'shopping'
  | 'other';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date?: string;
  paidBy?: string;
  splitWith: string[];
}

export interface PackingItem {
  id: string;
  text: string;
  done: boolean;
  group: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: Destination;
  startDate: string;
  endDate: string;
  currency: string;
  budget?: number;
  notes: string;
  travelers: Traveler[];
  days: Day[];
  saved: PlanItem[];
  reservations: Reservation[];
  expenses: Expense[];
  packing: PackingItem[];
  createdAt: number;
  updatedAt: number;
}

/** Container id for the "places to visit" list */
export const SAVED = 'saved';
