import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

/** Instant browser-side email alert to the business inbox via EmailJS (works without SMTP setup). */
export function sendBookingAlert(booking, car, settings) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return Promise.resolve();
  const start = new Date(booking.start).toLocaleString('en-IN');
  const end = new Date(booking.end).toLocaleString('en-IN');
  const place = p => (p.type === 'delivery' ? `Doorstep – ${p.address}, ${p.location}` : p.location);
  const c = booking.customer;
  const message = [
    `New booking: ${car.name}`,
    `Booking ID: ${booking.code}`,
    `Pickup: ${start} – ${place(booking.pickup)}`,
    `Drop: ${end} – ${place(booking.drop)}`,
    `Customer: ${c.name} | ${c.phone} | ${c.email}`,
    `Address: ${c.address}`,
    `DL: ${c.dlNumber} | ${c.idType}: ${c.idNumber}`,
    `Total: ₹${booking.pricing.total} (+ deposit ₹${booking.pricing.deposit})`
  ].join('\n');

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, {
    to_email: settings.businessEmail,
    from_name: c.name,
    from_email: c.email,
    reply_to: c.email,
    customer_name: c.name,
    customer_email: c.email,
    customer_phone: c.phone,
    customer_address: c.address,
    car_name: car.name,
    start_date: start,
    end_date: end,
    pickup_location: place(booking.pickup),
    drop_location: place(booking.drop),
    total_amount: booking.pricing.total,
    booking_id: booking.code,
    message
  }, PUBLIC_KEY);
}
