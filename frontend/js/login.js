/**
 * RailGo — Navbar Authentication & Modal Controller
 * Displays the Login button or User Profile pill in the top navigation bar beside "My tickets",
 * and handles modal login/registration via the RailGo API.
 */

(function () {
  'use strict';

  const API_BASE = window.API_BASE || (window.location.pathname.includes('/railway') ? '/railway/api' : '../api');

  // Navbar elements
  const navLoginBtn     = document.getElementById('nav-login-btn');
  const navUserProfile  = document.getElementById('nav-user-profile');
  const navUserName     = document.getElementById('nav-user-name');
  const navLogoutBtn    = document.getElementById('nav-logout-btn');

  // Modal elements
  const authModal          = document.getElementById('auth-modal');
  const btnCloseAuthModal  = document.getElementById('btn-close-auth-modal');
  const tabLogin           = document.getElementById('tab-login');
  const tabRegister        = document.getElementById('tab-register');
  const authLoginView      = document.getElementById('auth-login-view');
  const authRegisterView   = document.getElementById('auth-register-view');

  // Form elements
  const loginForm          = document.getElementById('login-form');
  const loginEmail         = document.getElementById('login-email');
  const loginPassword      = document.getElementById('login-password');
  const loginMessage       = document.getElementById('login-message');
  const linkGotoRegister   = document.getElementById('link-goto-register');

  const registerForm       = document.getElementById('register-form');
  const registerName       = document.getElementById('register-name');
  const registerEmail      = document.getElementById('register-email');
  const registerPassword   = document.getElementById('register-password');
  const registerMessage    = document.getElementById('register-message');
  const linkGotoLogin      = document.getElementById('link-goto-login');

  // ─── Tab Switching ───

  function switchToLogin() {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
    if (authLoginView) authLoginView.style.display = 'block';
    if (authRegisterView) authRegisterView.style.display = 'none';
    if (loginMessage) loginMessage.textContent = '';
    if (loginEmail) loginEmail.focus();
  }

  function switchToRegister() {
    if (tabRegister) tabRegister.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (authRegisterView) authRegisterView.style.display = 'block';
    if (authLoginView) authLoginView.style.display = 'none';
    if (registerMessage) registerMessage.textContent = '';
    if (registerName) registerName.focus();
  }

  if (tabLogin) tabLogin.addEventListener('click', switchToLogin);
  if (tabRegister) tabRegister.addEventListener('click', switchToRegister);
  if (linkGotoLogin) linkGotoLogin.addEventListener('click', switchToLogin);
  if (linkGotoRegister) linkGotoRegister.addEventListener('click', switchToRegister);

  // ─── Modal Open / Close ───

  if (navLoginBtn && authModal) {
    navLoginBtn.addEventListener('click', () => {
      switchToLogin();
      authModal.showModal();
    });
  }

  if (btnCloseAuthModal && authModal) {
    btnCloseAuthModal.addEventListener('click', () => {
      authModal.close();
    });
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      const rect = authModal.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
        && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        authModal.close();
      }
    });
  }

  // ─── UI Status Helpers ───

  function showStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-crimson-500, #dc2626)' : 'var(--color-emerald-600, #059669)';
  }

  function renderAuthState(user) {
    if (user) {
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      if (navUserProfile) {
        navUserProfile.style.display = 'inline-flex';
        if (navUserName) navUserName.textContent = user.name || user.email;
      }
    } else {
      if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
      if (navUserProfile) navUserProfile.style.display = 'none';
    }
  }

  // ─── Check Auth on Page Load ───

  async function checkAuth() {
    try {
      const res  = await fetch(`${API_BASE}/auth_check.php`, { credentials: 'include' });
      const json = await res.json();

      if (json.data && json.data.logged_in && json.data.user) {
        renderAuthState(json.data.user);
      } else {
        renderAuthState(null);
      }
    } catch {
      renderAuthState(null);
    }
  }

  // ─── Login Form Submit ───

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmail ? loginEmail.value.trim() : '';
      const password = loginPassword ? loginPassword.value : '';

      if (!email || !password) {
        showStatus(loginMessage, 'Please enter email and password.', true);
        return;
      }

      showStatus(loginMessage, 'Signing in…', false);

      try {
        const res = await fetch(`${API_BASE}/login.php`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json();

        if (json.status === 'success' && json.data) {
          showStatus(loginMessage, '✓ Login successful!', false);
          renderAuthState(json.data);
          setTimeout(() => {
            if (authModal) authModal.close();
            if (loginPassword) loginPassword.value = '';
            if (loginMessage) loginMessage.textContent = '';
          }, 500);
        } else {
          showStatus(loginMessage, json.message || 'Invalid credentials.', true);
        }
      } catch (err) {
        showStatus(loginMessage, 'Network error. Please try again.', true);
      }
    });
  }

  // ─── Register Form Submit ───

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = registerName ? registerName.value.trim() : '';
      const email = registerEmail ? registerEmail.value.trim() : '';
      const password = registerPassword ? registerPassword.value : '';

      if (!name || !email || !password) {
        showStatus(registerMessage, 'Please fill in all fields.', true);
        return;
      }
      if (password.length < 6) {
        showStatus(registerMessage, 'Password must be at least 6 characters.', true);
        return;
      }

      showStatus(registerMessage, 'Creating account…', false);

      try {
        const res = await fetch(`${API_BASE}/register.php`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const json = await res.json();

        if (json.status === 'success' && json.data) {
          showStatus(registerMessage, '✓ Account created! Welcome!', false);
          renderAuthState(json.data);
          setTimeout(() => {
            if (authModal) authModal.close();
            if (registerPassword) registerPassword.value = '';
            if (registerMessage) registerMessage.textContent = '';
          }, 500);
        } else {
          showStatus(registerMessage, json.message || 'Registration failed.', true);
        }
      } catch (err) {
        showStatus(registerMessage, 'Network error. Please try again.', true);
      }
    });
  }

  // ─── Logout ───

  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/logout.php`, { method: 'POST', credentials: 'include' });
      } catch {}
      renderAuthState(null);
    });
  }

  // Initialize
  checkAuth();
})();
