/**
 * RailGo Search & Home Screen Controller
 * Handles station inputs, swap animation, autocomplete, reduced motion,
 * live search execution, and live filter orchestration without page reload.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Reduced Motion Preference Handling
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

  // 2. Station Autocomplete & Swap Feature
  const fromInput = document.getElementById('from-station');
  const toInput = document.getElementById('to-station');
  const departureDateInput = document.getElementById('departure-date');
  const travelClassSelect = document.getElementById('travel-class');
  const swapBtn = document.getElementById('swap-stations-btn');
  const searchForm = document.getElementById('train-search-form');
  const clearFromBtn = document.getElementById('btn-clear-from');
  const clearToBtn = document.getElementById('btn-clear-to');

  const STATIONS = [
    { name: "New Delhi", code: "NDLS" },
    { name: "Mumbai Central", code: "MMCT" },
    { name: "Madgaon (Goa)", code: "MAO" },
    { name: "Bengaluru City", code: "SBC" },
    { name: "Chennai Central", code: "MAS" },
    { name: "Howrah (Kolkata)", code: "HWH" },
    { name: "Varanasi Jn", code: "BSB" },
    { name: "Jaipur Jn", code: "JP" },
    { name: "Ahmedabad Jn", code: "ADI" },
    { name: "Secunderabad (Hyderabad)", code: "SC" },
    { name: "Pune Jn", code: "PUNE" },
    { name: "Lucknow Charbagh", code: "LKO" },
    { name: "Amritsar Jn", code: "ASR" },
    { name: "Patna Jn", code: "PNBE" },
    { name: "Bhopal Jn", code: "BPL" },
    { name: "Chandigarh", code: "CDG" }
  ];

  function setupAutocomplete(inputElement, dropdownId, clearBtn) {
    const dropdown = document.getElementById(dropdownId);
    if (!inputElement || !dropdown) return;

    let debounceTimer = null;

    async function renderOptions(query) {
      const q = (query || '').trim();
      let matches = [];

      try {
        matches = await RailGoAPI.getStations(q, 30);
      } catch (e) {}

      if (!matches || matches.length === 0) {
        const qLower = q.toLowerCase();
        matches = q
          ? STATIONS.filter(s => s.name.toLowerCase().includes(qLower) || s.code.toLowerCase().includes(qLower))
          : STATIONS;
      }

      if (matches.length === 0) {
        dropdown.innerHTML = `<div class="autocomplete-item" style="cursor: default; color: var(--color-slate-400);">No stations found</div>`;
      } else {
        dropdown.innerHTML = matches.map(s => `
          <div class="autocomplete-item" data-station="${RailGoAPI.escapeHTML(s.name)} (${RailGoAPI.escapeHTML(s.code)})">
            <span class="station-title">${RailGoAPI.escapeHTML(s.name)}${s.state ? `<span style="font-size: 0.78rem; opacity: 0.65; margin-left: 6px;">· ${RailGoAPI.escapeHTML(s.state)}</span>` : ''}</span>
            <span class="station-code">${RailGoAPI.escapeHTML(s.code)}</span>
          </div>
        `).join('');
      }

      dropdown.classList.add('open');
      if (clearBtn) {
        clearBtn.classList.toggle('visible', Boolean(inputElement.value));
      }
    }

    inputElement.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderOptions(e.target.value);
      }, 150);
    });

    inputElement.addEventListener('focus', () => {
      renderOptions(inputElement.value);
    });

    inputElement.addEventListener('click', () => {
      renderOptions(inputElement.value);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputElement.value = '';
        inputElement.focus();
        renderOptions('');
      });
    }

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (item && item.getAttribute('data-station')) {
        inputElement.value = item.getAttribute('data-station');
        dropdown.classList.remove('open');
        if (clearBtn) clearBtn.classList.add('visible');
      }
    });

    document.addEventListener('click', (e) => {
      if (!inputElement.contains(e.target) && !dropdown.contains(e.target) && (!clearBtn || !clearBtn.contains(e.target))) {
        dropdown.classList.remove('open');
      }
    });
  }

  setupAutocomplete(fromInput, 'from-dropdown', clearFromBtn);
  setupAutocomplete(toInput, 'to-dropdown', clearToBtn);

  // Quick Destination Chips
  const quickDestChips = document.querySelectorAll('.quick-dest-chip');
  quickDestChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const targetStation = chip.getAttribute('data-station');
      if (targetStation && toInput) {
        toInput.value = targetStation;
        if (clearToBtn) clearToBtn.classList.add('visible');
        executeSearch();
      }
    });
  });

  // Station Swap Animation (Pure 3D CSS rotate)
  if (swapBtn && fromInput && toInput) {
    swapBtn.addEventListener('click', () => {
      swapBtn.classList.add('rotating');
      setTimeout(() => swapBtn.classList.remove('rotating'), 350);

      const temp = fromInput.value;
      fromInput.value = toInput.value;
      toInput.value = temp;
    });
  }

  // 3. Parallax tilt for Hero Scene Card
  const sceneCard = document.querySelector('.hero-scene-card');
  if (sceneCard) {
    sceneCard.addEventListener('mousemove', (e) => {
      if (document.documentElement.classList.contains('reduced-motion')) return;
      const rect = sceneCard.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateY = (x / (rect.width / 2)) * 10;
      const rotateX = -(y / (rect.height / 2)) * 8;
      sceneCard.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateZ(12px)`;
    });

    sceneCard.addEventListener('mouseleave', () => {
      if (document.documentElement.classList.contains('reduced-motion')) return;
      sceneCard.style.transform = 'rotateY(-8deg) rotateX(4deg) translateZ(0)';
    });
  }

  // 4. Live Search & Results State Management
  const resultsSection = document.getElementById('search-results-section');
  const popularRoutesSection = document.querySelector('.popular-routes-section');
  const journeyRouteEl = document.getElementById('journey-route');
  const journeyDetailsEl = document.getElementById('journey-details');
  const resultsCountEl = document.getElementById('results-count-text');
  const resultsListEl = document.getElementById('trains-list');
  const modifySearchBtn = document.getElementById('btn-modify-search');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');

  let currentRawTrains = [];
  let activeFilters = {
    timeSlot: null, // 'night' | 'morning' | 'afternoon' | 'evening'
    classes: new Set(),
    trainTypes: new Set()
  };

  // Popular routes click
  const popularRouteCards = document.querySelectorAll('.route-card');
  popularRouteCards.forEach(card => {
    card.addEventListener('click', () => {
      const from = card.getAttribute('data-from');
      const to = card.getAttribute('data-to');
      if (from && to && fromInput && toInput) {
        fromInput.value = from;
        toInput.value = to;
        executeSearch();
      }
    });
  });

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeSearch();
    });
  }

  if (modifySearchBtn) {
    modifySearchBtn.addEventListener('click', () => {
      window.scrollTo({ top: searchForm.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      fromInput.focus();
    });
  }

  async function executeSearch() {
    const fromVal = fromInput.value.trim() || 'New Delhi (NDLS)';
    const toVal = toInput.value.trim() || 'Mumbai Central (MMCT)';
    const dateVal = departureDateInput.value || '2026-11-20';
    const classVal = travelClassSelect.value;

    // Format date nicely
    const dateObj = new Date(dateVal);
    const dateFormatted = !isNaN(dateObj)
      ? dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : dateVal;

    // Show results section
    resultsSection.classList.add('active');
    popularRoutesSection.style.display = 'none';

    // Update summary bar
    const cleanFrom = fromVal.replace(/\s*\([A-Z0-9]+\)/, '');
    const cleanTo = toVal.replace(/\s*\([A-Z0-9]+\)/, '');
    journeyRouteEl.textContent = `${cleanFrom} → ${cleanTo}`;
    journeyDetailsEl.textContent = `${dateFormatted} · ${classVal === 'all' ? 'All classes' : classVal} · 1 passenger`;

    // Render Loading Skeletons
    renderSkeletons();

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const response = await RailGoAPI.searchTrains({
        from: fromVal,
        to: toVal,
        date: dateFormatted,
        travelClass: classVal
      });

      currentRawTrains = response.trains || [];
      applyFiltersAndRender();
    } catch (err) {
      console.error('Search error:', err);
      resultsListEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">!</div>
          <h3 class="empty-state-title">Unable to fetch train schedules</h3>
          <p class="empty-state-desc">Please check your network connection and try again.</p>
          <button type="button" class="btn btn-primary" onclick="window.location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function renderSkeletons() {
    resultsCountEl.textContent = "Checking trains and live availability…";
    resultsListEl.innerHTML = `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-title"></div>
        <div class="skeleton-shimmer skeleton-schedule"></div>
        <div class="skeleton-shimmer skeleton-chips"></div>
      </div>
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-title"></div>
        <div class="skeleton-shimmer skeleton-schedule"></div>
        <div class="skeleton-shimmer skeleton-chips"></div>
      </div>
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-title"></div>
        <div class="skeleton-shimmer skeleton-schedule"></div>
        <div class="skeleton-shimmer skeleton-chips"></div>
      </div>
    `;
  }

  // 5. Filter Controls Listener
  const timeSlotBtns = document.querySelectorAll('.time-slot-btn');
  timeSlotBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.getAttribute('data-slot');
      if (activeFilters.timeSlot === slot) {
        activeFilters.timeSlot = null;
        btn.classList.remove('active');
      } else {
        timeSlotBtns.forEach(b => b.classList.remove('active'));
        activeFilters.timeSlot = slot;
        btn.classList.add('active');
      }
      applyFiltersAndRender();
    });
  });

  const classCheckboxes = document.querySelectorAll('input[name="filter-class"]');
  classCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        activeFilters.classes.add(cb.value);
      } else {
        activeFilters.classes.delete(cb.value);
      }
      applyFiltersAndRender();
    });
  });

  const typeCheckboxes = document.querySelectorAll('input[name="filter-type"]');
  typeCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        activeFilters.trainTypes.add(cb.value);
      } else {
        activeFilters.trainTypes.delete(cb.value);
      }
      applyFiltersAndRender();
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      activeFilters.timeSlot = null;
      activeFilters.classes.clear();
      activeFilters.trainTypes.clear();

      timeSlotBtns.forEach(b => b.classList.remove('active'));
      classCheckboxes.forEach(cb => cb.checked = false);
      typeCheckboxes.forEach(cb => cb.checked = false);

      applyFiltersAndRender();
    });
  }

  function applyFiltersAndRender() {
    let filtered = [...currentRawTrains];

    // Filter by departure time slot
    if (activeFilters.timeSlot) {
      filtered = filtered.filter(train => {
        const hour = parseInt(train.departure_time.split(':')[0], 10);
        if (activeFilters.timeSlot === 'night') return hour >= 0 && hour < 6;
        if (activeFilters.timeSlot === 'morning') return hour >= 6 && hour < 12;
        if (activeFilters.timeSlot === 'afternoon') return hour >= 12 && hour < 18;
        if (activeFilters.timeSlot === 'evening') return hour >= 18 && hour < 24;
        return true;
      });
    }

    // Filter by train types
    if (activeFilters.trainTypes.size > 0) {
      filtered = filtered.filter(train => activeFilters.trainTypes.has(train.type));
    }

    // Filter by travel classes
    if (activeFilters.classes.size > 0) {
      filtered = filtered.filter(train => {
        return Object.keys(train.classes).some(code => activeFilters.classes.has(code));
      });
    }

    renderTrainList(filtered);
  }

  function renderTrainList(trains) {
    if (trains.length === 0) {
      resultsCountEl.textContent = "0 trains · Filters applied";
      resultsListEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon" aria-hidden="true">— — —</div>
          <h3 class="empty-state-title">No trains match these filters.</h3>
          <p class="empty-state-desc">Try another departure time or travel class.</p>
          <button type="button" class="btn btn-secondary" id="empty-clear-filters-btn">Clear all filters</button>
        </div>
      `;
      const btn = document.getElementById('empty-clear-filters-btn');
      if (btn) btn.addEventListener('click', () => clearFiltersBtn.click());
      return;
    }

    resultsCountEl.textContent = `${trains.length} ${trains.length === 1 ? 'train' : 'trains'} · Fares shown per passenger`;

    resultsListEl.innerHTML = trains.map(train => {
      // Build class chips
      const classChipsHtml = Object.entries(train.classes).map(([code, cInfo]) => {
        return `
          <button type="button" class="class-chip ${cInfo.status}"
                  data-train-id="${RailGoAPI.escapeHTML(train.id)}"
                  data-train-name="${RailGoAPI.escapeHTML(train.name)}"
                  data-train-number="${RailGoAPI.escapeHTML(train.number)}"
                  data-class-code="${RailGoAPI.escapeHTML(code)}"
                  data-class-name="${RailGoAPI.escapeHTML(cInfo.name)}"
                  data-base-fare="${cInfo.fare}"
                  data-departure="${RailGoAPI.escapeHTML(train.departure_time)}"
                  data-arrival="${RailGoAPI.escapeHTML(train.arrival_time)}"
                  data-duration="${RailGoAPI.escapeHTML(train.duration)}"
                  data-from="${RailGoAPI.escapeHTML(train.from_name)}"
                  data-to="${RailGoAPI.escapeHTML(train.to_name)}"
                  ${cInfo.status === 'soldout' ? 'disabled' : ''}>
            <div class="class-chip-top">
              <span class="class-code">${RailGoAPI.escapeHTML(code)}</span>
              <span class="class-fare">${cInfo.fare ? '₹' + cInfo.fare.toLocaleString('en-IN') : '—'}</span>
            </div>
            <span class="class-availability">${RailGoAPI.escapeHTML(cInfo.label)}</span>
          </button>
        `;
      }).join('');

      return `
        <article class="train-card" data-train-id="${RailGoAPI.escapeHTML(train.id)}">
          <div class="train-card-header">
            <div>
              <div class="train-name-group">
                <h3 class="train-name">${RailGoAPI.escapeHTML(train.name)}</h3>
                <span class="train-number">${RailGoAPI.escapeHTML(train.number)}</span>
                <span class="train-category-tag">${RailGoAPI.escapeHTML(train.category_tag)}</span>
              </div>
            </div>
            ${train.hint ? `<span class="train-hint">${RailGoAPI.escapeHTML(train.hint)}</span>` : ''}
          </div>

          <div class="train-schedule-row">
            <div class="schedule-endpoint">
              <span class="schedule-time">${RailGoAPI.escapeHTML(train.departure_time)}</span>
              <span class="schedule-station">${RailGoAPI.escapeHTML(train.from_name)}</span>
            </div>

            <div class="duration-track-container" aria-label="Journey duration: ${RailGoAPI.escapeHTML(train.duration)}">
              <span class="duration-label">${RailGoAPI.escapeHTML(train.duration)}</span>
              <div class="duration-line">
                <img src="assets/train-marker.svg" class="duration-marker-icon" alt="" aria-hidden="true">
              </div>
            </div>

            <div class="schedule-endpoint" style="text-align: right;">
              <span class="schedule-time">${RailGoAPI.escapeHTML(train.arrival_time)}</span>
              <span class="schedule-station">${RailGoAPI.escapeHTML(train.to_name)} ${train.next_day ? '+1' : ''}</span>
            </div>
          </div>

          <div class="classes-grid" role="group" aria-label="Available travel classes">
            ${classChipsHtml}
          </div>
        </article>
      `;
    }).join('');

    // Attach click listeners to class chips for booking initiation
    const chips = resultsListEl.querySelectorAll('.class-chip:not(:disabled)');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const trainData = {
          train_id: chip.getAttribute('data-train-id'),
          train_name: chip.getAttribute('data-train-name'),
          train_number: chip.getAttribute('data-train-number'),
          class_code: chip.getAttribute('data-class-code'),
          class_name: chip.getAttribute('data-class-name'),
          base_fare: parseInt(chip.getAttribute('data-base-fare'), 10),
          departure_time: chip.getAttribute('data-departure'),
          arrival_time: chip.getAttribute('data-arrival'),
          duration: chip.getAttribute('data-duration'),
          from_name: chip.getAttribute('data-from'),
          to_name: chip.getAttribute('data-to'),
          journey_date: departureDateInput.value || '2026-11-20'
        };

        // Dispatch custom event for booking modal
        window.dispatchEvent(new CustomEvent('railgo:init-booking', { detail: trainData }));
      });
    });
  }
});
