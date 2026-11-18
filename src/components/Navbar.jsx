import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, CarFront, LogOut, User, CalendarCheck, LayoutDashboard, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { contactPhones } from '../utils/format';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
    setMenu(false);
  }

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
  }, [open]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const dashboard = user?.role === 'admin' ? '/admin' : user?.role === 'owner' ? '/owner' : null;

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><CarFront size={20} /></span>
          <span className="brand-text">{settings.businessName}</span>
        </Link>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/cars">Browse Cars</NavLink>
          {user?.role === 'customer' && <NavLink to="/my-bookings">My Bookings</NavLink>}
          {dashboard && <NavLink to={dashboard}>Dashboard</NavLink>}
          <span className="nav-phones">
            {contactPhones(settings).map(p => (
              <a key={p} href={`tel:${p}`} className="nav-phone"><Phone size={15} /> {p}</a>
            ))}
          </span>
          {!user && (
            <div className="nav-auth-mobile">
              <Link to="/login" className="btn btn-outline btn-block">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-block">Create account</Link>
            </div>
          )}
          {user && (
            <div className="nav-auth-mobile">
              <Link to="/profile" className="btn btn-outline btn-block"><User size={16} /> My profile</Link>
              <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
            </div>
          )}
        </nav>

        <div className="nav-actions">
          {user ? (
            <div className="user-menu">
              <button type="button" className="avatar-btn" onClick={() => setMenu(v => !v)} aria-label="Account menu">
                <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
                <span className="avatar-name">{user.name?.split(' ')[0]}</span>
              </button>
              {menu && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenu(false)} />
                  <div className="dropdown">
                    <div className="dropdown-head">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <span className="role-tag">{user.role}</span>
                    </div>
                    {dashboard && <Link to={dashboard}><LayoutDashboard size={16} /> Dashboard</Link>}
                    {user.role === 'customer' && <Link to="/my-bookings"><CalendarCheck size={16} /> My bookings</Link>}
                    <Link to="/profile"><User size={16} /> Profile</Link>
                    <button type="button" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="nav-auth-desktop">
              <Link to="/login" className="btn btn-ghost">Sign in</Link>
              <Link to="/register" className="btn btn-primary">Sign up</Link>
            </div>
          )}
          <button type="button" className="icon-btn nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}
    </header>
  );
}
