export const DEFAULT_SETTINGS = {
  businessName: "Dac's Car Rental",
  businessPhone: '7020920064',
  businessPhone2: '8668793964',
  businessEmail: 'adityakamble021@gmail.com',
  city: 'Pune',
  kmPerDay: 250,
  extraKmRate: 12,
  deliveryCharge: 350,
  securityDeposit: 3000,
  minHours: 12,
  defaultOwnerShare: 70,
  hubs: ['Hinjewadi Phase 1 Hub', 'Viman Nagar Hub', 'Kothrud Hub', 'Pune Station Hub'],
  deliveryAreas: [
    'Hinjewadi', 'Wakad', 'Baner', 'Balewadi', 'Aundh', 'Pashan', 'Kothrud', 'Deccan',
    'FC Road', 'Shivajinagar', 'Camp', 'Pune Station', 'Koregaon Park', 'Kalyani Nagar',
    'Viman Nagar', 'Kharadi', 'Hadapsar', 'Magarpatta', 'Pimple Saudagar', 'Pimpri-Chinchwad',
    'Other (Pune)'
  ]
};

export const CAR_CATEGORIES = ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Luxury'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Petrol / CNG'];
export const TRANSMISSIONS = ['Manual', 'Automatic'];
export const BOOKING_STATUSES = ['confirmed', 'ongoing', 'completed', 'cancelled'];

const HOUR = 3600000;

export function calcHours(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return diff > 0 ? Math.ceil(diff / HOUR) : 0;
}

export function formatDuration(hours) {
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  const parts = [];
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
  return parts.join(' ') || '0 hrs';
}

/** Hourly pro-rata pricing with a minimum billable duration, similar to Revv. */
export function calcPrice({ car, start, end, pickupType = 'hub', dropType = 'hub', settings = DEFAULT_SETTINGS }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const hours = calcHours(start, end);
  const billableHours = hours ? Math.max(hours, s.minHours) : 0;
  const days = billableHours / 24;
  const rental = car ? Math.round(car.pricePerDay * days) : 0;
  const delivery = (pickupType === 'delivery' ? s.deliveryCharge : 0) + (dropType === 'delivery' ? s.deliveryCharge : 0);
  const includedKm = Math.round((car?.kmPerDay || s.kmPerDay) * days);
  const extraKmRate = car?.extraKmRate || s.extraKmRate;
  return {
    hours,
    billableHours,
    rental,
    delivery,
    includedKm,
    extraKmRate,
    deposit: s.securityDeposit,
    total: rental + delivery
  };
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
