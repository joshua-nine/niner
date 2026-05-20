import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { toast, redirectIfLoggedIn } from './ui.js';

redirectIfLoggedIn('dashboard.html');

// ── Toggle login / register forms ────────────────────────────
const loginSection    = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
document.getElementById('show-register')?.addEventListener('click', e => {
  e.preventDefault();
  loginSection.classList.add('hidden');
  registerSection.classList.remove('hidden');
});
document.getElementById('show-login')?.addEventListener('click', e => {
  e.preventDefault();
  registerSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
});

// ── Login ─────────────────────────────────────────────────────
document.getElementById('login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = e.target.querySelector('button[type="submit"]');
  btn.disabled   = true;
  btn.textContent = 'LOGGING IN...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    toast(friendlyAuthError(err.code), 'error');
    btn.disabled   = false;
    btn.textContent = 'ENTER THE DUNGEON';
  }
});

// ── Register ──────────────────────────────────────────────────
document.getElementById('register-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
  if (password.length < 6)  { toast('Password must be at least 6 characters', 'error'); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled   = true;
  btn.textContent = 'CREATING ACCOUNT...';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: username,
      email,
      createdAt: serverTimestamp()
    });
    window.location.href = 'dashboard.html';
  } catch (err) {
    toast(friendlyAuthError(err.code), 'error');
    btn.disabled   = false;
    btn.textContent = 'CREATE ACCOUNT';
  }
});

// ── Sign Out (called from other pages) ───────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = 'index.html';
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'Email already in use.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/weak-password':        'Password is too weak.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/invalid-credential':   'Invalid email or password.',
  };
  return map[code] || 'Authentication error. Please try again.';
}
