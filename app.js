// ============================================================
// app.js — Núcleo de la aplicación
// ============================================================
// Estado global, lógica de cálculo, modales, Firebase, exportar
// NOTA: Este archivo depende de data.js (cargado antes en index.html)
//       y renders.js (también cargado antes).
// ============================================================

// ── Toast notifications ─────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      display:flex; flex-direction:column; gap:8px; pointer-events:none;
    `;
    document.body.appendChild(container);
  }
  const colors = {
    success: {bg:'rgba(48,209,88,0.12)',  border:'rgba(48,209,88,0.35)',  color:'var(--green)'},
    error:   {bg:'rgba(255,69,58,0.12)',  border:'rgba(255,69,58,0.35)',  color:'var(--red)'},
    warn:    {bg:'rgba(255,159,10,0.12)', border:'rgba(255,159,10,0.35)', color:'var(--orange)'},
    info:    {bg:'rgba(10,132,255,0.12)', border:'rgba(10,132,255,0.35)', color:'var(--blue)'},
  };
  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding:12px 18px; border-radius:14px; font-size:14px; font-weight:600;
    background:${c.bg}; border:1px solid ${c.border}; color:${c.color};
    backdrop-filter:blur(12px); pointer-events:auto; cursor:default;
    box-shadow:0 4px 20px rgba(0,0,0,0.15);
    animation:toastIn 0.25s cubic-bezier(.34,1.56,.64,1) forwards;
    max-width:320px; line-height:1.4;
  `;
  toast.innerHTML = msg;
  container.appendChild(toast);
  if (!document.getElementById('toastStyles')) {
    const s = document.createElement('style');
    s.id = 'toastStyles';
    s.textContent = `
      @keyframes toastIn  { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:none; } }
      @keyframes toastOut { from { opacity:1; transform:none; } to { opacity:0; transform:translateY(8px) scale(0.95); } }
    `;
    document.head.appendChild(s);
  }
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

// ── LocalStorage helper ─────────────────────────────────────
const LS = {
  get(k) { try { const v = localStorage.getItem('fp_'+k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem('fp_'+k, JSON.stringify(v)); } catch {} },
};

// ── Estado offline ──────────────────────────────────────────
let _offlineQueue = LS.get('offlineQueue') || [];
let _isOnline = navigator.onLine;

function setOfflineBanner(state) {
  const b = document.getElementById('offlineBanner');
  const icon = document.getElementById('offlineIcon');
  const text = document.getElementById('offlineText');
  if (!b) return;
  if (state === 'offline')      { b.className = 'offline-banner show'; icon.textContent = '📴'; text.textContent = 'Sin internet — cambios guardados localmente'; }
  else if (state === 'syncing') { b.className = 'offline-banner show syncing'; icon.textContent = '⏳'; text.textContent = 'Sincronizando cambios pendientes…'; }
  else if (state === 'synced')  { b.className = 'offline-banner show synced'; icon.textContent = '✅'; text.textContent = '¡Sincronizado!'; setTimeout(() => { b.className = 'offline-banner'; }, 2500); }
  else { b.className = 'offline-banner'; }
}

function queueSave(data) { _offlineQueue = [{ data, ts: Date.now() }]; LS.set('offlineQueue', _offlineQueue); }

async function flushOfflineQueue() {
  if (!_offlineQueue.length) return;
  if (typeof window.saveToFirebase !== 'function') return;
  setOfflineBanner('syncing');
  try { await window.saveToFirebase(true); _offlineQueue = []; LS.set('offlineQueue', []); setOfflineBanner('synced'); }
  catch(e) { setOfflineBanner('offline'); }
}

window.addEventListener('online',  () => { _isOnline = true;  flushOfflineQueue(); });
window.addEventListener('offline', () => { _isOnline = false; setOfflineBanner('offline'); });

// ── Modo oscuro ─────────────────────────────────────────────
function toggleDark() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  LS.set('theme', dark ? 'light' : 'dark');
}
const savedTheme = LS.get('theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

// ── Estado de la aplicación ─────────────────────────────────
let platforms        = LS.get('platforms')       || DEFAULT_PLATFORMS;
let movements        = LS.get('movements')        || DEFAULT_MOVS;
let goals            = LS.get('goals')            || DEFAULT_GOALS;
let settings         = LS.get('settings')         || DEFAULT_SETTINGS;
let recurrentes      = LS.get('recurrentes')      || DEFAULT_RECURRENTES;
let patrimonioHistory= LS.get('patrimonioHistory')|| [];

platforms = platforms.map(p => ({tasaAnual:0, fechaInicio:'2026-02-01', moneda:'MXN', ...p}));

let currentTab = 'dashboard';
let movFilter  = {seccion:'todas', search:''};
let chartInstances = {};
let _lastLocalSave = 0;
let _chartRange = 'all';
let _projKey    = '1y';
let _fxCache    = null;
let priceUpdateState = {loading:false, lastUpdate:null};

const CHART_INTERVALS = [
  { key:'1m',  label:'1 mes',   months:1  },
  { key:'3m',  label:'3 meses', months:3  },
  { key:'6m',  label:'6 meses', months:6  },
  { key:'1y',  label:'1 año',   months:12 },
  { key:'3y',  label:'3 años',  months:36 },
  { key:'5y',  label:'5 años',  months:60 },
  { key:'7y',  label:'7 años',  months:84 },
  { key:'10y', label:'10 años', months:120},
];

// ── Guardar / Cargar ────────────────────────────────────────
function saveAll() {
  window.currentTab = currentTab;
  recalcularPlatformas();
  _lastLocalSave = Date.now();
  LS.set('platforms', platforms);
  LS.set('movements', movements);
  LS.set('goals', goals);
  LS.set('settings', settings);
  LS.set('recurrentes', recurrentes);
  LS.set('patrimonioHistory', patrimonioHistory);
  _recalcAndSaveSnapshot();
  renderPageInternal(currentTab);
  if (!_isOnline) { queueSave(window.getAppData()); setOfflineBanner('offline'); }
  else if (typeof window.saveToFirebase === 'function') { window.saveToFirebase(); }
}

function loadFromRemote(remote) {
  if (Date.now() - _lastLocalSave < 3000) return;
  if (remote.platforms)        platforms        = remote.platforms.map(p => ({tasaAnual:0,fechaInicio:'2026-02-01',moneda:'MXN',...p}));
  if (remote.movements)        movements        = remote.movements;
  if (remote.goals)            goals            = remote.goals;
  if (remote.settings)         settings         = remote.settings;
  if (remote.recurrentes)      recurrentes      = remote.recurrentes;
  if (remote.patrimonioHistory)patrimonioHistory= remote.patrimonioHistory;
  LS.set('platforms', platforms); LS.set('movements', movements); LS.set('goals', goals); LS.set('settings', settings);
  LS.set('recurrentes', recurrentes); LS.set('patrimonioHistory', patrimonioHistory);
  renderPageInternal(currentTab);
}

window.loadFromRemote = loadFromRemote;
window.getAppData = () => ({platforms, movements, goals, settings, recurrentes, patrimonioHistory});
window.currentTab = 'dashboard';

// ── Navegación ───────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab; window.currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(t => t.classList.remove('active'));
  const pageEl = document.getElementById('page-'+tab);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('[data-tab="'+tab+'"]').forEach(t => t.classList.add('active'));
  Object.keys(chartInstances).forEach(k => { if(chartInstances[k]){ chartInstances[k].destroy(); delete chartInstances[k]; } });
  renderPageInternal(tab);
}

