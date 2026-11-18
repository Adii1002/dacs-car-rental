import { useMemo, useState } from 'react';
import { Wallet, CalendarCheck, Gauge, Clock, TrendingUp, CarFront } from 'lucide-react';
import { StatCard, BarChart, PeriodFilter, Badge, EmptyState } from './ui';
import { getPeriodRange, summarize, buildSeries, utilization, ownerEarning } from '../../shared/analytics';
import { inr, fmtDateTime } from '../utils/format';

/** Owner earnings / bookings / km analytics. Shared by the owner dashboard and the admin owner view. */
export default function OwnerAnalytics({ owner, cars, bookings, sections = ['stats', 'chart', 'cars', 'bookings'] }) {
  const [period, setPeriod] = useState('month');
  const [customMonth, setCustomMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [carFilter, setCarFilter] = useState('all');
  const [metric, setMetric] = useState('value');
  const share = owner?.sharePercent ?? 100;

  const range = useMemo(() => getPeriodRange(period, new Date(), customMonth), [period, customMonth]);
  const scoped = useMemo(() => (carFilter === 'all' ? bookings : bookings.filter(b => b.carId === carFilter)), [bookings, carFilter]);
  const stats = useMemo(() => summarize(scoped, { sharePercent: share, range }), [scoped, share, range]);
  const monthly = period === 'all' || period === 'year';
  const series = useMemo(
    () => buildSeries(scoped, { range: monthly ? null : range, sharePercent: share, months: period === 'year' ? 12 : 6 }),
    [scoped, range, share, period, monthly]
  );
  const util = utilization(scoped, carFilter === 'all' ? cars.length : 1, range);

  const perCar = useMemo(() => cars.map(c => {
    const list = bookings.filter(b => b.carId === c.id);
    return { car: c, ...summarize(list, { sharePercent: share, range }), util: utilization(list, 1, range) };
  }), [cars, bookings, share, range]);

  const periodBookings = scoped
    .filter(b => new Date(b.start) >= range.start && new Date(b.start) < range.end)
    .sort((a, b) => new Date(b.start) - new Date(a.start));

  const chartData = series.map(s => ({ ...s, value: metric === 'value' ? s.value : metric === 'count' ? s.count : s.km }));
  const chartFormat = metric === 'value' ? inr : metric === 'count' ? n => `${n}` : n => `${n} km`;

  return (
    <div className="owner-analytics">
      <div className="toolbar">
        <PeriodFilter period={period} setPeriod={setPeriod} customMonth={customMonth} setCustomMonth={setCustomMonth} />
        {cars.length > 1 && (
          <select className="input input-sm" value={carFilter} onChange={e => setCarFilter(e.target.value)} aria-label="Filter by car">
            <option value="all">All cars ({cars.length})</option>
            {cars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {sections.includes('stats') && (
        <div className="stat-grid">
          <StatCard icon={Wallet} tone="green" label={`Earnings · ${range.label}`} value={inr(stats.earnings)} sub={`${share}% of ${inr(stats.revenue)} revenue`} />
          <StatCard icon={CalendarCheck} tone="blue" label="Bookings" value={stats.activeBookings} sub={`${stats.completedBookings} completed · ${stats.upcomingBookings} upcoming · ${stats.cancelledBookings} cancelled`} />
          <StatCard icon={Gauge} tone="orange" label="Km driven" value={`${stats.kmDriven.toLocaleString('en-IN')} km`} sub={stats.completedBookings ? `~${Math.round(stats.kmDriven / stats.completedBookings)} km per trip` : 'From completed trips'} />
          <StatCard icon={Clock} tone="purple" label="Hours booked" value={`${stats.hoursBooked.toLocaleString('en-IN')} hrs`} sub={util !== null ? `${util}% utilisation` : `${Math.round(stats.hoursBooked / 24)} days`} />
        </div>
      )}

      {sections.includes('chart') && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title"><TrendingUp size={18} /> {metric === 'value' ? 'Earnings' : metric === 'count' ? 'Bookings' : 'Km driven'} {period === 'all' ? '(last 6 months)' : period === 'year' ? '(last 12 months)' : `· ${range.label}`}</h3>
            <div className="seg">
              {[['value', 'Earnings'], ['count', 'Bookings'], ['km', 'Km']].map(([k, l]) => (
                <button key={k} type="button" className={metric === k ? 'active' : ''} onClick={() => setMetric(k)}>{l}</button>
              ))}
            </div>
          </div>
          <BarChart data={chartData} format={chartFormat} />
        </div>
      )}

      {sections.includes('cars') && (
        <div className="card">
          <h3 className="card-title"><CarFront size={18} /> Car-wise performance · {range.label}</h3>
          {perCar.length === 0 ? <EmptyState title="No cars assigned yet" text="Cars assigned by the admin will appear here." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Car</th><th>Bookings</th><th>Km driven</th><th>Hours</th><th>Utilisation</th><th>Revenue</th><th>Your earnings</th></tr>
                </thead>
                <tbody>
                  {perCar.map(r => (
                    <tr key={r.car.id}>
                      <td data-label="Car">
                        <div className="cell-car">
                          <img src={r.car.image} alt="" />
                          <div><strong>{r.car.name}</strong><span className="muted small">{r.car.regNumber || '—'} · {r.car.odometer?.toLocaleString('en-IN') || 0} km odo</span></div>
                        </div>
                      </td>
                      <td data-label="Bookings">{r.activeBookings}</td>
                      <td data-label="Km driven">{r.kmDriven.toLocaleString('en-IN')} km</td>
                      <td data-label="Hours">{r.hoursBooked} hrs</td>
                      <td data-label="Utilisation">{r.util !== null ? <div className="meter"><span style={{ width: `${r.util}%` }} /><em>{r.util}%</em></div> : '—'}</td>
                      <td data-label="Revenue">{inr(r.revenue)}</td>
                      <td data-label="Your earnings"><strong className="text-green">{inr(r.earnings)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sections.includes('bookings') && (
        <div className="card">
          <h3 className="card-title"><CalendarCheck size={18} /> Bookings · {range.label} ({periodBookings.length})</h3>
          {periodBookings.length === 0 ? <EmptyState title="No bookings in this period" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Booking</th><th>Car</th><th>Trip</th><th>Status</th><th>Km</th><th>Earning</th></tr></thead>
                <tbody>
                  {periodBookings.slice(0, 100).map(b => (
                    <tr key={b.id}>
                      <td data-label="Booking"><strong>{b.code}</strong><span className="muted small block">{b.customer?.name}</span></td>
                      <td data-label="Car">{cars.find(c => c.id === b.carId)?.name || b.carName}</td>
                      <td data-label="Trip"><span className="small">{fmtDateTime(b.start)}<br />→ {fmtDateTime(b.end)}</span></td>
                      <td data-label="Status"><Badge status={b.status} /></td>
                      <td data-label="Km">{b.status === 'completed' ? `${b.kmDriven} km` : '—'}</td>
                      <td data-label="Earning">{inr(ownerEarning(b, share))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
