# Zetheta — accessible super-app demo

A fully interactive **demo** wallet and services super-app for Pixel Paranoia ’26 (PS-04, Zetheta).
It grows the accessible Send Money prototype into one coherent app: payments, real QR codes, travel, movies and events, food, shopping, bills, local transport, offers, rewards and history.

> **Demo mode.** Every balance, payment, booking, notification and offer is simulated. No real money, bank, UPI rail, operator or SMS service is used. Don’t enter real account numbers.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit + component tests (Vitest)
npm run build          # type-check + production build → dist/
npm run preview        # serve dist/ on http://localhost:4173
npm run e2e            # Playwright end-to-end scenarios (needs `npm run build` first)
npm run build:artifact # single-file page used for the claude.ai share link
```

If Playwright can’t download its own browser, point it at an installed Chromium:
`CHROMIUM_PATH=/path/to/chrome-headless-shell npm run e2e`.

**Demo login and payment PIN: `1234`.** This is a fixed, documented, non-production PIN checked in the browser. It is not real authentication.

## What works

| Area | What you can do |
|---|---|
| Home | Wallet card with show/hide balance, add demo money, wallet details, 6 quick actions, 16 service tiles, offers carousel, recent activity, global search (services, people, merchants, restaurants, shows, offers, transactions) |
| Send money | Search by name, phone alias or ID; favourites and recents; amount by keypad or keyboard with amount in words (English or Hindi); balance and ₹2,00,000 limit checks; **extra-zero / unusual-amount check**; **look-alike payee warning**; review with bank-name check; PIN; processing; receipt; cancel before confirmation; duplicate-click protection |
| Receive | Personal QR (structured payload), copy ID, download QR as PNG, payment requests with reference and QR, **simulate another demo user paying** (credits the ledger) |
| Scan & Pay | Camera scanning (jsQR), image upload, 7 sample QR codes (3 valid, 4 that must be rejected), pay by typing an ID; payload validated with Zod; review → PIN → receipt |
| Ledger | Double-entry ledger in integer paise; balances derived from entries; idempotency keys; failed payments write no entries; refunds as reverse entries; consistency check in Profile |
| History | Filters, search, receipts (downloadable HTML), CSV statement, spending insights by category and month |
| Travel | Trains (class, PNR, passengers), flights (one-way/return, cabin, taxes), buses (seat map 2+1, boarding/drop), hotels (nights, rooms, GST); bookings with QR tickets; cancellation with tiered refunds |
| Movies & events | City/genre filters, showtimes, cinema seat map with price tiers, event zones, convenience fee + GST, QR tickets, **venue validator that admits a ticket only once** |
| Food | Search, cuisine and veg filters, sorting, item sizes and add-ons, single-restaurant cart, minimum order, packaging, delivery, platform fee, 5% GST, coupons, live order timeline, cancel → full refund |
| Shopping | Product list, details, cart, free-delivery threshold, coupon, checkout, order |
| Bills | Mobile plans, DTH, electricity, broadband, water, insurance; ID validation; bill fetch; receipts |
| Local transport | Metro and bus passes (QR), parking by the hour, auto/cab fare estimate and booking |
| Offers & rewards | 8 demo coupons (percent/fixed, caps, minimum spend, categories, start/expiry dates, single-use) with a coupon checker that explains every rejection; points earned on purchases, tiers, redemption to wallet credit, reversal on refunds |
| Accessibility Center | Text size up to 200%, reduced motion, high contrast, screen-reader-friendly mode, simplified navigation, Hindi amounts, idle-timeout length |
| Session | Idle warning with 60-second countdown and “Stay logged in”, lock app, wrong-PIN pause after 3 tries with OTP fallback |
| Judge walkthrough | Ten guided scenarios with one-click starts, plus reset demo data |

## Demo scenarios (all automated in `tests/e2e/flows.spec.ts`)

1. **Successful transfer:** Send → Rahul Sharma → ₹300 → Pay → PIN 1234. Your balance drops by exactly ₹300 and Rahul’s rises by ₹300.
2. **Insufficient balance:** Guide → “Try ₹99,999”. Blocked with “Add demo money”.
3. **Wrong PIN:** at any PIN step enter `0000`. You get “2 tries left. No money has been sent.” After 3 tries entry pauses for 30 s; use the one-time code instead.
4. **Valid QR:** Scan & Pay → Sample QR codes → “Café Monsoon bill” → Scan this → Review → Pay.
5. **Invalid QR:** scan “Free cashback link”, “Foreign currency code”, “Quick Loans” or “Tampered code”. Each is refused with a specific reason, and the payload is shown as text and never opened.
6. **Food order:** Food → Dosa Junction → add items → cart → Place order → `FOOD50` → track the order, then cancel for a full refund.
7. **Ticket booking:** Movies & events → any show → seats → `MOVIE75` → Pay → open ticket → Validate at venue → Admit → scan again shows “Already used”.
8. **Coupon rejection:** try `MONSOON30` (expired), `FOOD50` on travel (wrong category) or `FOOD50` under ₹199 (minimum spend).
9. **Refund:** book a train a few days ahead → open booking → Cancel. You get a 90% refund as a new ledger entry, and the original is marked refunded.
10. **Reward redemption:** Offers & rewards → Reward points → Redeem 100. You get ₹10 of wallet credit, and redeeming twice with the same request is impossible.

Make the next payment fail on purpose: Profile → Demo tools → “Make the next payment fail”.

## Testing QR codes

* **Generate:** Receive shows your personal QR code. Create a request to get a QR code with an amount and reference. Use Download to save it as a PNG.
* **Scan:** Scan & Pay → Camera. This needs HTTPS or localhost plus camera permission. Inside the claude.ai share link the browser blocks the camera, so use **Upload image** with a downloaded QR, or **Sample QR codes**.
* **Format:** `ZETHETA-DEMO:{"zth":1,"type":"pay","to":"gupta.kirana@zetheta","name":"…","amt":34000,"cur":"INR","ref":"…","purpose":"DEMO-ONLY"}`. `amt` is in paise. Tickets use `ZETHETA-TICKET:{"zth":1,"type":"ticket","id":"b_…","code":"…","sig":"…"}` with an integrity checksum.
* **Safety:** scanned text is untrusted. It is length-limited, parsed as data only, validated against a strict Zod schema (unknown fields rejected), checked against the demo directory, and never executed or opened as a link.

## Reset

Profile → **Reset demo data**, or Judge walkthrough → Reset. This restores the seeded balances, history and coupons.

## Project structure

```
src/
  App.tsx              routes + accessibility attributes
  main.tsx
  router.ts            tiny hash router
  store.ts             persisted demo state (localStorage)
  session.ts           demo PIN session (sessionStorage)
  cart.tsx             food/shopping carts (UI state)
  nav.tsx              navigation + service tiles
  lib/                 business logic, no UI
    money.ts           paise maths, Indian formatting, words (EN/HI)
    ledger.ts          double-entry ledger, transfers, checkout, refunds, rewards, requests
    coupons.ts         coupon rules and validation
    pricing.ts         food/ticket/travel/hotel totals, refund policy
    qr.ts              QR payload schemas (Zod), encode/parse/validate
    qrimage.ts         QR generation (qrcode) and decoding (jsQR)
    ids.ts             ids, references, seeded PRNG, checksum
    download.ts        file saves (claude.ai downloads capability or browser)
    types.ts
  data/
    seed.ts            demo users, merchants, seeded history
    catalog.ts         sample travel, shows, restaurants, products, billers, transport
  components/          Shell, Login + intro, PaySheet, PinEntry, UI kit
  pages/               one file per module
  styles/app.css       design tokens and components
