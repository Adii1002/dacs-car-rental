import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { LayoutDashboard, CarFront, CalendarCheck, Wallet, Gauge, RefreshCw, Users, Fuel, Cog } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import OwnerAnalytics from '../../components/OwnerAnalytics';
import { Spinner, Badge, EmptyState } from '../../components/ui';
import { api } from '../../api';
import { summarize } from '../../../shared/analytics';
import { inr, fmtDateTime } from '../../utils/format';

const NAV = [
  { to: '/owner', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/owner/cars', label: 'My cars', icon: CarFront },
  { to: '/owner/bookings', label: 'Bookings', icon: CalendarCheck }
];

export function OwnerLayout() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api('/owner/dashboard').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout title="Car owner" items={NAV}>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error ? <Spinner /> : data && <Outlet context={{ ...data, reload: load }} />}
    </DashboardLayout>
  );
}

export function OwnerOverview() {
  const { owner, cars, bookings, reload } = useOutletContext();
  const lifetime = useMemo(() => summarize(bookings, { sharePercent: owner.sharePercent }), [bookings, owner.sharePercent]);
  const upcoming = bookings.filter(b => b.status === 'confirmed' || b.status === 'ongoing').sort((a, b) => new Date(a.start) - new Date(b.start));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Hello, {owner.name.split(' ')[0]} 👋</h1>
          <p className="muted">Here is how your {cars.length} car{cars.length !== 1 ? 's are' : ' is'} performing. Your revenue share is <strong>{owner.sharePercent}%</strong>.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="hero-stats">
        <div><span>Lifetime earnings</span><strong>{inr(lifetime.earnings)}</strong></div>
        <div><span>Total trips</span><strong>{lifetime.completedBookings}</strong></div>
        <div><span>Total km driven</span><strong>{lifetime.kmDriven.toLocaleString('en-IN')} km</strong></div>
        <div><span>Upcoming trips</span><strong>{upcoming.length}</strong></div>
      </div>

      <OwnerAnalytics owner={owner} cars={cars} bookings={bookings} sections={['stats', 'chart', 'cars']} />

      <div className="grid-2 align-start">
        <div className="card">
          <h3 className="card-title"><CalendarCheck size={18} /> Upcoming & ongoing trips</h3>
          {upcoming.length === 0 ? <EmptyState title="No upcoming trips" /> : (
            <ul className="mini-list">
              {upcoming.slice(0, 6).map(b => (
                <li key={b.id}>
                  <div><strong>{cars.find(c => c.id === b.carId)?.name || b.carName}</strong><span className="muted small">{fmtDateTime(b.start)} → {fmtDateTime(b.end)}</span></div>
                  <Badge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="card-title"><Wallet size={18} /> Payout details</h3>
          <dl className="kv">
            <div><dt>Account name</dt><dd>{owner.bank?.accountName || '—'}</dd></div>
            <div><dt>Account no.</dt><dd>{owner.bank?.accountNumber || '—'}</dd></div>
            <div><dt>IFSC</dt><dd>{owner.bank?.ifsc || '—'}</dd></div>
            <div><dt>UPI</dt><dd>{owner.bank?.upi || '—'}</dd></div>
            <div><dt>Revenue share</dt><dd>{owner.sharePercent}% of rental + extra km</dd></div>
          </dl>
          <p className="muted small">To update payout details, please contact the admin.</p>
        </div>
      </div>
    </div>
  );
}

export function OwnerCars() {
  const { owner, cars, bookings } = useOutletContext();
  if (!cars.length) return <EmptyState icon={CarFront} title="No cars assigned yet" text="Once the admin assigns cars to you, they will appear here." />;
  return (
    <div className="stack">
      <h1 className="page-title">My cars</h1>
      <div className="owner-car-grid">
        {cars.map(car => {
          const list = bookings.filter(b => b.carId === car.id);
          const s = summarize(list, { sharePercent: owner.sharePercent });
          const next = list.filter(b => b.status === 'confirmed' && new Date(b.start) > new Date()).sort((a, b) => new Date(a.start) - new Date(b.start))[0];
          const ongoing = list.find(b => b.status === 'ongoing');
          return (
            <div key={car.id} className="card owner-car">
              <div className="owner-car-img">
                <img src={car.image} alt={car.name} />
                <Badge status={ongoing ? 'ongoing' : car.status === 'active' ? 'verified' : 'cancelled'}>{ongoing ? 'On trip' : car.status === 'active' ? 'Available' : car.status}</Badge>
              </div>
              <h3>{car.name} <span className="muted">{car.year}</span></h3>
              <span className="muted small">{car.regNumber}</span>
              <ul className="car-specs">
                <li><Cog size={14} />{car.transmission}</li>
                <li><Fuel size={14} />{car.fuel}</li>
                <li><Users size={14} />{car.seats} seats</li>
                <li><Gauge size={14} />{car.odometer?.toLocaleString('en-IN')} km</li>
              </ul>
              <div className="mini-stats">
                <div><span>Earnings</span><strong>{inr(s.earnings)}</strong></div>
                <div><span>Trips</span><strong>{s.completedBookings}</strong></div>
                <div><span>Km driven</span><strong>{s.kmDriven.toLocaleString('en-IN')}</strong></div>
              </div>
              <div className="muted small">Tariff: {inr(car.pricePerDay)}/day · {car.kmPerDay} km/day · ₹{car.extraKmRate}/extra km</div>
              <div className="next-trip">{ongoing ? `On trip until ${fmtDateTime(ongoing.end)}` : next ? `Next trip: ${fmtDateTime(next.start)}` : 'No upcoming trips'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OwnerBookings() {
  const { owner, cars, bookings } = useOutletContext();
  return (
    <div className="stack">
      <h1 className="page-title">Bookings for my cars</h1>
      <OwnerAnalytics owner={owner} cars={cars} bookings={bookings} sections={['stats', 'bookings']} />
    </div>
  );
}