document.querySelectorAll('.nav-tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

function renderPageInternal(tab) {
  if (tab==='dashboard')    window.renderDashboard();
  else if (tab==='movimientos') window.renderMovimientos();
  else if (tab==='plataformas') window.renderPlataformas();
  else if (tab==='gastos')      window.renderGastos();
  else if (tab==='metas')       window.renderMetas();
  else if (tab==='ajustes')     window.renderAjustes();
}
function renderPage(tab) { renderPageInternal(tab); }
window.renderPage = renderPage;

// ── Controles de gráfica ─────────────────────────────────────
function setChartRange(range) {
  _chartRange = range;
  Object.keys(chartInstances).forEach(k => { if(chartInstances[k]){ chartInstances[k].destroy(); delete chartInstances[k]; } });
  renderDashboard();
}
function setChartProj(key) {
  _projKey = key;
  Object.keys(chartInstances).forEach(k => { if(chartInstances[k]){ chartInstances[k].destroy(); delete chartInstances[k]; } });
  renderDashboard();
}
function toggleChartPanel() {
  const panel = document.getElementById('chartControlsPanel');
  const btn   = document.getElementById('chartToggleBtn');
  if (!panel || !btn) return;
  const isOpen = panel.classList.toggle('open');
  btn.className = 'chart-toggle-btn' + (isOpen ? ' open-state' : '');
  btn.innerHTML = isOpen ? '▲ Ocultar' : '▼ Controles';
}

// ── Modal ────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── Utilidades visuales ──────────────────────────────────────
function typeBadge(type){const map={'SOFIPO':'badge-green','BANCO':'badge-blue','BOLSA/ETFs':'badge-orange','CUENTA DIGITAL':'badge-purple','FONDOS':'badge-purple','FONDOS RETIRO':'badge-purple','DEUDA/CETES':'badge-blue'};return`<span class="badge ${map[type]||'badge-blue'}">${type}</span>`;}

// ── Cálculos ─────────────────────────────────────────────────
function getEurMxn() {
  const fx = _fxCache || LS.get('fxCache');
  if (fx && fx.eurmxn) return fx.eurmxn;
  return settings.tipoEUR || 21.5;
}

function platSaldoToMXN(p) {
  const tc = settings.tipoCambio || 20;
  const eurmxn = getEurMxn();
  const saldo = p.saldo || 0;
  if (p.moneda === 'USD') return saldo * tc;
  if (p.moneda === 'EUR') return saldo * eurmxn;
  return saldo;
}

function calcAutoYield(p, saldoBase, fechaRef) {
  const tasa = p.tasaAnual || 0;
  if (tasa <= 0 || saldoBase <= 0) return 0;
  let refDate = fechaRef ? new Date(fechaRef) : p.fechaInicio ? new Date(p.fechaInicio) : new Date();
  const dias = Math.max(0, Math.floor((new Date() - refDate) / (1000*60*60*24)));
  return saldoBase * (Math.pow(1 + tasa/100/365, dias) - 1);
}

function calcPlatforms() {
  return platforms.map(p => {
    const platMovs = movements.filter(m => m.seccion==='plataformas' && m.platform===p.name);
    let saldoBase = p.saldoInicial || 0;
    let rendimientoMov = 0, totalAportaciones = 0, totalRetiros = 0, totalGastos = 0;
    let ultimoSaldoFecha = p.fechaInicio || null, ultimoSaldoValor = saldoBase;
    const aportacionesDetalle = [];

    platMovs.forEach(m => {
      if (m.tipoPlat==='Saldo Actual')          { saldoBase=m.monto; ultimoSaldoFecha=m.fecha; ultimoSaldoValor=m.monto; }
      else if (m.tipoPlat==='Aportación')       { saldoBase+=m.monto; totalAportaciones+=m.monto; aportacionesDetalle.push({fecha:m.fecha,tipo:'Aportación',monto:m.monto,desc:m.desc||''}); }
      else if (m.tipoPlat==='Retiro')           { saldoBase-=m.monto; totalRetiros+=m.monto; aportacionesDetalle.push({fecha:m.fecha,tipo:'Retiro',monto:m.monto,desc:m.desc||''}); }
      else if (m.tipoPlat==='Rendimiento')      { rendimientoMov+=m.monto; saldoBase+=m.monto; }
      else if (m.tipoPlat==='Gasto')            { saldoBase-=m.monto; totalGastos+=m.monto; }
      else if (m.tipoPlat==='Transferencia salida') { saldoBase-=m.monto; totalRetiros+=m.monto; aportacionesDetalle.push({fecha:m.fecha,tipo:'Transfer. salida',monto:m.monto,desc:m.desc||''}); }
      else if (m.tipoPlat==='Transferencia entrada') { saldoBase+=m.monto; totalAportaciones+=m.monto; aportacionesDetalle.push({fecha:m.fecha,tipo:'Transfer. entrada',monto:m.monto,desc:m.desc||''}); }
      if (m.tipoPlat==='Saldo Actual') { ultimoSaldoFecha=m.fecha; ultimoSaldoValor=m.monto; }
    });

    const rendimientoAuto = calcAutoYield(p, ultimoSaldoValor, ultimoSaldoFecha);
    const saldoFinal = saldoBase + rendimientoAuto;
    const rendimientoTotal = rendimientoMov + rendimientoAuto;
    let diasDesdeRef = 0;
    if (ultimoSaldoFecha) { const diff = new Date() - new Date(ultimoSaldoFecha); diasDesdeRef = Math.max(0, Math.floor(diff/(1000*60*60*24))); }

    return {...p, saldo:saldoFinal, aportacion:totalAportaciones, retiro:totalRetiros, gasto:totalGastos, rendimiento:rendimientoTotal, rendimientoManual:rendimientoMov, rendimientoAuto, diasDesdeRef, fechaRefAuto:ultimoSaldoFecha, aportacionesDetalle};
  });
}

function recalcularPlatformas() {
  platforms = platforms.map(p => ({tasaAnual:0, fechaInicio:'2026-02-01', moneda:'MXN', ...p}));
}

function applyRecurrentes() {
  const cm=new Date().getMonth()+1, cy=new Date().getFullYear();
  const applied = settings.recurrentesApplied || {};
  const key = `${cy}-${cm}`;
  if (applied[key]) return 0;
  let count = 0;
  recurrentes.filter(r => r.activo).forEach(r => {
    const exists = movements.some(m => m.seccion==='gastos' && m.recurrenteId===r.id && m.fecha.startsWith(`${cy}-${String(cm).padStart(2,'0')}`));
    if (!exists) {
      const fechaMov = `${cy}-${String(cm).padStart(2,'0')}-${String(r.dia||1).padStart(2,'0')}`;
      movements.unshift({id:uid(), seccion:'gastos', fecha:fechaMov, categoria:r.categoria, tipo:'Gasto', importe:r.importe, notas:r.nombre+' (auto)', recurrenteId:r.id, esRecurrente:true});
      count++;
    }
  });
  if (count > 0) { if(!settings.recurrentesApplied) settings.recurrentesApplied={}; settings.recurrentesApplied[key]=true; LS.set('movements',movements); LS.set('settings',settings); }
  return count;
}

function getTickerPositions() {
  const tickers = {};
  movements.filter(m => m.seccion==='inversiones').forEach(m => {
    const t = m.ticker.toUpperCase();
    const moneda = (m.moneda||'USD').toUpperCase();
    const key = moneda==='MXN' ? t+'_MXN' : t;
    if (!tickers[key]) tickers[key] = {ticker:t, type:m.tipoActivo, moneda, cantC:0, cantV:0, costoTotal:0, ventasTotal:0, movs:[]};
    if (m.tipoMov==='Compra')  { tickers[key].cantC+=m.cantidad||0; tickers[key].costoTotal+=m.montoTotal||0; }
    if (m.tipoMov==='Venta')   { tickers[key].cantV+=m.cantidad||0; tickers[key].ventasTotal+=m.montoTotal||0; }
    tickers[key].movs.push(m);
  });
  return Object.values(tickers).map(t => {
    t.cantActual = t.cantC - t.cantV;
    t.precioCostoPromedio = t.cantC > 0 ? t.costoTotal/t.cantC : 0;
    const pi = getPriceInfo(t.ticker, t.type, t.moneda);
    t.precioActual=pi.price; t.priceLabel=pi.label; t.priceCssClass=pi.cssClass; t.priceTooltip=pi.tooltip||'';
    t.valorActual    = t.precioActual && t.cantActual>0 ? t.cantActual*t.precioActual : null;
    t.costoPosicion  = t.cantActual * t.precioCostoPromedio;
    t.gpNoRealizada  = t.valorActual!==null ? t.valorActual - t.costoPosicion : null;
    t.pctNoRealizada = t.costoPosicion>0 && t.gpNoRealizada!==null ? t.gpNoRealizada/t.costoPosicion : null;
    t.gpRealizada    = t.cantV>0 ? t.ventasTotal - (t.precioCostoPromedio*t.cantV) : 0;
    return t;
  });
}

function getBudgetAlerts() {
  const alerts = [];
  const cm=new Date().getMonth()+1, cy=new Date().getFullYear();
  const budgets = settings.budgets || {};
  const mesMovs = movements.filter(m => { const d=new Date(m.fecha); return m.seccion==='gastos'&&m.tipo==='Gasto'&&d.getMonth()+1===cm&&d.getFullYear()===cy; });
  const byCat = {}; mesMovs.forEach(m => { byCat[m.categoria]=(byCat[m.categoria]||0)+(m.importe||0); });
  EXPENSE_CATS.forEach(cat => {
    const pres=budgets[cat.id]||0, real=byCat[cat.id]||0;
    if (pres > 0) {
      const pct = real/pres;
      if (pct>=1)    alerts.push({level:'error',msg:`🔴 <strong>${cat.icon} ${cat.name}</strong>: presupuesto excedido (${fmt(real)} / ${fmt(pres)})`});
      else if(pct>=0.85) alerts.push({level:'warn',msg:`🟡 <strong>${cat.icon} ${cat.name}</strong>: al ${(pct*100).toFixed(0)}% del presupuesto`});
    }
  });
  return alerts;
}

// ── Snapshot de patrimonio ───────────────────────────────────
function _recalcAndSaveSnapshot() {
  const tc = settings.tipoCambio || 20;
  const eurmxn = getEurMxn();
  const plats = calcPlatforms();
  const totalMXN = plats.reduce((s,p) => {
    const saldo = p.saldo || 0;
    if (p.moneda==='USD') return s + saldo*tc;
    if (p.moneda==='EUR') return s + saldo*eurmxn;
    return s + saldo;
  }, 0);
  const tickers = getTickerPositions();
  const totalInvMXN = tickers.reduce((s,t) => {
    const val = t.valorActual !== null ? t.valorActual : t.costoPosicion;
    return s + (t.moneda==='MXN' ? val : val*tc);
  }, 0);
  savePatrimonioSnapshot(totalMXN + totalInvMXN);
}

function savePatrimonioSnapshot(value) {
  const todayStr = today();
  const idx = patrimonioHistory.findIndex(s => s.date===todayStr);
  const snap = {date:todayStr, value:Math.round(value)};
  if (idx===-1) { patrimonioHistory.push(snap); if(patrimonioHistory.length>365) patrimonioHistory=patrimonioHistory.slice(-365); }
  else { patrimonioHistory[idx] = snap; }
  LS.set('patrimonioHistory', patrimonioHistory);
}

// ── Precios ──────────────────────────────────────────────────
function getPriceCache()       { return LS.get('price_cache') || {}; }
function setPriceCache(c)      { LS.set('price_cache', c); }
function getCachedPrice(key)   { return (getPriceCache())[key] || null; }
function setCachedPrice(key,p,src) { const c=getPriceCache(); c[key]={price:p,source:src,ts:Date.now()}; setPriceCache(c); }
function isCacheFresh(ts)      { return (Date.now()-ts) < 4*60*60*1000; }

function getPriceInfo(ticker, type, moneda) {
  ticker=ticker.toUpperCase(); moneda=(moneda||'USD').toUpperCase();
  if (ticker==='USD'||type==='Efectivo USD') return {price:1,label:'$1.00',status:'fixed',cssClass:'price-cached'};
  const cacheKey = moneda==='MXN' ? ticker+'_MXN' : ticker;
  const c = getCachedPrice(cacheKey);
  if (c && isCacheFresh(c.ts)) {
    const t = new Date(c.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    const cur = moneda==='MXN' ? '$' : 'US$';
    return {price:c.price, label:cur+c.price.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}), status:'cached', cssClass:'price-live', tooltip:`${c.source} · hoy ${t}`, moneda};
  }
  return {price:null, label:'—', status:'none', cssClass:'price-fallback', tooltip:'Sin precio hoy', moneda};
}

