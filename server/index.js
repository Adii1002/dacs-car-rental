import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { initDb, getDb, commit, uid, bookingCode, publicUser, UPLOAD_DIR } from './db.js';
import { notifyBooking, channelStatus, waLink, customerWhatsAppText } from './notify.js';
import { calcPrice, rangesOverlap } from '../shared/pricing.js';
import { readOdometerPhoto } from './odometer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5050);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

initDb();
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads/cars', express.static(path.join(UPLOAD_DIR, 'cars'), { maxAge: '7d' }));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signToken = user => jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
const normPhone = p => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d;
};

function readUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const user = getDb().users.find(u => u.id === id && u.active !== false);
    return user || null;
  } catch {
    return null;
  }
}

const auth = (...roles) => (req, res, next) => {
  const user = readUser(req);
  if (!user) return next(new HttpError(401, 'Please sign in to continue.'));
  if (roles.length && !roles.includes(user.role)) return next(new HttpError(403, 'You do not have access to this area.'));
  req.user = user;
  next();
};

const imageOrPdf = (req, file, cb) => {
  if (/^image\/|application\/pdf/.test(file.mimetype)) cb(null, true);
  else cb(new HttpError(400, 'Only images or PDF files are allowed.'));
};
const storage = dir => multer.diskStorage({
  destination: path.join(UPLOAD_DIR, dir),
  filename: (req, file, cb) => cb(null, `${uid(dir.slice(0, 3))}${path.extname(file.originalname).toLowerCase() || '.jpg'}`)
});
const uploadDocs = multer({ storage: storage('documents'), limits: { fileSize: 6 * 1024 * 1024 }, fileFilter: imageOrPdf });
const uploadCar = multer({ storage: storage('cars'), limits: { fileSize: 6 * 1024 * 1024 }, fileFilter: imageOrPdf });
const imageOnly = (req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new HttpError(400, 'Upload a photo of the odometer (JPG or PNG).'));
};
const uploadOdo = multer({ storage: storage('odometer'), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageOnly });

function carIsAvailable(carId, start, end, excludeId) {
  return !getDb().bookings.some(b =>
    b.carId === carId && b.id !== excludeId && (b.status === 'confirmed' || b.status === 'ongoing') &&
    rangesOverlap(start, end, b.start, b.end)
  );
}

// Upcoming bookings follow the new owner; past earnings stay with the previous owner.
function setCarOwner(car, ownerId) {
  if ((car.ownerId || null) === (ownerId || null)) return;
  car.ownerId = ownerId || null;
  getDb().bookings
    .filter(b => b.carId === car.id && b.status === 'confirmed' && new Date(b.start) > new Date())
    .forEach(b => { b.ownerId = car.ownerId; });
}

function validateTrip({ start, end }, { allowPast = false } = {}) {
  if (!start || !end) throw new HttpError(400, 'Pickup and drop date/time are required.');
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) throw new HttpError(400, 'Invalid date/time.');
  if (!allowPast && s < new Date(Date.now() - 10 * 60000)) throw new HttpError(400, 'Pickup time must be in the future.');
  if (e <= s) throw new HttpError(400, 'Drop time must be after pickup time.');
}

function buildPlace(type, location, address, settings) {
  if (type === 'delivery') {
    if (!location) throw new HttpError(400, 'Please select your area for doorstep delivery.');
    if (!address || address.trim().length < 5) throw new HttpError(400, 'Please enter the full delivery address.');
    return { type: 'delivery', location, address: address.trim() };
  }
  return { type: 'hub', location: settings.hubs.includes(location) ? location : settings.hubs[0] };
}

