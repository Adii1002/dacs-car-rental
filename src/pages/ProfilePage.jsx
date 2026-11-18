import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { Field } from '../components/ui';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useApp();
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', address: user.address || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  async function save(e, body) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api('/auth/me', { method: 'PUT', body });
      setUser(d.user);
      toast('Profile updated.');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="container narrow">
        <h1 className="page-title">My profile</h1>
        <div className="grid-2 align-start">
          <form className="card" onSubmit={e => save(e, form)}>
            <h2 className="card-title">Personal details</h2>
            <Field label="Email"><input className="input" value={user.email} disabled /></Field>
            <Field label="Full name"><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Mobile"><input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} /></Field>
            {user.role !== 'admin' && <Field label="Address"><textarea className="input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>}
            <button className="btn btn-primary" disabled={busy}>Save changes</button>
          </form>
          <form className="card" onSubmit={e => save(e, pw)}>
            <h2 className="card-title">Change password</h2>
            <Field label="Current password"><input type="password" className="input" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} /></Field>
            <Field label="New password"><input type="password" className="input" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} /></Field>
            <button className="btn btn-outline" disabled={busy || !pw.newPassword}>Update password</button>
          </form>
        </div>
      </div>
    </section>
  );
}
