import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, CarFront } from 'lucide-react';
import SearchWidget from '../components/SearchWidget';
import CarCard from '../components/CarCard';
import { Spinner, EmptyState } from '../components/ui';
import { api } from '../api';
import { CAR_CATEGORIES, TRANSMISSIONS } from '../../shared/pricing';

const SEATS = ['4', '5', '7'];

export default function CarsPage() {
  const [params, setParams] = useSearchParams();
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const [cars, setCars] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ category: [], transmission: [], fuel: [], seats: [], onlyAvailable: true });
  const [sort, setSort] = useState('price-asc');
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const q = start && end ? `?start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end).toISOString())}` : '';
    api(`/cars${q}`).then(setCars).catch(e => setError(e.message));
  }, [start, end]);

  const fuels = useMemo(() => [...new Set((cars || []).map(c => c.fuel))], [cars]);

  const list = useMemo(() => {
    if (!cars) return [];
    let l = cars.filter(c =>
      (!filters.category.length || filters.category.includes(c.category)) &&
      (!filters.transmission.length || filters.transmission.includes(c.transmission)) &&
      (!filters.fuel.length || filters.fuel.includes(c.fuel)) &&
      (!filters.seats.length || filters.seats.includes(String(c.seats))) &&
      (!filters.onlyAvailable || !(start && end) || c.available)
    );
    l = [...l].sort((a, b) => (sort === 'price-asc' ? a.pricePerDay - b.pricePerDay : sort === 'price-desc' ? b.pricePerDay - a.pricePerDay : b.seats - a.seats));
    return l;
  }, [cars, filters, sort, start, end]);

  const toggle = (key, value) => setFilters(f => ({ ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value] }));
  const activeCount = filters.category.length + filters.transmission.length + filters.fuel.length + filters.seats.length;

  const filterPanel = (
    <div className="filters">
      <div className="filters-head">
        <h3>Filters</h3>
        {activeCount > 0 && <button type="button" className="btn-link" onClick={() => setFilters(f => ({ ...f, category: [], transmission: [], fuel: [], seats: [] }))}>Clear all</button>}
        <button type="button" className="icon-btn filters-close" onClick={() => setDrawer(false)} aria-label="Close filters"><X size={20} /></button>
      </div>
      {start && end && (
        <label className="switch-row">
          <input type="checkbox" checked={filters.onlyAvailable} onChange={e => setFilters(f => ({ ...f, onlyAvailable: e.target.checked }))} />
          <span>Show only available cars</span>
        </label>
      )}
      {[
        ['Car type', 'category', CAR_CATEGORIES],
        ['Transmission', 'transmission', TRANSMISSIONS],
        ['Fuel', 'fuel', fuels],
        ['Seats', 'seats', SEATS]
      ].map(([title, key, opts]) => (
        <div key={key} className="filter-group">
          <h4>{title}</h4>
          <div className="chip-row">
            {opts.map(o => (
              <button key={o} type="button" className={`chip ${filters[key].includes(o) ? 'active' : ''}`} onClick={() => toggle(key, o)}>
                {key === 'seats' ? `${o} seater` : o}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-primary btn-block filters-apply" onClick={() => setDrawer(false)}>Show {list.length} cars</button>
    </div>
  );

  return (
    <section className="section cars-page">
      <div className="container">
        <div className="cars-search-bar">
          <SearchWidget compact initial={{ start, end }} key={`${start}${end}`} onSearch={t => setParams({ start: t.start, end: t.end })} />
        </div>
        <div className="cars-layout">
          <aside className={`filters-aside ${drawer ? 'open' : ''}`}>{filterPanel}</aside>
          {drawer && <div className="drawer-overlay" onClick={() => setDrawer(false)} />}
          <div>
            <div className="results-bar">
              <div>
                <h1>{start && end ? 'Available cars' : 'All cars'}</h1>
                <span className="muted">{cars ? `${list.length} car${list.length !== 1 ? 's' : ''} found` : ''}</span>
              </div>
              <div className="results-actions">
                <button type="button" className="btn btn-outline btn-sm filters-toggle" onClick={() => setDrawer(true)}>
                  <SlidersHorizontal size={16} /> Filters{activeCount ? ` (${activeCount})` : ''}
                </button>
                <select className="input input-sm" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="seats">Seats: Most first</option>
                </select>
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            {!cars && !error ? <Spinner /> : list.length === 0 ? (
              <EmptyState icon={CarFront} title="No cars match your search" text="Try changing the dates or clearing some filters." />
            ) : (
              <div className="car-grid">
                {list.map(car => <CarCard key={car.id} car={car} trip={start && end ? { start, end } : null} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