function getPriceSummary() {
  const ts = new Map();
  movements.forEach(m => { if(m.seccion==='inversiones'&&m.ticker){ const key=(m.moneda==='MXN'?m.ticker.toUpperCase()+'_MXN':m.ticker.toUpperCase()); ts.set(key,{type:m.tipoActivo,moneda:m.moneda||'USD'}); } });
  let live=0, missing=0;
  ts.forEach((_,k)=>{ const c=getCachedPrice(k); if(c&&isCacheFresh(c.ts))live++; else missing++; });
  return {live, missing, total:ts.size};
}

async function fetchCryptoPrice(ticker) {
  const map={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',ADA:'cardano',DOT:'polkadot',MATIC:'matic-network',AVAX:'avalanche-2',LINK:'chainlink',UNI:'uniswap',ATOM:'cosmos',XRP:'ripple',BNB:'binancecoin',DOGE:'dogecoin',LTC:'litecoin',SHIB:'shiba-inu',NEAR:'near',ARB:'arbitrum',OP:'optimism',TON:'the-open-network'};
  const id = map[ticker.toUpperCase()] || ticker.toLowerCase();
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const d = await r.json();
    return d[id]?.usd || null;
  } catch { return null; }
}

async function fetchStockPrice(ticker) {
  if (!settings.finnhubKey) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${settings.finnhubKey}`);
    const d = await r.json();
    return (d.c && d.c > 0) ? d.c : null;
  } catch { return null; }
}

async function fetchMXPrice(ticker) {
  const queries = [`${ticker}.MX`,`${ticker}`];
  for (const q of queries) {
    for (let attempt=0; attempt<2; attempt++) {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${q}?interval=1d&range=1d`);
        if (!r.ok) continue;
        const d = await r.json();
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price && price > 0) return price;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return null;
}

