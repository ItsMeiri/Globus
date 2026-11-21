import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarPlus, Compass, Copy, Download, Info, ListChecks, Map as MapIcon, MoreHorizontal, Printer, Trash2, Wallet, X } from 'lucide-react';
import { Logo, ThemeToggle } from '../components/AppHeader';
import { TripMap } from '../components/TripMap';
import { Avatar, InlineEdit, Menu } from '../components/ui';
import { askConfirm } from '../components/dialogs';
import { CAN_DOWNLOAD } from '../lib/env';
import { useStore, useTrip, useUI } from '../store';
import { useCatalog } from '../lib/catalog';
import { useMediaQuery } from '../lib/hooks';
import { exportTripICS, exportTripJSON } from '../lib/io';
import { coverGradient, formatRange, tripStatus } from '../lib/utils';
import { DetailsTab } from '../tabs/DetailsTab';
import { ItineraryTab } from '../tabs/ItineraryTab';
import { ExploreTab } from '../tabs/ExploreTab';
import { BudgetTab } from '../tabs/BudgetTab';

const TABS = [
  { id: 'details', label: 'Details', icon: Info },
  { id: 'itinerary', label: 'Itinerary', icon: ListChecks },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'budget', label: 'Budget', icon: Wallet },
] as const;

export function TripPage() {
  const { id, tab = 'details' } = useParams();
  const trip = useTrip(id);
  const { mutate, deleteTrip, duplicateTrip } = useStore();
  const navigate = useNavigate();
  const catalog = useCatalog(trip);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [showMap, setShowMap] = useState(false);
  const setActiveDay = useUI((s) => s.setActiveDay);
  const focus = useUI((s) => s.focus);

  useEffect(() => {
    if (focus && !wide) setShowMap(true);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trip) document.title = `${trip.name} · Globus`;
    return () => {
      document.title = 'Globus — Trip Planner';
    };
  }, [trip?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveDay(null);
  }, [id, tab, setActiveDay]);

  if (!trip) {
    return (
      <div className="not-found">
        <Logo />
        <h1>Trip not found</h1>
        <p className="muted">It may have been deleted, or it lives in another browser.</p>
        <Link to="/" className="btn primary">
          Back to my trips
        </Link>
      </div>
    );
  }

  const status = tripStatus(trip.startDate, trip.endDate);
  const mapVisible = wide || showMap;

  return (
    <div className="trip-layout">
      <div className="trip-main">
        <div className="trip-cover" style={{ background: coverGradient(trip.destination.hue) }}>
          <div className="trip-cover-top">
            <Link to="/" className="cover-btn" aria-label="Back to trips">
              <ArrowLeft size={18} />
            </Link>
            <div className="grow" />
            <ThemeToggle />
            <Menu
              trigger={(toggle) => (
                <button className="cover-btn" onClick={toggle} aria-label="Trip actions">
                  <MoreHorizontal size={18} />
                </button>
              )}
            >
              {(close) => (
                <>
                  {CAN_DOWNLOAD && (
                    <>
                      <button onClick={() => (close(), exportTripICS(trip))}>
                        <CalendarPlus size={14} /> Add to calendar (.ics)
                      </button>
                      <button onClick={() => (close(), exportTripJSON(trip))}>
                        <Download size={14} /> Export trip file
                      </button>
                      <button onClick={() => (close(), navigate(`/trip/${trip.id}/itinerary`), setTimeout(() => window.print(), 300))}>
                        <Printer size={14} /> Print itinerary
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      close();
                      const nid = duplicateTrip(trip.id);
                      if (nid) navigate(`/trip/${nid}`);
                    }}
                  >
                    <Copy size={14} /> Duplicate trip
                  </button>
                  <button
                    className="danger"
                    onClick={async () => {
                      close();
                      if (await askConfirm({ title: `Delete “${trip.name}”?`, message: 'This cannot be undone.', confirmLabel: 'Delete trip', danger: true })) {
                        deleteTrip(trip.id);
                        navigate('/');
                      }
                    }}
                  >
                    <Trash2 size={14} /> Delete trip
                  </button>
                </>
              )}
            </Menu>
          </div>
          <div className="trip-cover-body">
            <span className="trip-cover-emoji">{trip.destination.emoji}</span>
            <div className="grow">
              <InlineEdit className="trip-title" value={trip.name} onChange={(v) => v && mutate(trip.id, (t) => void (t.name = v))} />
              <div className="trip-sub">
                <span>
                  {trip.destination.name}, {trip.destination.country}
                </span>
                <span>
                  <CalendarDays size={14} /> {formatRange(trip.startDate, trip.endDate)}
                </span>
                <span className={`badge badge-${status.kind}`}>{status.label}</span>
              </div>
            </div>
            <div className="avatars">
              {trip.travelers.slice(0, 5).map((t) => (
                <Avatar key={t.id} t={t} size={32} />
              ))}
            </div>
          </div>
        </div>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <NavLink key={t.id} to={`/trip/${trip.id}/${t.id}`} className={() => `tab ${tab === t.id ? 'active' : ''}`} role="tab" aria-selected={tab === t.id}>
              <t.icon size={16} />
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="tab-content">
          {tab === 'details' && <DetailsTab trip={trip} />}
          {tab === 'itinerary' && <ItineraryTab trip={trip} catalog={catalog.places} />}
          {tab === 'explore' && <ExploreTab trip={trip} catalog={catalog} />}
          {tab === 'budget' && <BudgetTab trip={trip} />}
        </div>
      </div>

      {mapVisible && (
        <aside className={`trip-map ${wide ? '' : 'overlay'}`}>
          {!wide && (
            <button className="map-close btn sm" onClick={() => setShowMap(false)}>
              <X size={16} /> Close map
            </button>
          )}
          <TripMap trip={trip} catalog={tab === 'explore' ? catalog.places : undefined} fitKey={`${trip.id}|${tab}`} />
        </aside>
      )}
      {!wide && !showMap && (
        <button className="fab" onClick={() => setShowMap(true)}>
          <MapIcon size={18} /> Map
        </button>
      )}
    </div>
  );
}
