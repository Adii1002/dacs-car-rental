import { useEffect, useMemo, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { X, Upload, FileText, CircleCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STATUS_LABELS, inr } from '../utils/format';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      {Icon && <div className="empty-icon"><Icon size={28} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Badge({ status, children }) {
  return <span className={`badge badge-${status}`}>{children || STATUS_LABELS[status] || status}</span>;
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={`modal modal-${size}`} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'blue' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{Icon && <Icon size={20} />}</div>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function FileDrop({ label, file, existing, onChange, accept = 'image/*,application/pdf', error }) {
  const inputRef = useRef(null);
  const preview = useMemo(() => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className={`file-drop ${file || existing ? 'has-file' : ''} ${error ? 'has-error' : ''}`} onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={e => onChange(e.target.files?.[0] || null)} />
      {preview ? <img src={preview} alt="" className="file-preview" /> : (
        <div className="file-icon">{file ? <FileText size={22} /> : existing ? <CircleCheck size={22} /> : <Upload size={22} />}</div>
      )}
      <div className="file-text">
        <strong>{label}</strong>
        <span>{file ? file.name : existing ? 'Saved from previous booking – tap to replace' : 'Tap to upload (JPG, PNG or PDF, max 6 MB)'}</span>
      </div>
    </div>
  );
}

export function BarChart({ data, format = inr, height = 180 }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const dense = data.length > 14;
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.key || i} className="bar-col" title={`${d.label}: ${format(d.value)} · ${d.count || 0} bookings`}>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(d.value / max) * 100}%` }}>
              {!dense && d.value > 0 && <span className="bar-value">{format(d.value).replace('₹', '')}</span>}
            </div>
          </div>
          <span className="bar-label">{dense && i % 3 !== 0 ? '' : d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export function PeriodFilter({ period, setPeriod, customMonth, setCustomMonth }) {
  const options = [
    ['week', 'This week'], ['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Pick month']
  ];
  return (
    <div className="period-filter">
      <div className="chip-row">
        {options.map(([k, l]) => (
          <button key={k} type="button" className={`chip ${period === k ? 'active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>
      {period === 'custom' && (
        <input type="month" className="input input-sm" value={customMonth} onChange={e => setCustomMonth(e.target.value)} />
      )}
    </div>
  );
}