tests/
  unit/                ledger, coupons, pricing, QR, money, PIN component
  e2e/flows.spec.ts    the ten judge scenarios + mobile overflow
```

## Architecture notes

* **Why Vite + React + TypeScript and not Next.js + Prisma:** the hackathon demo has to run from a static link with no server, database or paid hosting. All business logic lives in pure, tested modules in `src/lib`, so it can move behind API route handlers and a database later without touching the UI.
* **Money:** whole paise only, with no floating point. Balances are always the sum of ledger entries. Every operation is a pure function returning a new state, so a failure can’t leave a half-updated wallet. Idempotency keys stop double charges from repeated clicks.
* **Persistence:** `localStorage`, per browser. It can be cleared, isn’t shared across devices and isn’t secure. That’s fine for a demo, and never acceptable for real money.

## Honest limitations

* Frontend-only demo: no server-side validation or real authorisation. **Not suitable for real financial transactions.** Real payments would need a licensed provider’s official sandbox, server-side verification and proper security review.
* Camera scanning is unavailable inside the claude.ai share link. Upload and sample codes work there, and the camera works on any HTTPS host.
* Notifications are in-app only. No SMS, email or push messages are sent.
* Schedules, fares, venues, menus and products are invented sample data, not live inventory.

## Deploying

Static hosting works anywhere:

* **Vercel:** import the repo, framework preset “Vite”, build `npm run build`, output `dist`.
* **Netlify:** build `npm run build`, publish directory `dist`.
* **GitHub Pages:** `npm run build`, then publish `dist/` (hash routing means no rewrite rules are needed).

HTTPS is required for camera scanning.
