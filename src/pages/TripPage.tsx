import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Compass, Copy, Download, LayoutGrid, Luggage, Map as MapIcon, MoreHorizontal, Printer, Route, Trash2, Wallet, X } from 'lucide-react';
import { Logo } from '../components/AppHeader';
import { BottomNav, Rail, type NavItem } from '../components/Shell';
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
  { id: 'details', label: 'Overview', icon: LayoutGrid },
  { id: 'itinerary', label: 'Itinerary', icon: Route },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'budget', label: 'Budget', icon: Wallet },
] as const;

export function TripPage() {
  const { id, tab = 'details' } = useParams();
  const trip = useTrip(id);
  const { mutate, deleteTrip, duplicateTrip } = useStore();
  const navigate = useNavigate();
  const catalog = useCatalog(trip);
  const wide = useMediaQuery('(min-width: 1100px)');
  const [showMap, setShowMap] = useState(false);
  const setActiveDay = useUI((s) => s.setActiveDay);
  const focus = useUI((s) => s.focus);

  useEffect(() => {
    if (focus && !wide) setShowMap(true);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trip) document.title = `${trip.name} · Globus`;
    return () => {
      document.title = 'Globus';
    };
  }, [trip?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveDay(null);
    window.scrollTo(0, 0);
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
  const nav: NavItem[] = TABS.map((t) => ({
    to: `/trip/${trip.id}/${t.id}`,
    label: t.label,
    icon: t.icon,
    active: tab === t.id,
    badge: t.id === 'explore' ? trip.saved.length : undefined,
  }));

  return (
    <div className="shell">
      <Rail items={[{ to: '/', label: 'Trips', icon: Luggage, active: false }, ...nav]} />

      <div className="shell-main trip-layout">
        <div className="trip-main">
          <header className="appbar">
            <Link to="/" className="icon-btn only-phone" aria-label="Back to trips">
              <ArrowLeft size={20} />
            </Link>
            <span className="trip-thumb" style={{ background: coverGradient(trip.destination.hue) }}>
              {trip.destination.emoji}
            </span>
            <div className="appbar-text">
              <InlineEdit className="appbar-trip-name" value={trip.name} onChange={(v) => v && mutate(trip.id, (t) => void (t.name = v))} />
              <div className="appbar-sub">
                <span>{formatRange(trip.startDate, trip.endDate)}</span>
                <span className="sep">·</span>
                <span>{trip.destination.name}</span>
                <span className={`badge badge-soft badge-${status.kind}`}>{status.label}</span>
              </div>
            </div>
            <div className="avatars only-wide">
              {trip.travelers.slice(0, 4).map((t) => (
                <Avatar key={t.id} t={t} size={30} />
              ))}
            </div>
            {!wide && (
              <button className="icon-btn" onClick={() => setShowMap(true)} aria-label="Show map" title="Show map">
                <MapIcon size={20} />
              </button>
            )}
            <Menu
              trigger={(toggle) => (
                <button className="icon-btn" onClick={toggle} aria-label="Trip actions">
                  <MoreHorizontal size={20} />
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
          </header>

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
      </div>

      <BottomNav items={nav} />
    </div>
  );
}
