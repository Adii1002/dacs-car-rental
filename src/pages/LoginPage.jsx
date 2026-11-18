import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CarFront, ShieldCheck, Gauge, Wallet } from 'lucide-react';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';
import { contactPhones, homeForRole } from '../utils/format';
import { useApp } from '../context/AppContext';

export default function LoginPage({ mode = 'login' }) {
  const { user } = useAuth();
  const { settings } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');

  useEffect(() => {
    if (user) navigate(next || homeForRole(user.role), { replace: true });
  }, [user, next, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-side">
        <Link to="/" className="brand brand-light">
          <span className="brand-mark"><CarFront size={20} /></span>
          <span className="brand-text">{settings.businessName}</span>
        </Link>
        <div>
          <h1>One account for every journey.</h1>
          <ul>
            <li><ShieldCheck size={18} /> Customers – book cars & manage trips</li>
            <li><Gauge size={18} /> Car owners – track bookings, km & earnings</li>
            <li><Wallet size={18} /> Admin – manage fleet, owners & bookings</li>
          </ul>
        </div>
        <span className="muted-light">Need help? {contactPhones(settings).join(' · ')}</span>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{mode === 'login' ? 'Sign in to continue' : 'Sign up in less than a minute'}</p>
          <AuthForm key={mode} initialMode={mode} showDemo onDone={u => navigate(next || homeForRole(u.role), { replace: true })} />
        </div>
      </div>
    </div>
  );
}
