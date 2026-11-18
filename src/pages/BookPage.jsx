import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Users, Fuel, Cog, Gauge, CircleCheck, ShieldCheck, MapPin, ChevronLeft, Info, CalendarDays, Building2, Route } from 'lucide-react';
import { api, toFormData } from '../api';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Spinner, Field, FileDrop, EmptyState } from '../components/ui';
import AuthForm from '../components/AuthForm';
import { calcPrice, formatDuration, rangesOverlap } from '../../shared/pricing';
import { inr, fmtDateTime, defaultTrip, nowInput, ID_TYPES } from '../utils/format';
import { validateEmail, validatePhone, validateName } from '../utils/validation';
import { sendBookingAlert } from '../services/notify';

const STEPS = ['Trip details', 'Driver & documents', 'Review & confirm'];

export default function BookPage() {
  const { carId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, toast } = useApp();
  const [car, setCar] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState(() => {
    const d = defaultTrip();
    return {
      start: params.get('start') || d.start,
      end: params.get('end') || d.end,
      pickupType: 'hub', pickupLocation: '', pickupAddress: '',
      sameDrop: true, dropType: 'hub', dropLocation: '', dropAddress: ''
    };
  });
  const [driver, setDriver] = useState({ name: '', email: '', phone: '', dob: '', address: '', dlNumber: '', idType: ID_TYPES[0], idNumber: '' });
  const [files, setFiles] = useState({ dlFront: null, dlBack: null, idProof: null, selfie: null });
  const [extra, setExtra] = useState({ paymentMethod: 'pay_at_pickup', notes: '', agree: false });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/cars/${carId}`).then(setCar).catch(e => setLoadError(e.message));
  }, [carId]);

  useEffect(() => {
    setTrip(t => ({ ...t, pickupLocation: t.pickupLocation || settings.hubs[0], dropLocation: t.dropLocation || settings.hubs[0] }));
  }, [settings.hubs]);

  useEffect(() => {
    if (!user) return;
    setDriver(d => ({
      ...d,
      name: d.name || user.name || '',
      email: d.email || user.email || '',
      phone: d.phone || user.phone || '',
      address: d.address || user.address || '',
      dob: d.dob || user.dob || '',
      dlNumber: d.dlNumber || user.dlNumber || ''
    }));
  }, [user]);

  const drop = trip.sameDrop
    ? { type: trip.pickupType, location: trip.pickupLocation, address: trip.pickupAddress }
    : { type: trip.dropType, location: trip.dropLocation, address: trip.dropAddress };

  const price = useMemo(
    () => (car ? calcPrice({ car, start: trip.start, end: trip.end, pickupType: trip.pickupType, dropType: drop.type, settings }) : null),
    [car, trip.start, trip.end, trip.pickupType, drop.type, settings]
  );

  const conflict = car?.bookedSlots?.find(s => rangesOverlap(trip.start, trip.end, s.start, s.end));
  const savedDocs = user?.documents || {};

  const setT = (k, v) => { setTrip(t => ({ ...t, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };
  const setD = (k, v) => { setDriver(d => ({ ...d, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  function validateTrip() {
    const e = {};
    if (!trip.start) e.start = 'Select pickup time.';
    else if (new Date(trip.start) < new Date(Date.now() - 5 * 60000)) e.start = 'Pickup must be in the future.';
    if (!trip.end || new Date(trip.end) <= new Date(trip.start)) e.end = 'Drop must be after pickup.';
    else if (price.hours < settings.minHours) e.end = `Minimum booking is ${settings.minHours} hours.`;
    if (trip.pickupType === 'delivery') {
      if (!trip.pickupLocation || settings.hubs.includes(trip.pickupLocation)) e.pickupLocation = 'Select your area.';
      if (trip.pickupAddress.trim().length < 5) e.pickupAddress = 'Enter full address.';
    }
    if (!trip.sameDrop && trip.dropType === 'delivery') {
      if (!trip.dropLocation || settings.hubs.includes(trip.dropLocation)) e.dropLocation = 'Select your area.';
      if (trip.dropAddress.trim().length < 5) e.dropAddress = 'Enter full address.';
    }
    if (conflict) e.start = 'Car is already booked in this time. Change dates.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function validateDriver() {
    const e = {};
    e.name = validateName(driver.name);
    e.email = validateEmail(driver.email);
    e.phone = validatePhone(driver.phone);
    if (!driver.dob) e.dob = 'Date of birth is required.';
    else if ((Date.now() - new Date(driver.dob)) / (365.25 * 86400000) < 21) e.dob = 'Driver must be at least 21 years old.';
    if (driver.address.trim().length < 5) e.address = 'Enter your residential address.';
    if (driver.dlNumber.trim().length < 6) e.dlNumber = 'Enter a valid DL number.';
    if (driver.idNumber.trim().length < 4) e.idNumber = `Enter your ${driver.idType} number.`;
    ['dlFront', 'dlBack', 'idProof', 'selfie'].forEach(k => { if (!files[k] && !savedDocs[k]) e[k] = 'Required'; });
    Object.keys(e).forEach(k => !e[k] && delete e[k]);
    setErrors(e);
    return !Object.keys(e).length;
  }

  function next() {
    if (step === 0 && !validateTrip()) return;
    if (step === 1 && (!user || !validateDriver())) return;
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirm() {
    if (!extra.agree) return setSubmitError('Please accept the rental terms to continue.');
    setSubmitting(true);
    setSubmitError('');
    try {
      const form = toFormData({
        carId: car.id,
        start: new Date(trip.start).toISOString(),
        end: new Date(trip.end).toISOString(),
        pickupType: trip.pickupType, pickupLocation: trip.pickupLocation, pickupAddress: trip.pickupAddress,
        dropType: drop.type, dropLocation: drop.location, dropAddress: drop.address,
        ...driver,
        paymentMethod: extra.paymentMethod,
        notes: extra.notes,
        ...files
      });
      const { booking } = await api('/bookings', { method: 'POST', form });
      sendBookingAlert(booking, car, settings).catch(() => {});
      toast('Booking confirmed! Details sent to your email & WhatsApp.');
      navigate(`/booking/${booking.id}?new=1`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <div className="container section"><EmptyState title="Car not found" text={loadError} action={<Link to="/cars" className="btn btn-primary">Browse cars</Link>} /></div>;
  if (!car) return <Spinner />;

  const place = (type, location, address) => (type === 'delivery' ? `${address}, ${location}` : location);

  const summary = (
    <div className="summary-card">
      <div className="summary-car">
        <img src={car.image} alt={car.name} />
        <div>
          <strong>{car.name}</strong>
          <span className="muted">{car.transmission} · {car.fuel} · {car.seats} seats</span>
        </div>
      </div>
      <div className="summary-trip">
        <div><span>Pickup</span><strong>{fmtDateTime(trip.start)}</strong></div>
        <Route size={18} className="muted" />
        <div className="ta-right"><span>Drop</span><strong>{fmtDateTime(trip.end)}</strong></div>
      </div>
      {price && (
        <dl className="price-list">
          <div><dt>Rental ({formatDuration(price.billableHours)})</dt><dd>{inr(price.rental)}</dd></div>
          {price.delivery > 0 && <div><dt>Doorstep delivery</dt><dd>{inr(price.delivery)}</dd></div>}
          <div className="total"><dt>Total payable</dt><dd>{inr(price.total)}</dd></div>
          <div className="sub"><dt>Refundable security deposit</dt><dd>{inr(price.deposit)}</dd></div>
        </dl>
      )}
      {price && (
        <ul className="inclusions">
          <li><CircleCheck size={15} /> {price.includedKm} km free, then ₹{price.extraKmRate}/km</li>
          <li><CircleCheck size={15} /> Insurance & 24×7 roadside assistance</li>
          <li><Info size={15} /> Fuel, tolls & parking not included</li>
        </ul>
      )}
    </div>
  );

  return (
    <section className="section book-page">
      <div className="container">
        <Link to="/cars" className="back-link"><ChevronLeft size={18} /> Back to cars</Link>

        <div className="book-hero">
          <div className="book-hero-img"><img src={car.image} alt={car.name} /></div>
          <div className="book-hero-info">
            <span className="car-cat static">{car.category}</span>
            <h1>{car.name} <span className="muted">{car.year}</span></h1>
            <p className="muted">{car.description}</p>
            <ul className="car-specs big">
              <li><Cog size={16} />{car.transmission}</li>
              <li><Fuel size={16} />{car.fuel}</li>
              <li><Users size={16} />{car.seats} Seats</li>
              <li><Gauge size={16} />{car.kmPerDay} km/day free</li>
            </ul>
            <div className="feature-tags">{car.features?.map(f => <span key={f}>{f}</span>)}</div>
            <div className="book-hero-price"><strong>{inr(car.pricePerDay)}</strong><span>/day · {inr(Math.round(car.pricePerDay / 24))}/hr</span></div>
          </div>
        </div>

        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <button type="button" disabled={i > step} onClick={() => setStep(i)}>
                <span className="step-dot">{i < step ? <CircleCheck size={16} /> : i + 1}</span>
                <span className="step-label">{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="book-layout">
          <div className="book-main">
            {step === 0 && (
              <div className="card">
                <h2 className="card-title"><CalendarDays size={20} /> When do you need the car?</h2>
                <div className="grid-2">
                  <Field label="Pickup date & time" error={errors.start}>
                    <input type="datetime-local" className="input" value={trip.start} min={nowInput()} onChange={e => setT('start', e.target.value)} />
                  </Field>
                  <Field label="Drop date & time" error={errors.end}>
                    <input type="datetime-local" className="input" value={trip.end} min={trip.start} onChange={e => setT('end', e.target.value)} />
                  </Field>
                </div>
                {price?.hours > 0 && <p className="hint-line">Duration: <strong>{formatDuration(price.hours)}</strong>{price.billableHours > price.hours && ` (billed as ${settings.minHours} hrs minimum)`}</p>}
                {conflict && <div className="alert alert-error">This car is booked from {fmtDateTime(conflict.start)} to {fmtDateTime(conflict.end)}. Please choose another time.</div>}
                {!conflict && price?.hours > 0 && <div className="alert alert-success"><CircleCheck size={16} /> Car is available for your dates.</div>}

                <h2 className="card-title mt"><MapPin size={20} /> Pickup</h2>
                <PlaceChooser settings={settings} type={trip.pickupType} location={trip.pickupLocation} address={trip.pickupAddress} errors={{ location: errors.pickupLocation, address: errors.pickupAddress }}
                  onChange={(k, v) => setT({ type: 'pickupType', location: 'pickupLocation', address: 'pickupAddress' }[k], v)} />

                <h2 className="card-title mt"><MapPin size={20} /> Drop</h2>
                <label className="switch-row">
                  <input type="checkbox" checked={trip.sameDrop} onChange={e => setT('sameDrop', e.target.checked)} />
                  <span>Return to the same place as pickup</span>
                </label>
                {!trip.sameDrop && (
                  <PlaceChooser settings={settings} type={trip.dropType} location={trip.dropLocation} address={trip.dropAddress} errors={{ location: errors.dropLocation, address: errors.dropAddress }}
                    onChange={(k, v) => setT({ type: 'dropType', location: 'dropLocation', address: 'dropAddress' }[k], v)} />
                )}

                {car.bookedSlots?.length > 0 && (
                  <details className="booked-slots">
                    <summary>Already booked slots for this car ({car.bookedSlots.length})</summary>
                    <ul>{car.bookedSlots.map(s => <li key={s.start}>{fmtDateTime(s.start)} → {fmtDateTime(s.end)}</li>)}</ul>
                  </details>
                )}
              </div>
            )}

            {step === 1 && !user && (
              <div className="card">
                <h2 className="card-title">Sign in to continue booking</h2>
                <p className="muted">Your booking details will be saved to your account and sent on email & WhatsApp.</p>
                <AuthForm initialMode="register" />
              </div>
            )}

            {step === 1 && user && (
              <div className="card">
                <h2 className="card-title">Driver details</h2>
                <p className="muted small">Enter details exactly as on the driving licence. The driver must be 21+ with a licence at least 1 year old.</p>
                <div className="grid-2">
                  <Field label="Full name" error={errors.name}><input className="input" value={driver.name} onChange={e => setD('name', e.target.value)} autoComplete="name" /></Field>
                  <Field label="Date of birth" error={errors.dob}><input type="date" className="input" value={driver.dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setD('dob', e.target.value)} /></Field>
                  <Field label="Email" error={errors.email}><input type="email" className="input" value={driver.email} onChange={e => setD('email', e.target.value)} autoComplete="email" /></Field>
                  <Field label="Mobile (WhatsApp)" error={errors.phone}>
                    <div className="input-prefix"><span>+91</span><input type="tel" inputMode="numeric" maxLength={10} className="input" value={driver.phone} onChange={e => setD('phone', e.target.value.replace(/\D/g, ''))} /></div>
                  </Field>
                </div>
                <Field label="Residential address" error={errors.address}><textarea className="input" rows={2} value={driver.address} onChange={e => setD('address', e.target.value)} /></Field>

                <h2 className="card-title mt"><ShieldCheck size={20} /> Licence & ID verification</h2>
                <div className="grid-3">
                  <Field label="Driving licence no." error={errors.dlNumber}><input className="input upper" value={driver.dlNumber} onChange={e => setD('dlNumber', e.target.value)} placeholder="MH12 20190012345" /></Field>
                  <Field label="Photo ID type">
                    <select className="input" value={driver.idType} onChange={e => setD('idType', e.target.value)}>{ID_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                  </Field>
                  <Field label={`${driver.idType} no.`} error={errors.idNumber}><input className="input upper" value={driver.idNumber} onChange={e => setD('idNumber', e.target.value)} /></Field>
                </div>
                <div className="upload-grid">
                  {[
                    ['dlFront', 'Driving licence – front'],
                    ['dlBack', 'Driving licence – back'],
                    ['idProof', `${driver.idType} (photo ID)`],
                    ['selfie', 'Your recent photo / selfie']
                  ].map(([k, label]) => (
                    <FileDrop key={k} label={label} file={files[k]} existing={savedDocs[k]} error={errors[k]}
                      accept={k === 'selfie' ? 'image/*' : undefined}
                      onChange={f => { setFiles(x => ({ ...x, [k]: f })); setErrors(e => ({ ...e, [k]: null })); }} />
                  ))}
                </div>
                {['dlFront', 'dlBack', 'idProof', 'selfie'].some(k => errors[k]) && <div className="alert alert-error">Please upload all required documents.</div>}
                <p className="muted small"><ShieldCheck size={14} /> Your documents are stored securely and only used for verification.</p>
              </div>
            )}

            {step === 2 && (
              <div className="card">
                <h2 className="card-title">Review your booking</h2>
                <div className="review-grid">
                  <div><span>Pickup</span><strong>{fmtDateTime(trip.start)}</strong><small>{trip.pickupType === 'delivery' ? 'Doorstep: ' : ''}{place(trip.pickupType, trip.pickupLocation, trip.pickupAddress)}</small></div>
                  <div><span>Drop</span><strong>{fmtDateTime(trip.end)}</strong><small>{drop.type === 'delivery' ? 'Doorstep: ' : ''}{place(drop.type, drop.location, drop.address)}</small></div>
                  <div><span>Driver</span><strong>{driver.name}</strong><small>{driver.phone} · {driver.email}</small></div>
                  <div><span>Documents</span><strong>DL {driver.dlNumber.toUpperCase()}</strong><small>{driver.idType}: {driver.idNumber.toUpperCase()}</small></div>
                </div>

                <h3 className="sub-title">Payment</h3>
                <div className="radio-cards">
                  {[
                    ['pay_at_pickup', 'Pay at pickup', 'Cash / Card / UPI when you collect the car'],
                    ['upi', 'UPI before pickup', `We will share a UPI payment link on WhatsApp`]
                  ].map(([v, t, d]) => (
                    <label key={v} className={`radio-card ${extra.paymentMethod === v ? 'active' : ''}`}>
                      <input type="radio" name="pay" checked={extra.paymentMethod === v} onChange={() => setExtra(x => ({ ...x, paymentMethod: v }))} />
                      <div><strong>{t}</strong><span>{d}</span></div>
                    </label>
                  ))}
                </div>
                <Field label="Notes for us (optional)"><textarea className="input" rows={2} value={extra.notes} onChange={e => setExtra(x => ({ ...x, notes: e.target.value }))} placeholder="e.g. Need child seat, travelling to Lonavala" /></Field>
                <label className="check-row">
                  <input type="checkbox" checked={extra.agree} onChange={e => { setExtra(x => ({ ...x, agree: e.target.checked })); setSubmitError(''); }} />
                  <span>I agree to the rental terms: valid original DL at pickup, fuel/tolls/challans are my responsibility, extra km charged at ₹{price.extraKmRate}/km, and a refundable deposit of {inr(price.deposit)}.</span>
                </label>
                {submitError && <div className="alert alert-error">{submitError}</div>}
              </div>
            )}

            <div className="step-actions">
              {step > 0 && <button type="button" className="btn btn-outline" onClick={() => setStep(s => s - 1)}>Back</button>}
              {step < 2 && (step !== 1 || user) && <button type="button" className="btn btn-primary btn-lg" onClick={next}>Continue</button>}
              {step === 2 && <button type="button" className="btn btn-primary btn-lg" disabled={submitting} onClick={confirm}>{submitting ? 'Confirming…' : `Confirm booking · ${inr(price.total)}`}</button>}
            </div>
          </div>
          <aside className="book-aside">{summary}</aside>
        </div>
      </div>

      <div className="mobile-bar">
        <div>
          <strong>{inr(price?.total)}</strong>
          <span>{price ? `${formatDuration(price.billableHours)} · ${price.includedKm} km free` : ''}</span>
        </div>
        {step < 2 ? (
          (step !== 1 || user) && <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={submitting} onClick={confirm}>{submitting ? 'Booking…' : 'Confirm'}</button>
        )}
      </div>
    </section>
  );
}

function PlaceChooser({ settings, type, location, address, errors, onChange }) {
  return (
    <div className="place-chooser">
      <div className="radio-cards">
        <label className={`radio-card ${type === 'hub' ? 'active' : ''}`}>
          <input type="radio" checked={type === 'hub'} onChange={() => { onChange('type', 'hub'); onChange('location', settings.hubs[0]); }} />
          <Building2 size={20} />
          <div><strong>Self pickup at hub</strong><span>Free</span></div>
        </label>
        <label className={`radio-card ${type === 'delivery' ? 'active' : ''}`}>
          <input type="radio" checked={type === 'delivery'} onChange={() => { onChange('type', 'delivery'); onChange('location', ''); }} />
          <MapPin size={20} />
          <div><strong>Doorstep delivery</strong><span>₹{settings.deliveryCharge}</span></div>
        </label>
      </div>
      {type === 'hub' ? (
        <Field label="Select hub">
          <select className="input" value={location} onChange={e => onChange('location', e.target.value)}>
            {settings.hubs.map(h => <option key={h}>{h}</option>)}
          </select>
        </Field>
      ) : (
        <div className="grid-2">
          <Field label="Area" error={errors.location}>
            <select className="input" value={location} onChange={e => onChange('location', e.target.value)}>
              <option value="">Select area</option>
              {settings.deliveryAreas.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Full address" error={errors.address}>
            <input className="input" value={address} onChange={e => onChange('address', e.target.value)} placeholder="Flat, building, street, landmark" />
          </Field>
        </div>
      )}
    </div>
  );
}
