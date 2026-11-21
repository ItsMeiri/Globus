# 🌍 Globus

A trip planner web app inspired by Wanderlog. Create a trip, pick a destination, and plan everything on a **Details**, **Itinerary**, **Explore** and **Budget** tab, with a live map beside it.

## Features

**Trips**
- Create a trip from any city in the world: 11 cities have built-in guides, and any other city can be found through open geocoding.
- Set dates, tripmates, a budget and a currency. Trips are split into upcoming and past, and each one shows a countdown.
- Duplicate, delete, export and import trips (`.globus.json`), plus a sample Paris trip to try everything.
- Light and dark mode. Everything is saved in your browser, with no account needed.

**Details tab**
- Overview stats: days, places planned, bookings, spending.
- Change dates (planned places on removed days go back to *Places to visit*), the destination or the currency.
- Weather: a live forecast during your trip (Open-Meteo), or current conditions until then.
- Reservations for flights, lodging, rental cars, trains, restaurants and activities, with times, confirmation numbers and costs.
- Tripmates, a packing list (with a suggested starter list), notes, and a destination guide with local tips, currency, language and local time.

**Itinerary tab**
- One section per day, plus a *Places to visit* list for ideas.
- Drag and drop to reorder stops or move them between days (mouse, touch and keyboard).
- Travel time and distance between stops, with a link to directions.
- **Optimize route** reorders a day's stops to cut travel. **Auto-plan** groups saved places into days by location, or fills empty days with top-rated places.
- Times, costs and notes on each stop; day subtitles; collapse and expand; show a single day on the map.
- Add places by searching the guide or OpenStreetMap.
- Add to calendar (`.ics`) and a print-friendly itinerary.

**Explore tab**
- Places from the built-in guide, filtered by category (sights, museums, food, cafés, nightlife, nature, shopping, activities).
- For cities without a guide, notable places are found automatically from OpenStreetMap (Overpass API).
- Search, sort (top rated, closest, A–Z), save with ♥, or add straight to a day.

**Budget tab**
- Budget progress, totals per person and per day, booked and planned costs.
- Spending by category.
- Expenses with "paid by" and equal splits, live balances and suggested settle-up payments.

**Map**
- Numbered, color-coded pins and routes for each day, hearts for saved places, and category pins while exploring.
- Hovering a stop highlights its pin, and clicking a name flies the map to it. On phones the map opens full screen.

## Tech

React 19 + TypeScript + Vite, Zustand (persisted to `localStorage`), React Router, Leaflet / react-leaflet with CARTO/OpenStreetMap tiles, dnd-kit, and lucide icons. No API keys: weather, geocoding and place search use free, key-less services (Open-Meteo, Nominatim, Overpass).

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm test          # unit tests (trip logic, routing, budget splitting)
npm run build     # type-check + production build into dist/
```

The build uses relative paths and hash routing, so `dist/` can be hosted on any static host (GitHub Pages, Netlify, etc.).
