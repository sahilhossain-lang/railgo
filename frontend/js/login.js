/**
 * RailGo — Login / Register Toggle Logic
 * Handles the "Would you like to log in?" prompt, login form,
 * registration form, and logged-in state banner.
 */

(function () {
  'use strict';

  const API_BASE = window.API_BASE || (window.location.pathname.includes('/railway') ? '/railway/api' : '../api');

  // DOM references
  const loginPrompt       = document.getElementById('login-prompt');
  const loginYesBtn       = document.getElementById('login-yes');
  const loginNoBtn        = document.getElementById('login-no');

  const loginFormSection  = document.getElementById('login-form-section');
  const loginForm         = document.getElementById('login-form');
  const loginEmail        = document.getElementById('login-email');
  const loginPassword     = document.getElementById('login-password');
  const loginMessage      = document.getElementById('login-message');
  const loginCancelBtn    = document.getElementById('login-cancel');

  const registerSection   = document.getElementById('register-form-section');
  const registerForm      = document.getElementById('register-form');
  const registerName      = document.getElementById('register-name');
  const registerEmail     = document.getElementById('register-email');
  const registerPassword  = document.getElementById('register-password');
  const registerMessage   = document.getElementById('register-message');
  const registerCancelBtn = document.getElementById('register-cancel');

  const showRegisterLink  = document.getElementById('show-register');
  const showLoginLink     = document.getElementById('show-login-from-register');

  const loggedInBanner    = document.getElementById('logged-in-banner');
  const loggedInName      = document.getElementById('logged-in-name');
  const logoutBtn         = document.getElementById('logout-btn');

  // ─── Helpers ───

  function hideAll() {
    if (loginPrompt)     loginPrompt.style.display     = 'none';
    if (loginFormSection) loginFormSection.style.display = 'none';
    if (registerSection) registerSection.style.display  = 'none';
    if (loggedInBanner)  loggedInBanner.style.display   = 'none';
  }

  function showStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-error, #d32f2f)' : 'var(--color-success, #388e3c)';
  }

  // ─── Auth Check on Page Load ───

  async function checkAuth() {
    try {
      const res  = await fetch(`${API_BASE}/auth_check.php`, { credentials: 'include' });
      const json = await res.json();

      if (json.data && json.data.logged_in && json.data.user) {
        showLoggedIn(json.data.user);
      } else {
        // Not logged in → show the prompt (unless user already dismissed it)
        if (sessionStorage.getItem('railgo_guest') === '1') {
          hideAll();
        } else {
          showPrompt();
        }
      }
    } catch {
      // API unreachable → show prompt
      if (sessionStorage.getItem('railgo_guest') === '1') {
        hideAll();
      } else {
        showPrompt();
      }
    }
  }

  function showPrompt() {
    hideAll();
    if (loginPrompt) loginPrompt.style.display = 'flex';
  }

  function showLoggedIn(user) {
    hideAll();
    if (loggedInBanner) {
      loggedInBanner.style.display = 'flex';
      if (loggedInName) loggedInName.textContent = user.name || user.email;
    }
  }

  // ─── Event Handlers ───

  // "Yes" → show login form
  if (loginYesBtn) {
    loginYesBtn.addEventListener('click', () => {
      hideAll();
      if (loginFormSection) loginFormSection.style.display = 'block';
      if (loginEmail) loginEmail.focus();
    });
  }

  // "No" → dismiss prompt, continue as guest
  if (loginNoBtn) {
    loginNoBtn.addEventListener('click', () => {
      sessionStorage.setItem('railgo_guest', '1');
      hideAll();
    });
  }

  // Cancel login → back to prompt
  if (loginCancelBtn) {
    loginCancelBtn.addEventListener('click', () => {
      showPrompt();
    });
  }

  // Switch to register form
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      hideAll();
      if (registerSection) registerSection.style.display = 'block';
      if (registerName) registerName.focus();
    });
  }

  // Switch back to login form from register
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      hideAll();
      if (loginFormSection) loginFormSection.style.display = 'block';
      if (loginEmail) loginEmail.focus();
    });
  }

  // Cancel register → back to prompt
  if (registerCancelBtn) {
    registerCancelBtn.addEventListener('click', () => {
      showPrompt();
    });
  }

  // ─── Login Form Submission ───

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = loginEmail ? loginEmail.value.trim() : '';
      const password = loginPassword ? loginPassword.value : '';

      if (!email || !password) {
        showStatus(loginMessage, 'Please fill in both fields.', true);
        return;
      }

      showStatus(loginMessage, 'Logging in…', false);

      try {
        const res  = await fetch(`${API_BASE}/login.php`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();

        if (json.status === 'success' && json.data) {
          showStatus(loginMessage, 'Login successful!', false);
          sessionStorage.removeItem('railgo_guest');
          setTimeout(() => showLoggedIn(json.data), 600);
        } else {
          showStatus(loginMessage, json.message || 'Login failed.', true);
        }
      } catch (err) {
        showStatus(loginMessage, 'Network error. Please try again.', true);
      }
    });
  }

  // ─── Register Form Submission ───

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name     = registerName ? registerName.value.trim() : '';
      const email    = registerEmail ? registerEmail.value.trim() : '';
      const password = registerPassword ? registerPassword.value : '';

      if (!name || !email || !password) {
        showStatus(registerMessage, 'Please fill in all fields.', true);
        return;
      }
      if (password.length < 6) {
        showStatus(registerMessage, 'Password must be at least 6 characters.', true);
        return;
      }

      showStatus(registerMessage, 'Registering…', false);

      try {
        const res  = await fetch(`${API_BASE}/register.php`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const json = await res.json();

        if (json.status === 'success' && json.data) {
          showStatus(registerMessage, 'Account created! Welcome!', false);
          sessionStorage.removeItem('railgo_guest');
          setTimeout(() => showLoggedIn(json.data), 600);
        } else {
          showStatus(registerMessage, json.message || 'Registration failed.', true);
        }
      } catch (err) {
        showStatus(registerMessage, 'Network error. Please try again.', true);
      }
    });
  }

  // ─── Logout ───

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/logout.php`, { method: 'POST', credentials: 'include' });
      } catch { /* ignore */ }
      sessionStorage.removeItem('railgo_guest');
      showPrompt();
    });
  }

  // ─── Init ───
  checkAuth();
})();

