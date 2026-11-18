import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Phone, Mail, CarFront, UserCog } from 'lucide-react';
import { Modal, Field, Badge, EmptyState } from '../../components/ui';
import OwnerAnalytics from '../../components/OwnerAnalytics';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { inr } from '../../utils/format';
import { summarize, getPeriodRange } from '../../../shared/analytics';

export default function AdminOwners() {
  const { owners, cars, bookings, reload } = useOutletContext();
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const month = useMemo(() => getPeriodRange('month'), []);

  async function remove(o) {
    if (!window.confirm(`Delete owner ${o.name}? Their cars will become company owned.`)) return;
    try {
      await api(`/admin/owners/${o.id}`, { method: 'DELETE' });
      await reload();
      toast('Owner deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function toggle(o) {
    try {
      await api(`/admin/owners/${o.id}`, { method: 'PUT', body: { active: !o.active } });
      await reload();
      toast(o.active ? 'Owner login disabled' : 'Owner login enabled');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const viewOwner = viewing && owners.find(o => o.id === viewing);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Car owners <span className="muted">({owners.length})</span></h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={16} /> Add owner</button>
      </div>
      {owners.length === 0 ? <EmptyState icon={UserCog} title="No car owners yet" text="Add an owner and assign cars to let them track earnings." /> : (
        <div className="owner-grid">
          {owners.map(o => {
            const ownerCars = cars.filter(c => c.ownerId === o.id);
            const ob = bookings.filter(b => b.ownerId === o.id);
            const m = summarize(ob, { sharePercent: o.sharePercent, range: month });
            const life = summarize(ob, { sharePercent: o.sharePercent });
            return (
              <div key={o.id} className="card owner-card">
                <div className="owner-card-head">
                  <span className="avatar lg">{o.name[0]}</span>
                  <div>
                    <h3>{o.name}</h3>
                    <span className="muted small"><Phone size={12} /> {o.phone} · <Mail size={12} /> {o.email}</span>
                  </div>
                  <Badge status={o.active !== false ? 'verified' : 'cancelled'}>{o.active !== false ? 'Active' : 'Disabled'}</Badge>
                </div>
                <div className="mini-stats">
                  <div><span>This month</span><strong>{inr(m.earnings)}</strong></div>
                  <div><span>Lifetime</span><strong>{inr(life.earnings)}</strong></div>
                  <div><span>Share</span><strong>{o.sharePercent}%</strong></div>
                </div>
                <div className="owner-cars">
                  <CarFront size={15} />
                  {ownerCars.length ? ownerCars.map(c => <span key={c.id} className="tag">{c.name}</span>) : <span className="muted small">No cars assigned</span>}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setViewing(o.id)}><Eye size={14} /> Analytics</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(o)}><Pencil size={14} /> Edit</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(o)}>{o.active !== false ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => remove(o)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <OwnerForm owner={editing} cars={cars} owners={owners} onClose={() => setEditing(null)} reload={reload} />}
      {viewOwner && (
        <Modal open size="xl" title={`${viewOwner.name} · performance`} onClose={() => setViewing(null)}>
          <OwnerAnalytics owner={viewOwner} cars={cars.filter(c => c.ownerId === viewOwner.id)} bookings={bookings.filter(b => b.ownerId === viewOwner.id)} />
        </Modal>
      )}
    </div>
  );
}

function OwnerForm({ owner, cars, owners, onClose, reload }) {
  const { toast, settings } = useApp();
  const isNew = !owner.id;
  const [f, setF] = useState({
    name: owner.name || '', email: owner.email || '', phone: owner.phone || '', password: '',
    sharePercent: owner.sharePercent ?? settings.defaultOwnerShare, address: owner.address || '',
    bank: { accountName: '', accountNumber: '', ifsc: '', upi: '', ...(owner.bank || {}) },
    carIds: cars.filter(c => c.ownerId && c.ownerId === owner.id).map(c => c.id)
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setBank = (k, v) => setF(x => ({ ...x, bank: { ...x.bank, [k]: v } }));
  const toggleCar = id => set('carIds', f.carIds.includes(id) ? f.carIds.filter(x => x !== id) : [...f.carIds, id]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...f };
      if (!isNew && !body.password) delete body.password;
      await api(isNew ? '/admin/owners' : `/admin/owners/${owner.id}`, { method: isNew ? 'POST' : 'PUT', body });
      await reload();
      toast(isNew ? `Owner created. Login: ${f.email}` : 'Owner updated');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? 'Add car owner' : `Edit ${owner.name}`}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button type="submit" form="owner-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create owner' : 'Save changes'}</button></>}>
      <form id="owner-form" onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="grid-2">
          <Field label="Full name *"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Mobile *"><input className="input" inputMode="numeric" maxLength={10} value={f.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Email (login ID) *"><input type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label={isNew ? 'Password *' : 'New password'} hint={isNew ? 'Share this with the owner to log in' : 'Leave blank to keep current'}><input className="input" value={f.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" /></Field>
          <Field label="Revenue share (%)" hint="Owner's share of rental + extra km charges"><input type="number" min="0" max="100" className="input" value={f.sharePercent} onChange={e => set('sharePercent', e.target.value)} /></Field>
          <Field label="Address"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} /></Field>
        </div>
        <h4 className="sub-title">Payout details</h4>
        <div className="grid-2">
          <Field label="Account holder"><input className="input" value={f.bank.accountName} onChange={e => setBank('accountName', e.target.value)} /></Field>
          <Field label="Account number"><input className="input" value={f.bank.accountNumber} onChange={e => setBank('accountNumber', e.target.value)} /></Field>
          <Field label="IFSC"><input className="input upper" value={f.bank.ifsc} onChange={e => setBank('ifsc', e.target.value.toUpperCase())} /></Field>
          <Field label="UPI ID"><input className="input" value={f.bank.upi} onChange={e => setBank('upi', e.target.value)} /></Field>
        </div>
        <h4 className="sub-title">Assign cars</h4>
        <div className="check-grid">
          {cars.map(c => {
            const other = c.ownerId && c.ownerId !== owner.id ? owners.find(o => o.id === c.ownerId) : null;
            return (
              <label key={c.id} className={`check-card ${f.carIds.includes(c.id) ? 'active' : ''}`}>
                <input type="checkbox" checked={f.carIds.includes(c.id)} onChange={() => toggleCar(c.id)} />
                <img src={c.image} alt="" />
                <div><strong>{c.name}</strong><span className="muted small">{c.regNumber}{other ? ` · currently ${other.name}` : ''}</span></div>
              </label>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
