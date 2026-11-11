/**
 * RailGo Ticket & PNR Controller
 * Handles 10-digit PNR validation, journey timeline rendering,
 * pure CSS 3D boarding-pass ticket flip, and @media print activation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Reduced Motion Preference
  const motionToggleBtn = document.getElementById('motion-toggle-btn');
  const savedMotion = localStorage.getItem('railgo_reduced_motion');

  if (savedMotion === 'true') {
    document.documentElement.classList.add('reduced-motion');
    if (motionToggleBtn) {
      motionToggleBtn.classList.add('active');
      motionToggleBtn.setAttribute('aria-pressed', 'true');
    }
  }

  if (motionToggleBtn) {
    motionToggleBtn.addEventListener('click', () => {
      const isReduced = document.documentElement.classList.toggle('reduced-motion');
      localStorage.setItem('railgo_reduced_motion', isReduced);
      motionToggleBtn.classList.toggle('active', isReduced);
      motionToggleBtn.setAttribute('aria-pressed', isReduced);
    });
  }

  // 2. Elements
  const pnrForm = document.getElementById('pnr-search-form');
  const pnrInput = document.getElementById('pnr-input');
  const pnrHelper = document.getElementById('pnr-helper-message');
  const pnrResultSection = document.getElementById('pnr-result-section');
  const ticketSection = document.getElementById('ticket') || document.getElementById('ticket-view-section');
  const myBookingsSection = document.getElementById('my-bookings-section');
  const myBookingsChips = document.getElementById('my-bookings-chips');
  const myBookingsBadge = document.getElementById('my-bookings-badge');
  const emptyTicketsSection = document.getElementById('empty-tickets-section');

  // Timeline elements
  const timelineTrainTitle = document.getElementById('tl-train-title');
  const timelineTrainMeta = document.getElementById('tl-train-meta');
  const tlStepBookedTime = document.getElementById('tl-booked-time');
  const tlStepDepStation = document.getElementById('tl-dep-station');
  const tlStepDepTime = document.getElementById('tl-dep-time');
  const tlStepArrStation = document.getElementById('tl-arr-station');
  const tlStepArrTime = document.getElementById('tl-arr-time');
  const pnrPassengerList = document.getElementById('pnr-passenger-status-list');

  // Ticket elements
  const ticketScene = document.getElementById('ticket-3d-scene');
  const flipToBackBtn = document.getElementById('btn-flip-to-back');
  const flipToFrontBtn = document.getElementById('btn-flip-to-front');
  const printTicketBtn = document.getElementById('btn-print-ticket');

  const ticketTrainName = document.getElementById('ticket-train-name');
  const ticketTrainNumber = document.getElementById('ticket-train-number');
  const ticketClass = document.getElementById('ticket-class');
  const ticketDepTime = document.getElementById('ticket-dep-time');
  const ticketArrTime = document.getElementById('ticket-arr-time');
  const ticketDuration = document.getElementById('ticket-duration');
  const ticketFromStation = document.getElementById('ticket-from-station');
  const ticketToStation = document.getElementById('ticket-to-station');
  const ticketDepDate = document.getElementById('ticket-dep-date');
  const ticketCoach = document.getElementById('ticket-coach');
  const ticketArrDate = document.getElementById('ticket-arr-date');
  const ticketManifestList = document.getElementById('ticket-manifest-list');
  const ticketPnrDisplay = document.getElementById('ticket-pnr-display');
  const ticketBackPnr = document.getElementById('ticket-back-pnr');

  // Restrict input to digits only & max 10 chars
  if (pnrInput) {
    pnrInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      if (e.target.value.length === 10) {
        pnrHelper.className = 'pnr-helper-text';
        pnrHelper.textContent = 'Ready to check PNR status.';
      } else {
        pnrHelper.className = 'pnr-helper-text';
        pnrHelper.textContent = 'Enter your 10-digit PNR found on your booking.';
      }
    });
  }

  // 3. PNR Form Submission
  if (pnrForm) {
    pnrForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pnr = pnrInput.value.trim();
      executePNRLookup(pnr, true);
    });
  }

  async function executePNRLookup(pnr, shouldScroll = true) {
    // Validate exactly 10 digits
    if (!/^\d{10}$/.test(pnr)) {
      pnrHelper.className = 'pnr-helper-text error';
      pnrHelper.textContent = '! Enter a valid 10-digit PNR.';
      pnrInput.focus();
      return;
    }

    pnrHelper.className = 'pnr-helper-text';
    pnrHelper.textContent = 'Checking PNR and passenger status…';

    const submitBtn = pnrForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Checking…';
    }

    try {
      const res = await RailGoAPI.checkPNR(pnr);

      if (res.status === 'success' && res.data) {
        renderPNRStatus(res.data);
        renderTicket(res.data);

        pnrHelper.textContent = 'Find your PNR on your ticket or booking message.';
        pnrResultSection.style.display = 'block';
        ticketSection.style.display = 'block';
        if (emptyTicketsSection) emptyTicketsSection.style.display = 'none';

        localStorage.setItem('railgo_last_pnr', pnr);
        if (myBookingsChips) {
          myBookingsChips.querySelectorAll('.my-booking-chip').forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-pnr') === pnr);
          });
        }

        if (shouldScroll) {
          if (window.location.hash === '#ticket' && ticketSection) {
            setTimeout(() => {
              ticketSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
          } else if (pnrResultSection) {
            setTimeout(() => {
              pnrResultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
          }
        }
      } else {
        pnrResultSection.style.display = 'none';
        ticketSection.style.display = 'none';
        pnrHelper.className = 'pnr-helper-text error';
        pnrHelper.textContent = res.message || '! No booking found for this PNR. Check number and try again.';
      }
    } catch (err) {
      console.error('PNR check failed:', err);
      pnrResultSection.style.display = 'none';
      ticketSection.style.display = 'none';
      pnrHelper.className = 'pnr-helper-text error';
      pnrHelper.textContent = '! An error occurred while checking PNR. Please retry.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Check PNR';
      }
    }
  }

  function renderPNRStatus(data) {
    const realArrDate = (data.arrival_date && data.arrival_date !== data.departure_date)
      ? data.arrival_date
      : (RailGoAPI.calculateArrivalDate
          ? RailGoAPI.calculateArrivalDate(data.departure_date, data.departure_time, data.arrival_time, data.duration)
          : data.arrival_date);

    timelineTrainTitle.textContent = data.train_name;
    timelineTrainMeta.textContent = `${data.train_number} · ${data.class_name}`;
    tlStepBookedTime.textContent = data.booking_date || '10 Nov 2026 · 12:42';
    tlStepDepStation.textContent = `Departs · ${data.from_name}`;
    tlStepDepTime.textContent = `${data.departure_date} · ${data.departure_time}`;
    tlStepArrStation.textContent = `Arrives · ${data.to_name}`;
    tlStepArrTime.textContent = `${realArrDate} · ${data.arrival_time}`;

    // Render passengers
    pnrPassengerList.innerHTML = (data.passengers || []).map(p => `
      <div class="status-passenger-item">
        <div>
          <div class="status-p-name">${RailGoAPI.escapeHTML(p.name)}</div>
          <span class="status-pill confirmed">${RailGoAPI.escapeHTML(p.status || '✓ Confirmed')}</span>
        </div>
        <div class="status-p-berth">Coach ${RailGoAPI.escapeHTML(p.coach || data.coach)} / ${RailGoAPI.escapeHTML(p.seat)} / ${RailGoAPI.escapeHTML(p.berth_pref || 'Berth')}</div>
      </div>
    `).join('');
  }

  function renderTicket(data) {
    const realArrDate = (data.arrival_date && data.arrival_date !== data.departure_date)
      ? data.arrival_date
      : (RailGoAPI.calculateArrivalDate
          ? RailGoAPI.calculateArrivalDate(data.departure_date, data.departure_time, data.arrival_time, data.duration)
          : data.arrival_date);

    ticketTrainName.textContent = data.train_name;
    ticketTrainNumber.textContent = data.train_number;
    ticketClass.textContent = data.class_name;
    ticketDepTime.textContent = data.departure_time;
    ticketArrTime.textContent = data.arrival_time;
    ticketDuration.textContent = `${data.duration} →`;
    ticketFromStation.textContent = data.from_name;
    ticketToStation.textContent = data.to_name;
    ticketDepDate.textContent = data.departure_date;
    ticketCoach.textContent = data.coach || 'B4';
    ticketArrDate.textContent = realArrDate;
    ticketPnrDisplay.textContent = data.pnr;
    ticketBackPnr.textContent = data.pnr;

    // Render manifest table
    ticketManifestList.innerHTML = (data.passengers || []).map((p, idx) => {
      const ageNum = parseInt(p.age, 10);
      const cat = isNaN(ageNum) ? 'Adult' : (ageNum < 12 ? 'Child' : (ageNum >= 60 ? 'Senior' : 'Adult'));
      return `
      <div class="manifest-passenger-row">
        <div>
          <span class="manifest-p-name">${RailGoAPI.escapeHTML(p.name)}</span>
          <span class="manifest-p-detail">${RailGoAPI.escapeHTML(p.age || '')} · ${cat}</span>
        </div>
        <span class="manifest-p-seat">${RailGoAPI.escapeHTML(p.coach || data.coach)} / ${RailGoAPI.escapeHTML(p.seat || (20 + idx))} / ${RailGoAPI.escapeHTML(p.berth_pref || 'Lower')}</span>
      </div>
    `;
    }).join('');
  }

  // 4. Pure CSS 3D Ticket Flip
  if (flipToBackBtn && ticketScene) {
    flipToBackBtn.addEventListener('click', () => {
      ticketScene.classList.add('flipped');
    });
  }

  if (flipToFrontBtn && ticketScene) {
    flipToFrontBtn.addEventListener('click', () => {
      ticketScene.classList.remove('flipped');
    });
  }

  // 5. Print Ticket
  if (printTicketBtn) {
    printTicketBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 6. My Bookings Loader & Switcher
  async function loadMyBookings(activePnr) {
    if (!myBookingsSection || !myBookingsChips) return [];

    let bookings = [];

    // 1. Fetch from server API (MySQL)
    try {
      const res = await RailGoAPI.getBookingHistory(20);
      if (res && res.status === 'success' && Array.isArray(res.data)) {
        bookings = res.data;
      }
    } catch (e) {}

    // 2. Merge with localStorage store so recent bookings always show up
    try {
      const localStore = (RailGoAPI.getBookingsStore) ? RailGoAPI.getBookingsStore() : {};
      const serverPnrs = new Set(bookings.map(b => b.pnr));
      Object.keys(localStore).forEach(pnr => {
        if (!serverPnrs.has(pnr)) {
          bookings.push(localStore[pnr]);
        }
      });
    } catch (e) {}

    if (bookings.length === 0) {
      myBookingsSection.style.display = 'none';
      return [];
    }

    // Render bookings chips
    myBookingsSection.style.display = 'block';
    if (myBookingsBadge) {
      myBookingsBadge.textContent = `${bookings.length} ticket${bookings.length === 1 ? '' : 's'}`;
    }

    myBookingsChips.innerHTML = bookings.map(b => {
      const isActive = (b.pnr === activePnr);
      return `
        <button type="button" class="my-booking-chip ${isActive ? 'active' : ''}" data-pnr="${RailGoAPI.escapeHTML(b.pnr)}">
          <div class="chip-top">
            <span class="chip-train">${RailGoAPI.escapeHTML(b.train_number)} · ${RailGoAPI.escapeHTML(b.train_name)}</span>
            <span class="chip-status">${RailGoAPI.escapeHTML(b.status_label || '✓ Confirmed')}</span>
          </div>
          <div class="chip-route">${RailGoAPI.escapeHTML(b.from_name)} → ${RailGoAPI.escapeHTML(b.to_name)}</div>
          <div class="chip-meta">
            <span class="chip-date">${RailGoAPI.escapeHTML(b.departure_date)}</span>
            <span class="chip-pnr">PNR: ${RailGoAPI.escapeHTML(b.pnr)}</span>
          </div>
        </button>
      `;
    }).join('');

    // Attach click listeners to chips
    myBookingsChips.querySelectorAll('.my-booking-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pnr = chip.getAttribute('data-pnr');
        if (pnr) {
          pnrInput.value = pnr;
          myBookingsChips.querySelectorAll('.my-booking-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          executePNRLookup(pnr, true);
        }
      });
    });

    return bookings;
  }

  // 7. Handle URL query param: ?pnr=XXXXXXXXXX & "My tickets" Navigation
  const urlParams = new URLSearchParams(window.location.search);
  const paramPNR = urlParams.get('pnr');
  const hasTicketHash = window.location.hash === '#ticket';
  const savedLastPnr = localStorage.getItem('railgo_last_pnr');

  (async function initTicketPage() {
    const bookings = await loadMyBookings(paramPNR || savedLastPnr);

    if (paramPNR && /^\d{10}$/.test(paramPNR)) {
      pnrInput.value = paramPNR;
      executePNRLookup(paramPNR, hasTicketHash);
    } else if (bookings.length > 0) {
      // Automatically load and show the user's latest booking
      const targetPnr = (savedLastPnr && bookings.some(b => b.pnr === savedLastPnr))
        ? savedLastPnr
        : bookings[0].pnr;
      pnrInput.value = targetPnr;
      executePNRLookup(targetPnr, hasTicketHash);
    } else {
      // No bookings found
      pnrInput.value = '';
      if (pnrResultSection) pnrResultSection.style.display = 'none';
      if (ticketSection) ticketSection.style.display = 'none';
      if (hasTicketHash && emptyTicketsSection) {
        emptyTicketsSection.style.display = 'block';
      }
    }
  })();

  // 8. Handle hashchange (e.g. user clicks "My tickets" while already on pnr.html)
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#ticket') {
      if (ticketSection && ticketSection.style.display !== 'none') {
        ticketSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const savedLastPnr = localStorage.getItem('railgo_last_pnr');
        if (savedLastPnr) {
          pnrInput.value = savedLastPnr;
          executePNRLookup(savedLastPnr, true);
        }
      }
    }
  });
});

