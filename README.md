# Adi Car Rental – Self-drive car rental platform

Revv-style self-drive car rental app with three portals:

- **Customer** – search by date/time, filter cars, book with hub pickup or doorstep delivery, upload driving licence (front/back), photo ID and selfie, get booking confirmation on email / WhatsApp, view and cancel bookings.
- **Car owner** – weekly / monthly / yearly / custom-month dashboard of bookings, income (revenue share), km driven, hours booked and utilisation per car.
- **Admin** – dashboard, bookings (KYC verification, trip start/end with odometer, extra-km charges, payment status, reschedule, cancel, resend notifications, offline bookings), fleet management, car owners (create, assign cars, revenue share, analytics), customers, notification log and business settings.

## Run locally

```bash
npm install
npm run dev
```

- Website: http://localhost:5173 (also reachable from your phone on the same Wi-Fi via the "Network" URL Vite prints)
- API: http://localhost:5050

### Demo logins

| Role     | Email                       | Password      |
| -------- | --------------------------- | ------------- |
| Admin    | admin@adicarrental.com      | Admin@123     |
| Owner    | owner@adicarrental.com      | Owner@123     |
| Owner 2  | sneha@adicarrental.com      | Owner@123     |
| Customer | customer@adicarrental.com   | Customer@123  |

Data lives in `data/db.json` and uploads in `data/uploads/`. Run `npm run reset-data` (then restart) to re-seed demo data.

## Email & WhatsApp notifications

Configure in `.env` (see `.env.example`):

- **Email** – `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (e.g. Gmail with an app password).
- **WhatsApp** – either Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`) or Meta WhatsApp Cloud API (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).

Without these, messages are recorded in **Admin → Notifications** with a one-click `wa.me` link, and customers get a "Send on WhatsApp" button on their confirmation page.

## Production

```bash
npm run build
npm start   # serves the API and the built site on PORT (default 5050)
```

The original base version is kept in `_base_backup/`.
