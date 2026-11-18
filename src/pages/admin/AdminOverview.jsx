import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { IndianRupee, CalendarCheck, CarFront, ShieldCheck, Gauge, TrendingUp, Play, Flag, Bell, RefreshCw, UserCog } from 'lucide-react';
import { StatCard, BarChart, Badge, PeriodFilter, EmptyState } from '../../components/ui';
import { getPeriodRange, summarize, buildSeries, utilization } from '../../../shared/analytics';
import { inr, fmtDateTime, fmtTime } from '../../utils/format';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export default function AdminOverview() {
  const { bookings, cars, owners, customers, channels, reload } = useOutletContext();
  const [period, setPeriod] = useState('month');
  const [customMonth, setCustomMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const range = useMemo(() => getPeriodRange(period, new Date(), customMonth), [period, customMonth]);
  const stats = useMemo(() => summarize(bookings, { range }), [bookings, range]);
  const monthly = period === 'all' || period === 'year';
  const series = useMemo(() => buildSeries(bookings, { range: monthly ? null : range, months: period === 'year' ? 12 : 6 }), [bookings, range, monthly, period]);
  const util = utilization(bookings, cars.filter(c => c.status === 'active').length, range);

  const today = new Date();
  const pickups = bookings.filter(b => b.status === 'confirmed' && sameDay(b.start, today));
  const returns = bookings.filter(b => b.status === 'ongoing' && sameDay(b.end, today));
  const overdue = bookings.filter(b => b.status === 'ongoing' && new Date(b.end) < today);
  const kycPending = bookings.filter(b => b.kycStatus === 'pending' && b.status === 'confirmed');
  const ongoing = bookings.filter(b => b.status === 'ongoing');
  const recent = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const carName = id => cars.find(c => c.id === id)?.name;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline btn-sm" onClick={reload}><RefreshCw size={16} /> Refresh</button>
          <Link to="/admin/bookings?new=1" className="btn btn-primary btn-sm">+ New booking</Link>
        </div>
      </div>

      {(!channels.email || !channels.whatsapp) && (
        <div className="alert alert-info">
          <Bell size={18} />
          <div>
            Automatic {[!channels.email && 'email', !channels.whatsapp && 'WhatsApp'].filter(Boolean).join(' & ')} to customers is not configured yet.
            Messages are logged and can be sent with one click from <Link to="/admin/notifications">Notifications</Link>. Add SMTP / WhatsApp keys in <code>.env</code> to send automatically.
          </div>
        </div>
      )}

      <div className="today-grid">
        <div className="today-card"><Play size={18} /><div><strong>{pickups.length}</strong><span>Pickups today</span></div></div>
        <div className="today-card"><Flag size={18} /><div><strong>{returns.length}</strong><span>Returns today</span></div></div>
        <div className="today-card"><CarFront size={18} /><div><strong>{ongoing.length}</strong><span>Cars on trip</span></div></div>
        <div className={`today-card ${overdue.length ? 'warn' : ''}`}><Flag size={18} /><div><strong>{overdue.length}</strong><span>Overdue returns</span></div></div>
        <div className={`today-card ${kycPending.length ? 'warn' : ''}`}><ShieldCheck size={18} /><div><strong>{kycPending.length}</strong><span>KYC to verify</span></div></div>
      </div>

      <div className="toolbar">
        <PeriodFilter period={period} setPeriod={setPeriod} customMonth={customMonth} setCustomMonth={setCustomMonth} />
      </div>

      <div className="stat-grid">
        <StatCard icon={IndianRupee} tone="green" label={`Revenue · ${range.label}`} value={inr(stats.grossCollected)} sub={`Rental + extra km: ${inr(stats.revenue)}`} />
        <StatCard icon={CalendarCheck} tone="blue" label="Bookings" value={stats.activeBookings} sub={`${stats.completedBookings} completed · ${stats.cancelledBookings} cancelled`} />
        <StatCard icon={Gauge} tone="orange" label="Km driven" value={`${stats.kmDriven.toLocaleString('en-IN')} km`} sub={`${stats.hoursBooked} hrs booked`} />
        <StatCard icon={CarFront} tone="purple" label="Fleet" value={`${cars.length} cars`} sub={`${util ?? '—'}${util !== null ? '% utilisation · ' : ' · '}${owners.length} owners · ${customers.length} customers`} />
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="card-title"><TrendingUp size={18} /> Revenue {monthly ? `(last ${period === 'year' ? 12 : 6} months)` : `· ${range.label}`}</h3>
        </div>
        <BarChart data={series} />
      </div>

      <div className="grid-2 align-start">
        <div className="card">
          <h3 className="card-title"><Play size={18} /> Today&apos;s pickups & returns</h3>
          {pickups.length + returns.length + overdue.length === 0 ? <EmptyState title="Nothing scheduled today" /> : (
            <ul className="mini-list">
              {overdue.map(b => <li key={b.id}><div><strong>{carName(b.carId) || b.carName}</strong><span className="muted small">Overdue since {fmtDateTime(b.end)} · {b.customer.name} · {b.customer.phone}</span></div><Badge status="failed">Overdue</Badge></li>)}
              {pickups.map(b => <li key={b.id}><div><strong>{carName(b.carId) || b.carName}</strong><span className="muted small">Pickup {fmtTime(b.start)} · {b.customer.name} · {b.pickup.location}</span></div><Badge status="confirmed">Pickup</Badge></li>)}
              {returns.map(b => <li key={b.id}><div><strong>{carName(b.carId) || b.carName}</strong><span className="muted small">Return {fmtTime(b.end)} · {b.customer.name}</span></div><Badge status="ongoing">Return</Badge></li>)}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h3 className="card-title"><CalendarCheck size={18} /> Latest bookings</h3>
            <Link to="/admin/bookings" className="btn-link">View all</Link>
          </div>
          <ul className="mini-list">
            {recent.map(b => (
              <li key={b.id}>
                <div><strong>{b.customer.name} · {carName(b.carId) || b.carName}</strong><span className="muted small">#{b.code} · {fmtDateTime(b.start)}</span></div>
                <div className="ta-right"><strong>{inr(b.finalAmount)}</strong><Badge status={b.status} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="card-title"><UserCog size={18} /> Owner earnings · {range.label}</h3>
          <Link to="/admin/owners" className="btn-link">Manage owners</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Owner</th><th>Cars</th><th>Bookings</th><th>Km driven</th><th>Revenue</th><th>Owner payout</th></tr></thead>
            <tbody>
              {owners.map(o => {
                const ownerCars = cars.filter(c => c.ownerId === o.id).map(c => c.id);
                const s = summarize(bookings.filter(b => b.ownerId === o.id), { sharePercent: o.sharePercent, range });
                return (
                  <tr key={o.id}>
                    <td data-label="Owner"><strong>{o.name}</strong><span className="muted small block">{o.phone}</span></td>
                    <td data-label="Cars">{ownerCars.length}</td>
                    <td data-label="Bookings">{s.activeBookings}</td>
                    <td data-label="Km driven">{s.kmDriven.toLocaleString('en-IN')} km</td>
                    <td data-label="Revenue">{inr(s.revenue)}</td>
                    <td data-label="Owner payout"><strong className="text-green">{inr(s.earnings)}</strong> <span className="muted small">({o.sharePercent}%)</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
