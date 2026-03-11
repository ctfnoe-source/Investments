// app.js - Punto de entrada, Firebase y autenticación

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { loadInitialData, saveAllToStorage, updateAllPrices, fetchFX, getPriceSummary } from './core.js';
import { renderPage, saveAll } from './ui.js';

const firebaseConfig = {
  apiKey: "AIzaSyDUAOlDXmkBRQNoYgmax9KOMjQrZd061Q8",
  authDomain: "control-de-inversion.firebaseapp.com",
  projectId: "control-de-inversion",
  storageBucket: "control-de-inversion.firebasestorage.app",
  messagingSenderId: "955139190781",
  appId: "1:955139190781:web:b73653484f5f96b7e23394"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const DOC_REF = doc(db, "finanzas", "main");

let _ignoreSnap = false;
let _saveTimeout = null;
let _unsub = null;

// ==================== UI DE ESTADO FIREBASE ====================
function setFbStatus(s) {
  let el = document.getElementById('fbStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fbStatus';
    el.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;white-space:nowrap;transition:all 0.3s;flex-shrink:0';
    const nav = document.querySelector('.nav-inner');
    if (nav) nav.appendChild(el);
  }
  const map = {
    syncing: ['⏳ Sync...', 'rgba(10,132,255,0.1)', '#0A84FF'],
    ok: ['☁️ Sincronizado', 'rgba(48,209,88,0.1)', '#30D158'],
    error: ['⚠️ Sin conexión', 'rgba(255,69,58,0.1)', '#FF453A'],
    offline: ['📴 Offline', 'rgba(0,0,0,0.06)', '#86868B']
  };
  const [text, bg, color] = map[s] || map.offline;
  el.textContent = text;
  el.style.background = bg;
  el.style.color = color;
}

// ==================== AUTENTICACIÓN ====================
function showApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('mainNav').style.display = '';
  document.getElementById('mainContainer').style.display = '';
  document.getElementById('mobileNav').style.display = '';
  document.getElementById('accessDenied').classList.remove('show');
}
function showLogin(msg) {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('mainContainer').style.display = 'none';
  document.getElementById('mobileNav').style.display = 'none';
  document.getElementById('accessDenied').classList.remove('show');
  if (msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.style.display = 'block';
  }
}

window.signOutUser = async () => {
  await signOut(auth);
  showLogin();
};

document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
  const btn = document.getElementById('btnGoogleLogin');
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(10,132,255,0.2);border-top-color:#0A84FF;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle"></span> Conectando...';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:22px;height:22px">...</svg> Continuar con Google';
    showLogin(e.code === 'auth/popup-closed-by-user' ? '' : 'Error al iniciar sesión.');
  }
});

// ==================== FIRESTORE ====================
function setupFirestore() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(DOC_REF, snap => {
    if (_ignoreSnap) { _ignoreSnap = false; return; }
    if (!snap.exists()) {
      window.saveToFirebase();
      return;
    }
    setFbStatus('ok');
    const remote = snap.data();
    // Cargar datos remotos en memoria
    if (remote.platforms) platforms = remote.platforms;
    if (remote.movements) movements = remote.movements;
    if (remote.goals) goals = remote.goals;
    if (remote.settings) settings = remote.settings;
    if (remote.recurrentes) recurrentes = remote.recurrentes;
    if (remote.patrimonioHistory) patrimonioHistory = remote.patrimonioHistory;
    // Actualizar localStorage
    saveAllToStorage();
    // Renderizar vista actual
    renderPage(window.currentTab || 'dashboard');
  }, err => {
    console.error(err);
    setFbStatus('error');
  });
}

window.saveToFirebase = async (forceImmediate = false) => {
  const doSave = async () => {
    setFbStatus('syncing');
    try {
      _ignoreSnap = true;
      const data = {
        platforms, movements, goals, settings, recurrentes, patrimonioHistory,
        updatedAt: serverTimestamp(),
        device: navigator.userAgent.substring(0,60)
      };
      await setDoc(DOC_REF, data);
      setFbStatus('ok');
    } catch (e) {
      setFbStatus('error');
      console.error(e);
      if (!navigator.onLine) {
        // offline queue
        window.dispatchEvent(new CustomEvent('offline-save', { detail: { platforms, movements, goals, settings, recurrentes, patrimonioHistory } }));
      }
      throw e;
    }
  };
  if (forceImmediate) { await doSave(); return; }
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(doSave, 1500);
};

// ==================== ESTADO DE CONEXIÓN ====================
window.addEventListener('online', () => {
  setFbStatus('ok');
  // Reintentar sincronización pendiente
  if (window._offlineQueue) {
    window.saveToFirebase(true);
    window._offlineQueue = null;
  }
});
window.addEventListener('offline', () => setFbStatus('offline'));

// ==================== INICIALIZACIÓN ====================
onAuthStateChanged(auth, user => {
  if (user) {
    window._currentUser = user;
    // Cargar datos locales primero
    loadInitialData();
    // Mostrar UI
    showApp();
    // Conectar Firestore
    setupFirestore();
    // Renderizar dashboard
    renderPage('dashboard');
    // Actualizar FX y precios
    setTimeout(() => {
      fetchFX();
      const s = getPriceSummary();
      if (s.total > 0 && s.missing > 0) updateAllPrices(false);
    }, 1200);
  } else {
    window._currentUser = null;
    if (_unsub) { _unsub(); _unsub = null; }
    showLogin();
  }
});

// ==================== OFFLINE QUEUE (básico) ====================
window.addEventListener('offline-save', (e) => {
  window._offlineQueue = e.detail;
});

// ==================== EXPORTAR FUNCIONES AL GLOBAL ====================
window.saveToFirebase = saveToFirebase;
window.getAppData = () => ({ platforms, movements, goals, settings, recurrentes, patrimonioHistory });
window.loadFromRemote = (remote) => {
  if (remote.platforms) platforms = remote.platforms;
  if (remote.movements) movements = remote.movements;
  if (remote.goals) goals = remote.goals;
  if (remote.settings) settings = remote.settings;
  if (remote.recurrentes) recurrentes = remote.recurrentes;
  if (remote.patrimonioHistory) patrimonioHistory = remote.patrimonioHistory;
  saveAllToStorage();
  renderPage(window.currentTab || 'dashboard');
};

// ==================== INICIALIZAR TEMA OSCURO ====================
function applyDarkMode() {
  const saved = localStorage.getItem('fp_darkMode') === 'true';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved || (!localStorage.getItem('fp_darkMode') && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
applyDarkMode();

window.toggleDark = () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('fp_darkMode', !dark);
  // Re-renderizar para actualizar gráficos
  renderPage(window.currentTab);
};
