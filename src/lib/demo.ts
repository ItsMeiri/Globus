import type { Trip } from '../types';
import { DESTINATIONS } from '../data/destinations';
import { toDestination } from '../components/DestinationPicker';
import { createTrip, makeItem, packingFromTemplate } from './tripLogic';
import { addDays, today, uid } from './utils';

/** A fully populated sample trip so new users can see every feature in action. */
export function buildDemoTrip(): Trip {
  const paris = DESTINATIONS.find((d) => d.id === 'paris')!;
  const start = addDays(today(), 21);
  const end = addDays(start, 3);
  const trip = createTrip({
    name: 'Paris long weekend',
    destination: toDestination(paris),
    startDate: start,
    endDate: end,
    travelers: ['You', 'Alex', 'Sam'],
    budget: 3000,
  });
  const [you, alex, sam] = trip.travelers.map((t) => t.id);

  const pick = (...names: string[]) => names.map((n) => makeItem(paris.places.find((p) => p.name.startsWith(n))!));
  const plan: [string, string[], string[]][] = [
    ['Arrival & the Islands', ['Notre-Dame', 'Sainte-Chapelle', 'Le Marais'], ['14:00', '15:30', '17:00']],
    ['Left Bank & the Louvre', ['Louvre', 'Musée d’Orsay', 'Café de Flore', 'Luxembourg', 'Le Comptoir'], ['09:30', '14:00', '17:00', '18:00', '20:00']],
    ['Iconic Paris', ['Arc de', 'Eiffel', 'Seine'], ['10:00', '13:00', '19:30']],
    ['Montmartre farewell', ['Montmartre', 'Moulin'], ['10:00', '21:00']],
  ];
  trip.days.forEach((d, i) => {
    const [title, names, times] = plan[i];
    d.title = title;
    d.items = pick(...names).map((it, j) => ({ ...it, time: times[j] }));
  });
  trip.saved = pick('Galeries Lafayette');

  trip.reservations = [
    { id: uid('r_'), type: 'flight', title: 'Flight to Paris CDG', confirmation: 'GLB7QX', start: `${start}T07:15`, end: `${start}T09:40`, location: 'CDG Terminal 2E', cost: 540 },
    { id: uid('r_'), type: 'lodging', title: 'Hôtel des Grands Boulevards', confirmation: 'HB-22841', start: `${start}T15:00`, end: `${end}T11:00`, location: '17 Bd Poissonnière, Paris', cost: 860 },
    { id: uid('r_'), type: 'restaurant', title: 'Dinner at Le Comptoir', start: `${addDays(start, 1)}T20:00`, location: 'Saint-Germain', notes: 'Table for 3' },
  ];
  trip.expenses = [
    { id: uid('e_'), title: 'Hotel deposit', amount: 860, category: 'lodging', paidBy: you, splitWith: [you, alex, sam], date: start },
    { id: uid('e_'), title: 'Museum passes', amount: 186, category: 'activities', paidBy: alex, splitWith: [you, alex, sam], date: start },
    { id: uid('e_'), title: 'Croissants & coffee', amount: 24.5, category: 'food', paidBy: sam, splitWith: [you, alex, sam], date: start },
    { id: uid('e_'), title: 'Metro tickets', amount: 52, category: 'transport', paidBy: you, splitWith: [you, alex, sam], date: start },
  ];
  trip.packing = packingFromTemplate([]).map((p, i) => ({ ...p, done: i < 4 }));
  trip.notes = 'Book Eiffel Tower summit tickets 60 days ahead.\nFirst Sunday: Musée d’Orsay is free!';
  return trip;
}