function maskBookingForOwner(b) {
  const phone = b.customer?.phone || '';
  return {
    ...b,
    customer: { name: b.customer?.name?.split(' ')[0] || 'Customer', phone: phone ? `${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}` : '' },
    documents: undefined,
    history: undefined
  };
}

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const db = getDb();
  const { name, email, phone, password, address } = req.body;
  if (!name || name.trim().length < 2) throw new HttpError(400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email || '')) throw new HttpError(400, 'Please enter a valid email.');
  if (!PHONE_RE.test(normPhone(phone))) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new HttpError(409, 'An account with this email already exists.');
  const user = {
    id: uid('u'), role: 'customer', name: name.trim(), email: email.trim().toLowerCase(), phone: normPhone(phone),
    address: address?.trim() || '', passwordHash: await bcrypt.hash(password, 10), active: true, createdAt: new Date().toISOString()
  };
  db.users.push(user);
  commit();
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = getDb().users.find(u => u.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) throw new HttpError(401, 'Invalid email or password.');
  if (user.active === false) throw new HttpError(403, 'Your account is disabled. Please contact support.');
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

app.put('/api/auth/me', auth(), wrap(async (req, res) => {
  const { name, phone, address, currentPassword, newPassword } = req.body;
  const u = req.user;
  if (name !== undefined) {
    if (name.trim().length < 2) throw new HttpError(400, 'Please enter your full name.');
    u.name = name.trim();
  }
  if (phone !== undefined) {
    if (!PHONE_RE.test(normPhone(phone))) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
    u.phone = normPhone(phone);
  }
  if (address !== undefined) u.address = address.trim();
  if (newPassword) {
    if (!(await bcrypt.compare(currentPassword || '', u.passwordHash))) throw new HttpError(400, 'Current password is incorrect.');
    if (newPassword.length < 6) throw new HttpError(400, 'New password must be at least 6 characters.');
    u.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  commit();
  res.json({ user: publicUser(u) });
}));

// ---------- public ----------
app.get('/api/settings', (req, res) => res.json(getDb().settings));

app.get('/api/cars', (req, res) => {
  const { start, end } = req.query;
  const cars = getDb().cars.filter(c => c.status === 'active').map(c => {
    const { regNumber, ownerId, odometer, ...pub } = c;
    return { ...pub, available: start && end ? carIsAvailable(c.id, start, end) : true };
  });
  res.json(cars);
});

app.get('/api/cars/:id', (req, res) => {
  const db = getDb();
  const car = db.cars.find(c => c.id === req.params.id && c.status === 'active');
  if (!car) return res.status(404).json({ error: 'Car not found.' });
  const { regNumber, ownerId, odometer, ...pub } = car;
  const bookedSlots = db.bookings
    .filter(b => b.carId === car.id && (b.status === 'confirmed' || b.status === 'ongoing') && new Date(b.end) > new Date())
    .map(b => ({ start: b.start, end: b.end }))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  res.json({ ...pub, bookedSlots });
});

// ---------- customer bookings ----------
const docFields = uploadDocs.fields([
  { name: 'dlFront', maxCount: 1 }, { name: 'dlBack', maxCount: 1 },
  { name: 'idProof', maxCount: 1 }, { name: 'selfie', maxCount: 1 }
]);

app.post('/api/bookings', auth('customer', 'admin'), docFields, wrap(async (req, res) => {
  const db = getDb();
  const settings = db.settings;
  const body = req.body;
  const car = db.cars.find(c => c.id === body.carId && c.status === 'active');
  if (!car) throw new HttpError(404, 'Selected car is not available.');
  validateTrip(body);
  if (!carIsAvailable(car.id, body.start, body.end)) throw new HttpError(409, 'Sorry, this car was just booked for the selected time. Please choose different dates or another car.');

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = normPhone(body.phone);
  if (name.length < 2) throw new HttpError(400, 'Please enter the driver\'s full name.');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email.');
  if (!PHONE_RE.test(phone)) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  if (!body.address || body.address.trim().length < 5) throw new HttpError(400, 'Please enter your residential address.');
  if (!body.dob) throw new HttpError(400, 'Please enter date of birth.');
  const age = (Date.now() - new Date(body.dob)) / (365.25 * 86400000);
  if (age < 21) throw new HttpError(400, 'Driver must be at least 21 years old.');
  if (!body.dlNumber || body.dlNumber.trim().length < 6) throw new HttpError(400, 'Please enter a valid driving licence number.');
  if (!body.idType || !body.idNumber) throw new HttpError(400, 'Please provide your photo ID type and number.');

  const saved = req.user.documents || {};
  const files = req.files || {};
  const doc = key => (files[key]?.[0]?.filename) || saved[key] || null;
  const documents = { dlFront: doc('dlFront'), dlBack: doc('dlBack'), idProof: doc('idProof'), selfie: doc('selfie') };
  const missing = Object.entries({ dlFront: 'Driving licence (front)', dlBack: 'Driving licence (back)', idProof: 'Photo ID proof', selfie: 'Your photo' })
    .filter(([k]) => !documents[k]).map(([, v]) => v);
  if (missing.length) throw new HttpError(400, `Please upload: ${missing.join(', ')}.`);

  const pickup = buildPlace(body.pickupType, body.pickupLocation, body.pickupAddress, settings);
  const drop = buildPlace(body.dropType, body.dropLocation, body.dropAddress, settings);
  const pricing = calcPrice({ car, start: body.start, end: body.end, pickupType: pickup.type, dropType: drop.type, settings });

  const now = new Date().toISOString();
  const booking = {
    id: uid('b'), code: bookingCode(), carId: car.id, carName: car.name, carReg: car.regNumber, ownerId: car.ownerId || null,
    customerId: req.user.role === 'customer' ? req.user.id : null,
    customer: { name, email, phone, address: body.address.trim(), dob: body.dob, dlNumber: body.dlNumber.trim().toUpperCase(), idType: body.idType, idNumber: body.idNumber.trim().toUpperCase() },
    documents, start: new Date(body.start).toISOString(), end: new Date(body.end).toISOString(), pickup, drop, pricing,
    status: 'confirmed', kycStatus: 'pending', payment: { method: body.paymentMethod === 'upi' ? 'upi' : 'pay_at_pickup', status: 'pending' },
    startOdometer: null, endOdometer: null, kmDriven: 0, extraKmCharges: 0, finalAmount: pricing.total,
    notes: (body.notes || '').slice(0, 500), createdAt: now, history: [{ at: now, action: 'Booking created', by: req.user.name }]
  };
  db.bookings.push(booking);
  if (req.user.role === 'customer') {
    req.user.documents = documents;
    req.user.dlNumber = booking.customer.dlNumber;
    req.user.dob = booking.customer.dob;
    if (!req.user.address) req.user.address = booking.customer.address;
  }
  commit();
  notifyBooking(booking, 'created').catch(err => console.error('notify failed', err));
  res.json({ booking, whatsappLink: waLink(settings.businessPhone, customerWhatsAppText(booking)) });
}));

app.get('/api/bookings/my', auth(), (req, res) => {
  const db = getDb();
  const list = db.bookings.filter(b => b.customerId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list.map(b => ({ ...b, car: db.cars.find(c => c.id === b.carId) || null })));
});

app.get('/api/bookings/:id', auth(), (req, res) => {
  const db = getDb();
  const b = db.bookings.find(x => x.id === req.params.id);
  if (!b || (req.user.role !== 'admin' && b.customerId !== req.user.id)) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ ...b, car: db.cars.find(c => c.id === b.carId) || null, whatsappLink: waLink(db.settings.businessPhone, customerWhatsAppText(b)) });
});

