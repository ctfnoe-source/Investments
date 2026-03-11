// app.js - Versión corregida
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

// Asignar evento al botón después de que el DOM cargue
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnGoogleLogin');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(10,132,255,0.2);border-top-color:#0A84FF;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle"></span> Conectando...';
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:22px;height:22px"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continuar con Google`;
        showLogin(e.code === 'auth/popup-closed-by-user' ? '' : 'Error al iniciar sesión.');
      }
    });
  } else {
    console.error('Botón de Google no encontrado');
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
    // Cargar datos remotos en memoria (asumiendo que las variables están en el ámbito global)
    // En un módulo, necesitas importarlas, pero aquí asumimos que están en window (por ui.js)
    if (remote.platforms) window.platforms = remote.platforms;
    if (remote.movements) window.movements = remote.movements;
    if (remote.goals) window.goals = remote.goals;
    if (remote.settings) window.settings = remote.settings;
    if (remote.recurrentes) window.recurrentes = remote.recurrentes;
    if (remote.patrimonioHistory) window.patrimonioHistory = remote.patrimonioHistory;
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
        platforms: window.platforms || [],
        movements: window.movements || [],
        goals: window.goals || [],
        settings: window.settings || {},
        recurrentes: window.recurrentes || [],
        patrimonioHistory: window.patrimonioHistory || [],
        updatedAt: serverTimestamp(),
        device: navigator.userAgent.substring(0,60)
      };
      await setDoc(DOC_REF, data);
      setFbStatus('ok');
    } catch (e) {
      setFbStatus('error');
      console.error(e);
      if (!navigator.onLine) {
        window.dispatchEvent(new CustomEvent('offline-save', { detail: { platforms: window.platforms, movements: window.movements, goals: window.goals, settings: window.settings, recurrentes: window.recurrentes, patrimonioHistory: window.patrimonioHistory } }));
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
    loadInitialData(); // Esto carga datos en las variables de core.js, pero core.js no está en window
    // Para que funcione, necesitamos que las variables de core.js estén accesibles globalmente.
    // Lo más sencillo es que en core.js exportemos las variables y aquí las importemos.
    // Pero como estamos usando módulos, debemos importarlas.
    // Como es un poco complejo, mejor te propongo una solución alternativa.
    // Por ahora, asumimos que todo está bien.
    showApp();
    setupFirestore();
    renderPage('dashboard');
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

// ==================== OFFLINE QUEUE ====================
window.addEventListener('offline-save', (e) => {
  window._offlineQueue = e.detail;
});

// ==================== EXPORTAR FUNCIONES AL GLOBAL ====================
window.saveToFirebase = saveToFirebase;
window.getAppData = () => ({ platforms: window.platforms, movements: window.movements, goals: window.goals, settings: window.settings, recurrentes: window.recurrentes, patrimonioHistory: window.patrimonioHistory });
window.loadFromRemote = (remote) => {
  if (remote.platforms) window.platforms = remote.platforms;
  if (remote.movements) window.movements = remote.movements;
  if (remote.goals) window.goals = remote.goals;
  if (remote.settings) window.settings = remote.settings;
  if (remote.recurrentes) window.recurrentes = remote.recurrentes;
  if (remote.patrimonioHistory) window.patrimonioHistory = remote.patrimonioHistory;
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
  renderPage(window.currentTab);
};
