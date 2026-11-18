import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { Spinner, Badge, EmptyState } from '../components/ui';
import { inr, fmtDateTime } from '../utils/format';

const TABS = [
  ['upcoming', 'Upcoming', b => b.status === 'confirmed' || b.status === 'ongoing'],
  ['past', 'Completed', b => b.status === 'completed'],
  ['cancelled', 'Cancelled', b => b.status === 'cancelled']
];

export default function MyBookingsPage() {
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/bookings/my').then(setList).catch(e => setError(e.message));
  }, []);

  const filter = TABS.find(t => t[0] === tab)[2];
  const shown = (list || []).filter(filter);

  return (
    <section className="section">
      <div className="container narrow">
        <h1 className="page-title">My bookings</h1>
        <div className="tabs tabs-underline">
          {TABS.map(([k, l, f]) => (
            <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {l}{list ? ` (${list.filter(f).length})` : ''}
            </button>
          ))}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {!list && !error ? <Spinner /> : shown.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No bookings here yet" text="Find the perfect car for your next trip." action={<Link to="/cars" className="btn btn-primary">Browse cars</Link>} />
        ) : (
          <div className="booking-list">
            {shown.map(b => (
              <Link key={b.id} to={`/booking/${b.id}`} className="booking-row">
                <img src={b.car?.image} alt={b.carName} />
                <div className="br-main">
                  <div className="br-top">
                    <strong>{b.car?.name || b.carName}</strong>
                    <Badge status={b.status} />
                  </div>
                  <span className="muted small">{fmtDateTime(b.start)} → {fmtDateTime(b.end)}</span>
                  <span className="muted small">#{b.code}</span>
                </div>
                <div className="br-amt">
                  <strong>{inr(b.finalAmount)}</strong>
                  <ChevronRight size={18} className="muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