app.post('/api/bookings/:id/cancel', auth(), wrap(async (req, res) => {
  const b = getDb().bookings.find(x => x.id === req.params.id);
  if (!b || (req.user.role !== 'admin' && b.customerId !== req.user.id)) throw new HttpError(404, 'Booking not found.');
  if (b.status !== 'confirmed') throw new HttpError(400, 'Only upcoming bookings can be cancelled.');
  if (req.user.role !== 'admin' && new Date(b.start) <= new Date()) throw new HttpError(400, 'Trip has already started. Please contact support.');
  b.status = 'cancelled';
  b.payment.status = b.payment.status === 'paid' ? 'refund_pending' : b.payment.status;
  b.history.push({ at: new Date().toISOString(), action: 'Cancelled', by: req.user.name });
  commit();
  notifyBooking(b, 'cancelled').catch(() => {});
  res.json(b);
}));

app.get('/api/files/documents/:name', auth(), (req, res) => {
  const name = path.basename(req.params.name);
  const owns = req.user.role === 'admin' || Object.values(req.user.documents || {}).includes(name);
  if (!owns) return res.status(403).json({ error: 'Not allowed.' });
  const file = path.join(UPLOAD_DIR, 'documents', name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(file);
});

// ---------- owner ----------
app.get('/api/owner/dashboard', auth('owner'), (req, res) => {
  const db = getDb();
  const cars = db.cars.filter(c => c.ownerId === req.user.id);
  const bookings = db.bookings.filter(b => b.ownerId === req.user.id).map(maskBookingForOwner);
  res.json({ owner: publicUser(req.user), cars, bookings });
});

// ---------- admin ----------
const admin = auth('admin');

app.get('/api/admin/overview', admin, (req, res) => {
  const db = getDb();
  res.json({
    settings: db.settings,
    channels: channelStatus(),
    cars: db.cars,
    bookings: db.bookings,
    owners: db.users.filter(u => u.role === 'owner').map(publicUser),
    customers: db.users.filter(u => u.role === 'customer').map(publicUser)
  });
});

app.put('/api/admin/settings', admin, (req, res) => {
  const db = getDb();
  const allowed = ['businessName', 'businessPhone', 'businessPhone2', 'businessEmail', 'city', 'kmPerDay', 'extraKmRate', 'deliveryCharge', 'securityDeposit', 'minHours', 'defaultOwnerShare', 'hubs', 'deliveryAreas'];
  allowed.forEach(k => {
    if (req.body[k] === undefined) return;
    const numeric = typeof db.settings[k] === 'number';
    db.settings[k] = numeric ? Math.max(0, Number(req.body[k]) || 0) : req.body[k];
  });
  commit();
  res.json(db.settings);
});

function carFromBody(body, file, existing = {}) {
  const car = { ...existing };
  const str = k => { if (body[k] !== undefined) car[k] = String(body[k]).trim(); };
  const num = k => { if (body[k] !== undefined && body[k] !== '') car[k] = Number(body[k]); };
  ['name', 'brand', 'regNumber', 'category', 'color', 'fuel', 'transmission', 'description', 'status', 'location'].forEach(str);
  ['year', 'seats', 'pricePerDay', 'kmPerDay', 'extraKmRate', 'odometer'].forEach(num);
  if (body.features !== undefined) car.features = String(body.features).split(',').map(s => s.trim()).filter(Boolean);
  if (body.ownerId !== undefined) car.ownerId = body.ownerId || null;
  if (file) car.image = `/uploads/cars/${file.filename}`;
  else if (body.image) car.image = String(body.image).trim();
  if (!car.name) throw new HttpError(400, 'Car name is required.');
  if (!(car.pricePerDay > 0)) throw new HttpError(400, 'Price per day must be greater than 0.');
  if (!car.image) throw new HttpError(400, 'Please upload a car photo or provide an image URL.');
  if (car.ownerId && !getDb().users.some(u => u.id === car.ownerId && u.role === 'owner')) throw new HttpError(400, 'Selected owner not found.');
  return car;
}

app.post('/api/admin/cars', admin, uploadCar.single('imageFile'), (req, res) => {
  const db = getDb();
  const car = carFromBody(req.body, req.file, { status: 'active', seats: 5, transmission: 'Manual', category: 'SUV', features: [], location: db.settings.city, odometer: 0, createdAt: new Date().toISOString() });
  car.id = uid('car');
  db.cars.push(car);
  commit();
  res.json(car);
});

app.put('/api/admin/cars/:id', admin, uploadCar.single('imageFile'), (req, res) => {
  const db = getDb();
  const idx = db.cars.findIndex(c => c.id === req.params.id);
  if (idx < 0) throw new HttpError(404, 'Car not found.');
  const prevOwner = db.cars[idx].ownerId || null;
  db.cars[idx] = carFromBody(req.body, req.file, db.cars[idx]);
  const nextOwner = db.cars[idx].ownerId || null;
  db.cars[idx].ownerId = prevOwner;
  setCarOwner(db.cars[idx], nextOwner);
  commit();
  res.json(db.cars[idx]);
});

app.delete('/api/admin/cars/:id', admin, (req, res) => {
  const db = getDb();
  const upcoming = db.bookings.some(b => b.carId === req.params.id && (b.status === 'confirmed' || b.status === 'ongoing'));
  if (upcoming) throw new HttpError(400, 'This car has upcoming/ongoing bookings. Cancel or complete them first, or set the car to inactive.');
  db.cars = db.cars.filter(c => c.id !== req.params.id);
  commit();
  res.json({ ok: true });
});

app.post('/api/admin/owners', admin, wrap(async (req, res) => {
  const db = getDb();
  const { name, email, phone, password, sharePercent, address, bank, carIds } = req.body;
  if (!name || name.trim().length < 2) throw new HttpError(400, 'Owner name is required.');
  if (!EMAIL_RE.test(email || '')) throw new HttpError(400, 'Valid email is required.');
  if (!PHONE_RE.test(normPhone(phone))) throw new HttpError(400, 'Valid 10-digit phone is required.');
  if (!password || password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new HttpError(409, 'A user with this email already exists.');
  const owner = {
    id: uid('u'), role: 'owner', name: name.trim(), email: email.trim().toLowerCase(), phone: normPhone(phone),
    passwordHash: await bcrypt.hash(password, 10), active: true,
    sharePercent: Math.min(100, Math.max(0, Number(sharePercent) || db.settings.defaultOwnerShare)),
    address: address || '', bank: bank || {}, createdAt: new Date().toISOString()
  };
  db.users.push(owner);
  (carIds || []).forEach(id => { const c = db.cars.find(x => x.id === id); if (c) setCarOwner(c, owner.id); });
  commit();
  res.json(publicUser(owner));
}));

app.put('/api/admin/owners/:id', admin, wrap(async (req, res) => {
  const db = getDb();
  const owner = db.users.find(u => u.id === req.params.id && u.role === 'owner');
  if (!owner) throw new HttpError(404, 'Owner not found.');
  const { name, email, phone, password, sharePercent, address, bank, active, carIds } = req.body;
  if (name !== undefined) owner.name = name.trim();
  if (email !== undefined) {
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Valid email is required.');
    if (db.users.some(u => u.id !== owner.id && u.email.toLowerCase() === email.toLowerCase())) throw new HttpError(409, 'Email already in use.');
    owner.email = email.trim().toLowerCase();
  }
  if (phone !== undefined) {
    if (!PHONE_RE.test(normPhone(phone))) throw new HttpError(400, 'Valid 10-digit phone is required.');
    owner.phone = normPhone(phone);
  }
  if (password) owner.passwordHash = await bcrypt.hash(password, 10);
  if (sharePercent !== undefined) owner.sharePercent = Math.min(100, Math.max(0, Number(sharePercent)));
  if (address !== undefined) owner.address = address;
  if (bank !== undefined) owner.bank = bank;
  if (active !== undefined) owner.active = !!active;
  if (Array.isArray(carIds)) {
    db.cars.forEach(c => {
      if (carIds.includes(c.id)) setCarOwner(c, owner.id);
      else if (c.ownerId === owner.id) setCarOwner(c, null);
    });
  }
  commit();
  res.json(publicUser(owner));
}));

app.delete('/api/admin/owners/:id', admin, (req, res) => {
  const db = getDb();
  db.cars.forEach(c => { if (c.ownerId === req.params.id) setCarOwner(c, null); });
  db.users = db.users.filter(u => !(u.id === req.params.id && u.role === 'owner'));
  commit();
  res.json({ ok: true });
});

app.patch('/api/admin/customers/:id', admin, (req, res) => {
  const u = getDb().users.find(x => x.id === req.params.id && x.role === 'customer');
  if (!u) throw new HttpError(404, 'Customer not found.');
  if (req.body.active !== undefined) u.active = !!req.body.active;
  commit();
  res.json(publicUser(u));
});

app.post('/api/admin/bookings', admin, wrap(async (req, res) => {
  const db = getDb();
  const b = req.body;
  const car = db.cars.find(c => c.id === b.carId);
  if (!car) throw new HttpError(400, 'Select a car.');
  validateTrip(b, { allowPast: true });
  if (!carIsAvailable(car.id, b.start, b.end)) throw new HttpError(409, 'Car is not available for the selected time.');
  if (!b.name || !PHONE_RE.test(normPhone(b.phone))) throw new HttpError(400, 'Customer name and valid phone are required.');
  if (b.email && !EMAIL_RE.test(b.email)) throw new HttpError(400, 'Invalid email.');
  const pickup = buildPlace(b.pickupType, b.pickupLocation, b.pickupAddress, db.settings);
  const drop = buildPlace(b.dropType, b.dropLocation, b.dropAddress, db.settings);
  const pricing = calcPrice({ car, start: b.start, end: b.end, pickupType: pickup.type, dropType: drop.type, settings: db.settings });
  const now = new Date().toISOString();
  const booking = {
    id: uid('b'), code: bookingCode(), carId: car.id, carName: car.name, carReg: car.regNumber, ownerId: car.ownerId || null, customerId: null,
    customer: { name: b.name.trim(), email: (b.email || '').trim(), phone: normPhone(b.phone), address: b.address || '', dlNumber: (b.dlNumber || '').toUpperCase(), idType: b.idType || '', idNumber: b.idNumber || '' },
    documents: {}, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), pickup, drop, pricing,
    status: 'confirmed', kycStatus: 'pending', payment: { method: b.paymentMethod || 'pay_at_pickup', status: 'pending' },
    startOdometer: null, endOdometer: null, kmDriven: 0, extraKmCharges: 0, finalAmount: pricing.total,
    notes: b.notes || '', offline: true, createdAt: now, history: [{ at: now, action: 'Offline booking created', by: req.user.name }]
  };
  db.bookings.push(booking);
  commit();
  if (b.notify !== false) notifyBooking(booking, 'created').catch(() => {});
  res.json(booking);
}));

function attachMeterPhoto(booking, key, filename) {
  if (!filename) return;
  const name = path.basename(String(filename));
  if (!fs.existsSync(path.join(UPLOAD_DIR, 'odometer', name))) throw new HttpError(400, 'Odometer photo was not uploaded. Take the photo again.');
  booking[key] = name;
}

app.post('/api/admin/odometer/scan', admin, uploadOdo.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Take a photo of the odometer.');
  let result = { reading: null, confidence: 0, raw: '' };
  try {
    result = await readOdometerPhoto(req.file.path, req.body.hint);
  } catch (err) {
    console.error('Odometer OCR failed:', err.message);
  }
  res.json({ photo: req.file.filename, ...result });
}));

