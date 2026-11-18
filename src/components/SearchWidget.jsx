import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { defaultTrip, nowInput } from '../utils/format';
import { calcHours, formatDuration } from '../../shared/pricing';

export default function SearchWidget({ initial, compact = false, onSearch }) {
  const { settings } = useApp();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(() => ({ ...defaultTrip(), ...Object.fromEntries(Object.entries(initial || {}).filter(([, v]) => v)) }));
  const [error, setError] = useState('');
  const hours = calcHours(trip.start, trip.end);

  function submit(e) {
    e.preventDefault();
    if (!trip.start || !trip.end) return setError('Select pickup and drop time.');
    if (new Date(trip.start) < new Date(Date.now() - 5 * 60000)) return setError('Pickup time must be in the future.');
    if (hours <= 0) return setError('Drop time must be after pickup time.');
    if (hours < settings.minHours) return setError(`Minimum booking is ${settings.minHours} hours.`);
    setError('');
    const params = new URLSearchParams({ start: trip.start, end: trip.end });
    if (onSearch) onSearch(trip);
    else navigate(`/cars?${params}`);
  }

  function changeStart(value) {
    setTrip(t => {
      const next = { ...t, start: value };
      if (!t.end || new Date(t.end) <= new Date(value)) {
        const d = new Date(new Date(value).getTime() + 24 * 3600000);
        const pad = n => String(n).padStart(2, '0');
        next.end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return next;
    });
  }

  return (
    <form className={`search-widget ${compact ? 'compact' : ''}`} onSubmit={submit}>
      {!compact && (
        <div className="sw-field sw-city">
          <MapPin size={18} />
          <div>
            <span>City</span>
            <strong>{settings.city}</strong>
          </div>
        </div>
      )}
      <label className="sw-field">
        <Calendar size={18} />
        <div>
          <span>Pickup</span>
          <input type="datetime-local" value={trip.start} min={nowInput()} onChange={e => changeStart(e.target.value)} required />
        </div>
      </label>
      <label className="sw-field">
        <Calendar size={18} />
        <div>
          <span>Drop</span>
          <input type="datetime-local" value={trip.end} min={trip.start} onChange={e => setTrip(t => ({ ...t, end: e.target.value }))} required />
        </div>
      </label>
      <button type="submit" className="btn btn-primary sw-btn">
        <Search size={18} /> {compact ? 'Update' : 'Find cars'}
      </button>
      {(error || hours > 0) && (
        <div className={`sw-note ${error ? 'error' : ''}`}>{error || `Trip duration: ${formatDuration(hours)}`}</div>
      )}
    </form>
  );
}
