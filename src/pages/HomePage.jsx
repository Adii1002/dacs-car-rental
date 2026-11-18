import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Headphones, IndianRupee, MapPin, Sparkles, KeyRound, Search, FileText, CarFront, Star, ArrowRight } from 'lucide-react';
import SearchWidget from '../components/SearchWidget';
import CarCard from '../components/CarCard';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { contactPhones } from '../utils/format';

const FAQS = [
  ['What documents do I need?', 'A valid Indian driving licence (at least 1 year old), a government photo ID (Aadhaar / PAN / Passport / Voter ID) and a recent photo. Upload them while booking and carry the originals at pickup.'],
  ['Is fuel included?', 'No. You get the car with a certain fuel level and return it at the same level. Tolls, parking and challans are paid by the customer.'],
  ['What if I drive more than the free km?', 'Extra kilometres are charged per km as shown on the car page. The final amount is calculated from the odometer reading when you return the car.'],
  ['Can you deliver the car to my home?', 'Yes. Choose doorstep delivery while booking. A flat delivery charge applies for each way (pickup and/or drop).'],
  ['How do I cancel?', 'Open My Bookings and cancel any upcoming trip before the pickup time. Refunds are processed in 5–7 working days.']
];

export default function HomePage() {
  const { settings } = useApp();
  const [cars, setCars] = useState([]);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    api('/cars').then(setCars).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> Self-drive cars in {settings.city}</span>
            <h1>Your car, your rules.<br /><span className="grad">Drive it like you own it.</span></h1>
            <p>Rent sanitised, well-maintained cars by the hour, day or week. {settings.kmPerDay} km/day free, doorstep delivery and zero hidden charges.</p>
            <ul className="hero-points">
              <li><ShieldCheck size={16} /> Insured cars</li>
              <li><Headphones size={16} /> 24×7 support</li>
              <li><MapPin size={16} /> Doorstep delivery</li>
            </ul>
          </div>
          <div className="hero-search">
            <h2>Book a self-drive car</h2>
            <SearchWidget />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Our fleet</span>
              <h2>Pick the perfect car for your trip</h2>
            </div>
            <Link to="/cars" className="link-arrow">View all cars <ArrowRight size={16} /></Link>
          </div>
          <div className="car-grid">
            {cars.slice(0, 6).map(car => <CarCard key={car.id} car={car} />)}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">How it works</span>
            <h2>Book in 3 simple steps</h2>
          </div>
          <div className="steps">
            {[
              [Search, 'Choose dates & car', 'Pick your trip time and choose from hatchbacks, sedans, SUVs and 7-seaters.'],
              [FileText, 'Upload documents', 'Share your driving licence, photo ID and photo. Quick online verification.'],
              [KeyRound, 'Pick up & drive', 'Collect from our hub or get it delivered to your doorstep. Enjoy the ride!']
            ].map(([Icon, t, d], i) => (
              <div key={t} className="step">
                <span className="step-num">{i + 1}</span>
                <div className="step-icon"><Icon size={24} /></div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Why us</span>
            <h2>Everything you need for a worry-free drive</h2>
          </div>
          <div className="features">
            {[
              [IndianRupee, 'Transparent pricing', `Pay by the hour. ${settings.kmPerDay} km/day free, ₹${settings.extraKmRate}/km after that. No hidden fees.`],
              [ShieldCheck, 'Insured & sanitised', 'Every car is comprehensively insured and cleaned before each trip.'],
              [MapPin, 'Doorstep delivery', `Delivery anywhere in ${settings.city} for a flat ₹${settings.deliveryCharge} each way, or pick up free from our hubs.`],
              [Headphones, '24×7 roadside help', 'Breakdown or flat tyre? Call us anytime and we will get you moving again.'],
              [CarFront, 'Well-maintained fleet', 'Late-model cars serviced regularly by authorised workshops.'],
              [Star, 'Loved by customers', 'Hundreds of happy trips across Pune, Lonavala, Mahabaleshwar and Goa.']
            ].map(([Icon, t, d]) => (
              <div key={t} className="feature">
                <div className="feature-icon"><Icon size={22} /></div>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container faq-wrap">
          <div>
            <span className="eyebrow">FAQs</span>
            <h2>Questions? We have answers.</h2>
            <p className="muted">Still need help? Call or WhatsApp us at {contactPhones(settings).map((p, i) => <span key={p}>{i > 0 && ' or '}<a href={`tel:${p}`}>{p}</a></span>)}.</p>
          </div>
          <div className="faq-list">
            {FAQS.map(([q, a], i) => (
              <div key={q} className={`faq ${openFaq === i ? 'open' : ''}`}>
                <button type="button" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>{q}<span>{openFaq === i ? '−' : '+'}</span></button>
                {openFaq === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <div>
              <h2>Own a car? Earn with it.</h2>
              <p>List your car with {settings.businessName} and track every booking, kilometre and rupee from your owner dashboard.</p>
            </div>
            <a href={`https://wa.me/91${settings.businessPhone}?text=${encodeURIComponent('Hi, I want to list my car with you.')}`} target="_blank" rel="noreferrer" className="btn btn-light">Partner with us</a>
          </div>
        </div>
      </section>
    </>
  );
}
