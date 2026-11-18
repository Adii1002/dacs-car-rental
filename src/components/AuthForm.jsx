import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field } from './ui';
import { validateEmail, validatePhone, validateName } from '../utils/validation';

export default function AuthForm({ initialMode = 'login', onDone, showDemo = false }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: null }));
    setError('');
  };

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (mode === 'register') {
      errs.name = validateName(form.name);
      errs.phone = validatePhone(form.phone);
    }
    errs.email = validateEmail(form.email);
    if (!form.password || form.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    Object.keys(errs).forEach(k => !errs[k] && delete errs[k]);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const user = mode === 'login' ? await login(form.email, form.password) : await register(form);
      onDone?.(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
      </div>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        {mode === 'register' && (
          <Field label="Full name" error={errors.name}>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="As on driving licence" autoComplete="name" />
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        {mode === 'register' && (
          <Field label="Mobile number" error={errors.phone} hint="Booking updates will be sent on WhatsApp">
            <div className="input-prefix">
              <span>+91</span>
              <input className="input" type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile" autoComplete="tel-national" />
            </div>
          </Field>
        )}
        <Field label="Password" error={errors.password}>
          <div className="input-suffix">
            <input className="input" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <button type="button" className="icon-btn" onClick={() => setShowPw(v => !v)} aria-label="Toggle password">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </Field>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      {showDemo && mode === 'login' && (
        <div className="demo-creds">
          <strong>Demo logins</strong>
          {[
            ['Admin', 'admin@adicarrental.com', 'Admin@123'],
            ['Car owner', 'owner@adicarrental.com', 'Owner@123'],
            ['Customer', 'customer@adicarrental.com', 'Customer@123']
          ].map(([role, email, pw]) => (
            <button key={role} type="button" onClick={() => setForm(f => ({ ...f, email, password: pw }))}>
              <span>{role}</span><code>{email}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
