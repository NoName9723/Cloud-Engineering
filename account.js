const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const statusElement = document.querySelector('#account-status');
const sessionPanel = document.querySelector('#account-session');
const modeButtons = document.querySelectorAll('[data-auth-mode]');
const logoutButton = document.querySelector('#logout-button');
let csrfToken = null;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.dataset.state = isError ? 'error' : 'success';
}

async function requestApi(path, options = {}) {
  const response = await fetch('/api' + path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.csrf ? { 'X-CSRF-Token': csrfToken || '' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || 'Le serveur n’a pas pu traiter la demande.';
    throw new Error(message);
  }
  return payload;
}

function showSignedOut() {
  sessionPanel.hidden = true;
  loginForm.hidden = false;
  registerForm.hidden = true;
  setMode('login');
}

function showSignedIn(user) {
  loginForm.hidden = true;
  registerForm.hidden = true;
  sessionPanel.hidden = false;
  document.querySelector('#account-name').textContent = user.name;
  document.querySelector('#account-email').textContent = user.email;
  setStatus('Votre session est active.');
}

function setMode(mode) {
  const registering = mode === 'register';
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  modeButtons.forEach(button => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

modeButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (!sessionPanel.hidden) return;
    setMode(button.dataset.authMode);
    setStatus('');
  });
});

async function initializeAccount() {
  try {
    const csrf = await requestApi('/auth/csrf');
    csrfToken = csrf.csrfToken;
    try {
      const profile = await requestApi('/auth/me');
      showSignedIn(profile.user);
    } catch (error) {
      if (error.message.includes('session active') || error.message.includes('plus valide')) {
        showSignedOut();
        setStatus('Vous pouvez vous connecter ou créer un compte.');
      } else {
        throw error;
      }
    }
  } catch (error) {
    showSignedOut();
    setStatus(error.message + ' Vérifiez que le serveur et sa base de données sont disponibles.', true);
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;

  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus('Connexion en cours…');
  try {
    const result = await requestApi('/auth/login', {
      method: 'POST',
      csrf: true,
      body: {
        email: loginForm.elements.email.value,
        password: loginForm.elements.password.value
      }
    });
    csrfToken = result.csrfToken;
    loginForm.reset();
    showSignedIn(result.user);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!registerForm.reportValidity()) return;

  const password = registerForm.elements.password.value;
  const confirm = registerForm.elements.confirm.value;
  if (password !== confirm) {
    setStatus('Les deux mots de passe ne correspondent pas.', true);
    return;
  }

  const submitButton = registerForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus('Création du compte en cours…');
  try {
    const result = await requestApi('/auth/register', {
      method: 'POST',
      csrf: true,
      body: {
        name: registerForm.elements.name.value,
        email: registerForm.elements.email.value,
        password
      }
    });
    csrfToken = result.csrfToken;
    registerForm.reset();
    showSignedIn(result.user);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await requestApi('/auth/logout', { method: 'POST', csrf: true });
    csrfToken = null;
    showSignedOut();
    setStatus('Vous êtes déconnecté.');
    await initializeAccount();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    logoutButton.disabled = false;
  }
});

initializeAccount();
