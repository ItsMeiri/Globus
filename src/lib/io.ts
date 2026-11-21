import type { Trip } from '../types';
import { addDays } from './utils';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip';

export function exportTripJSON(trip: Trip) {
  download(`${slug(trip.name)}.globus.json`, JSON.stringify({ app: 'globus', version: 1, trip }, null, 2), 'application/json');
}

export async function readTripFile(file: File): Promise<Trip> {
  const data = JSON.parse(await file.text());
  const trip: Trip = data?.trip ?? data;
  if (!trip || typeof trip !== 'object' || !trip.destination || !Array.isArray(trip.days) || !trip.startDate) {
    throw new Error('This file is not a Globus trip.');
  }
  return {
    ...trip,
    saved: trip.saved ?? [],
    reservations: trip.reservations ?? [],
    expenses: trip.expenses ?? [],
    packing: trip.packing ?? [],
    travelers: trip.travelers ?? [],
    notes: trip.notes ?? '',
  };
}

const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
const icsDate = (d: string) => d.replace(/-/g, '');
const icsDateTime = (dt: string) => dt.replace(/[-:]/g, '').slice(0, 13) + '00';

/** Export the itinerary and reservations as an iCalendar file. */
export function exportTripICS(trip: Trip) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Globus//Trip Planner//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ev = (uid: string, props: string[]) => lines.push('BEGIN:VEVENT', `UID:${uid}@globus`, `DTSTAMP:${stamp}`, ...props, 'END:VEVENT');

  ev(trip.id, [`DTSTART;VALUE=DATE:${icsDate(trip.startDate)}`, `DTEND;VALUE=DATE:${icsDate(addDays(trip.endDate, 1))}`, `SUMMARY:${esc(trip.name)}`, `LOCATION:${esc(trip.destination.name)}`]);
  trip.days.forEach((d) =>
    d.items.forEach((it) => {
      const loc = `LOCATION:${esc(it.place.name)}`;
      const geo = `GEO:${it.place.lat};${it.place.lng}`;
      if (it.time) {
        const start = `${d.date}T${it.time}`;
        const mins = it.place.duration ?? 60;
        const [h, m] = it.time.split(':').map(Number);
        const endTotal = Math.min(h * 60 + m + mins, 23 * 60 + 59);
        const end = `${d.date}T${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
        ev(it.id, [`DTSTART:${icsDateTime(start)}`, `DTEND:${icsDateTime(end)}`, `SUMMARY:${esc(it.place.name)}`, loc, geo, ...(it.note ? [`DESCRIPTION:${esc(it.note)}`] : [])]);
      } else {
        ev(it.id, [`DTSTART;VALUE=DATE:${icsDate(d.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(d.date, 1))}`, `SUMMARY:${esc(it.place.name)}`, loc, geo]);
      }
    }),
  );
  trip.reservations.forEach((r) => {
    if (!r.start) return;
    const props = [`SUMMARY:${esc(r.title)}`];
    if (r.start.includes('T')) props.push(`DTSTART:${icsDateTime(r.start)}`, `DTEND:${icsDateTime(r.end && r.end.includes('T') ? r.end : r.start)}`);
    else props.push(`DTSTART;VALUE=DATE:${icsDate(r.start)}`);
    if (r.location) props.push(`LOCATION:${esc(r.location)}`);
    const desc = [r.confirmation && `Confirmation: ${r.confirmation}`, r.notes].filter(Boolean).join('\n');
    if (desc) props.push(`DESCRIPTION:${esc(desc)}`);
    ev(r.id, props);
  });
  lines.push('END:VCALENDAR');
  download(`${slug(trip.name)}.ics`, lines.join('\r\n'), 'text/calendar');
}
