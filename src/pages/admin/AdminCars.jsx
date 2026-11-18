import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Users, Fuel, Cog, Gauge, UserCog } from 'lucide-react';
import { Modal, Field, Badge, EmptyState } from '../../components/ui';
import { api, toFormData } from '../../api';
import { useApp } from '../../context/AppContext';
import { inr } from '../../utils/format';
import { CAR_CATEGORIES, FUEL_TYPES, TRANSMISSIONS } from '../../../shared/pricing';
import { summarize } from '../../../shared/analytics';

export default function AdminCars() {
  const { cars, owners, bookings, reload } = useOutletContext();
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const list = cars.filter(c =>
    (!q || `${c.name} ${c.regNumber}`.toLowerCase().includes(q.toLowerCase())) &&
    (!ownerFilter || (ownerFilter === 'none' ? !c.ownerId : c.ownerId === ownerFilter))
  );

  async function remove(car) {
    if (!window.confirm(`Remove ${car.name} from the fleet?`)) return;
    try {
      await api(`/admin/cars/${car.id}`, { method: 'DELETE' });
      await reload();
      toast('Car removed');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Fleet <span className="muted">({cars.length})</span></h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={16} /> Add car</button>
      </div>
      <div className="toolbar">
        <div className="search-input"><Search size={16} /><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search car or registration" /></div>
        <select className="input input-sm" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          <option value="none">Company owned / unassigned</option>
          {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {list.length === 0 ? <EmptyState title="No cars found" /> : (
        <div className="admin-car-grid">
          {list.map(car => {
            const owner = owners.find(o => o.id === car.ownerId);
            const s = summarize(bookings.filter(b => b.carId === car.id));
            const onTrip = bookings.some(b => b.carId === car.id && b.status === 'ongoing');
            return (
              <div key={car.id} className="card admin-car">
                <div className="admin-car-img">
                  <img src={car.image} alt={car.name} />
                  <Badge status={onTrip ? 'ongoing' : car.status === 'active' ? 'verified' : car.status === 'maintenance' ? 'pending' : 'cancelled'}>{onTrip ? 'On trip' : car.status}</Badge>
                </div>
                <div className="admin-car-body">
                  <div className="row-between"><h3>{car.name}</h3><strong>{inr(car.pricePerDay)}<small className="muted">/day</small></strong></div>
                  <span className="muted small">{car.regNumber || 'No reg. no.'} · {car.year} · {car.category}</span>
                  <ul className="car-specs">
                    <li><Cog size={14} />{car.transmission}</li>
                    <li><Fuel size={14} />{car.fuel}</li>
                    <li><Users size={14} />{car.seats}</li>
                    <li><Gauge size={14} />{(car.odometer || 0).toLocaleString('en-IN')} km</li>
                  </ul>
                  <div className="owner-line"><UserCog size={15} /> {owner ? `${owner.name} (${owner.sharePercent}%)` : 'Company owned'}</div>
                  <div className="mini-stats">
                    <div><span>Trips</span><strong>{s.completedBookings}</strong></div>
                    <div><span>Km</span><strong>{s.kmDriven.toLocaleString('en-IN')}</strong></div>
                    <div><span>Revenue</span><strong>{inr(s.revenue)}</strong></div>
                  </div>
                  <div className="btn-row">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(car)}><Pencil size={14} /> Edit</button>
                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => remove(car)}><Trash2 size={14} /> Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <CarForm car={editing} owners={owners} onClose={() => setEditing(null)} reload={reload} />}
    </div>
  );
}

function CarForm({ car, owners, onClose, reload }) {
  const { toast, settings } = useApp();
  const isNew = !car.id;
  const [f, setF] = useState({
    name: car.name || '', brand: car.brand || '', year: car.year || new Date().getFullYear(), regNumber: car.regNumber || '',
    category: car.category || 'SUV', color: car.color || '', fuel: car.fuel || 'Petrol', transmission: car.transmission || 'Manual',
    seats: car.seats || 5, pricePerDay: car.pricePerDay || '', kmPerDay: car.kmPerDay || settings.kmPerDay, extraKmRate: car.extraKmRate || settings.extraKmRate,
    odometer: car.odometer || 0, image: car.image?.startsWith('/uploads') ? '' : car.image || '', features: (car.features || []).join(', '),
    description: car.description || '', status: car.status || 'active', ownerId: car.ownerId || ''
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const preview = filePreview || f.image || car.image;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = toFormData({ ...f, ownerId: f.ownerId || '', imageFile: file });
      if (!f.ownerId) form.set('ownerId', '');
      await api(isNew ? '/admin/cars' : `/admin/cars/${car.id}`, { method: isNew ? 'POST' : 'PUT', form });
      await reload();
      toast(isNew ? 'Car added to fleet' : 'Car updated');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? 'Add new car' : `Edit ${car.name}`}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button type="submit" form="car-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add car' : 'Save changes'}</button></>}>
      <form id="car-form" onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="car-form-top">
          <div className="car-form-img">{preview ? <img src={preview} alt="" /> : <span className="muted">No photo</span>}</div>
          <div className="stack-sm">
            <Field label="Upload photo"><input type="file" accept="image/*" className="input" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
            <Field label="…or image URL"><input className="input" value={f.image} onChange={e => set('image', e.target.value)} placeholder="https://" /></Field>
          </div>
        </div>
        <div className="grid-3">
          <Field label="Car name *"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Hyundai Creta" /></Field>
          <Field label="Brand"><input className="input" value={f.brand} onChange={e => set('brand', e.target.value)} /></Field>
          <Field label="Registration no."><input className="input upper" value={f.regNumber} onChange={e => set('regNumber', e.target.value.toUpperCase())} placeholder="MH12 AB 1234" /></Field>
          <Field label="Year"><input type="number" className="input" value={f.year} onChange={e => set('year', e.target.value)} /></Field>
          <Field label="Category"><select className="input" value={f.category} onChange={e => set('category', e.target.value)}>{CAR_CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Color"><input className="input" value={f.color} onChange={e => set('color', e.target.value)} /></Field>
          <Field label="Fuel"><select className="input" value={f.fuel} onChange={e => set('fuel', e.target.value)}>{FUEL_TYPES.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Transmission"><select className="input" value={f.transmission} onChange={e => set('transmission', e.target.value)}>{TRANSMISSIONS.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Seats"><input type="number" min="2" className="input" value={f.seats} onChange={e => set('seats', e.target.value)} /></Field>
          <Field label="Price per day (₹) *"><input type="number" min="1" className="input" value={f.pricePerDay} onChange={e => set('pricePerDay', e.target.value)} /></Field>
          <Field label="Free km per day"><input type="number" className="input" value={f.kmPerDay} onChange={e => set('kmPerDay', e.target.value)} /></Field>
          <Field label="Extra km rate (₹)"><input type="number" className="input" value={f.extraKmRate} onChange={e => set('extraKmRate', e.target.value)} /></Field>
          <Field label="Odometer (km)"><input type="number" className="input" value={f.odometer} onChange={e => set('odometer', e.target.value)} /></Field>
          <Field label="Status"><select className="input" value={f.status} onChange={e => set('status', e.target.value)}><option value="active">Active (bookable)</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></Field>
          <Field label="Assign owner"><select className="input" value={f.ownerId} onChange={e => set('ownerId', e.target.value)}><option value="">Company owned</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        </div>
        <Field label="Features (comma separated)"><input className="input" value={f.features} onChange={e => set('features', e.target.value)} placeholder="AC, Sunroof, Android Auto" /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={f.description} onChange={e => set('description', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