async function fetchPrice(ticker, type, moneda) {
  ticker=ticker.toUpperCase(); moneda=(moneda||'USD').toUpperCase();
  if (ticker==='USD'||type==='Efectivo USD') return {price:1,source:'fixed',cached:false,ts:Date.now()};
  const cacheKey = moneda==='MXN' ? ticker+'_MXN' : ticker;
  const cached = getCachedPrice(cacheKey);
  if (cached && isCacheFresh(cached.ts)) return {...cached, cached:true};
  let price=null, source='none';
  if (type==='Crypto') { price=await fetchCryptoPrice(ticker); if(price!==null)source='coingecko'; }
  else if ((type==='Acción'||type==='ETF') && moneda==='MXN') { price=await fetchMXPrice(ticker); if(price!==null)source='yahoo-bmv-mxn'; else { price=await fetchStockPrice(ticker); if(price!==null){price=price*(settings.tipoCambio||20);source='finnhub-converted';} } }
  else if (type==='Acción'||type==='ETF') { price=await fetchStockPrice(ticker); if(price!==null)source='finnhub'; }
  else if (type==='Acción MX'||type==='ETF MX') { price=await fetchMXPrice(ticker); if(price!==null)source='yahoo-bmv'; }
  if (price !== null) { setCachedPrice(cacheKey, price, source); return {price, source, cached:false, ts:Date.now()}; }
  return null;
}

async function updateAllPrices(forceRefresh=false) {
  if (priceUpdateState.loading) return;
  priceUpdateState.loading = true;
  const btn = document.getElementById('btnUpdate');
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Actualizando...'; }
  await updateFX();
  const tickerSet = new Map();
  movements.forEach(m => { if(m.seccion==='inversiones'&&m.ticker){ const key=(m.moneda==='MXN'?m.ticker.toUpperCase()+'_MXN':m.ticker.toUpperCase()); tickerSet.set(key,{type:m.tipoActivo,moneda:m.moneda||'USD',ticker:m.ticker.toUpperCase()}); } });
  if (forceRefresh) { const c=getPriceCache(); tickerSet.forEach((_,k)=>{delete c[k];}); setPriceCache(c); }
  for (const [key, info] of tickerSet) {
    const b = document.getElementById('btnUpdate');
    if (b) b.innerHTML = `<span class="spinner"></span> ${info.ticker}...`;
    await fetchPrice(info.ticker, info.type, info.moneda);
    await new Promise(r => setTimeout(r, 300));
  }
  priceUpdateState.loading = false;
  priceUpdateState.lastUpdate = new Date();
  _recalcAndSaveSnapshot();
  renderPage(currentTab);
}

async function fetchFX() {
  const cached = LS.get('fxCache');
  if (cached && isCacheFresh(cached.ts)) { _fxCache=cached; return cached; }
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN,EUR');
    if (!r.ok) throw new Error();
    const d = await r.json();
    const result = {usdmxn:d.rates.MXN, usdeur:d.rates.EUR, eurmxn:d.rates.MXN/d.rates.EUR, ts:Date.now()};
    LS.set('fxCache', result); _fxCache=result; return result;
  } catch { return _fxCache || {usdmxn:settings.tipoCambio||20, usdeur:0.92, eurmxn:(settings.tipoCambio||20)/0.92, ts:0}; }
}

async function updateFX() {
  const fx = await fetchFX();
  if (fx && fx.usdmxn && fx.ts && isCacheFresh(fx.ts)) {
    settings.tipoCambio = Math.round(fx.usdmxn*100)/100;
    settings.tipoEUR    = Math.round(fx.eurmxn*100)/100;
    LS.set('settings', settings);
    const inpUSD = document.getElementById('inputTCUSD');
    const inpEUR = document.getElementById('inputTCEUR');
    if (inpUSD) inpUSD.value = settings.tipoCambio;
    if (inpEUR) inpEUR.value = settings.tipoEUR;
    updateNavFX();
    _recalcAndSaveSnapshot();
  }
  return fx;
}

function updateNavFX() {
  const sub = document.getElementById('navSub');
  if (!sub) return;
  const fx = _fxCache || LS.get('fxCache');
  const usd = fx?.usdmxn ? `<span>USD $${fx.usdmxn.toFixed(2)}</span>` : '';
  const eur = fx?.eurmxn ? `<span>EUR $${fx.eurmxn.toFixed(2)}</span>` : '';
  if (usd || eur) sub.innerHTML = usd + (usd&&eur?'<span style="opacity:0.3">·</span>':'') + eur;
}

// ── Nav patrimonio ────────────────────────────────────────────
function updateNav(patrimonio, totalMXN, totalUSD, tc, totalRend) {
  const el1 = document.getElementById('navTotal'), el2 = document.getElementById('navSub');
  if (el1) el1.textContent = fmt(patrimonio);
  const fx = _fxCache || LS.get('fxCache');
  const eurStr = fx?.eurmxn ? `<span>EUR $${fx.eurmxn.toFixed(2)}</span>` : '';
  if (el2) el2.innerHTML = `<span>🇲🇽 ${fmt(totalMXN)}</span><span>🇺🇸 ${fmt(totalUSD,'USD')}</span><span>💱 $${tc}</span>${eurStr}<span style="color:${pctCol(totalRend)};font-weight:600">${totalRend>=0?'▲':'▼'} ${fmt(totalRend)}</span>`;
}

function updateNavUser(user) {
  const el = document.getElementById('navUser'); if (!el) return;
  const darkBtn = `<button class="dark-toggle" onclick="toggleDark()" title="Modo oscuro" style="margin-right:4px"><span class="dark-toggle-icon dark-toggle-moon">🌙</span><span class="dark-toggle-icon dark-toggle-sun">☀️</span></button>`;
  if (user) el.innerHTML = `${darkBtn}${user.photoURL?`<img src="${user.photoURL}" class="nav-avatar">`:`<div class="nav-avatar-placeholder">${(user.displayName||user.email||'U')[0].toUpperCase()}</div>`}<button class="btn-signout" onclick="window.signOutUser()">Salir</button>`;
}

