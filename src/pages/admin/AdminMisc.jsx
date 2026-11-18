import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Mail, MessageCircle, RefreshCw, Bell, Users, Save } from 'lucide-react';
import { Badge, EmptyState, Field, Spinner } from '../../components/ui';
import { api } from '../../api';
import { useApp } from '../../context/AppContext';
import { inr, fmtDate, fmtDateTime } from '../../utils/format';

export function AdminCustomers() {
  const { customers, bookings, reload } = useOutletContext();
  const { toast } = useApp();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const byPhone = new Map();
    bookings.forEach(b => {
      const key = b.customerId || `guest:${b.customer.phone}`;
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key).push(b);
    });
    return customers.map(c => {
      const list = byPhone.get(c.id) || [];
      const spent = list.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.finalAmount || 0), 0);
      const last = list.sort((a, b) => new Date(b.start) - new Date(a.start))[0];
      return { ...c, count: list.length, spent, last };
    }).filter(c => !q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  }, [customers, bookings, q]);

  async function toggle(c) {
    try {
      await api(`/admin/customers/${c.id}`, { method: 'PATCH', body: { active: c.active === false } });
      await reload();
      toast(c.active === false ? 'Customer enabled' : 'Customer blocked');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">Customers <span className="muted">({customers.length})</span></h1>
      <div className="toolbar">
        <div className="search-input"><Search size={16} /><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone" /></div>
      </div>
      {rows.length === 0 ? <EmptyState icon={Users} title="No customers yet" text="Customers who sign up on the website will appear here." /> : (
        <div className="card no-pad">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Customer</th><th>Contact</th><th>DL no.</th><th>Bookings</th><th>Total spent</th><th>Joined</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id}>
                    <td data-label="Customer"><strong>{c.name}</strong><span className="muted small block">{c.address || '—'}</span></td>
                    <td data-label="Contact"><a href={`tel:${c.phone}`}>{c.phone}</a><span className="muted small block">{c.email}</span></td>
                    <td data-label="DL no.">{c.dlNumber || '—'}</td>
                    <td data-label="Bookings">{c.count}{c.last && <span className="muted small block">Last: {fmtDate(c.last.start)}</span>}</td>
                    <td data-label="Total spent">{inr(c.spent)}</td>
                    <td data-label="Joined">{fmtDate(c.createdAt)}</td>
                    <td data-label="Status"><Badge status={c.active === false ? 'cancelled' : 'verified'}>{c.active === false ? 'Blocked' : 'Active'}</Badge></td>
                    <td data-label="">
                      <div className="btn-row nowrap">
                        <a className="btn btn-whatsapp btn-xs" href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a>
                        <button type="button" className="btn btn-outline btn-xs" onClick={() => toggle(c)}>{c.active === false ? 'Unblock' : 'Block'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminNotifications() {
  const { channels } = useOutletContext();
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('all');
  const load = () => api('/admin/notifications').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const shown = (list || []).filter(n => filter === 'all' || n.channel === filter || n.status === filter);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Notifications</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="grid-2">
        <div className={`channel-card ${channels.email ? 'on' : ''}`}>
          <Mail size={22} />
          <div>
            <strong>Email (SMTP) {channels.email ? 'connected' : 'not configured'}</strong>
            <span>{channels.email ? 'Customers, owners and admin receive booking emails automatically.' : 'Add SMTP_HOST, SMTP_USER, SMTP_PASS in .env (Gmail App Password works) and restart the server.'}</span>
          </div>
        </div>
        <div className={`channel-card ${channels.whatsapp ? 'on' : ''}`}>
          <MessageCircle size={22} />
          <div>
            <strong>WhatsApp API {channels.whatsapp ? 'connected' : 'not configured'}</strong>
            <span>{channels.whatsapp ? 'WhatsApp messages are sent automatically.' : 'Add Twilio or Meta WhatsApp Cloud API keys in .env. Until then, use "Send on WhatsApp" below – it opens WhatsApp with the message ready.'}</span>
          </div>
        </div>
      </div>

      <div className="chip-row scroll-x">
        {[['all', 'All'], ['email', 'Email'], ['whatsapp', 'WhatsApp'], ['sent', 'Sent'], ['skipped', 'Not sent'], ['failed', 'Failed']].map(([k, l]) => (
          <button key={k} type="button" className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {!list ? <Spinner /> : shown.length === 0 ? <EmptyState icon={Bell} title="No notifications yet" text="Every booking email & WhatsApp message will be logged here." /> : (
        <div className="notif-list">
          {shown.map(n => (
            <div key={n.id} className="card notif">
              <div className="notif-head">
                <span className={`notif-ch ${n.channel}`}>{n.channel === 'email' ? <Mail size={16} /> : <MessageCircle size={16} />}</span>
                <div>
                  <strong>{n.subject || `WhatsApp to ${n.audience}`}</strong>
                  <span className="muted small block">To {n.audience}: {n.to} · {fmtDateTime(n.createdAt)}</span>
                </div>
                <Badge status={n.status} />
              </div>
              <pre className="notif-msg">{n.message}</pre>
              {n.error && <span className="muted small">{n.error}</span>}
              {n.link && n.status !== 'sent' && (
                <a className="btn btn-whatsapp btn-sm" href={n.link} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Send on WhatsApp</a>
              )}
              {n.channel === 'email' && n.status !== 'sent' && (
                <a className="btn btn-outline btn-sm" href={`mailto:${n.to}?subject=${encodeURIComponent(n.subject || '')}&body=${encodeURIComponent(n.message || '')}`}><Mail size={15} /> Send from my email</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSettings() {
  const { settings, reload } = useOutletContext();
  const { toast, setSettings } = useApp();
  const [f, setF] = useState({ ...settings, hubs: settings.hubs.join('\n'), deliveryAreas: settings.deliveryAreas.join('\n') });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
      const saved = await api('/admin/settings', { method: 'PUT', body: { ...f, hubs: lines(f.hubs), deliveryAreas: lines(f.deliveryAreas) } });
      setSettings(saved);
      await reload();
      toast('Settings saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="page-head">
        <h1>Settings</h1>
        <button className="btn btn-primary btn-sm" disabled={busy}><Save size={16} /> Save settings</button>
      </div>
      <div className="card">
        <h3 className="card-title">Business details</h3>
        <div className="grid-2">
          <Field label="Business name"><input className="input" value={f.businessName} onChange={e => set('businessName', e.target.value)} /></Field>
          <Field label="City"><input className="input" value={f.city} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="Business phone / WhatsApp" hint="Shown on the site and receives admin WhatsApp alerts"><input className="input" value={f.businessPhone || ''} onChange={e => set('businessPhone', e.target.value)} /></Field>
          <Field label="Second phone / WhatsApp" hint="Also shown on the site and receives the same admin WhatsApp alerts"><input className="input" value={f.businessPhone2 || ''} onChange={e => set('businessPhone2', e.target.value)} /></Field>
          <Field label="Business email" hint="Receives admin booking emails"><input className="input" value={f.businessEmail} onChange={e => set('businessEmail', e.target.value)} /></Field>
        </div>
      </div>
      <div className="card">
        <h3 className="card-title">Pricing & policies</h3>
        <div className="grid-3">
          <Field label="Default free km / day"><input type="number" className="input" value={f.kmPerDay} onChange={e => set('kmPerDay', e.target.value)} /></Field>
          <Field label="Default extra km rate (₹)"><input type="number" className="input" value={f.extraKmRate} onChange={e => set('extraKmRate', e.target.value)} /></Field>
          <Field label="Doorstep delivery (₹ each way)"><input type="number" className="input" value={f.deliveryCharge} onChange={e => set('deliveryCharge', e.target.value)} /></Field>
          <Field label="Security deposit (₹)"><input type="number" className="input" value={f.securityDeposit} onChange={e => set('securityDeposit', e.target.value)} /></Field>
          <Field label="Minimum booking (hours)"><input type="number" className="input" value={f.minHours} onChange={e => set('minHours', e.target.value)} /></Field>
          <Field label="Default owner share (%)"><input type="number" className="input" value={f.defaultOwnerShare} onChange={e => set('defaultOwnerShare', e.target.value)} /></Field>
        </div>
      </div>
      <div className="grid-2 align-start">
        <div className="card">
          <h3 className="card-title">Pickup hubs</h3>
          <Field hint="One per line. Self-pickup is free at these locations."><textarea className="input" rows={6} value={f.hubs} onChange={e => set('hubs', e.target.value)} /></Field>
        </div>
        <div className="card">
          <h3 className="card-title">Doorstep delivery areas</h3>
          <Field hint="One per line."><textarea className="input" rows={6} value={f.deliveryAreas} onChange={e => set('deliveryAreas', e.target.value)} /></Field>
        </div>
      </div>
    </form>
  );
}
