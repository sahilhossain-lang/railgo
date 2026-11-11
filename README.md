# RailGo — Modern Railway Ticket Reservation System

A modern, responsive Railway Ticket Reservation web application built with semantic HTML5, custom CSS3, and pure Vanilla JavaScript ES6+.

Designed from high-fidelity Figma specifications with an authentic boarding-pass aesthetic, 3D interactive elements, and seamless responsive design.

---

## 🌟 Key Features

### 1. Route Search & Station Discovery (`index.html`)
- **Station Picker**: 16 major Indian railway stations (NDLS, MMCT, SBC, MAS, MAO, HWH, BSB, JP, ADI, SC, PUNE, LKO, ASR, PNBE, BPL, CDG) with live autocomplete and keyboard navigation.
- **Quick Destination Chips**: One-tap selection for popular journeys (e.g. Mumbai, Goa, Bengaluru, Chennai).
- **3D Interactive Swap (`⇄`)**: Smooth animated interchange between origin and destination stations.
- **Live Filter Sidebar**: Instant filtering by departure time slot (Early Morning, Morning, Afternoon, Evening), travel class (1A, 2A, 3A, CC, EC, SL), and train type (Rajdhani, Vande Bharat, Express, Superfast).
- **Dynamic Class Pricing Cards**: Real-time fare indicators, availability tags (`Available`, `Filling Fast`, `Waitlist`), and instant class selection.

### 2. Native Passenger Booking Dialog
- **Modal Controller**: Accessible HTML5 `<dialog>` component with smooth backdrop blur.
- **Dynamic Passenger Manifest (1–6 passengers)**: Add/remove passenger rows with name, age, gender, and berth preference (Lower, Middle, Upper, Side Lower, Side Upper).
- **Live Fare Calculator**: Real-time total calculation based on selected class base fare and active passenger count.

### 3. PNR Inquiry & Journey Timeline (`pnr.html`)
- **10-Digit PNR Lookup**: Validated lookup matching Indian Railways standard format.
- **3-Stage Vertical Journey Timeline**: Visual progression displaying Booked, Departure, and Arrival milestones with timings and stations.
- **Passenger Allocation Status**: Per-passenger coach, seat number, berth type, and confirmation status.

### 4. Boarding Pass E-Ticket & 3D Flip
- **Authentic Boarding Pass Design**: Ticket header, train metadata, perforation cutouts (notches), and QR code placeholder.
- **Pure CSS 3D Flip**: Tap/click to rotate 180° in 3D space (`perspective: 1400px; transform: rotateY(180deg)`) to reveal travel guidelines and baggage terms.
- **Single-Page PDF Print Output**: Optimized `@media print` layout isolating strictly the ticket card onto a clean A4 portrait sheet.

---

## 🛠️ Technology Stack

- **Markup**: HTML5 Semantic Architecture (Accessible landmarks, `<dialog>`, ARIA attributes)
- **Styling**: Custom CSS3 (Custom Properties / CSS Variables, Flexbox, CSS Grid, 3D Transforms, `@media print`)
- **Scripting**: Pure Vanilla JavaScript ES6+ (Zero external libraries or frameworks)
- **Fonts**: Bricolage Grotesque, DM Sans, JetBrains Mono (Google Fonts)

---

## 🚀 Getting Started

### Local Development
To run the static preview locally using Node.js:
```bash
node server.js
```
Then visit [http://localhost:3000](http://localhost:3000) in your browser.

Or open `frontend/index.html` directly in any modern web browser.

---

## 📁 Project Structure

```
railway/
├── frontend/
│   ├── assets/
│   │   ├── qr-placeholder.svg
│   │   ├── train-hero.svg
│   │   └── train-marker.svg
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   └── tokens.css
│   ├── js/
│   │   ├── api.js
│   │   ├── booking.js
│   │   ├── search.js
│   │   └── ticket.js
│   ├── index.html
│   └── pnr.html
├── .gitignore
├── README.md
└── server.js
```

---

## 📄 License
MIT License.