// ── Exportar datos ────────────────────────────────────────────
function exportData() {
  const data = {platforms,movements,goals,settings,recurrentes,patrimonioHistory,exportDate:new Date().toISOString(),version:'4.5'};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`finanzas-pro-${today()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 JSON exportado correctamente', 'success');
}

// ── ✨ NUEVO: Exportar a CSV ──────────────────────────────────
// Exporta todos los movimientos visibles a un archivo .csv
// compatible con Excel y Google Sheets.
function exportCSV() {
  const cols = ['Fecha','Sección','Plataforma/Ticker','Tipo','Movimiento','Monto','Moneda','Extra','Notas'];
  const rows = movements
    .filter(m => movFilter.seccion==='todas' || m.seccion===movFilter.seccion)
    .sort((a,b) => new Date(b.fecha)-new Date(a.fecha))
    .map(m => {
      let plat='', tipo='', movTipo='', monto='', moneda='', extra='', notas=m.notas||m.desc||'';
      if (m.seccion==='plataformas') {
        plat=m.platform; tipo=m.tipoPlat; monto=m.monto; moneda='MXN';
      } else if (m.seccion==='inversiones') {
        plat=m.ticker+' ('+m.broker+')'; tipo=m.tipoActivo; movTipo=m.tipoMov;
        monto=m.montoTotal; moneda=m.moneda||'USD'; extra=m.cantidad+'×'+m.precioUnit;
      } else {
        plat=catName(m.categoria); tipo=m.tipo; monto=m.importe; moneda='MXN';
      }
      return [m.fecha, m.seccion, plat, tipo, movTipo, monto, moneda, extra, notas]
        .map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',');
    });

  const csv = [cols.map(c=>`"${c}"`).join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`movimientos-${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast(`📊 CSV exportado (${rows.length} movimientos)`, 'success');
}

function importData(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.platforms) platforms = d.platforms.map(p=>({tasaAnual:0,fechaInicio:'2026-02-01',moneda:'MXN',...p}));
      if (d.movements) movements = d.movements;
      if (d.goals)     goals     = d.goals;
      if (d.settings)  settings  = d.settings;
      if (d.recurrentes) recurrentes = d.recurrentes;
      if (d.patrimonioHistory) patrimonioHistory = d.patrimonioHistory;
      saveAll();
      showToast('✅ Datos importados correctamente', 'success');
    } catch {
      showToast('❌ Archivo inválido — revisa el formato', 'error');
    }
  };
  r.readAsText(file);
}

function resetAll() {
  platforms        = DEFAULT_PLATFORMS.map(p=>({...p}));
  movements        = JSON.parse(JSON.stringify(DEFAULT_MOVS));
  goals            = [...DEFAULT_GOALS];
  settings         = {...DEFAULT_SETTINGS};
  recurrentes      = JSON.parse(JSON.stringify(DEFAULT_RECURRENTES));
  patrimonioHistory = [];
  LS.set('price_cache', {});
  saveAll();
  setTimeout(() => updateAllPrices(false), 500);
  showToast('🗑 Datos reseteados', 'warn');
}

// ── Plataformas — acciones ────────────────────────────────────
function showAportaciones(platformId) {
  const plats = calcPlatforms();
  const p = plats.find(p => p.id===platformId);
  if (!p || !p.aportacionesDetalle || p.aportacionesDetalle.length===0) {
    showToast('No hay movimientos de aportación para esta plataforma', 'info'); return;
  }
  let html = `<div class="modal-header"><div class="modal-title">📋 Detalle de Aportaciones — ${p.name}</div><button class="modal-close" onclick="closeModal()">✕</button></div>`;
  html += '<table style="width:100%"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Descripción</th></tr></thead><tbody>';
  p.aportacionesDetalle.forEach(d => { html += `<tr><td>${d.fecha}</td><td>${d.tipo}</td><td>${fmtPlat(d.monto,p.moneda)}</td><td>${d.desc||'—'}</td></tr>`; });
  html += '</tbody></table>';
  openModal(html);
}

