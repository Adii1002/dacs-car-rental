import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, MessageCircle, Phone, ChevronLeft, MapPin, Route, Mail } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { Spinner, Badge, EmptyState } from '../components/ui';
import { inr, fmtDateTime, contactPhones } from '../utils/format';
import { formatDuration } from '../../shared/pricing';

export default function BookingDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const { settings, toast } = useApp();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/bookings/${id}`).then(setB).catch(e => setError(e.message));
  }, [id]);

  async function cancel() {
    if (!window.confirm('Cancel this booking? This cannot be undone.')) return;
    setBusy(true);
    try {
      const updated = await api(`/bookings/${id}/cancel`, { method: 'POST' });
      setB(x => ({ ...x, ...updated }));
      toast('Booking cancelled.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="container section"><EmptyState title="Booking not found" text={error} action={<Link to="/my-bookings" className="btn btn-primary">My bookings</Link>} /></div>;
  if (!b) return <Spinner />;

  const place = p => (p.type === 'delivery' ? `Doorstep · ${p.address}, ${p.location}` : p.location);
  const carName = b.car?.name || b.carName;

  return (
    <section className="section">
      <div className="container narrow">
        {!isNew && <Link to="/my-bookings" className="back-link"><ChevronLeft size={18} /> My bookings</Link>}
        {isNew && (
          <div className="success-banner">
            <div className="success-icon"><CircleCheck size={36} /></div>
            <h1>Booking confirmed!</h1>
            <p>Booking ID <strong>{b.code}</strong>. We have sent the details to <strong>{b.customer.email}</strong> and WhatsApp <strong>+91 {b.customer.phone}</strong>.</p>
            <div className="btn-row center">
              <a href={b.whatsappLink} target="_blank" rel="noreferrer" className="btn btn-whatsapp"><MessageCircle size={18} /> Get details on WhatsApp</a>
              <Link to="/my-bookings" className="btn btn-outline">View my bookings</Link>
            </div>
          </div>
        )}

        <div className="card booking-detail">
          <div className="bd-head">
            <img src={b.car?.image} alt={carName} />
            <div>
              <span className="muted small">Booking {b.code}</span>
              <h2>{carName}</h2>
              <div className="badge-row">
                <Badge status={b.status} />
                <Badge status={b.kycStatus}>KYC {b.kycStatus}</Badge>
                <Badge status={b.payment.status}>Payment {b.payment.status.replace('_', ' ')}</Badge>
              </div>
            </div>
          </div>

          <div className="trip-line">
            <div><span>Pickup</span><strong>{fmtDateTime(b.start)}</strong><small><MapPin size={13} /> {place(b.pickup)}</small></div>
            <Route className="muted" size={20} />
            <div><span>Drop</span><strong>{fmtDateTime(b.end)}</strong><small><MapPin size={13} /> {place(b.drop)}</small></div>
          </div>

          <dl className="price-list">
            <div><dt>Rental ({formatDuration(b.pricing.billableHours)})</dt><dd>{inr(b.pricing.rental)}</dd></div>
            {b.pricing.delivery > 0 && <div><dt>Doorstep delivery</dt><dd>{inr(b.pricing.delivery)}</dd></div>}
            {b.extraKmCharges > 0 && <div><dt>Extra km ({b.kmDriven - b.pricing.includedKm} km)</dt><dd>{inr(b.extraKmCharges)}</dd></div>}
            {b.otherCharges > 0 && <div><dt>Other charges</dt><dd>{inr(b.otherCharges)}</dd></div>}
            <div className="total"><dt>{b.status === 'completed' ? 'Final amount' : 'Total payable'}</dt><dd>{inr(b.finalAmount)}</dd></div>
            <div className="sub"><dt>Refundable security deposit</dt><dd>{inr(b.pricing.deposit)}</dd></div>
            <div className="sub"><dt>Free km</dt><dd>{b.pricing.includedKm} km (then ₹{b.pricing.extraKmRate}/km)</dd></div>
            {b.status === 'completed' && <div className="sub"><dt>Km driven</dt><dd>{b.kmDriven} km</dd></div>}
          </dl>

          <div className="info-box">
            <strong>At pickup, please carry:</strong>
            <ul>
              <li>Original driving licence ({b.customer.dlNumber})</li>
              <li>Original {b.customer.idType || 'photo ID'}</li>
              <li>Security deposit of {inr(b.pricing.deposit)} (refundable)</li>
            </ul>
          </div>

          <div className="btn-row">
            {contactPhones(settings).map(p => (
              <a key={p} href={`tel:${p}`} className="btn btn-outline"><Phone size={16} /> {p}</a>
            ))}
            <a href={`mailto:${settings.businessEmail}?subject=Booking ${b.code}`} className="btn btn-outline"><Mail size={16} /> Email</a>
            {b.status === 'confirmed' && new Date(b.start) > new Date() && (
              <button type="button" className="btn btn-danger-outline" disabled={busy} onClick={cancel}>Cancel booking</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
