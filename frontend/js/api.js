/**
 * RailGo API Client
 * Configurable base URL, fetch methods with async/await, and realistic multi-route mock fallback.
 */

const RailGoAPI = (() => {
  // Configuration: Auto-detects /railway prefix when running inside XAMPP
  let BASE_URL = typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/railway')
    ? '/railway'
    : '';
  let USE_MOCK_FALLBACK = true;

  /**
   * Safe HTML Escaper to prevent XSS when inserting server data into DOM.
   * @param {string|number} str
   * @returns {string}
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Multi-route mock train schedules for India
  const ROUTE_SCHEDULES = {
    // New Delhi -> Mumbai
    "NDLS_MMCT": [
      {
        id: "12952",
        name: "Mumbai Rajdhani",
        number: "12952",
        type: "Rajdhani",
        category_tag: "RAJDHANI · RUNS DAILY",
        hint: "Fastest overnight",
        from_code: "NDLS", from_name: "New Delhi",
        to_code: "MMCT", to_name: "Mumbai Central",
        departure_time: "16:55", arrival_time: "08:35", duration: "15h 40m",
        departure_slot: "afternoon", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1895, status: "available", seats: 42, label: "✓ Available · 42" },
          "2A": { name: "2A · AC 2 tier", fare: 2650, status: "warning", seats: 12, label: "◷ Seats left: 12" },
          "1A": { name: "1A · AC 1st Class", fare: 4550, status: "waitlist", seats: 8, label: "! Waitlist · 8" },
          "SL": { name: "Sleeper Class", fare: 650, status: "soldout", seats: 0, label: "— Sold out" }
        }
      },
      {
        id: "12954",
        name: "August Kranti Rajdhani",
        number: "12954",
        type: "Rajdhani",
        category_tag: "RAJDHANI · RUNS DAILY",
        hint: "A little more time to unwind",
        from_code: "NDLS", from_name: "New Delhi",
        to_code: "MMCT", to_name: "Mumbai Central",
        departure_time: "17:15", arrival_time: "10:05", duration: "16h 50m",
        departure_slot: "afternoon", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1895, status: "available", seats: 36, label: "✓ Available · 36" },
          "2A": { name: "2A · AC 2 tier", fare: 2650, status: "available", seats: 18, label: "✓ Available · 18" },
          "1A": { name: "1A · AC 1st Class", fare: 4550, status: "warning", seats: 4, label: "◷ Seats left: 4" },
          "SL": { name: "Sleeper Class", fare: 650, status: "soldout", seats: 0, label: "— Sold out" }
        }
      },
      {
        id: "12926",
        name: "Paschim Express",
        number: "12926",
        type: "Express",
        category_tag: "EXPRESS · RUNS DAILY",
        hint: "The scenic way south",
        from_code: "NDLS", from_name: "New Delhi",
        to_code: "MMCT", to_name: "Mumbai Central",
        departure_time: "16:45", arrival_time: "14:55", duration: "22h 10m",
        departure_slot: "afternoon", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1540, status: "available", seats: 75, label: "✓ Available · 75" },
          "2A": { name: "2A · AC 2 tier", fare: 2210, status: "available", seats: 24, label: "✓ Available · 24" },
          "1A": { name: "1A · AC 1st Class", fare: 3780, status: "warning", seats: 5, label: "◷ Seats left: 5" },
          "SL": { name: "Sleeper Class", fare: 590, status: "available", seats: 110, label: "✓ Available · 110" },
          "2S": { name: "Second Sitting", fare: 340, status: "available", seats: 95, label: "✓ Available · 95" }
        }
      },
      {
        id: "20901",
        name: "Vande Bharat Express",
        number: "20901",
        type: "Vande Bharat",
        category_tag: "VANDE BHARAT · EXCEPT SUN",
        hint: "High-speed comfortable seating",
        from_code: "NDLS", from_name: "New Delhi",
        to_code: "MMCT", to_name: "Mumbai Central",
        departure_time: "06:00", arrival_time: "18:15", duration: "12h 15m",
        departure_slot: "morning", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 2450, status: "available", seats: 58, label: "✓ Available · 58" },
          "EC": { name: "Exec Chair Car", fare: 4100, status: "warning", seats: 8, label: "◷ Seats left: 8" }
        }
      },
      {
        id: "12903",
        name: "Golden Temple Mail",
        number: "12903",
        type: "Superfast",
        category_tag: "SUPERFAST · RUNS DAILY",
        hint: "Historic heritage connection",
        from_code: "NDLS", from_name: "New Delhi",
        to_code: "MMCT", to_name: "Mumbai Central",
        departure_time: "21:25", arrival_time: "18:45", duration: "21h 20m",
        departure_slot: "evening", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1620, status: "available", seats: 28, label: "✓ Available · 28" },
          "2A": { name: "2A · AC 2 tier", fare: 2340, status: "warning", seats: 6, label: "◷ Seats left: 6" },
          "SL": { name: "Sleeper Class", fare: 610, status: "available", seats: 45, label: "✓ Available · 45" }
        }
      }
    ],

    // Mumbai -> Goa
    "MMCT_MAO": [
      {
        id: "22229",
        name: "Madgaon Vande Bharat Express",
        number: "22229",
        type: "Vande Bharat",
        category_tag: "VANDE BHARAT · EXCEPT FRI",
        hint: "Fastest morning scenic ride",
        from_code: "CSMT", from_name: "Mumbai",
        to_code: "MAO", to_name: "Madgaon (Goa)",
        departure_time: "05:25", arrival_time: "13:10", duration: "7h 45m",
        departure_slot: "night", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 1815, status: "available", seats: 46, label: "✓ Available · 46" },
          "EC": { name: "Exec Chair Car", fare: 3355, status: "warning", seats: 9, label: "◷ Seats left: 9" }
        }
      },
      {
        id: "20111",
        name: "Konkan Kanya Express",
        number: "20111",
        type: "Superfast",
        category_tag: "SUPERFAST · RUNS DAILY",
        hint: "Overnight through the Konkan coast",
        from_code: "CSMT", from_name: "Mumbai",
        to_code: "MAO", to_name: "Madgaon (Goa)",
        departure_time: "23:05", arrival_time: "10:45", duration: "11h 40m",
        departure_slot: "evening", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1045, status: "available", seats: 64, label: "✓ Available · 64" },
          "2A": { name: "2A · AC 2 tier", fare: 1485, status: "available", seats: 18, label: "✓ Available · 18" },
          "1A": { name: "1A · AC 1st Class", fare: 2475, status: "warning", seats: 4, label: "◷ Seats left: 4" },
          "SL": { name: "Sleeper Class", fare: 385, status: "available", seats: 120, label: "✓ Available · 120" }
        }
      },
      {
        id: "10103",
        name: "Mandovi Express",
        number: "10103",
        type: "Express",
        category_tag: "EXPRESS · RUNS DAILY",
        hint: "Daytime vistas of the Western Ghats",
        from_code: "CSMT", from_name: "Mumbai",
        to_code: "MAO", to_name: "Madgaon (Goa)",
        departure_time: "07:10", arrival_time: "19:10", duration: "12h 00m",
        departure_slot: "morning", next_day: false,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 990, status: "available", seats: 52, label: "✓ Available · 52" },
          "2A": { name: "2A · AC 2 tier", fare: 1410, status: "warning", seats: 7, label: "◷ Seats left: 7" },
          "SL": { name: "Sleeper Class", fare: 360, status: "available", seats: 84, label: "✓ Available · 84" },
          "2S": { name: "Second Sitting", fare: 215, status: "available", seats: 130, label: "✓ Available · 130" }
        }
      }
    ],

    // Bengaluru -> Chennai
    "SBC_MAS": [
      {
        id: "20608",
        name: "Mysuru - Chennai Vande Bharat",
        number: "20608",
        type: "Vande Bharat",
        category_tag: "VANDE BHARAT · EXCEPT WED",
        hint: "Fastest intercity express",
        from_code: "SBC", from_name: "Bengaluru City",
        to_code: "MAS", to_name: "Chennai Central",
        departure_time: "14:50", arrival_time: "19:20", duration: "4h 30m",
        departure_slot: "afternoon", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 995, status: "available", seats: 72, label: "✓ Available · 72" },
          "EC": { name: "Exec Chair Car", fare: 1885, status: "available", seats: 15, label: "✓ Available · 15" }
        }
      },
      {
        id: "12028",
        name: "Bengaluru - Chennai Shatabdi",
        number: "12028",
        type: "Superfast",
        category_tag: "SHATABDI · EXCEPT TUE",
        hint: "Premier business schedule with meals",
        from_code: "SBC", from_name: "Bengaluru City",
        to_code: "MAS", to_name: "Chennai Central",
        departure_time: "06:00", arrival_time: "11:00", duration: "5h 00m",
        departure_slot: "morning", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 810, status: "available", seats: 88, label: "✓ Available · 88" },
          "EC": { name: "Exec Chair Car", fare: 1560, status: "warning", seats: 11, label: "◷ Seats left: 11" }
        }
      },
      {
        id: "12640",
        name: "Brindavan Express",
        number: "12640",
        type: "Express",
        category_tag: "EXPRESS · RUNS DAILY",
        hint: "The classic daily commuter route",
        from_code: "SBC", from_name: "Bengaluru City",
        to_code: "MAS", to_name: "Chennai Central",
        departure_time: "15:10", arrival_time: "21:15", duration: "6h 05m",
        departure_slot: "afternoon", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 485, status: "available", seats: 95, label: "✓ Available · 95" },
          "2S": { name: "Second Sitting", fare: 145, status: "available", seats: 210, label: "✓ Available · 210" }
        }
      }
    ]
  };

  // Helper: extract 3-4 letter code from "City (CODE)"
  function extractCode(str) {
    if (!str) return '';
    const match = str.match(/\(([A-Z0-9]+)\)/);
    if (match) return match[1];
    return str.trim().toUpperCase().slice(0, 4);
  }

  function extractCleanName(str) {
    if (!str) return '';
    return str.replace(/\s*\([A-Z0-9]+\)/, '').trim();
  }

  // Generate dynamic trains for ANY other custom route pair
  function generateCustomRouteTrains(fromStr, toStr) {
    const fromName = extractCleanName(fromStr) || 'Origin';
    const toName = extractCleanName(toStr) || 'Destination';
    const fromCode = extractCode(fromStr) || 'ORIG';
    const toCode = extractCode(toStr) || 'DEST';

    return [
      {
        id: "12001",
        name: `${toName} Superfast Express`,
        number: "12001",
        type: "Superfast",
        category_tag: "SUPERFAST · RUNS DAILY",
        hint: `Direct connect between ${fromName} and ${toName}`,
        from_code: fromCode, from_name: fromName,
        to_code: toCode, to_name: toName,
        departure_time: "07:30", arrival_time: "17:15", duration: "9h 45m",
        departure_slot: "morning", next_day: false,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1250, status: "available", seats: 48, label: "✓ Available · 48" },
          "2A": { name: "2A · AC 2 tier", fare: 1780, status: "available", seats: 16, label: "✓ Available · 16" },
          "SL": { name: "Sleeper Class", fare: 420, status: "available", seats: 92, label: "✓ Available · 92" }
        }
      },
      {
        id: "22015",
        name: `${toName} Vande Bharat`,
        number: "22015",
        type: "Vande Bharat",
        category_tag: "VANDE BHARAT · EXCEPT WED",
        hint: "High-speed comfortable day service",
        from_code: fromCode, from_name: fromName,
        to_code: toCode, to_name: toName,
        departure_time: "14:15", arrival_time: "20:45", duration: "6h 30m",
        departure_slot: "afternoon", next_day: false,
        classes: {
          "CC": { name: "AC Chair Car", fare: 1450, status: "available", seats: 62, label: "✓ Available · 62" },
          "EC": { name: "Exec Chair Car", fare: 2650, status: "warning", seats: 8, label: "◷ Seats left: 8" }
        }
      },
      {
        id: "12999",
        name: `${fromName} - ${toName} Express`,
        number: "12999",
        type: "Express",
        category_tag: "EXPRESS · RUNS DAILY",
        hint: "Convenient overnight journey",
        from_code: fromCode, from_name: fromName,
        to_code: toCode, to_name: toName,
        departure_time: "21:00", arrival_time: "08:20", duration: "11h 20m",
        departure_slot: "evening", next_day: true,
        classes: {
          "3A": { name: "3A · AC 3 tier", fare: 1350, status: "available", seats: 34, label: "✓ Available · 34" },
          "2A": { name: "2A · AC 2 tier", fare: 1950, status: "warning", seats: 6, label: "◷ Seats left: 6" },
          "1A": { name: "1A · AC 1st Class", fare: 3200, status: "waitlist", seats: 4, label: "! Waitlist · 4" },
          "SL": { name: "Sleeper Class", fare: 460, status: "available", seats: 78, label: "✓ Available · 78" }
        }
      }
    ];
  }

  // Session storage bookings store
  let memoryStore = {};

  function getBookingsStore() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const data = sessionStorage.getItem('railgo_bookings');
        return data ? JSON.parse(data) : {};
      }
      return memoryStore;
    } catch {
      return memoryStore;
    }
  }

  function saveBooking(pnr, booking) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const store = getBookingsStore();
        store[pnr] = booking;
        sessionStorage.setItem('railgo_bookings', JSON.stringify(store));
      }
      memoryStore[pnr] = booking;
    } catch (e) {
      console.warn('Could not store booking in sessionStorage', e);
    }
  }

  // Default seed booking for Figma PNR: 4827361950
  const DEFAULT_PNR_BOOKING = {
    pnr: "4827361950",
    train_id: "12952",
    train_name: "Mumbai Rajdhani",
    train_number: "12952",
    class_code: "3A",
    class_name: "3A · AC 3 tier",
    from_name: "New Delhi",
    to_name: "Mumbai Central",
    departure_time: "16:55",
    departure_date: "20 Nov 2026",
    arrival_time: "08:35",
    arrival_date: "21 Nov 2026",
    duration: "15h 40m",
    coach: "B4",
    status: "Confirmed",
    status_label: "✓ Confirmed",
    booking_date: "10 Nov 2026 · 12:42",
    passengers: [
      { name: "Aanya Sharma", age: 28, gender: "F", berth_pref: "Lower", coach: "B4", seat: "21", status: "✓ Confirmed" },
      { name: "Rohan Mehta", age: 29, gender: "M", berth_pref: "Upper", coach: "B4", seat: "22", status: "✓ Confirmed" },
      { name: "Meera Iyer", age: 30, gender: "F", berth_pref: "Lower", coach: "B4", seat: "23", status: "✓ Confirmed" },
      { name: "Arjun Rao", age: 31, gender: "M", berth_pref: "Upper", coach: "B4", seat: "24", status: "✓ Confirmed" },
      { name: "Kavya Nair", age: 32, gender: "F", berth_pref: "Lower", coach: "B4", seat: "25", status: "✓ Confirmed" },
      { name: "Dev Patel", age: 33, gender: "M", berth_pref: "Upper", coach: "B4", seat: "26", status: "✓ Confirmed" }
    ]
  };

  if (!getBookingsStore()["4827361950"]) {
    saveBooking("4827361950", DEFAULT_PNR_BOOKING);
  }

  /**
   * Search Trains API
   * GET /api/search_trains.php?from=&to=&date=&class=
   */
  async function searchTrains(params = {}) {
    const { from = 'New Delhi (NDLS)', to = 'Mumbai Central (MMCT)', date = '20 Nov 2026', travelClass = 'all' } = params;

    // 1. Attempt Real PHP Backend API
    try {
      const query = new URLSearchParams({
        from: from,
        to: to,
        date: date,
        class: travelClass
      });
      const res = await fetch(`${BASE_URL}/api/search_trains.php?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          return {
            status: 'success',
            total: json.data.length,
            from: from,
            to: to,
            date: date,
            class: travelClass,
            trains: json.data,
            data: json.data
          };
        }
      }
    } catch (err) {
      console.info('Backend search API unavailable, using offline fallback:', err.message);
    }

    // Mock network delay
    await new Promise(r => setTimeout(r, 380));

    const fromCode = extractCode(from);
    const toCode = extractCode(to);
    const routeKey = `${fromCode}_${toCode}`;
    const reverseRouteKey = `${toCode}_${fromCode}`;

    let results = [];

    if (ROUTE_SCHEDULES[routeKey]) {
      results = ROUTE_SCHEDULES[routeKey].map(t => ({ ...t }));
    } else if (ROUTE_SCHEDULES[reverseRouteKey]) {
      // Swapped route
      results = ROUTE_SCHEDULES[reverseRouteKey].map(t => ({
        ...t,
        from_code: toCode, from_name: extractCleanName(from),
        to_code: fromCode, to_name: extractCleanName(to)
      }));
    } else {
      // Dynamically generate realistic trains for any chosen stations
      results = generateCustomRouteTrains(from, to);
    }

    // Filter by class if selected
    if (travelClass && travelClass !== 'all') {
      results = results.filter(t => t.classes && t.classes[travelClass]);
    }

    return {
      status: 'success',
      total: results.length,
      from: from,
      to: to,
      date: date,
      class: travelClass,
      trains: results,
      data: results
    };
  }

  /**
   * Book Ticket API
   * POST /api/book_ticket.php
   */
  async function bookTicket(bookingData) {
    // 1. Attempt Real PHP Backend API
    try {
      const res = await fetch(`${BASE_URL}/api/book_ticket.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          saveBooking(json.data.pnr, json.data);
          return {
            status: 'success',
            pnr: json.data.pnr,
            ticket: json.data,
            data: json.data
          };
        }
      }
    } catch (err) {
      console.info('Backend book API unavailable, using offline booking engine:', err.message);
    }

    // Mock network latency
    await new Promise(r => setTimeout(r, 650));

    const random10DigitPNR = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const coachPrefix = bookingData.class_code === '1A' ? 'H1' :
                        bookingData.class_code === '2A' ? 'A1' :
                        bookingData.class_code === '3A' ? 'B4' :
                        bookingData.class_code === 'CC' ? 'C1' : 'S1';

    const assignedPassengers = (bookingData.passengers || []).map((p, idx) => ({
      name: p.name,
      age: p.age,
      gender: p.gender,
      berth_pref: p.berth_pref || 'No preference',
      coach: coachPrefix,
      seat: String(18 + idx),
      status: '✓ Confirmed'
    }));

    const newTicket = {
      pnr: random10DigitPNR,
      train_id: bookingData.train_id || "12952",
      train_name: bookingData.train_name || "Mumbai Rajdhani",
      train_number: bookingData.train_number || "12952",
      class_code: bookingData.class_code,
      class_name: `${bookingData.class_code} Class`,
      from_name: bookingData.from_name || "New Delhi",
      to_name: bookingData.to_name || "Mumbai Central",
      departure_time: bookingData.departure_time || "16:55",
      departure_date: bookingData.journey_date || "20 Nov 2026",
      arrival_time: bookingData.arrival_time || "08:35",
      arrival_date: "21 Nov 2026",
      duration: bookingData.duration || "15h 40m",
      coach: coachPrefix,
      status: "Confirmed",
      status_label: "✓ Confirmed",
      booking_date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' +
                    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      passengers: assignedPassengers,
      total_fare: (bookingData.base_fare || 1895) * assignedPassengers.length
    };

    saveBooking(random10DigitPNR, newTicket);

    return {
      status: 'success',
      pnr: random10DigitPNR,
      ticket: newTicket,
      data: newTicket
    };
  }

  /**
   * Check PNR Status API
   * GET /api/check_pnr.php?pnr=
   */
  async function checkPNR(pnr) {
    const cleanPNR = String(pnr).trim();

    // 1. Attempt Real PHP Backend API
    try {
      const res = await fetch(`${BASE_URL}/api/check_pnr.php?pnr=${encodeURIComponent(cleanPNR)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          saveBooking(cleanPNR, json.data);
          return {
            status: 'success',
            pnr: cleanPNR,
            data: json.data
          };
        }
      }
    } catch (err) {
      console.info('Backend check PNR unavailable, using offline store:', err.message);
    }

    await new Promise(r => setTimeout(r, 450));

    const store = getBookingsStore();

    if (store[cleanPNR]) {
      return {
        status: 'success',
        pnr: cleanPNR,
        data: store[cleanPNR]
      };
    }

    if (/^\d{10}$/.test(cleanPNR)) {
      const generated = {
        pnr: cleanPNR,
        train_id: "12952",
        train_name: "Mumbai Rajdhani",
        train_number: "12952",
        class_code: "3A",
        class_name: "3A · AC 3 tier",
        from_name: "New Delhi",
        to_name: "Mumbai Central",
        departure_time: "16:55",
        departure_date: "20 Nov 2026",
        arrival_time: "08:35",
        arrival_date: "21 Nov 2026",
        duration: "15h 40m",
        coach: "B4",
        status: "Confirmed",
        status_label: "✓ Confirmed",
        booking_date: "10 Nov 2026 · 12:42",
        passengers: [
          { name: "Passenger 1", age: 30, gender: "M", berth_pref: "Lower", coach: "B4", seat: "21", status: "✓ Confirmed" }
        ]
      };
      saveBooking(cleanPNR, generated);
      return {
        status: 'success',
        pnr: cleanPNR,
        data: generated
      };
    }

    return {
      status: 'error',
      message: 'Invalid PNR number or record not found.'
    };
  }

  /**
   * Cancel Ticket API
   * POST /api/cancel_ticket.php
   */
  async function cancelTicket(pnr) {
    const cleanPNR = String(pnr).trim();
    try {
      const res = await fetch(`${BASE_URL}/api/cancel_ticket.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnr: cleanPNR })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Local fallback
    }

    const store = getBookingsStore();
    if (store[cleanPNR]) {
      store[cleanPNR].status = 'Cancelled';
      store[cleanPNR].status_label = 'Cancelled';
      (store[cleanPNR].passengers || []).forEach(p => p.status = 'Cancelled');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return { status: 'success', message: 'Ticket cancelled successfully.' };
    }
    return { status: 'error', message: 'Record not found to cancel.' };
  }

  /**
   * Booking History API
   * GET /api/booking_history.php
   */
  async function getBookingHistory(limit = 10) {
    try {
      const res = await fetch(`${BASE_URL}/api/booking_history.php?limit=${limit}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const store = getBookingsStore();
    return {
      status: 'success',
      data: Object.values(store)
    };
  }

  /**
   * Auth APIs
   */
  async function login(email, password) {
    const res = await fetch(`${BASE_URL}/api/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  }

  async function register(name, email, password) {
    const res = await fetch(`${BASE_URL}/api/register.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    return await res.json();
  }

  async function logout() {
    const res = await fetch(`${BASE_URL}/api/logout.php`, { method: 'POST' });
    return await res.json();
  }

  async function checkAuth() {
    const res = await fetch(`${BASE_URL}/api/auth_check.php`);
    return await res.json();
  }

  /**
   * Fast Station Search Across All 8,990 Stations
   */
  async function getStations(query = '', limit = 25) {
    try {
      const res = await fetch(`${BASE_URL}/api/get_stations.php?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {}

    // Fallback to loading stations_index.json
    try {
      const res = await fetch(`${BASE_URL}/frontend/assets/stations_index.json`);
      if (res.ok) {
        const all = await res.json();
        const qLower = query.toLowerCase().trim();
        if (!qLower) return all.slice(0, limit);
        return all.filter(s =>
          (s.name && s.name.toLowerCase().includes(qLower)) ||
          (s.code && s.code.toLowerCase().includes(qLower))
        ).slice(0, limit);
      }
    } catch (e) {}

    return [];
  }

  return {
    setBaseUrl: (url) => { BASE_URL = url; },
    setUseMock: (flag) => { USE_MOCK_FALLBACK = Boolean(flag); },
    getUseMock: () => USE_MOCK_FALLBACK,
    escapeHTML,
    searchTrains,
    bookTicket,
    checkPNR,
    cancelTicket,
    getBookingHistory,
    login,
    register,
    logout,
    checkAuth,
    getStations
  };
})();

// Attach to window and module exports
if (typeof window !== 'undefined') {
  window.RailGoAPI = RailGoAPI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RailGoAPI;
}
