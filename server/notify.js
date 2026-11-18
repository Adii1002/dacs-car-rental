import nodemailer from 'nodemailer';
import { getDb, commit, uid } from './db.js';
import { formatDuration } from '../shared/pricing.js';

const env = process.env;

let transporter = null;
if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
}

export function channelStatus() {
  return {
    email: !!transporter,
    whatsapp: !!((env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM) || (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID))
  };
}

const fmtDate = iso => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const inr = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function toIndianNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function waLink(phone, text) {
  return `https://wa.me/${toIndianNumber(phone)}?text=${encodeURIComponent(text)}`;
}

function log(entry) {
  const db = getDb();
  db.notifications.unshift({ id: uid('n'), createdAt: new Date().toISOString(), ...entry });
  db.notifications = db.notifications.slice(0, 500);
  commit();
}

async function sendEmail({ to, subject, html, text, bookingId, audience }) {
  if (!to) return;
  if (!transporter) {
    log({ channel: 'email', to, subject, message: text, bookingId, audience, status: 'skipped', error: 'SMTP not configured' });
    return;
  }
  try {
    await transporter.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, html, text });
    log({ channel: 'email', to, subject, message: text, bookingId, audience, status: 'sent' });
  } catch (err) {
    log({ channel: 'email', to, subject, message: text, bookingId, audience, status: 'failed', error: err.message });
  }
}

