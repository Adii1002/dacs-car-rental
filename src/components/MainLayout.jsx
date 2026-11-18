import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useApp } from '../context/AppContext';

export default function MainLayout() {
  const { pathname } = useLocation();
  const { settings } = useApp();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <Footer />
      <a className="wa-fab" href={`https://wa.me/91${settings.businessPhone}?text=${encodeURIComponent('Hi, I want to rent a self-drive car.')}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
        <MessageCircle size={26} />
      </a>
    </div>
  );
}
