# RailGo — Full-Stack Railway Ticket Reservation System

A full-stack Railway Ticket Reservation web application built with semantic **HTML5**, custom **CSS3**, pure **Vanilla JavaScript ES6+**, **Core PHP 8+ OOP**, **Object-Oriented PDO**, and a **MySQL** database (`railway_db`), fully compatible with **XAMPP**.

Designed with authentic Indian Railways boarding-pass aesthetics, 3D interactive elements, atomic InnoDB transactions, pessimistic concurrency locking (`SELECT FOR UPDATE`), and secure REST JSON APIs.

---

## 🌟 Key Features

### 1. Route Search & Station Discovery (`index.html`)
- **Station Picker**: 16 major Indian railway stations (NDLS, MMCT, SBC, MAS, MAO, HWH, BSB, JP, ADI, SC, PUNE, LKO, ASR, PNBE, BPL, CDG) with live autocomplete and keyboard navigation.
- **Quick Destination Chips**: One-tap selection for popular journeys (e.g. Mumbai, Goa, Bengaluru, Chennai).
- **3D Interactive Swap (`⇄`)**: Smooth animated interchange between origin and destination stations.
- **Live Filter Sidebar**: Instant filtering by departure time slot (Early Morning, Morning, Afternoon, Evening), travel class (1A, 2A, 3A, CC, EC, SL), and train type (Rajdhani, Vande Bharat, Express, Superfast).
- **Dynamic Class Pricing Cards**: Real-time fare indicators, availability tags (`Available`, `Filling Fast`, `Waitlist`), and instant class selection.

### 2. Native Passenger Booking Dialog & Booking Engine
- **Modal Controller**: Accessible HTML5 `<dialog>` component with smooth backdrop blur.
- **Dynamic Passenger Manifest (1–6 passengers)**: Add/remove passenger rows with name, age, gender, and berth preference (Lower, Middle, Upper, Side Lower, Side Upper).
- **Live Fare Calculator**: Real-time total calculation based on selected class base fare and active passenger count.
- **Atomic InnoDB Booking Engine**:
  - Pessimistic locking via `SELECT ... FOR UPDATE` on `train_seats` to eliminate race conditions and double-booking.
  - Server-side fare verification (`base_fare × count`).
  - Cryptographically secure 10-digit unique PNR generation (`random_int(1000000000, 9999999999)`).
  - Confirmed / RAC / Waitlist allocation logic.
  - Coach & berth allocation respecting preferences.
  - Automatic rollback on any failure.

### 3. PNR Inquiry & Journey Timeline (`pnr.html`)
- **10-Digit PNR Lookup**: Validated lookup matching Indian Railways standard format.
- **Sliding-Window Rate Limiting**: Protects PNR lookups against brute-force attacks.
- **3-Stage Vertical Journey Timeline**: Visual progression displaying Booked, Departure, and Arrival milestones with timings and stations.
- **Passenger Allocation Status**: Per-passenger coach, seat number, berth type, and confirmation status.

### 4. Boarding Pass E-Ticket & 3D Flip
- **Authentic Boarding Pass Design**: Ticket header, train metadata, perforation cutouts (notches), and QR code placeholder.
- **Pure CSS 3D Flip**: Tap/click to rotate 180° in 3D space (`perspective: 1400px; transform: rotateY(180deg)`) to reveal travel guidelines and baggage terms.
- **Single-Page PDF Print Output**: Optimized `@media print` layout isolating strictly the ticket card onto a clean A4 portrait sheet.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | HTML5 Semantic Markup | `<dialog>`, semantic landmark tags, ARIA attributes |
| **Styling** | Custom CSS3 | CSS Variables, Flexbox, Grid stack, 3D Transforms, `@media print` |
| **Client Scripting** | Pure Vanilla JavaScript ES6+ | Fetch API, zero dependencies, no React/Vue/jQuery/Bootstrap |
| **Backend** | Core PHP 8+ OOP | Strict typing, singleton PDO, prepared statements |
| **Database** | MySQL 8.0+ / MariaDB 10.4+ (`railway_db`) | InnoDB engine, utf8mb4, foreign keys with cascade |
| **Architecture** | Modular REST JSON APIs | `api/search_trains.php`, `book_ticket.php`, `check_pnr.php`, etc. |
| **Environment** | XAMPP | Compatible with Apache and MySQL on port 3306 |

---

## 🗄️ Database Architecture (`database/schema.sql`)

- **`users`**: User authentication, bcrypt password hashing, roles.
- **`trains`**: Master catalog of trains, routes, schedules, slots, and categories.
- **`train_seats`**: Class pricing, available seats, RAC, and waitlist counters.
- **`bookings`**: Unique 10-digit PNR, user ID, journey date, coach, total fare, status.
- **`passengers`**: Manifest linked to bookings with assigned coach, seat number, berth, and status.

---

## 🚀 XAMPP Quick Start

For detailed step-by-step setup instructions, see **[XAMPP_SETUP.md](XAMPP_SETUP.md)**.

1. Copy the `railway` folder to `C:\xampp\htdocs\railway\`.
2. Start **Apache** and **MySQL** in XAMPP Control Panel.
3. Open `http://localhost/phpmyadmin/` and import `database/schema.sql`.
4. Open the app at [http://localhost/railway/frontend/index.html](http://localhost/railway/frontend/index.html).

---

## 🧪 Automated Testing

Run the test suite directly from the command line:
```bash
php tests/test_backend.php
```

---

## 📁 Project Structure

```
railway/
├── api/
│   ├── auth_check.php        # GET: Current session and CSRF token
│   ├── booking_history.php   # GET: Booking history for user
│   ├── book_ticket.php       # POST: Atomic ticket booking
│   ├── cancel_ticket.php     # POST: Cancellation and seat restoration
│   ├── check_pnr.php         # GET: PNR status inquiry with rate limit
│   ├── login.php             # POST: Secure session login
│   ├── logout.php            # POST: Session termination
│   ├── register.php          # POST: User account registration
│   └── search_trains.php     # GET: Train search with live filters
├── backend/
│   ├── config/
│   │   ├── config.php        # DB constants, CORS, JSON response, CSRF
│   │   └── Database.php      # Singleton PDO connection manager
│   └── models/
│       ├── Booking.php       # Booking engine, transactions, PNR, cancel
│       ├── Train.php         # Route matching, pricing, class inventory
│       └── User.php          # Auth, password hashing, sessions
├── database/
│   └── schema.sql            # Complete MySQL database schema & seed data
├── frontend/
│   ├── assets/               # SVGs (train-hero, marker, QR code)
│   ├── css/                  # tokens.css, base.css, components.css
│   ├── js/                   # api.js, booking.js, search.js, ticket.js
│   ├── index.html            # Train search & booking page
│   └── pnr.html              # PNR status & 3D boarding pass E-ticket
├── tests/
│   └── test_backend.php      # Automated unit & verification test suite
├── .gitignore
├── README.md
├── server.js                 # Static development preview server
└── XAMPP_SETUP.md            # Detailed XAMPP step-by-step guide
```

---

## 📄 License
MIT License.
