import { Link } from 'react-router-dom';
import { CarFront, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { contactPhones } from '../utils/format';

export default function Footer() {
  const { settings } = useApp();
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand brand-light">
            <span className="brand-mark"><CarFront size={20} /></span>
            <span className="brand-text">{settings.businessName}</span>
          </Link>
          <p className="footer-about">Self-drive car rentals in {settings.city}. Sanitised cars, transparent pricing, doorstep delivery and 24×7 roadside support.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/cars">Browse cars</Link>
          <Link to="/my-bookings">My bookings</Link>
          <Link to="/login">Owner login</Link>
          <Link to="/login">Admin login</Link>
        </div>
        <div>
          <h4>Policies</h4>
          <span>{settings.kmPerDay} km/day free · ₹{settings.extraKmRate}/km extra</span>
          <span>Fuel not included</span>
          <span>Refundable deposit ₹{settings.securityDeposit.toLocaleString('en-IN')}</span>
          <span>Min. age 21 with valid DL</span>
        </div>
        <div>
          <h4>Contact</h4>
          {contactPhones(settings).map(p => (
            <a key={p} href={`tel:${p}`}><Phone size={15} /> {p}</a>
          ))}
          {contactPhones(settings).map(p => (
            <a key={`wa-${p}`} href={`https://wa.me/91${p.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp {p}</a>
          ))}
          <a href={`mailto:${settings.businessEmail}`}><Mail size={15} /> {settings.businessEmail}</a>
          <span><MapPin size={15} /> {settings.city}, Maharashtra</span>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} {settings.businessName}. All rights reserved.</div>
    </footer>
  );
}
