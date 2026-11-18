export const inr = n => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

export const fmtDateTime = iso =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtTime = iso =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultTrip() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 3);
  const end = new Date(start.getTime() + 24 * 3600000);
  return { start: toLocalInput(start), end: toLocalInput(end) };
}

export const nowInput = () => toLocalInput(new Date());

export const STATUS_LABELS = {
  confirmed: 'Upcoming',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
  paid: 'Paid',
  refunded: 'Refunded',
  refund_pending: 'Refund pending',
  sent: 'Sent',
  skipped: 'Not sent',
  failed: 'Failed'
};

export const homeForRole = role => (role === 'admin' ? '/admin' : role === 'owner' ? '/owner' : '/');

export function contactPhones(settings) {
  const seen = new Set();
  return [settings?.businessPhone, settings?.businessPhone2]
    .map(p => String(p || '').trim())
    .filter(p => p && !seen.has(p) && seen.add(p));
}

export const ID_TYPES = ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID'];
