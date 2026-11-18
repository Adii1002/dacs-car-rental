import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Search, Plus, Phone, MessageCircle, Mail, Send, Play, Flag, Ban, CalendarDays, ShieldCheck, FileText, CalendarCheck } from 'lucide-react';
import { Modal, Badge, Field, EmptyState } from '../../components/ui';
import { api, documentUrl } from '../../api';
import { useApp } from '../../context/AppContext';
import { inr, fmtDateTime, toLocalInput, defaultTrip, ID_TYPES } from '../../utils/format';
import { calcPrice, formatDuration } from '../../../shared/pricing';

const TABS = [
  ['all', 'All'], ['confirmed', 'Upcoming'], ['ongoing', 'Ongoing'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['kyc', 'KYC pending']
];

export default function AdminBookings() {
  const { bookings, cars, reload } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [carId, setCarId] = useState('');
  const [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState(50);
  const showNew = params.get('new') === '1';

  const carName = id => cars.find(c => c.id === id)?.name;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings
      .filter(b => tab === 'all' || (tab === 'kyc' ? b.kycStatus === 'pending' && b.status !== 'cancelled' : b.status === tab))
      .filter(b => !carId || b.carId === carId)
      .filter(b => !term || [b.code, b.customer.name, b.customer.phone, b.customer.email].some(v => v?.toLowerCase().includes(term)))
      .sort((a, b) => new Date(b.start) - new Date(a.start));
  }, [bookings, tab, q, carId]);

  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, k === 'all' ? bookings.length : k === 'kyc' ? bookings.filter(b => b.kycStatus === 'pending' && b.status !== 'cancelled').length : bookings.filter(b => b.status === k).length])), [bookings]);
  const current = selected ? bookings.find(b => b.id === selected) : null;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Bookings</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><Plus size={16} /> Offline booking</button>
      </div>

      <div className="chip-row scroll-x">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l} <em>{counts[k]}</em></button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={16} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search booking ID, name, phone, email" />
        </div>
        <select className="input input-sm" value={carId} onChange={e => setCarId(e.target.value)}>
          <option value="">All cars</option>
          {cars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {list.length === 0 ? <EmptyState icon={CalendarCheck} title="No bookings found" /> : (
        <div className="card no-pad">
          <div className="table-wrap">
            <table className="table table-click">
              <thead><tr><th>Booking</th><th>Customer</th><th>Car</th><th>Trip</th><th>Status</th><th>KYC</th><th>Amount</th></tr></thead>
              <tbody>
                {list.slice(0, limit).map(b => (
                  <tr key={b.id} onClick={() => setSelected(b.id)}>
                    <td data-label="Booking"><strong>{b.code}</strong>{b.offline && <span className="muted small block">Offline</span>}</td>
                    <td data-label="Customer"><strong>{b.customer.name}</strong><span className="muted small block">{b.customer.phone}</span></td>
                    <td data-label="Car">{carName(b.carId) || b.carName}</td>
                    <td data-label="Trip"><span className="small">{fmtDateTime(b.start)}<br />→ {fmtDateTime(b.end)}</span></td>
                    <td data-label="Status"><Badge status={b.status} /></td>
                    <td data-label="KYC"><Badge status={b.kycStatus} /></td>
                    <td data-label="Amount"><strong>{inr(b.finalAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length > limit && <div className="center pad"><button type="button" className="btn btn-outline btn-sm" onClick={() => setLimit(l => l + 50)}>Load more ({list.length - limit} remaining)</button></div>}
        </div>
      )}

      {current && <BookingModal booking={current} cars={cars} onClose={() => setSelected(null)} reload={reload} />}
      {showNew && <NewBookingModal cars={cars} onClose={() => setParams({})} reload={reload} />}
    </div>
  );
}

function BookingModal({ booking: b, cars, onClose, reload }) {
  const { toast, settings } = useApp();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null);
  const [odo, setOdo] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [resched, setResched] = useState({ start: toLocalInput(b.start), end: toLocalInput(b.end), carId: b.carId });
  const [notes, setNotes] = useState(b.notes || '');
  const car = cars.find(c => c.id === b.carId);
  const c = b.customer;

  async function patch(body, msg) {
    setBusy(true);
    try {
      await api(`/admin/bookings/${b.id}`, { method: 'PATCH', body });
      await reload();
      toast(msg);
      setMode(null);
      setOdo('');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      await api(`/admin/bookings/${b.id}/notify`, { method: 'POST', body: { event: b.status === 'completed' ? 'completed' : b.status === 'cancelled' ? 'cancelled' : 'created' } });
      toast('Notifications sent. Check the Notifications log for status.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const place = p => (p.type === 'delivery' ? `Doorstep · ${p.address}, ${p.location}` : p.location);
  const waText = `Hi ${c.name}, this is ${settings.businessName} regarding your booking ${b.code} for ${car?.name || b.carName} (${fmtDateTime(b.start)} → ${fmtDateTime(b.end)}).`;
  const docs = [['dlFront', 'DL front'], ['dlBack', 'DL back'], ['idProof', c.idType || 'ID proof'], ['selfie', 'Photo']].filter(([k]) => b.documents?.[k]);
  const extraKmPreview = mode === 'complete' && odo !== '' ? Math.max(0, Number(odo) - b.startOdometer - b.pricing.includedKm) : 0;

  return (
    <Modal open onClose={onClose} size="lg" title={`Booking ${b.code}`}>
      <div className="bm">
        <div className="bm-head">
          <img src={car?.image} alt="" />
          <div>
            <h3>{car?.name || b.carName}</h3>
            <span className="muted small">{car?.regNumber || b.carReg}</span>
            <div className="badge-row">
              <Badge status={b.status} />
              <Badge status={b.kycStatus}>KYC {b.kycStatus}</Badge>
              <Badge status={b.payment.status}>{b.payment.method === 'upi' ? 'UPI' : 'Pay at pickup'} · {b.payment.status.replace('_', ' ')}</Badge>
            </div>
          </div>
        </div>

        <div className="bm-actions">
          {b.status === 'confirmed' && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMode('start'); setOdo(String(car?.odometer || '')); }}><Play size={15} /> Start trip</button>}
          {b.status === 'ongoing' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode('complete')}><Flag size={15} /> Complete trip</button>}
          {(b.status === 'confirmed' || b.status === 'ongoing') && <button type="button" className="btn btn-outline btn-sm" onClick={() => setMode('reschedule')}><CalendarDays size={15} /> Reschedule</button>}
          <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
          <a className="btn btn-outline btn-sm" href={`tel:${c.phone}`}><Phone size={15} /> Call</a>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={resend}><Send size={15} /> Resend notifications</button>
          {(b.status === 'confirmed' || b.status === 'ongoing') && <button type="button" className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => window.confirm('Cancel this booking? The customer will be notified.') && patch({ action: 'cancel' }, 'Booking cancelled')}><Ban size={15} /> Cancel</button>}
        </div>

        {mode === 'start' && (
          <div className="action-panel">
            <Field label="Starting odometer reading (km)" hint={`Car's last recorded odometer: ${car?.odometer ?? '—'} km`}>
              <input type="number" className="input" value={odo} onChange={e => setOdo(e.target.value)} />
            </Field>
            {b.kycStatus !== 'verified' && <div className="alert alert-warn">KYC is not verified yet. Verify documents before handing over the car.</div>}
            <div className="btn-row"><button type="button" className="btn btn-outline btn-sm" onClick={() => setMode(null)}>Cancel</button><button type="button" className="btn btn-primary btn-sm" disabled={busy || odo === ''} onClick={() => patch({ action: 'start', startOdometer: odo }, 'Trip started')}>Start trip</button></div>
          </div>
        )}
        {mode === 'complete' && (
          <div className="action-panel">
            <div className="grid-2">
              <Field label="End odometer reading (km)" hint={`Start: ${b.startOdometer} km · Free: ${b.pricing.includedKm} km`}>
                <input type="number" className="input" value={odo} onChange={e => setOdo(e.target.value)} />
              </Field>
              <Field label="Other charges (₹)" hint="Late return, fuel, damage, cleaning">
                <input type="number" className="input" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
              </Field>
            </div>
            {odo !== '' && <p className="hint-line">Km driven: <strong>{Math.max(0, Number(odo) - b.startOdometer)} km</strong> · Extra km: <strong>{extraKmPreview}</strong> · Extra charges: <strong>{inr(extraKmPreview * b.pricing.extraKmRate)}</strong> · Final: <strong>{inr(b.pricing.total + extraKmPreview * b.pricing.extraKmRate + (Number(otherCharges) || 0))}</strong></p>}
            <div className="btn-row"><button type="button" className="btn btn-outline btn-sm" onClick={() => setMode(null)}>Cancel</button><button type="button" className="btn btn-primary btn-sm" disabled={busy || odo === ''} onClick={() => patch({ action: 'complete', endOdometer: odo, otherCharges }, 'Trip completed')}>Complete trip</button></div>
          </div>
        )}
        {mode === 'reschedule' && (
          <div className="action-panel">
            <div className="grid-3">
              <Field label="Car"><select className="input" value={resched.carId} onChange={e => setResched(r => ({ ...r, carId: e.target.value }))}>{cars.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Field label="Pickup"><input type="datetime-local" className="input" value={resched.start} onChange={e => setResched(r => ({ ...r, start: e.target.value }))} /></Field>
              <Field label="Drop"><input type="datetime-local" className="input" value={resched.end} onChange={e => setResched(r => ({ ...r, end: e.target.value }))} /></Field>
            </div>
            <div className="btn-row"><button type="button" className="btn btn-outline btn-sm" onClick={() => setMode(null)}>Cancel</button><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => patch({ action: 'reschedule', carId: resched.carId, start: new Date(resched.start).toISOString(), end: new Date(resched.end).toISOString() }, 'Booking rescheduled')}>Save</button></div>
          </div>
        )}

        <div className="bm-grid">
          <section>
            <h4>Trip</h4>
            <dl className="kv">
              <div><dt>Pickup</dt><dd>{fmtDateTime(b.start)}<small>{place(b.pickup)}</small></dd></div>
              <div><dt>Drop</dt><dd>{fmtDateTime(b.end)}<small>{place(b.drop)}</small></dd></div>
              <div><dt>Duration</dt><dd>{formatDuration(b.pricing.hours)} (billed {formatDuration(b.pricing.billableHours)})</dd></div>
              <div><dt>Free km</dt><dd>{b.pricing.includedKm} km · ₹{b.pricing.extraKmRate}/extra km</dd></div>
              {b.startOdometer != null && <div><dt>Odometer</dt><dd>{b.startOdometer} → {b.endOdometer ?? '…'} km</dd></div>}
              {b.status === 'completed' && <div><dt>Km driven</dt><dd>{b.kmDriven} km</dd></div>}
            </dl>
          </section>
          <section>
            <h4>Customer</h4>
            <dl className="kv">
              <div><dt>Name</dt><dd>{c.name}</dd></div>
              <div><dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${c.email}`}><Mail size={13} /> {c.email || '—'}</a></dd></div>
              <div><dt>Address</dt><dd>{c.address || '—'}</dd></div>
              {c.dob && <div><dt>DOB</dt><dd>{c.dob}</dd></div>}
              <div><dt>DL no.</dt><dd>{c.dlNumber || '—'}</dd></div>
              <div><dt>{c.idType || 'ID'}</dt><dd>{c.idNumber || '—'}</dd></div>
            </dl>
          </section>
          <section>
            <h4>Payment</h4>
            <dl className="kv">
              <div><dt>Rental</dt><dd>{inr(b.pricing.rental)}</dd></div>
              {b.pricing.delivery > 0 && <div><dt>Delivery</dt><dd>{inr(b.pricing.delivery)}</dd></div>}
              {b.extraKmCharges > 0 && <div><dt>Extra km</dt><dd>{inr(b.extraKmCharges)}</dd></div>}
              {b.otherCharges > 0 && <div><dt>Other</dt><dd>{inr(b.otherCharges)}</dd></div>}
              <div><dt>Total</dt><dd><strong>{inr(b.finalAmount)}</strong></dd></div>
              <div><dt>Deposit</dt><dd>{inr(b.pricing.deposit)}</dd></div>
            </dl>
            <div className="btn-row">
              {['pending', 'paid', 'refunded'].map(s => (
                <button key={s} type="button" className={`chip ${b.payment.status === s ? 'active' : ''}`} disabled={busy} onClick={() => patch({ paymentStatus: s }, `Payment marked ${s}`)}>{s}</button>
              ))}
            </div>
          </section>
          <section>
            <h4><ShieldCheck size={16} /> Documents & KYC</h4>
            {docs.length === 0 ? <p className="muted small">No documents uploaded (offline booking). Verify originals at pickup.</p> : (
              <div className="doc-grid">
                {docs.map(([k, label]) => {
                  const name = b.documents[k];
                  const isPdf = name.endsWith('.pdf');
                  return (
                    <a key={k} href={documentUrl(name)} target="_blank" rel="noreferrer" className="doc-thumb">
                      {isPdf ? <div className="doc-pdf"><FileText size={26} /></div> : <img src={documentUrl(name)} alt={label} />}
                      <span>{label}</span>
                    </a>
                  );
                })}
              </div>
            )}
            <div className="btn-row">
              <button type="button" className="btn btn-sm btn-success" disabled={busy || b.kycStatus === 'verified'} onClick={() => patch({ kycStatus: 'verified' }, 'KYC verified')}>Verify</button>
              <button type="button" className="btn btn-sm btn-danger-outline" disabled={busy || b.kycStatus === 'rejected'} onClick={() => patch({ kycStatus: 'rejected' }, 'KYC rejected')}>Reject</button>
            </div>
          </section>
        </div>

        <Field label="Internal notes">
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (b.notes || '') && patch({ notes }, 'Notes saved')} />
        </Field>

        {b.history?.length > 0 && (
          <div className="timeline">
            <h4>Activity</h4>
            <ul>{[...b.history].reverse().map((h, i) => <li key={i}><span>{fmtDateTime(h.at)}</span>{h.action}{h.by ? ` · ${h.by}` : ''}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function NewBookingModal({ cars, onClose, reload }) {
  const { settings, toast } = useApp();
  const [f, setF] = useState(() => ({
    ...defaultTrip(), carId: cars[0]?.id || '', name: '', phone: '', email: '', address: '', dlNumber: '', idType: ID_TYPES[0], idNumber: '',
    pickupType: 'hub', pickupLocation: settings.hubs[0], pickupAddress: '', dropType: 'hub', dropLocation: settings.hubs[0], dropAddress: '',
    paymentMethod: 'pay_at_pickup', notes: '', notify: true
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const car = cars.find(c => c.id === f.carId);
  const price = car ? calcPrice({ car, start: f.start, end: f.end, pickupType: f.pickupType, dropType: f.dropType, settings }) : null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/bookings', { method: 'POST', body: { ...f, start: new Date(f.start).toISOString(), end: new Date(f.end).toISOString() } });
      await reload();
      toast('Offline booking created');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const placeFields = prefix => (
    <div className="grid-3">
      <Field label={prefix === 'pickup' ? 'Pickup type' : 'Drop type'}>
        <select className="input" value={f[`${prefix}Type`]} onChange={e => { set(`${prefix}Type`, e.target.value); set(`${prefix}Location`, e.target.value === 'hub' ? settings.hubs[0] : settings.deliveryAreas[0]); }}>
          <option value="hub">Hub (free)</option><option value="delivery">Doorstep (₹{settings.deliveryCharge})</option>
        </select>
      </Field>
      <Field label={f[`${prefix}Type`] === 'hub' ? 'Hub' : 'Area'}>
        <select className="input" value={f[`${prefix}Location`]} onChange={e => set(`${prefix}Location`, e.target.value)}>
          {(f[`${prefix}Type`] === 'hub' ? settings.hubs : settings.deliveryAreas).map(x => <option key={x}>{x}</option>)}
        </select>
      </Field>
      {f[`${prefix}Type`] === 'delivery' && <Field label="Address"><input className="input" value={f[`${prefix}Address`]} onChange={e => set(`${prefix}Address`, e.target.value)} /></Field>}
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title="New offline booking"
      footer={<><span className="muted">{price ? `${formatDuration(price.billableHours)} · ${inr(price.total)}` : ''}</span><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button type="submit" form="new-booking" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create booking'}</button></>}>
      <form id="new-booking" onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="grid-3">
          <Field label="Car"><select className="input" value={f.carId} onChange={e => set('carId', e.target.value)}>{cars.map(c => <option key={c.id} value={c.id}>{c.name} – {inr(c.pricePerDay)}/day</option>)}</select></Field>
          <Field label="Pickup"><input type="datetime-local" className="input" value={f.start} onChange={e => set('start', e.target.value)} /></Field>
          <Field label="Drop"><input type="datetime-local" className="input" value={f.end} onChange={e => set('end', e.target.value)} /></Field>
        </div>
        {placeFields('pickup')}
        {placeFields('drop')}
        <div className="grid-3">
          <Field label="Customer name *"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Phone *"><input className="input" inputMode="numeric" maxLength={10} value={f.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Email"><input type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="DL number"><input className="input upper" value={f.dlNumber} onChange={e => set('dlNumber', e.target.value)} /></Field>
          <Field label="ID type"><select className="input" value={f.idType} onChange={e => set('idType', e.target.value)}>{ID_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="ID number"><input className="input upper" value={f.idNumber} onChange={e => set('idNumber', e.target.value)} /></Field>
        </div>
        <Field label="Address"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="Payment"><select className="input" value={f.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}><option value="pay_at_pickup">Pay at pickup</option><option value="upi">UPI</option><option value="cash">Cash</option></select></Field>
          <Field label="Notes"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
        <label className="check-row"><input type="checkbox" checked={f.notify} onChange={e => set('notify', e.target.checked)} /><span>Send confirmation to customer (email & WhatsApp)</span></label>
      </form>
    </Modal>
  );
}