async function sendWhatsApp({ to, text, bookingId, audience }) {
  if (!to) return;
  const number = toIndianNumber(to);
  const link = waLink(to, text);
  try {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`, To: `whatsapp:+${number}`, Body: text })
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
    } else if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: number, type: 'text', text: { body: text } })
      });
      if (!res.ok) throw new Error(`WhatsApp Cloud API ${res.status}: ${await res.text()}`);
    } else {
      log({ channel: 'whatsapp', to, message: text, bookingId, audience, status: 'skipped', error: 'WhatsApp API not configured – use the link to send manually', link });
      return;
    }
    log({ channel: 'whatsapp', to, message: text, bookingId, audience, status: 'sent', link });
  } catch (err) {
    log({ channel: 'whatsapp', to, message: text, bookingId, audience, status: 'failed', error: err.message, link });
  }
}

function bookingLines(b, car) {
  return [
    `Booking ID: ${b.code}`,
    `Car: ${car?.name || b.carId}${car?.regNumber ? ` (${car.regNumber})` : ''}`,
    `Pickup: ${fmtDate(b.start)} – ${b.pickup.type === 'delivery' ? `Doorstep: ${b.pickup.address}, ${b.pickup.location}` : b.pickup.location}`,
    `Drop: ${fmtDate(b.end)} – ${b.drop.type === 'delivery' ? `Doorstep: ${b.drop.address}, ${b.drop.location}` : b.drop.location}`,
    `Duration: ${formatDuration(b.pricing.hours)} | Free km: ${b.pricing.includedKm} km`,
    `Amount: ${inr(b.pricing.total)} (+ refundable deposit ${inr(b.pricing.deposit)})`
  ];
}

function emailHtml(title, intro, lines, footer, settings) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
  <tr><td style="background:#0b1b3f;color:#fff;padding:20px 24px;font-size:20px;font-weight:bold">${settings.businessName}</td></tr>
  <tr><td style="padding:24px"><h2 style="margin:0 0 8px;font-size:20px">${title}</h2><p style="margin:0 0 16px;color:#475569">${intro}</p>
  <table width="100%" cellpadding="8" style="background:#f8fafc;border-radius:10px;font-size:14px">
  ${lines.map(l => { const [k, ...v] = l.split(': '); return `<tr><td style="color:#64748b;width:38%">${k}</td><td style="font-weight:600">${v.join(': ')}</td></tr>`; }).join('')}
  </table><p style="margin:16px 0 0;color:#475569;font-size:13px">${footer}</p></td></tr>
  <tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">Need help? Call/WhatsApp ${[settings.businessPhone, settings.businessPhone2].filter(Boolean).join(' / ')} · ${settings.businessEmail}</td></tr>
  </table></td></tr></table></body></html>`;
}

const EVENTS = {
  created: {
    customerTitle: 'Your booking is confirmed! 🎉',
    customerIntro: name => `Hi ${name}, thank you for booking with us. Here are your trip details.`,
    footer: 'Please carry your original Driving Licence and the ID proof you uploaded at the time of pickup. Fuel is not included. Extra km are charged as per the car tariff.',
    adminTitle: 'New booking received'
  },
  cancelled: {
    customerTitle: 'Your booking has been cancelled',
    customerIntro: name => `Hi ${name}, your booking below has been cancelled. Any amount paid will be refunded within 5-7 working days.`,
    footer: 'We hope to serve you again soon.',
    adminTitle: 'Booking cancelled'
  },
  started: {
    customerTitle: 'Your trip has started 🚗',
    customerIntro: name => `Hi ${name}, enjoy your drive! Please drive safely.`,
    footer: 'Return the car on time to avoid late charges.',
    adminTitle: 'Trip started'
  },
  completed: {
    customerTitle: 'Trip completed – thank you!',
    customerIntro: name => `Hi ${name}, your trip is complete. Here is your final summary.`,
    footer: 'Your security deposit will be refunded after inspection.',
    adminTitle: 'Trip completed'
  }
};

export async function notifyBooking(booking, event = 'created') {
  const db = getDb();
  const settings = db.settings;
  const car = db.cars.find(c => c.id === booking.carId);
  const owner = booking.ownerId ? db.users.find(u => u.id === booking.ownerId) : null;
  const ev = EVENTS[event];
  const lines = bookingLines(booking, car);
  if (event === 'completed') {
    lines.push(`Km driven: ${booking.kmDriven} km`, `Extra km charges: ${inr(booking.extraKmCharges)}`, `Final amount: ${inr(booking.finalAmount)}`);
  }
  const c = booking.customer;

  const helpPhones = [settings.businessPhone, settings.businessPhone2].filter(Boolean).join(' / ');
  const customerText = [`*${settings.businessName}*`, ev.customerTitle, '', ...lines, '', ev.footer, `Help: ${helpPhones}`].join('\n');
  const adminText = [`*${ev.adminTitle}*`, ...lines, `Customer: ${c.name} | ${c.phone} | ${c.email}`].join('\n');
  const adminPhones = [...new Set([settings.businessPhone, settings.businessPhone2].filter(Boolean))];

  const jobs = [
    sendEmail({ to: c.email, subject: `${ev.customerTitle} – ${booking.code}`, html: emailHtml(ev.customerTitle, ev.customerIntro(c.name), lines, ev.footer, settings), text: customerText, bookingId: booking.id, audience: 'customer' }),
    sendWhatsApp({ to: c.phone, text: customerText, bookingId: booking.id, audience: 'customer' }),
    sendEmail({ to: settings.businessEmail, subject: `[${settings.businessName}] ${ev.adminTitle} – ${booking.code}`, html: emailHtml(ev.adminTitle, `Customer: ${c.name} · ${c.phone} · ${c.email}`, lines, '', settings), text: adminText, bookingId: booking.id, audience: 'admin' }),
    ...adminPhones.map(to => sendWhatsApp({ to, text: adminText, bookingId: booking.id, audience: 'admin' }))
  ];
  if (owner && (event === 'created' || event === 'cancelled')) {
    const ownerText = [`*${ev.adminTitle} for your car*`, ...lines.slice(0, 5)].join('\n');
    jobs.push(sendEmail({ to: owner.email, subject: `${ev.adminTitle} for your ${car?.name} – ${booking.code}`, html: emailHtml(`${ev.adminTitle} for your car`, `Hi ${owner.name}, here are the details.`, lines.slice(0, 5), '', settings), text: ownerText, bookingId: booking.id, audience: 'owner' }));
  }
  await Promise.allSettled(jobs);
}

export function customerWhatsAppText(booking) {
  const db = getDb();
  const car = db.cars.find(c => c.id === booking.carId);
  return [`*${db.settings.businessName}*`, `Hi ${booking.customer.name}, your booking is confirmed.`, '', ...bookingLines(booking, car)].join('\n');
}
