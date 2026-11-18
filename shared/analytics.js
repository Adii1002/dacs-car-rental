// Owner / fleet analytics computed from bookings. Used by owner and admin dashboards.

const DAY = 86400000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getPeriodRange(period, ref = new Date(), customMonth) {
  const now = new Date(ref);
  if (period === 'week') {
    const start = startOfDay(now);
    const dow = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - dow);
    const end = new Date(start.getTime() + 7 * DAY);
    return { start, end, label: 'This week' };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end, label: 'This month' };
  }
  if (period === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end, label: 'Last month' };
  }
  if (period === 'custom' && customMonth) {
    const [y, m] = customMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start, end, label: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start, end, label: 'This year' };
  }
  return { start: new Date(0), end: new Date(8640000000000000), label: 'All time' };
}

export function bookingRevenue(b) {
  if (b.status === 'cancelled') return 0;
  return (b.pricing?.rental || 0) + (b.extraKmCharges || 0);
}

export function ownerEarning(b, sharePercent) {
  return Math.round(bookingRevenue(b) * (sharePercent / 100));
}

export function inRange(b, range) {
  const s = new Date(b.start);
  return s >= range.start && s < range.end;
}

export function summarize(bookings, { sharePercent = 100, range } = {}) {
  const list = range ? bookings.filter(b => inRange(b, range)) : bookings;
  const active = list.filter(b => b.status !== 'cancelled');
  const completed = list.filter(b => b.status === 'completed');
  const revenue = active.reduce((sum, b) => sum + bookingRevenue(b), 0);
  const grossCollected = active.reduce((sum, b) => sum + (b.finalAmount ?? b.pricing?.total ?? 0), 0);
  return {
    totalBookings: list.length,
    activeBookings: active.length,
    completedBookings: completed.length,
    cancelledBookings: list.length - active.length,
    upcomingBookings: list.filter(b => b.status === 'confirmed').length,
    ongoingBookings: list.filter(b => b.status === 'ongoing').length,
    revenue,
    grossCollected,
    earnings: Math.round(revenue * (sharePercent / 100)),
    kmDriven: completed.reduce((sum, b) => sum + (b.kmDriven || 0), 0),
    hoursBooked: active.reduce((sum, b) => sum + (b.pricing?.billableHours || 0), 0)
  };
}

/** Buckets for charts: daily buckets for week/month ranges, monthly buckets otherwise. */
export function buildSeries(bookings, { range, sharePercent = 100, months = 6 } = {}) {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const spanDays = range ? (range.end - range.start) / DAY : Infinity;
  if (range && spanDays <= 31) {
    const buckets = [];
    for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY) {
      const d = new Date(t);
      buckets.push({
        key: d.toDateString(),
        label: spanDays <= 7 ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : String(d.getDate()),
        value: 0,
        count: 0,
        km: 0
      });
    }
    active.forEach(b => {
      const key = startOfDay(b.start).toDateString();
      const bucket = buckets.find(x => x.key === key);
      if (bucket) {
        bucket.value += ownerEarning(b, sharePercent);
        bucket.count += 1;
        bucket.km += b.kmDriven || 0;
      }
    });
    return buckets;
  }
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      value: 0,
      count: 0,
      km: 0
    });
  }
  active.forEach(b => {
    const d = new Date(b.start);
    const bucket = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) {
      bucket.value += ownerEarning(b, sharePercent);
      bucket.count += 1;
      bucket.km += b.kmDriven || 0;
    }
  });
  return buckets;
}

export function utilization(bookings, carsCount, range) {
  if (!carsCount || !range || range.start.getTime() === 0) return null;
  const totalHours = ((range.end.getTime() - range.start.getTime()) / 3600000) * carsCount;
  const booked = bookings
    .filter(b => b.status !== 'cancelled' && inRange(b, range))
    .reduce((sum, b) => sum + (b.pricing?.billableHours || 0), 0);
  return totalHours > 0 ? Math.min(100, Math.round((booked / totalHours) * 100)) : 0;
}
