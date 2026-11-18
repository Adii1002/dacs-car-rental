import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CarFront, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function DashboardLayout({ title, items, children }) {
  const { user, logout } = useAuth();
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="dash">
      <aside className={`dash-side ${open ? 'open' : ''}`}>
        <div className="dash-brand">
          <Link to="/" className="brand brand-light">
            <span className="brand-mark"><CarFront size={18} /></span>
            <span className="brand-text">{settings.businessName}</span>
          </Link>
          <button type="button" className="icon-btn dash-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <span className="dash-role">{title}</span>
        <nav className="dash-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <div className="dash-side-foot">
          <Link to="/" className="dash-link"><ExternalLink size={16} /> View website</Link>
          <button type="button" className="dash-link" onClick={() => { logout(); navigate('/login'); }}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      {open && <div className="dash-overlay" onClick={() => setOpen(false)} />}
      <div className="dash-main">
        <header className="dash-top">
          <button type="button" className="icon-btn dash-toggle" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <strong className="dash-top-title">{items.find(i => (i.end ? pathname === i.to : pathname.startsWith(i.to)))?.label || title}</strong>
          <div className="dash-user">
            <span className="avatar">{user?.name?.[0]}</span>
            <div className="dash-user-text"><strong>{user?.name}</strong><span>{user?.email}</span></div>
          </div>
        </header>
        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