app.get('/api/files/odometer/:name', admin, (req, res) => {
  const name = path.basename(req.params.name);
  const file = path.join(UPLOAD_DIR, 'odometer', name);
  if (!name || !fs.existsSync(file)) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(file);
});

app.patch('/api/admin/bookings/:id', admin, wrap(async (req, res) => {
  const db = getDb();
  const b = db.bookings.find(x => x.id === req.params.id);
  if (!b) throw new HttpError(404, 'Booking not found.');
  const { action, startOdometer, endOdometer, kycStatus, paymentStatus, notes, start, end, carId, otherCharges } = req.body;
  const car = db.cars.find(c => c.id === b.carId);
  const at = new Date().toISOString();
  const by = req.user.name;
  let event = null;

  if (action === 'start') {
    if (b.status !== 'confirmed') throw new HttpError(400, 'Only confirmed bookings can be started.');
    const odo = Number(startOdometer);
    if (!(odo >= 0)) throw new HttpError(400, 'Enter the starting odometer reading.');
    b.status = 'ongoing';
    b.startOdometer = odo;
    attachMeterPhoto(b, 'startOdometerPhoto', req.body.startOdometerPhoto);
    if (car) car.odometer = Math.max(car.odometer || 0, odo);
    b.history.push({ at, action: `Trip started (odometer ${odo} km${b.startOdometerPhoto ? ', photo' : ''})`, by });
    event = 'started';
  } else if (action === 'complete') {
    if (b.status !== 'ongoing') throw new HttpError(400, 'Only ongoing trips can be completed.');
    const odo = Number(endOdometer);
    if (!(odo >= b.startOdometer)) throw new HttpError(400, 'End odometer must be greater than or equal to start odometer.');
    b.endOdometer = odo;
    attachMeterPhoto(b, 'endOdometerPhoto', req.body.endOdometerPhoto);
    b.kmDriven = odo - b.startOdometer;
    const extraKm = Math.max(0, b.kmDriven - b.pricing.includedKm);
    b.extraKmCharges = extraKm * b.pricing.extraKmRate;
    b.otherCharges = Math.max(0, Number(otherCharges) || 0);
    b.finalAmount = b.pricing.total + b.extraKmCharges + b.otherCharges;
    b.status = 'completed';
    if (car) car.odometer = Math.max(car.odometer || 0, odo);
    b.history.push({ at, action: `Trip completed (${b.kmDriven} km, extra ₹${b.extraKmCharges})`, by });
    event = 'completed';
  } else if (action === 'cancel') {
    if (b.status === 'completed' || b.status === 'cancelled') throw new HttpError(400, 'Booking cannot be cancelled.');
    b.status = 'cancelled';
    b.history.push({ at, action: 'Cancelled by admin', by });
    event = 'cancelled';
  } else if (action === 'reschedule') {
    const newCarId = carId || b.carId;
    const newCar = db.cars.find(c => c.id === newCarId);
    if (!newCar) throw new HttpError(400, 'Car not found.');
    validateTrip({ start, end }, { allowPast: true });
    if (!carIsAvailable(newCarId, start, end, b.id)) throw new HttpError(409, 'Car is not available for the new time.');
    b.carId = newCarId;
    b.carName = newCar.name;
    b.carReg = newCar.regNumber;
    b.ownerId = newCar.ownerId || null;
    b.start = new Date(start).toISOString();
    b.end = new Date(end).toISOString();
    b.pricing = calcPrice({ car: newCar, start: b.start, end: b.end, pickupType: b.pickup.type, dropType: b.drop.type, settings: db.settings });
    b.finalAmount = b.pricing.total;
    b.history.push({ at, action: 'Rescheduled', by });
  }
  if (kycStatus && ['pending', 'verified', 'rejected'].includes(kycStatus)) {
    b.kycStatus = kycStatus;
    b.history.push({ at, action: `KYC ${kycStatus}`, by });
  }
  if (paymentStatus) {
    b.payment.status = paymentStatus;
    b.history.push({ at, action: `Payment marked ${paymentStatus}`, by });
  }
  if (notes !== undefined) b.notes = notes;
  commit();
  if (event) notifyBooking(b, event).catch(() => {});
  res.json(b);
}));

app.post('/api/admin/bookings/:id/notify', admin, wrap(async (req, res) => {
  const b = getDb().bookings.find(x => x.id === req.params.id);
  if (!b) throw new HttpError(404, 'Booking not found.');
  await notifyBooking(b, req.body.event || 'created');
  res.json({ ok: true });
}));

app.get('/api/admin/notifications', admin, (req, res) => res.json(getDb().notifications));

// ---------- production static ----------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 6 MB).' : err.message });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, err => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Stop the other process or set PORT in .env.` : err);
    process.exit(1);
  }
  const ch = channelStatus();
  console.log(`API running on http://localhost:${PORT}  (email: ${ch.email ? 'on' : 'off'}, whatsapp api: ${ch.whatsapp ? 'on' : 'off'})`);
});
