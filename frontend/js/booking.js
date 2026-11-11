/**
 * RailGo Booking Controller
 * Manages native <dialog> booking modal, dynamic passenger rows (1-6),
 * live fare calculation, validation, and POST submission.
 */

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('booking-modal');
  if (!modal) return;

  const formView = document.getElementById('booking-form-view');
  const successView = document.getElementById('booking-success-view');
  const closeBtn = document.getElementById('btn-close-booking');
  const trainNameEl = document.getElementById('modal-train-name');
  const trainNumberEl = document.getElementById('modal-train-number');
  const journeySummaryEl = document.getElementById('modal-journey-summary');
  const classSelectEl = document.getElementById('modal-class-select');
  const passengerListEl = document.getElementById('passenger-rows-container');
  const addPassengerBtn = document.getElementById('btn-add-passenger');
  const validationAlert = document.getElementById('booking-validation-alert');
  const baseFareTimesEl = document.getElementById('fare-base-times');
  const fareTotalEl = document.getElementById('fare-total-amount');
  const bookingForm = document.getElementById('booking-details-form');
  const submitBtn = document.getElementById('btn-confirm-booking');

  let currentTrainData = null;
  let currentBaseFare = 1895;
  const MAX_PASSENGERS = 6;

  // Listen for booking initiation event
  window.addEventListener('railgo:init-booking', (e) => {
    currentTrainData = e.detail;
    openBookingModal();
  });

  function openBookingModal() {
    if (!currentTrainData) return;

    // Reset views
    formView.style.display = 'block';
    successView.classList.remove('show');
    validationAlert.classList.remove('show');

    // Populate Train Info
    trainNameEl.textContent = currentTrainData.train_name;
    trainNumberEl.textContent = currentTrainData.train_number;
    journeySummaryEl.textContent = `${currentTrainData.from_name} → ${currentTrainData.to_name} · ${currentTrainData.departure_time} → ${currentTrainData.arrival_time}`;

    // Populate Class Select
    currentBaseFare = currentTrainData.base_fare;
    classSelectEl.innerHTML = `
      <option value="${currentTrainData.class_code}" selected>
        ${currentTrainData.class_code} · ₹${currentTrainData.base_fare.toLocaleString('en-IN')}
      </option>
    `;

    // Reset passenger rows to 1
    passengerListEl.innerHTML = '';
    addPassengerRow();

    updateFareSummary();
    modal.showModal();
  }

  // Close handlers
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.close());
  }

  modal.addEventListener('click', (e) => {
    // Close if clicked on backdrop outside dialog content
    const rect = modal.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      modal.close();
    }
  });

  // Add Passenger Row
  function addPassengerRow() {
    const currentRows = passengerListEl.querySelectorAll('.passenger-row-card');
    const index = currentRows.length + 1;
    if (index > MAX_PASSENGERS) return;

    const rowEl = document.createElement('div');
    rowEl.className = 'passenger-row-card';
    rowEl.innerHTML = `
      <div class="passenger-row-header">
        <span class="passenger-num-title">Passenger ${index}</span>
        ${index > 1 ? `<button type="button" class="btn-remove-passenger" aria-label="Remove passenger ${index}">Remove</button>` : ''}
      </div>

      <div class="passenger-row-grid">
        <!-- Name -->
        <div class="form-group">
          <label class="form-label" for="p-name-${index}">Name</label>
          <input type="text" id="p-name-${index}" class="form-input p-name" placeholder="Full name as on ID" required>
        </div>

        <!-- Age -->
        <div class="form-group">
          <label class="form-label" for="p-age-${index}">Age</label>
          <input type="number" id="p-age-${index}" class="form-input p-age" placeholder="Age" min="1" max="120" required>
        </div>

        <!-- Gender Segmented Control -->
        <div class="form-group">
          <label class="form-label">Gender</label>
          <div class="gender-control" role="radiogroup" aria-label="Gender">
            <button type="button" class="gender-btn selected" data-gender="M" role="radio" aria-checked="true">M</button>
            <button type="button" class="gender-btn" data-gender="F" role="radio" aria-checked="false">F</button>
            <button type="button" class="gender-btn" data-gender="O" role="radio" aria-checked="false">O</button>
          </div>
        </div>

        <!-- Berth Preference -->
        <div class="form-group">
          <label class="form-label" for="p-berth-${index}">Berth preference</label>
          <select id="p-berth-${index}" class="form-input p-berth">
            <option value="No preference">No preference</option>
            <option value="Lower">Lower</option>
            <option value="Middle">Middle</option>
            <option value="Upper">Upper</option>
            <option value="Side Lower">Side Lower</option>
            <option value="Side Upper">Side Upper</option>
          </select>
        </div>
      </div>
    `;

    // Gender radio behavior
    const genderBtns = rowEl.querySelectorAll('.gender-btn');
    genderBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        genderBtns.forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
      });
    });

    // Remove behavior
    const removeBtn = rowEl.querySelector('.btn-remove-passenger');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        rowEl.remove();
        reindexPassengers();
        updateFareSummary();
      });
    }

    passengerListEl.appendChild(rowEl);
    checkPassengerLimit();
    updateFareSummary();
  }

  function reindexPassengers() {
    const rows = passengerListEl.querySelectorAll('.passenger-row-card');
    rows.forEach((row, i) => {
      const title = row.querySelector('.passenger-num-title');
      if (title) title.textContent = `Passenger ${i + 1}`;
    });
    checkPassengerLimit();
  }

  function checkPassengerLimit() {
    const count = passengerListEl.querySelectorAll('.passenger-row-card').length;
    addPassengerBtn.disabled = count >= MAX_PASSENGERS;
    if (count >= MAX_PASSENGERS) {
      addPassengerBtn.textContent = 'Maximum 6 passengers reached';
    } else {
      addPassengerBtn.textContent = '+ Add passenger';
    }
  }

  if (addPassengerBtn) {
    addPassengerBtn.addEventListener('click', () => {
      addPassengerRow();
    });
  }

  // Live Fare Calculation: Base Fare * Count
  function updateFareSummary() {
    const count = passengerListEl.querySelectorAll('.passenger-row-card').length;
    baseFareTimesEl.textContent = `₹${currentBaseFare.toLocaleString('en-IN')} × ${count} =`;
    const total = currentBaseFare * count;
    fareTotalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  }

  // Booking Form Submission
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      validationAlert.classList.remove('show');

      // Validate all passenger fields
      const rows = passengerListEl.querySelectorAll('.passenger-row-card');
      const passengersData = [];
      let hasError = false;

      rows.forEach(row => {
        const nameInput = row.querySelector('.p-name');
        const ageInput = row.querySelector('.p-age');
        const selectedGenderBtn = row.querySelector('.gender-btn.selected');
        const berthSelect = row.querySelector('.p-berth');

        const name = nameInput.value.trim();
        const age = parseInt(ageInput.value, 10);
        const gender = selectedGenderBtn ? selectedGenderBtn.getAttribute('data-gender') : 'M';
        const berth = berthSelect.value;

        if (!name || isNaN(age) || age < 1 || age > 120) {
          hasError = true;
          nameInput.style.borderColor = !name ? 'var(--color-crimson-500)' : '';
          ageInput.style.borderColor = (isNaN(age) || age < 1 || age > 120) ? 'var(--color-crimson-500)' : '';
        } else {
          nameInput.style.borderColor = '';
          ageInput.style.borderColor = '';
          passengersData.push({
            name,
            age,
            gender,
            berth_pref: berth
          });
        }
      });

      if (hasError || passengersData.length === 0) {
        validationAlert.classList.add('show');
        return;
      }

      // Processing state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing booking…';

      try {
        const payload = {
          train_id: currentTrainData.train_id,
          class_code: currentTrainData.class_code,
          journey_date: currentTrainData.journey_date,
          passengers: passengersData
        };

        const result = await RailGoAPI.bookTicket(payload);

        if (result.status === 'success') {
          // Show Success View
          formView.style.display = 'none';
          successView.classList.add('show');

          document.getElementById('success-destination').textContent = currentTrainData.to_name;
          document.getElementById('success-pnr-display').textContent = `PNR: ${result.pnr}`;

          const viewTicketBtn = document.getElementById('btn-view-ticket');
          if (viewTicketBtn) {
            viewTicketBtn.href = `pnr.html?pnr=${result.pnr}#ticket`;
          }
        } else {
          alert(result.message || 'Booking could not be completed. Please try again.');
        }
      } catch (err) {
        console.error('Booking error:', err);
        alert('An error occurred while booking. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm booking →';
      }
    });
  }
});

