import { Link } from 'react-router-dom';
import { Users, Fuel, Cog, Gauge } from 'lucide-react';
import { inr } from '../utils/format';
import { calcPrice } from '../../shared/pricing';
import { useApp } from '../context/AppContext';

export default function CarCard({ car, trip }) {
  const { settings } = useApp();
  const hasTrip = trip?.start && trip?.end;
  const price = hasTrip ? calcPrice({ car, start: trip.start, end: trip.end, settings }) : null;
  const unavailable = hasTrip && car.available === false;
  const query = hasTrip ? `?start=${encodeURIComponent(trip.start)}&end=${encodeURIComponent(trip.end)}` : '';

  return (
    <article className={`car-card ${unavailable ? 'is-unavailable' : ''}`}>
      <Link to={`/cars/${car.id}${query}`} className="car-media">
        <img src={car.image} alt={car.name} loading="lazy" />
        <span className="car-cat">{car.category}</span>
        {unavailable && <span className="car-sold">Booked for these dates</span>}
      </Link>
      <div className="car-body">
        <div className="car-title">
          <h3>{car.name}</h3>
          {car.year && <span className="muted">{car.year}</span>}
        </div>
        <ul className="car-specs">
          <li><Cog size={15} />{car.transmission}</li>
          <li><Fuel size={15} />{car.fuel}</li>
          <li><Users size={15} />{car.seats} Seats</li>
          <li><Gauge size={15} />{car.kmPerDay || settings.kmPerDay} km/day</li>
        </ul>
        <div className="car-foot">
          <div className="car-price">
            {price ? (
              <>
                <strong>{inr(price.rental)}</strong>
                <span>{price.includedKm} km free · excl. fuel</span>
              </>
            ) : (
              <>
                <strong>{inr(car.pricePerDay)}<small>/day</small></strong>
                <span>{inr(Math.round(car.pricePerDay / 24))}/hr · excl. fuel</span>
              </>
            )}
          </div>
          {unavailable ? (
            <button type="button" className="btn btn-disabled" disabled>Unavailable</button>
          ) : (
            <Link to={`/cars/${car.id}${query}`} className="btn btn-primary">Book</Link>
          )}
        </div>
      </div>
    </article>
  );
}