function editPlatField(id, field, el, inputType) {
  const p = platforms.find(x=>x.id===id); if (!p) return;
  let input;
  if (inputType==='date') { input=document.createElement('input');input.type='date';input.value=p[field]||today();input.className='form-input';input.style.cssText='width:130px;padding:4px 8px;font-size:12px'; }
  else if (inputType==='percent') { input=document.createElement('input');input.type='number';input.step='0.01';input.min='0';input.max='100';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:90px;padding:4px 8px;font-size:12px'; }
  else if (inputType==='moneda') {
    input=document.createElement('select');input.className='form-select';input.style.cssText='width:100px;padding:4px 8px;font-size:12px';
    PLAT_MONEDAS.forEach(m=>{const opt=document.createElement('option');opt.value=m;opt.textContent=m==='MXN'?'🇲🇽 MXN':m==='USD'?'🇺🇸 USD':'🇪🇺 EUR';if(p[field]===m)opt.selected=true;input.appendChild(opt);});
  }
  else { input=document.createElement('input');input.type='number';input.step='any';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:110px;padding:4px 8px;font-size:12px'; }
  const finish = () => { const val=inputType==='date'||inputType==='moneda'?input.value:(Number(input.value)||0); platforms=platforms.map(x=>x.id!==id?x:{...x,[field]:val}); saveAll(); };
  input.onblur=finish; input.onkeydown=e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape')saveAll();};
  if (inputType==='moneda') input.onchange=finish;
  el.replaceWith(input); input.focus();
}

function deletePlatform(id) {
  platforms = platforms.filter(p => p.id!==id); saveAll();
  showToast('🗑 Plataforma eliminada', 'warn');
}

function openAddPlatformModal() {
  openModal(`<div class="modal-header"><div class="modal-title">Nueva Plataforma</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form onsubmit="addPlatform();return false">
      <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="npName" placeholder="Ej: Banco Azteca" required></div>
      <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="npType">${PLAT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Grupo</label><select class="form-select" id="npGroup">${PLAT_GROUPS.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" id="npMoneda"><option value="MXN">🇲🇽 MXN</option><option value="USD">🇺🇸 USD</option><option value="EUR">🇪🇺 EUR</option></select></div></div>
      <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Saldo Inicial</label><input type="number" class="form-input" id="npSaldo" placeholder="0" value="0"></div><div class="form-group"><label class="form-label">⚡ Tasa Anual %</label><input type="number" step="0.01" min="0" max="100" class="form-input" id="npTasa" placeholder="ej: 13.5" value="0"></div></div>
      <div class="form-group"><label class="form-label">Fecha inicio</label><input type="date" class="form-input" id="npFecha" value="${today()}"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">Agregar</button>
    </form>`);
}

function addPlatform() {
  const name = document.getElementById('npName').value; if (!name) return;
  platforms.push({id:uid(), name, type:document.getElementById('npType').value, group:document.getElementById('npGroup').value, moneda:document.getElementById('npMoneda').value||'MXN', saldoInicial:Number(document.getElementById('npSaldo').value)||0, tasaAnual:Number(document.getElementById('npTasa').value)||0, fechaInicio:document.getElementById('npFecha').value||today()});
  saveAll(); closeModal();
  showToast('✅ Plataforma agregada', 'success');
}

// ── Presupuesto / Ingresos ────────────────────────────────────
function updateBudget(catId, value) { if(!settings.budgets)settings.budgets={}; settings.budgets[catId]=Number(value)||0; saveAll(); }
function updateIngreso(tipo, value) { if(!settings.ingresos)settings.ingresos={}; settings.ingresos[tipo]=Number(value)||0; saveAll(); }
function updateIngresoConMoneda(tipo, value, moneda) {
  if(!settings.ingresos)settings.ingresos={};
  const raw=Number(value)||0; settings.ingresos.monedaSueldo=moneda; settings.ingresos.sueldoRaw=raw;
  if(moneda==='EUR'){settings.ingresos[tipo]=Math.round(raw*getEurMxn()*100)/100;}else{settings.ingresos[tipo]=raw;}
  saveAll();
}

// ── Recurrentes ───────────────────────────────────────────────
function openRecurrentesModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🔄 Gastos Recurrentes</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="recList">
      ${recurrentes.map(r=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card2);border-radius:12px;margin-bottom:8px">
          <div style="font-size:20px">${r.icon||'📌'}</div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${r.nombre}</div><div style="font-size:11px;color:var(--text2)">${r.frecuencia} · día ${r.dia}</div></div>
          <div style="font-size:15px;font-weight:800;color:var(--red);margin-right:8px">-${fmt(r.importe)}</div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0"><input type="checkbox" ${r.activo?'checked':''} onchange="toggleRecurrente('${r.id}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px"><span style="font-size:11px;color:var(--text2)">${r.activo?'Activo':'Pausado'}</span></label>
          <button class="del-btn" onclick="deleteRecurrente('${r.id}')">×</button>
        </div>`).join('')}
    </div>
    <div style="margin-top:16px;padding:16px;background:var(--card2);border-radius:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">+ Nuevo recurrente</div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="rNombre" placeholder="Netflix, Gym..." oninput="syncRecurrenteName(this.value)"></div>
        <div class="form-group"><label class="form-label">Categoría</label><select class="form-select" id="rCat">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-row form-row-3">
        <div class="form-group"><label class="form-label">Importe</label><input type="number" class="form-input" id="rImporte" placeholder="0"></div>
        <div class="form-group"><label class="form-label">Frecuencia</label><select class="form-select" id="rFrec">${FRECUENCIAS.map(f=>`<option>${f}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Día del mes</label><input type="number" class="form-input" id="rDia" min="1" max="31" value="1"></div>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="addRecurrente()">+ Agregar</button>
    </div>
  `);
}

function syncRecurrenteName(val) { /* placeholder */ }

function addRecurrente() {
  const nombre = document.getElementById('rNombre').value; if (!nombre) return;
  recurrentes.push({id:uid(), nombre, categoria:document.getElementById('rCat').value, importe:Number(document.getElementById('rImporte').value)||0, frecuencia:document.getElementById('rFrec').value, dia:Number(document.getElementById('rDia').value)||1, icon:'📌', color:'#0A84FF', activo:true});
  saveAll(); openRecurrentesModal();
  showToast('✅ Recurrente agregado', 'success');
}

function toggleRecurrente(id, val) { recurrentes=recurrentes.map(r=>r.id!==id?r:{...r,activo:val}); saveAll(); }

function deleteRecurrente(id) {
  recurrentes = recurrentes.filter(r=>r.id!==id); saveAll(); openRecurrentesModal();
  showToast('🗑 Recurrente eliminado', 'warn');
}

// ── Metas ─────────────────────────────────────────────────────
function openGoalModal() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🎯 Nueva Meta</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form onsubmit="addGoal();return false">
      <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="gNombre" placeholder="Ej: Portafolio $1M" required></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Clase</label><select class="form-select" id="gClase"><option value="Todos">Todos (Patrimonio)</option><option value="Plataformas">Plataformas</option><option value="Inversiones">Inversiones</option><option value="Ingreso Mensual">Ingreso Mensual</option></select></div>
        <div class="form-group"><label class="form-label">Meta</label><input type="number" class="form-input" id="gMeta" placeholder="1000000" required></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Fecha límite</label><input type="date" class="form-input" id="gFecha"></div>
        <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="gDesc" placeholder="Opcional..."></div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">Crear Meta</button>
    </form>
  `);
}

function addGoal() {
  const nombre = document.getElementById('gNombre').value; if (!nombre) return;
  goals.push({id:uid(), nombre, clase:document.getElementById('gClase').value, meta:Number(document.getElementById('gMeta').value)||0, fechaLimite:document.getElementById('gFecha').value||'', descripcion:document.getElementById('gDesc').value||''});
  saveAll(); closeModal();
  showToast('🎯 Meta creada', 'success');
}

function deleteGoal(id) {
  goals = goals.filter(g=>g.id!==id); saveAll();
  showToast('🗑 Meta eliminada', 'warn');
}

// ── Movimientos — modal nuevo/editar ─────────────────────────
function openMovModal(sec) {
  const s = sec || 'plataformas';
  openModal(`
    <div class="modal-header"><div class="modal-title">Nuevo Movimiento</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="sec-tabs">
      <button class="sec-tab ${s==='plataformas'?'active-plat':''}"   onclick="closeModal();openMovModal('plataformas')">🏦 Plataforma</button>
      <button class="sec-tab ${s==='inversiones'?'active-inv':''}"    onclick="closeModal();openMovModal('inversiones')">📈 Inversión</button>
      <button class="sec-tab ${s==='gastos'?'active-gasto':''}"       onclick="closeModal();openMovModal('gastos')">💳 Gasto</button>
      <button class="sec-tab ${s==='transferencia'?'active-transfer':''}" onclick="closeModal();openMovModal('transferencia')">↔ Transferencia</button>
    </div>
    <form id="movForm" onsubmit="saveMovement('${s}');return false">
      ${s==='plataformas'?`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Plataforma</label><select class="form-select" name="platform" required><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipoPlat">${['Saldo Actual','Aportación','Retiro','Gasto'].map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Monto</label><input type="number" step="any" class="form-input" name="monto" placeholder="0" required></div></div>
        <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" name="desc" placeholder="Opcional..."></div>
      `:s==='inversiones'?`
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Tipo Activo</label><select class="form-select" name="tipoActivo">${ASSET_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Movimiento</label><select class="form-select" name="tipoMov">${['Compra','Venta','Dividendo','Comisión'].map(t=>`<option>${t}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Ticker</label><input class="form-input" name="ticker" placeholder="AAPL, BTC..." required style="text-transform:uppercase"></div><div class="form-group"><label class="form-label">Broker</label><input list="brokerList" class="form-input" name="broker" placeholder="Binance, GBM..."><datalist id="brokerList">${BROKERS.map(b=>`<option value="${b}">`).join('')}</datalist></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" name="moneda"><option value="USD">🇺🇸 USD</option><option value="MXN">🇲🇽 MXN</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" step="any" class="form-input" name="cantidad" placeholder="0" required></div><div class="form-group"><label class="form-label">Precio Unitario</label><input type="number" step="any" class="form-input" name="precioUnit" placeholder="0" required></div><div class="form-group"><label class="form-label">Comisión</label><input type="number" step="any" class="form-input" name="comision" placeholder="0" value="0"></div></div>
        <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" placeholder="Opcional..."></div>
      `:s==='gastos'?`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipo"><option>Gasto</option><option>Ingreso</option></select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Categoría</label><select class="form-select" name="categoria">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Importe</label><input type="number" step="any" class="form-input" name="importe" placeholder="0" required></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" name="monedaGasto"><option value="MXN">🇲🇽 MXN</option><option value="EUR">🇪🇺 EUR</option></select></div><div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" placeholder="Opcional..."></div></div>
      `:/* transferencia */`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Origen</label><select class="form-select" name="platOrigen"><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Destino</label><select class="form-select" name="platDestino"><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Monto</label><input type="number" step="any" class="form-input" name="monto" placeholder="0" required></div><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}"></div></div>
        <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" name="desc" placeholder="Opcional..."></div>
      `}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px">💾 Guardar</button>
    </form>
  `);
}

function saveMovement(sec) {
  const f = document.getElementById('movForm');
  const d = Object.fromEntries(new FormData(f));
  if (sec==='transferencia') {
    if (!d.platOrigen||!d.platDestino||!d.monto) return;
    if (d.platOrigen===d.platDestino) { showToast('⚠️ Origen y destino deben ser distintos','warn'); return; }
    const tid = uid();
    movements = [{id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platOrigen,tipoPlat:'Transferencia salida',monto:Number(d.monto),desc:d.desc||'Transferencia',transferId:tid},{id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platDestino,tipoPlat:'Transferencia entrada',monto:Number(d.monto),desc:d.desc||'Transferencia',transferId:tid},...movements];
    saveAll(); closeModal(); showToast('↔ Transferencia registrada','success'); return;
  }
  let mov = {id:uid(), seccion:sec, fecha:d.fecha||today()};
  if (sec==='plataformas') { if(!d.platform||!d.monto)return; mov.platform=d.platform;mov.tipoPlat=d.tipoPlat;mov.monto=Number(d.monto);mov.desc=d.desc||''; }
  else if (sec==='inversiones') { if(!d.ticker||!d.cantidad||!d.precioUnit)return; mov.tipoActivo=d.tipoActivo;mov.ticker=d.ticker.toUpperCase();mov.broker=d.broker;mov.tipoMov=d.tipoMov;mov.cantidad=Number(d.cantidad);mov.precioUnit=Number(d.precioUnit);mov.montoTotal=mov.cantidad*mov.precioUnit;mov.moneda=d.moneda||'USD';mov.comision=Number(d.comision)||0;mov.notas=d.notas||''; }
  else { if(!d.importe)return; mov.categoria=d.categoria;mov.tipo=d.tipo; const importeRaw=Number(d.importe); const monedaGasto=d.monedaGasto||'MXN'; if(monedaGasto==='EUR'){const eurmxn=getEurMxn();mov.importe=Math.round(importeRaw*eurmxn*100)/100;mov.notas=(d.notas?d.notas+' · ':'')+'€'+importeRaw+' → $'+mov.importe+' MXN (TC '+eurmxn.toFixed(2)+')';}else{mov.importe=importeRaw;mov.notas=d.notas||'';} }
  movements = [mov, ...movements]; saveAll(); closeModal();
  showToast('✅ Movimiento guardado', 'success');
}

function deleteMovement(id) {
  const mov = movements.find(m=>m.id===id);
  if (mov&&mov.transferId) { movements=movements.filter(m=>m.transferId!==mov.transferId); }
  else { movements=movements.filter(m=>m.id!==id); }
  saveAll();
  showToast('🗑 Movimiento eliminado', 'warn');
}

function openEditMovModal(id) {
  const m = movements.find(x=>x.id===id); if (!m) return;
  const sec = m.seccion;
  openModal(`
    <div class="modal-header"><div class="modal-title">✏️ Editar Movimiento</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="editForm" onsubmit="updateMovement('${id}');return false">
      ${sec==='plataformas'?`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">Plataforma</label><select class="form-select" name="platform" required>${platforms.map(p=>`<option value="${p.name}" ${m.platform===p.name?'selected':''}>${p.name}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipoPlat">${['Saldo Actual','Aportación','Retiro','Gasto'].map(t=>`<option ${m.tipoPlat===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Monto</label><input type="number" step="any" class="form-input" name="monto" value="${m.monto}" required></div></div>
        <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" name="desc" value="${m.desc||''}"></div>
      `:sec==='inversiones'?`
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">Tipo Activo</label><select class="form-select" name="tipoActivo">${ASSET_TYPES.map(t=>`<option ${m.tipoActivo===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Movimiento</label><select class="form-select" name="tipoMov">${['Compra','Venta','Dividendo','Comisión'].map(t=>`<option ${m.tipoMov===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Ticker</label><input class="form-input" name="ticker" value="${m.ticker}" required style="text-transform:uppercase"></div><div class="form-group"><label class="form-label">Broker</label><input list="brokerListE" class="form-input" name="broker" value="${m.broker||''}"><datalist id="brokerListE">${BROKERS.map(b=>`<option value="${b}">`).join('')}</datalist></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" name="moneda"><option value="USD" ${(m.moneda||'USD')==='USD'?'selected':''}>USD</option><option value="MXN" ${m.moneda==='MXN'?'selected':''}>MXN</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" step="any" class="form-input" name="cantidad" value="${m.cantidad}" required></div><div class="form-group"><label class="form-label">Precio Unitario</label><input type="number" step="any" class="form-input" name="precioUnit" value="${m.precioUnit}" required></div><div class="form-group"><label class="form-label">Comisión</label><input type="number" step="any" class="form-input" name="comision" value="${m.comision||0}"></div></div>
        <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" value="${m.notas||''}"></div>
      `:`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipo"><option ${m.tipo==='Gasto'?'selected':''}>Gasto</option><option ${m.tipo==='Ingreso'?'selected':''}>Ingreso</option></select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Categoría</label><select class="form-select" name="categoria">${EXPENSE_CATS.map(c=>`<option value="${c.id}" ${m.categoria===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Importe</label><input type="number" step="any" class="form-input" name="importe" value="${m.importe}" required></div></div>
        <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" value="${m.notas||''}"></div>
      `}
      <div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary" style="flex:1;padding:14px">💾 Guardar</button><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button></div>
    </form>
  `);
}

function updateMovement(id) {
  const f=document.getElementById('editForm'); const d=Object.fromEntries(new FormData(f));
  movements = movements.map(m => {
    if (m.id!==id) return m;
    const sec=m.seccion; let updated={...m, fecha:d.fecha||m.fecha};
    if (sec==='plataformas') { updated.platform=d.platform;updated.tipoPlat=d.tipoPlat;updated.monto=Number(d.monto);updated.desc=d.desc||''; }
    else if (sec==='inversiones') { updated.tipoActivo=d.tipoActivo;updated.ticker=d.ticker.toUpperCase();updated.broker=d.broker;updated.tipoMov=d.tipoMov;updated.cantidad=Number(d.cantidad);updated.precioUnit=Number(d.precioUnit);updated.montoTotal=updated.cantidad*updated.precioUnit;updated.moneda=d.moneda||'USD';updated.comision=Number(d.comision)||0;updated.notas=d.notas||''; }
    else { updated.categoria=d.categoria;updated.tipo=d.tipo;updated.importe=Number(d.importe);updated.notas=d.notas||''; }
    return updated;
  });
  saveAll(); closeModal();
  showToast('✅ Movimiento actualizado', 'success');
}

// ── Finnhub test ──────────────────────────────────────────────
async function testFinnhub() {
  const k=settings.finnhubKey, el=document.getElementById('finnhubTestResult');
  if (!k) { el.innerHTML='<span style="color:var(--red)">⚠️ Ingresa tu API key</span>'; return; }
  el.innerHTML='<span class="spinner"></span> Probando...';
  try {
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`), d=await r.json();
    if (d.c&&d.c>0) el.innerHTML=`<span style="color:var(--green)">✅ AAPL: $${d.c.toFixed(2)}</span>`;
    else el.innerHTML='<span style="color:var(--orange)">⚠️ Respuesta inesperada</span>';
  } catch(e) { el.innerHTML=`<span style="color:var(--red)">❌ ${e.message}</span>`; }
}

// ── Sobrante (usado en modales de Gastos) ────────────────────
function calcSobranteMes(mesKey) {
  const eurmxn = getEurMxn();
  const toEUR = m => {
    if (m.monedaOrig==='EUR') return m.importeEUR||m.importe;
    if (m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
    return Math.round(m.importe/eurmxn*100)/100;
  };
  const gastos  = movements.filter(mv=>mv.seccion==='gastos'&&mv.tipo==='Gasto'  &&mv.fecha?.startsWith(mesKey));
  const ingresos= movements.filter(mv=>mv.seccion==='gastos'&&mv.tipo==='Ingreso'&&mv.fecha?.startsWith(mesKey));
  const totG = gastos.reduce((s,mv)=>s+toEUR(mv),0);
  const totI = ingresos.reduce((s,mv)=>s+toEUR(mv),0);
  const ing = settings.ingresos||{};
  const sueldoEUR = ing.monedaSueldo==='EUR'?(ing.sueldoRaw||0):(ing.sueldo||0);
  const ingRef = totI>0?totI:(sueldoEUR+(ing.extrasEUR||ing.extras||0)+(ing.otrosEUR||ing.otros||0));
  return Math.max(0, Math.round((ingRef-totG)*100)/100);
}

function actualizarMontoSobrante(mesKey) {
  const inp=document.getElementById('inputMontoSob');
  if (inp) inp.value = calcSobranteMes(mesKey);
}

// ── Exportar funciones globales ──────────────────────────────
window.toggleDark        = toggleDark;
window.switchTab         = switchTab;
window.openModal         = openModal;
window.closeModal        = closeModal;
window.setChartRange     = setChartRange;
window.setChartProj      = setChartProj;
window.toggleChartPanel  = toggleChartPanel;
window.showAportaciones  = showAportaciones;
window.editPlatField     = editPlatField;
window.deletePlatform    = deletePlatform;
window.openAddPlatformModal = openAddPlatformModal;
window.addPlatform       = addPlatform;
window.updateBudget      = updateBudget;
window.updateIngreso     = updateIngreso;
window.updateIngresoConMoneda = updateIngresoConMoneda;
window.openRecurrentesModal = openRecurrentesModal;
window.syncRecurrenteName= syncRecurrenteName;
window.addRecurrente     = addRecurrente;
window.toggleRecurrente  = toggleRecurrente;
window.deleteRecurrente  = deleteRecurrente;
window.openGoalModal     = openGoalModal;
window.addGoal           = addGoal;
window.deleteGoal        = deleteGoal;
window.testFinnhub       = testFinnhub;
window.exportData        = exportData;
window.exportCSV         = exportCSV;
window.importData        = importData;
window.resetAll          = resetAll;
window.openMovModal      = openMovModal;
window.saveMovement      = saveMovement;
window.deleteMovement    = deleteMovement;
window.openEditMovModal  = openEditMovModal;
window.updateMovement    = updateMovement;
window.updateAllPrices   = updateAllPrices;
window.actualizarMontoSobrante = actualizarMontoSobrante;
window.showToast         = showToast;

// ── Firebase ─────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig={apiKey:"AIzaSyDUAOlDXmkBRQNoYgmax9KOMjQrZd061Q8",authDomain:"control-de-inversion.firebaseapp.com",projectId:"control-de-inversion",storageBucket:"control-de-inversion.firebasestorage.app",messagingSenderId:"955139190781",appId:"1:955139190781:web:b73653484f5f96b7e23394"};
const fbApp=initializeApp(firebaseConfig), db=getFirestore(fbApp), auth=getAuth(fbApp);
const DOC_REF=doc(db,"finanzas","main");

function setFbStatus(s){
  let el=document.getElementById('fbStatus');
  if(!el){el=document.createElement('div');el.id='fbStatus';el.style.cssText='font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;white-space:nowrap;transition:all 0.3s;flex-shrink:0';const nav=document.querySelector('.nav-inner');if(nav)nav.appendChild(el);}
  const map={syncing:['⏳ Sync...','rgba(10,132,255,0.1)','#0A84FF'],ok:['☁️ Sincronizado','rgba(48,209,88,0.1)','#30D158'],error:['⚠️ Sin conexión','rgba(255,69,58,0.1)','#FF453A'],offline:['📴 Offline','rgba(0,0,0,0.06)','#86868B']};
  const[text,bg,color]=map[s]||map.offline; el.textContent=text; el.style.background=bg; el.style.color=color;
}

function showApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('mainNav').style.display='';
  document.getElementById('mainContainer').style.display='';
  const mob = document.getElementById('mobileNav');
  if (mob) mob.style.display='';
}
function showLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('mainNav').style.display='none';
  document.getElementById('mainContainer').style.display='none';
  const mob = document.getElementById('mobileNav');
  if (mob) mob.style.display='none';
}

document.getElementById('btnGoogleLogin').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e) { const err=document.getElementById('loginError'); if(err){err.style.display='block';err.textContent=e.code==='auth/popup-closed-by-user'?'':e.message||'Error al iniciar sesión.';} }
});

let _ignoreSnap=false, _saveTimeout=null, _unsub=null;

function setupFirestore() {
  if (_unsub) { _unsub(); _unsub=null; }
  _unsub=onSnapshot(DOC_REF, snap=>{
    if (_ignoreSnap){_ignoreSnap=false;return;}
    if (!snap.exists()){window.saveToFirebase();return;}
    setFbStatus('ok');
    if (window.loadFromRemote) window.loadFromRemote(snap.data());
  }, err=>{console.error(err);setFbStatus('error');});
}

window.saveToFirebase = async(forceImmediate=false) => {
  const doSave = async () => {
    setFbStatus('syncing');
    try {
      _ignoreSnap=true;
      const d=window.getAppData?window.getAppData():{};
      await setDoc(DOC_REF, {platforms:d.platforms||[],movements:d.movements||[],goals:d.goals||[],settings:d.settings||{},recurrentes:d.recurrentes||[],patrimonioHistory:d.patrimonioHistory||[],updatedAt:serverTimestamp(),device:navigator.userAgent.substring(0,60)});
      setFbStatus('ok');
    } catch(e) { setFbStatus('error'); console.error(e); if(!navigator.onLine){window.queueSave&&window.queueSave(window.getAppData&&window.getAppData());} throw e; }
  };
  if (forceImmediate) { await doSave(); return; }
  clearTimeout(_saveTimeout); _saveTimeout=setTimeout(doSave,1500);
};

window.signOutUser = async () => {
  if (_unsub){_unsub();_unsub=null;}
  await signOut(auth); showLogin();
};

onAuthStateChanged(auth, user => {
  if (user) {
    window._currentUser=user;
    if (typeof updateNavUser==='function') updateNavUser(user);
    showApp(); setupFirestore();
    if (window.renderPage) window.renderPage(window.currentTab||'dashboard');
    setTimeout(() => {
      if (typeof updateFX==='function') updateFX();
      const s=typeof getPriceSummary==='function'?getPriceSummary():{total:0,missing:0};
      if (s.total>0&&s.missing>0&&typeof updateAllPrices==='function') updateAllPrices(false);
      if (typeof flushOfflineQueue==='function') flushOfflineQueue();
    }, 1200);
  } else { window._currentUser=null; if(_unsub){_unsub();_unsub=null;} showLogin(); }
});

window.addEventListener('online',  () => setFbStatus('ok'));
window.addEventListener('offline', () => setFbStatus('offline'));
