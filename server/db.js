import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { DEFAULT_SETTINGS, calcPrice } from '../shared/pricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(path.join(UPLOAD_DIR, 'cars'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'documents'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'odometer'), { recursive: true });

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

export function bookingCode() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DCR${ymd}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

let db;

function save() {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function getDb() {
  return db;
}

export function commit() {
  save();
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function seed() {
  const now = new Date();
  const hash = pw => bcrypt.hashSync(pw, 10);
  const admin = {
    id: 'u_admin', role: 'admin', name: 'Aditya Kamble', email: 'admin@adicarrental.com',
    phone: '7020920064', passwordHash: hash('Admin@123'), active: true, createdAt: now.toISOString()
  };
  const owner1 = {
    id: 'u_owner1', role: 'owner', name: 'Rahul Patil', email: 'owner@adicarrental.com',
    phone: '9876543210', passwordHash: hash('Owner@123'), active: true, sharePercent: 70,
    address: 'Baner, Pune', bank: { accountName: 'Rahul Patil', accountNumber: 'XXXX4521', ifsc: 'HDFC0001234', upi: 'rahul@okhdfc' },
    createdAt: now.toISOString()
  };
  const owner2 = {
    id: 'u_owner2', role: 'owner', name: 'Sneha Joshi', email: 'sneha@adicarrental.com',
    phone: '9823456789', passwordHash: hash('Owner@123'), active: true, sharePercent: 65,
    address: 'Kothrud, Pune', bank: { accountName: 'Sneha Joshi', accountNumber: 'XXXX7788', ifsc: 'ICIC0004321', upi: 'sneha@okicici' },
    createdAt: now.toISOString()
  };
  const customer = {
    id: 'u_customer1', role: 'customer', name: 'Demo Customer', email: 'customer@adicarrental.com',
    phone: '9123456780', passwordHash: hash('Customer@123'), active: true, address: 'Wakad, Pune',
    createdAt: now.toISOString()
  };

  const base = { kmPerDay: 250, extraKmRate: 12, status: 'active', location: 'Pune', createdAt: now.toISOString() };
  const cars = [
    { ...base, id: 'creta', name: 'Hyundai Creta', brand: 'Hyundai', year: 2023, regNumber: 'MH12 AB 1234', category: 'SUV', color: 'White', fuel: 'Petrol', transmission: 'Automatic', seats: 5, pricePerDay: 3500, odometer: 18450, ownerId: 'u_owner1', image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=900&q=80', features: ['AC', 'Sunroof', 'Android Auto', 'Cruise Control'], description: 'Comfortable SUV for city and highway. Ideal for families and weekend getaways.' },
    { ...base, id: 'fortuner', name: 'Toyota Fortuner', brand: 'Toyota', year: 2022, regNumber: 'MH12 CD 5678', category: 'Luxury', color: 'White', fuel: 'Diesel', transmission: 'Automatic', seats: 7, pricePerDay: 5500, extraKmRate: 18, odometer: 32010, ownerId: 'u_owner1', image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=900&q=80', features: ['7 Seater', '4x4', 'Touchscreen', 'Premium Interior'], description: 'Premium SUV for comfort and long drives. Spacious and powerful.' },
    { ...base, id: 'thar', name: 'Mahindra Thar', brand: 'Mahindra', year: 2023, regNumber: 'MH14 EF 9012', category: 'SUV', color: 'Black', fuel: 'Diesel', transmission: 'Manual', seats: 4, pricePerDay: 4000, odometer: 12880, ownerId: 'u_owner2', image: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=900&q=80', features: ['4x4', 'Convertible Top', 'Touchscreen', 'Off-road Ready'], description: 'Rugged SUV for adventure. Perfect for off-road trails and the Sahyadris.' },
    { ...base, id: 'fronx', name: 'Maruti Fronx', brand: 'Maruti Suzuki', year: 2024, regNumber: 'MH12 GH 3456', category: 'Hatchback', color: 'Blue', fuel: 'Petrol / CNG', transmission: 'Manual', seats: 5, pricePerDay: 2500, extraKmRate: 10, odometer: 8020, ownerId: 'u_owner2', image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=900&q=80', features: ['CNG Option', 'AC', 'Fuel Efficient', 'Apple CarPlay'], description: 'Economical and stylish. Great for city driving and short trips.' },
    { ...base, id: 'ertiga', name: 'Maruti Ertiga', brand: 'Maruti Suzuki', year: 2023, regNumber: 'MH14 IJ 7890', category: 'MUV', color: 'Black', fuel: 'Petrol / CNG', transmission: 'Manual', seats: 7, pricePerDay: 3000, odometer: 22300, ownerId: 'u_owner1', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=900&q=80', features: ['7 Seater', 'CNG Option', 'Spacious Boot', 'Rear AC'], description: 'Spacious MPV for larger groups. Family and group travel friendly.' },
    { ...base, id: 'city', name: 'Honda City', brand: 'Honda', year: 2023, regNumber: 'MH12 KL 2468', category: 'Sedan', color: 'White', fuel: 'Petrol', transmission: 'Automatic', seats: 5, pricePerDay: 3200, odometer: 15600, ownerId: null, image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=900&q=80', features: ['AC', 'Sunroof', 'Lane Watch', 'Cruise Control'], description: 'Smooth premium sedan, perfect for business trips and highway drives.' }
  ];

  const rand = seededRandom(42);
  const names = ['Amit Shah', 'Priya Deshmukh', 'Rohan Kulkarni', 'Neha Pawar', 'Vikram Rao', 'Anjali More', 'Karan Mehta', 'Pooja Jadhav'];
  const bookings = [];
  cars.forEach(car => {
    let cursor = new Date(now.getTime() - 120 * 86400000);
    while (cursor < new Date(now.getTime() - 2 * 86400000)) {
      cursor = new Date(cursor.getTime() + Math.floor(1 + rand() * 5) * 86400000);
      cursor.setHours(9 + Math.floor(rand() * 4), 0, 0, 0);
      const hours = 24 * Math.floor(1 + rand() * 3);
      const start = new Date(cursor);
      const end = new Date(start.getTime() + hours * 3600000);
      if (end > now) break;
      const pricing = calcPrice({ car, start, end, pickupType: rand() > 0.5 ? 'delivery' : 'hub', dropType: 'hub' });
      const cancelled = rand() < 0.08;
      const kmDriven = cancelled ? 0 : Math.round(pricing.includedKm * (0.4 + rand() * 0.8));
      const extraKm = Math.max(0, kmDriven - pricing.includedKm);
      const extraKmCharges = extraKm * pricing.extraKmRate;
      const name = names[Math.floor(rand() * names.length)];
      bookings.push({
        id: uid('b'),
        code: `ACRDEMO${String(bookings.length + 1).padStart(3, '0')}`,
        carId: car.id,
        ownerId: car.ownerId,
        customerId: null,
        customer: { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: `98${Math.floor(10000000 + rand() * 89999999)}`, address: 'Pune' },
        documents: {},
        start: start.toISOString(),
        end: end.toISOString(),
        pickup: { type: 'hub', location: DEFAULT_SETTINGS.hubs[0] },
        drop: { type: 'hub', location: DEFAULT_SETTINGS.hubs[0] },
        pricing,
        status: cancelled ? 'cancelled' : 'completed',
        kycStatus: 'verified',
        payment: { method: 'upi', status: cancelled ? 'refunded' : 'paid' },
        startOdometer: cancelled ? null : 1000,
        endOdometer: cancelled ? null : 1000 + kmDriven,
        kmDriven,
        extraKmCharges,
        finalAmount: cancelled ? 0 : pricing.total + extraKmCharges,
        demo: true,
        createdAt: start.toISOString(),
        history: [{ at: start.toISOString(), action: 'Demo booking seeded' }]
      });
      cursor = end;
    }
  });

  [['creta', 2, 48, 'pending'], ['thar', 3, 72, 'verified'], ['ertiga', 5, 24, 'pending']].forEach(([carId, inDays, hours, kycStatus], i) => {
    const car = cars.find(c => c.id === carId);
    const start = new Date(now.getTime() + inDays * 86400000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + hours * 3600000);
    const pricing = calcPrice({ car, start, end, pickupType: 'delivery', dropType: 'delivery' });
    const name = names[i + 2];
    bookings.push({
      id: uid('b'), code: `ACRDEMOU${i + 1}`, carId, carName: car.name, carReg: car.regNumber, ownerId: car.ownerId, customerId: null,
      customer: { name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: `98220${10000 + i * 1111}`, address: 'Baner, Pune', dlNumber: `MH12201900${4321 + i}`, idType: 'Aadhaar Card', idNumber: `XXXX XXXX ${1234 + i}` },
      documents: {}, start: start.toISOString(), end: end.toISOString(),
      pickup: { type: 'delivery', location: 'Baner', address: 'Sus Road, near D-Mart' }, drop: { type: 'delivery', location: 'Baner', address: 'Sus Road, near D-Mart' },
      pricing, status: 'confirmed', kycStatus, payment: { method: 'pay_at_pickup', status: 'pending' },
      startOdometer: null, endOdometer: null, kmDriven: 0, extraKmCharges: 0, finalAmount: pricing.total,
      demo: true, offline: true, createdAt: now.toISOString(), history: [{ at: now.toISOString(), action: 'Demo booking seeded' }]
    });
  });

  db = {
    settings: { ...DEFAULT_SETTINGS },
    users: [admin, owner1, owner2, customer],
    cars,
    bookings,
    notifications: []
  };
  save();
  console.log(`Seeded database with ${cars.length} cars and ${bookings.length} demo bookings.`);
}

export function initDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const stored = db.settings || {};
    db.settings = { ...DEFAULT_SETTINGS, ...stored };
    if (stored.businessPhone2 === undefined) db.settings.businessPhone2 = DEFAULT_SETTINGS.businessPhone2;
    if (!stored.businessName || stored.businessName === 'Adi Car Rental') db.settings.businessName = DEFAULT_SETTINGS.businessName;
    db.notifications ||= [];
    save();
  } else {
    seed();
  }
}

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}
