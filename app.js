// ==================== MÓDULO PRINCIPAL ====================
const LS = {
  get(k) { try { const v = localStorage.getItem('fp_'+k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem('fp_'+k, JSON.stringify(v)); } catch {} },
};

let _offlineQueue = LS.get('offlineQueue') || [];
let _isOnline = navigator.onLine;

function setOfflineBanner(state) {
  const b = document.getElementById('offlineBanner');
  const icon = document.getElementById('offlineIcon');
  const text = document.getElementById('offlineText');
  if (!b) return;
  if (state === 'offline') { b.className = 'offline-banner show'; icon.textContent = '📴'; text.textContent = 'Sin internet — cambios guardados localmente'; }
  else if (state === 'syncing') { b.className = 'offline-banner show syncing'; icon.textContent = '⏳'; text.textContent = 'Sincronizando cambios pendientes…'; }
  else if (state === 'synced') { b.className = 'offline-banner show synced'; icon.textContent = '✅'; text.textContent = '¡Sincronizado!'; setTimeout(() => { b.className = 'offline-banner'; }, 2500); }
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

window.addEventListener('online', () => { _isOnline = true; flushOfflineQueue(); });
window.addEventListener('offline', () => { _isOnline = false; setOfflineBanner('offline'); });

function toggleDark() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  LS.set('darkMode', !dark);
  Object.keys(chartInstances).forEach(k => { if(chartInstances[k]){ chartInstances[k].destroy(); delete chartInstances[k]; } });
  renderPageInternal(currentTab);
}
function applyDarkMode() {
  const saved = LS.get('darkMode');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === true || (saved === null && prefersDark)) document.documentElement.setAttribute('data-theme', 'dark');
}
applyDarkMode();

const PRICE_CACHE_KEY = 'price_cache';
function getPriceCache() { return LS.get(PRICE_CACHE_KEY) || {}; }
function setPriceCache(c) { LS.set(PRICE_CACHE_KEY, c); }
function isCacheFresh(ts) { if (!ts) return false; const n = new Date(), c = new Date(ts); return n.getFullYear()===c.getFullYear() && n.getMonth()===c.getMonth() && n.getDate()===c.getDate(); }
function getCachedPrice(t) { const c=getPriceCache(); return c[t]||null; }
function setCachedPrice(t,p,s) { const c=getPriceCache(); c[t]={price:p,ts:Date.now(),source:s}; setPriceCache(c); }

const CRYPTO_MAP = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','ADA':'cardano','DOT':'polkadot','DOGE':'dogecoin',
  'LINK':'chainlink','MATIC':'matic-network','UNI':'uniswap','XRP':'ripple','BNB':'binancecoin',
  'AVAX':'avalanche-2','SHIB':'shiba-inu','LTC':'litecoin','ATOM':'cosmos','TRX':'tron',
  'TON':'the-open-network','PEPE':'pepe','WIF':'dogwifcoin',
};

async function fetchCryptoPrice(ticker) {
  const coinId = CRYPTO_MAP[ticker.toUpperCase()]; if(!coinId) return null;
  try { const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`); if(!r.ok) throw new Error(); const d = await r.json(); return d[coinId]?.usd || null; } catch { return null; }
}
async function fetchStockPrice(ticker) {
  const k = settings.finnhubKey||''; if(!k) return null;
  try { const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${k}`); if(!r.ok) throw new Error(); const d = await r.json(); return (d.c && d.c > 0) ? d.c : null; } catch { return null; }
}
async function fetchMXPrice(ticker) {
  const baseTicker = ticker.toUpperCase().replace(/\.MX$/i, '');
  const variations = [baseTicker + '.MX', baseTicker];
  const proxies = ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/'];
  for (const sym of variations) { for (const proxyBase of proxies) { const url = `${proxyBase}${sym}?interval=1d&range=1d`; try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) continue; const d = await r.json(); const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice; if (price && price > 0) return price; } catch { } await new Promise(r => setTimeout(r, 200)); } } return null;
}

let _fxCache = null;
async function fetchFX() {
  const cached = LS.get('fxCache');
  if (cached && isCacheFresh(cached.ts)) { _fxCache = cached; return cached; }
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN,EUR');
    if (!r.ok) throw new Error();
    const d = await r.json();
    const result = { usdmxn: d.rates.MXN, usdeur: d.rates.EUR, eurmxn: d.rates.MXN / d.rates.EUR, ts: Date.now() };
    LS.set('fxCache', result);
    _fxCache = result;
    return result;
  } catch { return _fxCache || { usdmxn: settings.tipoCambio||20, usdeur: 0.92, eurmxn: (settings.tipoCambio||20)/0.92, ts: 0 }; }
}

async function updateFX() {
  const fx = await fetchFX();
  if (fx && fx.usdmxn && fx.ts && isCacheFresh(fx.ts)) {
    settings.tipoCambio = Math.round(fx.usdmxn * 100) / 100;
    settings.tipoEUR = Math.round(fx.eurmxn * 100) / 100;
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
  if (usd || eur) sub.innerHTML = usd + (usd && eur ? '<span style="opacity:0.3">·</span>' : '') + eur;
}

async function fetchPrice(ticker, type, moneda) {
  ticker = ticker.toUpperCase();
  moneda = (moneda || 'USD').toUpperCase();
  if (ticker === 'USD' || type === 'Efectivo USD') return {price:1, source:'fixed', cached:false, ts:Date.now()};
  const cacheKey = moneda === 'MXN' ? ticker + '_MXN' : ticker;
  const cached = getCachedPrice(cacheKey);
  if (cached && isCacheFresh(cached.ts)) return {...cached, cached:true};
  let price = null, source = 'none';
  if (type === 'Crypto') { price = await fetchCryptoPrice(ticker); if (price !== null) source = 'coingecko'; }
  else if ((type === 'Acción' || type === 'ETF') && moneda === 'MXN') { price = await fetchMXPrice(ticker); if (price !== null) source = 'yahoo-bmv-mxn'; else { price = await fetchStockPrice(ticker); if (price !== null) { price = price * (settings.tipoCambio||20); source = 'finnhub-converted'; } } }
  else if (type === 'Acción' || type === 'ETF') { price = await fetchStockPrice(ticker); if (price !== null) source = 'finnhub'; }
  else if (type === 'Acción MX' || type === 'ETF MX') { price = await fetchMXPrice(ticker); if (price !== null) source = 'yahoo-bmv'; }
  if (price !== null) { setCachedPrice(cacheKey, price, source); return {price, source, cached:false, ts:Date.now()}; }
  return null;
}

let priceUpdateState = {loading:false, lastUpdate:null};
async function updateAllPrices(forceRefresh=false) {
  if (priceUpdateState.loading) return;
  priceUpdateState.loading = true;
  const btn = document.getElementById('btnUpdate');
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Actualizando...'; }
  await updateFX();
  const tickerSet = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); tickerSet.set(key, {type: m.tipoActivo, moneda: m.moneda || 'USD', ticker: m.ticker.toUpperCase()}); } });
  if (forceRefresh) { const c = getPriceCache(); tickerSet.forEach((_, k) => { delete c[k]; }); setPriceCache(c); }
  for (const [key, info] of tickerSet) { const b = document.getElementById('btnUpdate'); if (b) b.innerHTML = `<span class="spinner"></span> ${info.ticker}...`; await fetchPrice(info.ticker, info.type, info.moneda); await new Promise(r => setTimeout(r, 300)); }
  priceUpdateState.loading = false;
  priceUpdateState.lastUpdate = new Date();
  _recalcAndSaveSnapshot();
  renderPage(currentTab);
}

function getPriceInfo(ticker, type, moneda) {
  ticker = ticker.toUpperCase(); moneda = (moneda || 'USD').toUpperCase();
  if (ticker === 'USD' || type === 'Efectivo USD') return {price:1, label:'$1.00', status:'fixed', cssClass:'price-cached'};
  const cacheKey = moneda === 'MXN' ? ticker + '_MXN' : ticker;
  const c = getCachedPrice(cacheKey);
  if (c && isCacheFresh(c.ts)) { const t = new Date(c.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); const cur = moneda === 'MXN' ? '$' : 'US$'; return {price:c.price, label:cur+c.price.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}), status:'cached', cssClass:'price-live', tooltip:`${c.source} · hoy ${t}`, moneda}; }
  return {price:null, label:'—', status:'none', cssClass:'price-fallback', tooltip:'Sin precio hoy', moneda};
}

function getPriceSummary() {
  const ts = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); ts.set(key, {type: m.tipoActivo, moneda: m.moneda || 'USD'}); } });
  let live=0, missing=0;
  ts.forEach((_, k) => { const c=getCachedPrice(k); if(c&&isCacheFresh(c.ts))live++; else missing++; });
  return {live, missing, total: ts.size};
}

const COLORS=['#0A84FF','#30D158','#FF9F0A','#BF5AF2','#FF375F','#64D2FF','#FFD60A','#AC8E68','#5E5CE6','#FF6482','#32D74B','#00C7BE','#FF453A','#5856D6','#AF52DE','#FF2D55','#A2845E','#30B0C7'];
const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const EXPENSE_CATS=[
  {id:'vivienda',name:'Vivienda',icon:'🏠'},{id:'alimentacion',name:'Alimentación',icon:'🍔'},{id:'luz',name:'Luz',icon:'💡'},{id:'agua',name:'Agua',icon:'🚰'},
  {id:'celular',name:'Celular',icon:'📱'},{id:'salud',name:'Salud',icon:'💊'},{id:'seguro',name:'Seguro',icon:'🛡'},{id:'ocio',name:'Ocio',icon:'🎮'},
  {id:'suscripciones',name:'Suscripciones',icon:'📲'},{id:'transporte',name:'Transporte',icon:'🚗'},{id:'educacion',name:'Educación',icon:'🎓'},{id:'otros',name:'Otros',icon:'📦'},
];
const ASSET_TYPES=['Acción','ETF','Crypto','Efectivo USD','Acción MX','ETF MX'];
const BROKERS=['Interactive Brokers','Fidelity','Binance','Robinhood','Bitso','GBM','OKX','Kraken','Coinbase','Actinver','Charles Schwab','BBVA Bancomer','Bursanet'];
const PLAT_TYPES=['BANCO','SOFIPO','CUENTA DIGITAL','BOLSA/ETFs','FONDOS','FONDOS RETIRO','DEUDA/CETES'];
const PLAT_GROUPS=['Ahorro/Liquidez','Cuenta Digital','Bolsa/ETFs','Fondos','Deuda/CETES'];
const PLAT_MONEDAS=['MXN','USD','EUR'];
const FRECUENCIAS=['Mensual','Quincenal','Semanal','Anual','Trimestral'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().split('T')[0];

function fmt(n, cur) {
  if (n == null || isNaN(n)) {
    if (cur === 'USD') return 'US$0';
    if (cur === 'EUR') return '€0';
    return '$0';
  }
  const sign = n < 0 ? '-' : '';
  if (cur === 'USD') return sign + 'US$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
  if (cur === 'EUR') return sign + '€' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits: 0});
}
function fmtFull(n, cur) {
  if (n == null || isNaN(n)) {
    if (cur === 'USD') return 'US$0.00';
    if (cur === 'EUR') return '€0.00';
    return '$0.00';
  }
  const sign = n < 0 ? '-' : '';
  if (cur === 'USD') return sign + 'US$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
  if (cur === 'EUR') return sign + '€' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtPct(n) { return (n==null||isNaN(n)) ? '0.00%' : (n>=0?'+':'') + (n*100).toFixed(2) + '%'; }
function pctCol(n) { return n >= 0 ? 'var(--green)' : 'var(--red)'; }
function fmtPlat(n, moneda) { return fmt(n, moneda || 'MXN'); }

const DEFAULT_PLATFORMS=[
  {id:'nu',name:'Nu Bank',type:'BANCO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:171436,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'klar',name:'Klar',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:151400,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'finsus',name:'Finsus',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:107271,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'supert',name:'Super Tasas',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:128480,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'stori',name:'Stori',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:159522,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'mpago',name:'Mercado Pago',type:'CUENTA DIGITAL',group:'Cuenta Digital',moneda:'MXN',saldoInicial:38674,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'uala',name:'Ualá',type:'BANCO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:49727,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'kubo',name:'Kubo',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:5917,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'gbm',name:'GBM',type:'BOLSA/ETFs',group:'Bolsa/ETFs',moneda:'MXN',saldoInicial:558468,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'finamex',name:'Finamex',type:'BOLSA/ETFs',group:'Bolsa/ETFs',moneda:'MXN',saldoInicial:87269,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'heybanco',name:'Hey Banco',type:'BANCO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:27608,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'actinver',name:'Actinver',type:'BOLSA/ETFs',group:'Bolsa/ETFs',moneda:'MXN',saldoInicial:15205,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'dinn',name:'Dinn',type:'FONDOS',group:'Fondos',moneda:'MXN',saldoInicial:5303,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'fintual',name:'Fintual',type:'FONDOS RETIRO',group:'Fondos',moneda:'MXN',saldoInicial:44864,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'mifel',name:'Mifel',type:'BANCO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:17290,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'didi',name:'Didi',type:'SOFIPO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:24620,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'openbank',name:'Openbank',type:'BANCO',group:'Ahorro/Liquidez',moneda:'MXN',saldoInicial:20000,tasaAnual:0,fechaInicio:'2026-02-01'},
  {id:'cetes',name:'CETES',type:'DEUDA/CETES',group:'Deuda/CETES',moneda:'MXN',saldoInicial:12000,tasaAnual:0,fechaInicio:'2026-02-01'},
];
const DEFAULT_MOVS=[
  {id:uid(),fecha:'2026-02-10',seccion:'inversiones',tipoActivo:'Crypto',ticker:'BTC',broker:'Binance',tipoMov:'Compra',cantidad:0.5,precioUnit:94000,montoTotal:47000,moneda:'USD',comision:0,notas:'Bitcoin'},
  {id:uid(),fecha:'2026-02-15',seccion:'inversiones',tipoActivo:'Crypto',ticker:'ETH',broker:'Binance',tipoMov:'Compra',cantidad:4,precioUnit:3200,montoTotal:12800,moneda:'USD',comision:0,notas:'Ethereum'},
  {id:uid(),fecha:'2026-02-20',seccion:'inversiones',tipoActivo:'ETF',ticker:'VOO',broker:'Fidelity',tipoMov:'Compra',cantidad:3,precioUnit:520,montoTotal:1560,moneda:'USD',comision:0,notas:'Vanguard S&P500'},
  {id:uid(),fecha:'2026-02-22',seccion:'inversiones',tipoActivo:'ETF',ticker:'QQQ',broker:'Interactive Brokers',tipoMov:'Compra',cantidad:2,precioUnit:470,montoTotal:940,moneda:'USD',comision:0,notas:'Nasdaq 100'},
  {id:uid(),fecha:'2026-02-25',seccion:'inversiones',tipoActivo:'Acción',ticker:'NVDA',broker:'Interactive Brokers',tipoMov:'Compra',cantidad:5,precioUnit:135,montoTotal:675,moneda:'USD',comision:0,notas:'Nvidia'},
  {id:uid(),fecha:'2026-02-28',seccion:'inversiones',tipoActivo:'Acción',ticker:'AAPL',broker:'Fidelity',tipoMov:'Compra',cantidad:4,precioUnit:230,montoTotal:920,moneda:'USD',comision:0,notas:'Apple'},
  {id:uid(),fecha:'2026-03-01',seccion:'gastos',categoria:'vivienda',tipo:'Gasto',importe:430,notas:'Alquiler marzo'},
  {id:uid(),fecha:'2026-03-05',seccion:'gastos',categoria:'alimentacion',tipo:'Gasto',importe:200,notas:'Supermercado'},
  {id:uid(),fecha:'2026-03-08',seccion:'gastos',categoria:'luz',tipo:'Gasto',importe:80,notas:'Factura luz'},
  {id:uid(),fecha:'2026-03-01',seccion:'gastos',categoria:'otros',tipo:'Ingreso',importe:25000,notas:'Nómina'},
  {id:uid(),fecha:'2026-02-15',seccion:'plataformas',platform:'Nu Bank',tipoPlat:'Saldo Actual',monto:172760,desc:'Actualización feb'},
];
const DEFAULT_GOALS=[
  {id:uid(),nombre:'Meta Conservadora $2M',clase:'Todos',meta:2000000,fechaLimite:'2031-12-31',descripcion:'Portafolio MX a 2 millones'},
  {id:uid(),nombre:'Meta Ambiciosa $5M',clase:'Todos',meta:5000000,fechaLimite:'2036-12-31',descripcion:'5 millones en 10 años'},
  {id:uid(),nombre:'Portafolio $100K USD',clase:'Todos',meta:100000,fechaLimite:'2027-12-31',descripcion:'Meta maestra inversión'},
  {id:uid(),nombre:'Cartera Crypto $20K',clase:'Crypto',meta:20000,fechaLimite:'2027-06-30',descripcion:'Alta volatilidad controlada'},
];
const DEFAULT_SETTINGS={tipoCambio:20,tipoEUR:21.5,rendimientoEsperado:0.06,finnhubKey:''};
const DEFAULT_RECURRENTES=[
  {id:uid(),nombre:'Renta / Hipoteca',icon:'🏠',categoria:'vivienda',importe:8500,frecuencia:'Mensual',dia:1,activo:true,color:'#FF9F0A'},
  {id:uid(),nombre:'Luz',icon:'💡',categoria:'luz',importe:350,frecuencia:'Mensual',dia:1,activo:true,color:'#FFD60A'},
  {id:uid(),nombre:'Agua',icon:'🚰',categoria:'agua',importe:200,frecuencia:'Mensual',dia:1,activo:true,color:'#64D2FF'},
  {id:uid(),nombre:'Celular',icon:'📱',categoria:'celular',importe:400,frecuencia:'Mensual',dia:1,activo:true,color:'#30D158'},
  {id:uid(),nombre:'Seguro',icon:'🛡',categoria:'seguro',importe:1200,frecuencia:'Mensual',dia:15,activo:true,color:'#BF5AF2'},
  {id:uid(),nombre:'Suscripciones',icon:'📲',categoria:'suscripciones',importe:350,frecuencia:'Mensual',dia:1,activo:true,color:'#5856D6'},
];

let platforms = LS.get('platforms') || DEFAULT_PLATFORMS;
let movements = LS.get('movements') || DEFAULT_MOVS;
let goals = LS.get('goals') || DEFAULT_GOALS;
let settings = LS.get('settings') || DEFAULT_SETTINGS;
let recurrentes = LS.get('recurrentes') || DEFAULT_RECURRENTES;
let patrimonioHistory = LS.get('patrimonioHistory') || [];

platforms = platforms.map(p => ({tasaAnual:0, fechaInicio:'2026-02-01', moneda:'MXN', ...p}));

let currentTab = 'dashboard';
let movFilter = {seccion:'todas', search:''};
let chartInstances = {};
let _lastLocalSave = 0;
let _chartRange = 'all';

// Intervalos unificados para el gráfico
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

let _projKey = '1y';

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
  const btn = document.getElementById('chartToggleBtn');
  if (!panel || !btn) return;
  const isOpen = panel.classList.toggle('open');
  btn.className = 'chart-toggle-btn' + (isOpen ? ' open-state' : '');
  btn.innerHTML = isOpen ? '▲ Ocultar controles' : '▼ Controles';
}

function setTipoTransfer(tipo){
  const pBtn=document.getElementById('btnTipoPlat');
  const sBtn=document.getElementById('btnTipoSob');
  const pForm=document.getElementById('formTransferPlat');
  const sForm=document.getElementById('formTransferSob');
  if(!pBtn||!sBtn||!pForm||!sForm) return;
  if(tipo==='plat'){
    pBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:2px solid var(--cyan);background:rgba(100,210,255,0.12);color:var(--cyan);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)';
    sBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)';
    pForm.style.display=''; sForm.style.display='none';
  } else {
    sBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:2px solid var(--green);background:rgba(48,209,88,0.12);color:var(--green);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)';
    pBtn.style.cssText='flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)';
    pForm.style.display='none'; sForm.style.display='';
    const sel=document.querySelector('select[name="mesSobrante"]');
    if(sel) actualizarMontoSobrante(sel.value);
  }
}

function calcSobranteMes(mesKey){
  const eurmxn=getEurMxn();
  const toEUR=m=>{
    if(m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
    return Math.round(m.importe/eurmxn*100)/100;
  };
  const gastos=movements.filter(mv=>mv.seccion==='gastos'&&mv.tipo==='Gasto'&&mv.fecha&&mv.fecha.startsWith(mesKey));
  const ingresos=movements.filter(mv=>mv.seccion==='gastos'&&mv.tipo==='Ingreso'&&mv.fecha&&mv.fecha.startsWith(mesKey));
  const totG=gastos.reduce((s,mv)=>s+toEUR(mv),0);
  const totI=ingresos.reduce((s,mv)=>s+toEUR(mv),0);
  const ing=settings.ingresos||{};
  const sueldoEUR=ing.monedaSueldo==='EUR'?(ing.sueldoRaw||0):(ing.sueldo||0);
  const ingRef=totI>0?totI:(sueldoEUR+(ing.extrasEUR||ing.extras||0)+(ing.otrosEUR||ing.otros||0));
  return Math.max(0,Math.round((ingRef-totG)*100)/100);
}

function actualizarMontoSobrante(mesKey){
  const inp=document.getElementById('inputMontoSob');
  if(inp) inp.value=calcSobranteMes(mesKey);
}

function _recalcAndSaveSnapshot() {
  const tc = settings.tipoCambio || 20;
  const eurmxn = getEurMxn();
  const plats = calcPlatforms();
  const totalMXN = plats.reduce((s,p) => {
    const saldo = p.saldo || 0;
    if (p.moneda === 'USD') return s + saldo * tc;
    if (p.moneda === 'EUR') return s + saldo * eurmxn;
    return s + saldo;
  }, 0);
  const tickers = getTickerPositions();
  const totalInvMXN = tickers.reduce((s,t) => {
    const val = t.valorActual !== null ? t.valorActual : t.costoPosicion;
    return s + (t.moneda === 'MXN' ? val : val * tc);
  }, 0);
  savePatrimonioSnapshot(totalMXN + totalInvMXN);
}

function savePatrimonioSnapshot(value) {
  const todayStr = today();
  const existingIndex = patrimonioHistory.findIndex(s => s.date === todayStr);
  const newSnapshot = { date: todayStr, value: Math.round(value) };
  if (existingIndex === -1) { patrimonioHistory.push(newSnapshot); if (patrimonioHistory.length > 365) patrimonioHistory = patrimonioHistory.slice(-365); }
  else { patrimonioHistory[existingIndex] = newSnapshot; }
  LS.set('patrimonioHistory', patrimonioHistory);
}

function calcAutoYield(p, saldoBase, fechaRef) {
  const tasa = p.tasaAnual||0; if(tasa<=0||saldoBase<=0) return 0;
  let refDate = fechaRef ? new Date(fechaRef) : p.fechaInicio ? new Date(p.fechaInicio) : null;
  if(!refDate||isNaN(refDate.getTime())) return 0;
  const diffMs = new Date() - refDate; if(diffMs<=0) return 0;
  return saldoBase * (tasa/100) * (diffMs/(1000*60*60*24*365));
}

function calcPlatforms() {
  return platforms.map(p => {
    const movs = movements.filter(m => m.seccion === 'plataformas' && m.platform === p.name)
                          .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    let saldoBase = p.saldoInicial;
    let ultimoSaldoFecha = p.fechaInicio;
    let ultimoSaldoValor = p.saldoInicial;
    let saldoBaseParaYield = p.saldoInicial;
    let totalAportaciones = 0, totalRetiros = 0, totalGastos = 0;
    let aportacionesDetalle = [];
    let rendimientoMov = 0;

    movs.forEach(m => {
      if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') {
        saldoBase += m.monto; saldoBaseParaYield += m.monto; totalAportaciones += m.monto;
        aportacionesDetalle.push({ fecha: m.fecha, monto: m.monto, tipo: m.tipoPlat, desc: m.desc });
      } else if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida') {
        saldoBase -= m.monto; saldoBaseParaYield -= m.monto; totalRetiros += m.monto;
      } else if (m.tipoPlat === 'Gasto') {
        saldoBase -= m.monto; saldoBaseParaYield -= m.monto; totalGastos += m.monto;
      } else if (m.tipoPlat === 'Saldo Actual') {
        const saldoEsperado = saldoBase;
        rendimientoMov += (m.monto - saldoEsperado);
        saldoBase = m.monto; saldoBaseParaYield = m.monto;
        ultimoSaldoFecha = m.fecha; ultimoSaldoValor = m.monto;
      }
    });

    const rendimientoAuto = calcAutoYield(p, ultimoSaldoValor, ultimoSaldoFecha);
    const saldoFinal = saldoBase + rendimientoAuto;
    const rendimientoTotal = rendimientoMov + rendimientoAuto;
    let diasDesdeRef = 0;
    if (ultimoSaldoFecha) { const diff = new Date() - new Date(ultimoSaldoFecha); diasDesdeRef = Math.max(0, Math.floor(diff / (1000*60*60*24))); }

    return { ...p, saldo: saldoFinal, aportacion: totalAportaciones, retiro: totalRetiros, gasto: totalGastos, rendimiento: rendimientoTotal, rendimientoManual: rendimientoMov, rendimientoAuto, diasDesdeRef, fechaRefAuto: ultimoSaldoFecha, aportacionesDetalle };
  });
}

function recalcularPlatformas(){ platforms = platforms.map(p => ({tasaAnual:0, fechaInicio:'2026-02-01', moneda:'MXN', ...p})); }

function applyRecurrentes() {
  const cm=new Date().getMonth()+1, cy=new Date().getFullYear();
  const applied=settings.recurrentesApplied||{};
  const key=`${cy}-${cm}`;
  if(applied[key]) return 0;
  let count=0;
  recurrentes.filter(r=>r.activo).forEach(r=>{
    const exists=movements.some(m=>m.seccion==='gastos'&&m.recurrenteId===r.id&&m.fecha.startsWith(`${cy}-${String(cm).padStart(2,'0')}`));
    if(!exists){
      const dia=r.dia||1;
      const fechaMov=`${cy}-${String(cm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      movements.unshift({id:uid(),seccion:'gastos',fecha:fechaMov,categoria:r.categoria,tipo:'Gasto',importe:r.importe,notas:r.nombre+' (auto)',recurrenteId:r.id,esRecurrente:true});
      count++;
    }
  });
  if(count>0){ if(!settings.recurrentesApplied)settings.recurrentesApplied={}; settings.recurrentesApplied[key]=true; LS.set('movements',movements);LS.set('settings',settings); }
  return count;
}

function loadFromRemote(remote){
  if(Date.now()-_lastLocalSave<3000) return;
  if(remote.platforms)platforms=remote.platforms.map(p=>({tasaAnual:0,fechaInicio:'2026-02-01',moneda:'MXN',...p}));
  if(remote.movements)movements=remote.movements;
  if(remote.goals)goals=remote.goals;
  if(remote.settings)settings=remote.settings;
  if(remote.recurrentes)recurrentes=remote.recurrentes;
  if(remote.patrimonioHistory)patrimonioHistory=remote.patrimonioHistory;
  LS.set('platforms',platforms);LS.set('movements',movements);LS.set('goals',goals);LS.set('settings',settings);
  LS.set('recurrentes',recurrentes);LS.set('patrimonioHistory',patrimonioHistory);
  renderPageInternal(currentTab);
}
window.loadFromRemote = loadFromRemote;
window.getAppData = () => ({platforms,movements,goals,settings,recurrentes,patrimonioHistory});
window.currentTab = 'dashboard';

function saveAll(){
  window.currentTab = currentTab;
  recalcularPlatformas();
  _lastLocalSave = Date.now();
  LS.set('platforms',platforms);LS.set('movements',movements);LS.set('goals',goals);LS.set('settings',settings);
  LS.set('recurrentes',recurrentes);LS.set('patrimonioHistory',patrimonioHistory);
  _recalcAndSaveSnapshot();
  renderPageInternal(currentTab);
  if (!_isOnline) { queueSave(window.getAppData()); setOfflineBanner('offline'); }
  else if(typeof window.saveToFirebase==='function') { window.saveToFirebase(); }
}

function switchTab(tab){
  currentTab=tab; window.currentTab=tab;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(t=>t.classList.remove('active'));
  const pageEl = document.getElementById('page-'+tab);
  if(pageEl) pageEl.classList.add('active');
  const nt=document.querySelector('[data-tab="'+tab+'"]');if(nt)nt.classList.add('active');
  document.querySelectorAll('.mobile-nav-item[data-tab="'+tab+'"]').forEach(t=>t.classList.add('active'));
  Object.keys(chartInstances).forEach(k=>{if(chartInstances[k]){chartInstances[k].destroy();delete chartInstances[k];}});
  renderPageInternal(tab);
}
document.querySelectorAll('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
function openModal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modalOverlay').classList.add('open');}
function closeModal(){document.getElementById('modalOverlay').classList.remove('open');}

function typeBadge(type){const map={'SOFIPO':'badge-green','BANCO':'badge-blue','BOLSA/ETFs':'badge-orange','CUENTA DIGITAL':'badge-purple','FONDOS':'badge-purple','FONDOS RETIRO':'badge-purple','DEUDA/CETES':'badge-blue'};return`<span class="badge ${map[type]||'badge-blue'}">${type}</span>`;}
function monedaBadge(moneda){return`<span class="moneda-flag moneda-${moneda||'MXN'}">${moneda==='USD'?'🇺🇸 USD':moneda==='EUR'?'🇪🇺 EUR':'🇲🇽 MXN'}</span>`;}
function secBadge(sec){const map={plataformas:['PLATAFORMA','badge-blue'],inversiones:['INVERSIÓN','badge-green'],gastos:['GASTO','badge-orange'],transferencia:['TRANSFERENCIA','badge-teal']};const[label,cls]=map[sec]||['—',''];return`<span class="badge ${cls}">${label}</span>`;}
function catName(id){const c=EXPENSE_CATS.find(x=>x.id===id);return c?c.icon+' '+c.name:id;}
function statCard(label,value,sub,color,borderColor){
  let tint='';
  if(borderColor){if(borderColor.includes('green'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(48,209,88,0.04) 100%);';else if(borderColor.includes('red'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(255,69,58,0.04) 100%);';else if(borderColor.includes('blue'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(10,132,255,0.04) 100%);';else if(borderColor.includes('orange'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(255,159,10,0.04) 100%);';else if(borderColor.includes('purple')||borderColor.includes('BF5AF2'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(191,90,242,0.04) 100%);';else if(borderColor.includes('C7BE')||borderColor.includes('teal'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(0,199,190,0.04) 100%);';}
  const accent=borderColor?'border-top:3px solid '+borderColor+';':'';
  return '<div class="card stat" style="'+accent+tint+'">'+'<div class="stat-label">'+label+'</div>'+'<div class="stat-value" style="'+(color?'color:'+color:'')+' ">'+value+'</div>'+(sub?'<div class="stat-sub">'+sub+'</div>':'')+'</div>';
}

function getTickerPositions(){
  const tickers={};
  movements.filter(m=>m.seccion==='inversiones').forEach(m=>{
    const t=m.ticker.toUpperCase();
    const moneda=(m.moneda||'USD').toUpperCase();
    const key = moneda==='MXN' ? t+'_MXN' : t;
    if(!tickers[key])tickers[key]={ticker:t,type:m.tipoActivo,moneda,cantC:0,cantV:0,costoTotal:0,ventasTotal:0,movs:[]};
    if(m.tipoMov==='Compra'){tickers[key].cantC+=m.cantidad||0;tickers[key].costoTotal+=m.montoTotal||0;}
    if(m.tipoMov==='Venta'){tickers[key].cantV+=m.cantidad||0;tickers[key].ventasTotal+=m.montoTotal||0;}
    tickers[key].movs.push(m);
  });
  return Object.values(tickers).map(t=>{
    t.cantActual=t.cantC-t.cantV;t.precioCostoPromedio=t.cantC>0?t.costoTotal/t.cantC:0;
    const pi=getPriceInfo(t.ticker,t.type,t.moneda);
    t.precioActual=pi.price;t.priceLabel=pi.label;t.priceCssClass=pi.cssClass;t.priceTooltip=pi.tooltip||'';
    t.valorActual=t.precioActual&&t.cantActual>0?t.cantActual*t.precioActual:null;
    t.costoPosicion=t.cantActual*t.precioCostoPromedio;
    t.gpNoRealizada=t.valorActual!==null?t.valorActual-t.costoPosicion:null;
    t.pctNoRealizada=t.costoPosicion>0&&t.gpNoRealizada!==null?t.gpNoRealizada/t.costoPosicion:null;
    t.gpRealizada=t.cantV>0?t.ventasTotal-(t.precioCostoPromedio*t.cantV):0;
    return t;
  });
}

function getBudgetAlerts(){
  const alerts=[];
  const cm=new Date().getMonth()+1,cy=new Date().getFullYear();
  const budgets=settings.budgets||{};
  const mesMovs=movements.filter(m=>{const d=new Date(m.fecha);return m.seccion==='gastos'&&m.tipo==='Gasto'&&d.getMonth()+1===cm&&d.getFullYear()===cy;});
  const byCat={};mesMovs.forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+(m.importe||0);});
  EXPENSE_CATS.forEach(cat=>{
    const pres=budgets[cat.id]||0,real=byCat[cat.id]||0;
    if(pres>0){
      const pct=real/pres;
      if(pct>=1)alerts.push({level:'error',msg:`🔴 <strong>${cat.icon} ${cat.name}</strong>: presupuesto excedido (${fmt(real)} / ${fmt(pres)})`});
      else if(pct>=0.85)alerts.push({level:'warn',msg:`🟡 <strong>${cat.icon} ${cat.name}</strong>: al ${(pct*100).toFixed(0)}% del presupuesto (${fmt(real)} / ${fmt(pres)})`});
    }
  });
  return alerts;
}

function showAportaciones(platformId) {
  const plats = calcPlatforms();
  const p = plats.find(p => p.id === platformId);
  if (!p || !p.aportacionesDetalle || p.aportacionesDetalle.length === 0) { alert('No hay movimientos de aportación para esta plataforma.'); return; }
  let html = `<div class="modal-header"><div class="modal-title">📋 Detalle de Aportaciones - ${p.name}</div><button class="modal-close" onclick="closeModal()">✕</button></div>`;
  html += '<table style="width:100%"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Descripción</th></tr></thead><tbody>';
  p.aportacionesDetalle.forEach(d => { html += `<tr><td>${d.fecha}</td><td>${d.tipo}</td><td>${fmtPlat(d.monto, p.moneda)}</td><td>${d.desc || '—'}</td></tr>`; });
  html += '</tbody></table>';
  openModal(html);
}
window.showAportaciones = showAportaciones;

function getEurMxn(){
  const fx=_fxCache||LS.get('fxCache');
  if(fx&&fx.eurmxn) return fx.eurmxn;
  return settings.tipoEUR||21.5;
}

function platSaldoToMXN(p) {
  const tc = settings.tipoCambio || 20;
  const eurmxn = getEurMxn();
  const saldo = p.saldo || 0;
  if (p.moneda === 'USD') return saldo * tc;
  if (p.moneda === 'EUR') return saldo * eurmxn;
  return saldo;
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard(){
  const tc=settings.tipoCambio||20,re=settings.rendimientoEsperado||0.06;
  const eurmxn=getEurMxn();
  const cm=new Date().getMonth()+1,cy=new Date().getFullYear();
  const plats=calcPlatforms();

  const totalMXN=plats.reduce((s,p)=>s+platSaldoToMXN(p),0);
  const totalRend=plats.reduce((s,p)=>s+(p.rendimiento||0),0);
  const totalRendAuto=plats.reduce((s,p)=>s+(p.rendimientoAuto||0),0);
  const totalAport=plats.reduce((s,p)=>s+(p.aportacion||0),0);
  const totalRetiros=plats.reduce((s,p)=>s+(p.retiro||0),0);
  const invInicial=plats.reduce((s,p)=>s+(p.saldoInicial||0),0);
  const topPlat=[...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a))[0];
  const maxConc=topPlat?platSaldoToMXN(topPlat)/totalMXN:0;
  const riskLvl=maxConc>0.4?'🔴 ALTO':maxConc>0.25?'🟡 MEDIO':'🟢 BAJO';
  const platsConTasa=plats.filter(p=>(p.tasaAnual||0)>0).length;
  const tickerList=getTickerPositions();
  const tickerListUSD=tickerList.filter(t=>t.moneda!=='MXN');
  const tickerListMXN=tickerList.filter(t=>t.moneda==='MXN');
  const totalUSDCurrent=tickerListUSD.reduce((s,t)=>s+(t.valorActual||t.costoPosicion||0),0);
  const totalInvertidoUSD=tickerListUSD.reduce((s,t)=>s+t.costoTotal,0);
  const totalMXNCurrent=tickerListMXN.reduce((s,t)=>s+(t.valorActual||t.costoPosicion||0),0);
  const gpNoRealizadaTotal=tickerList.reduce((s,t)=>s+(t.gpNoRealizada||0)*(t.moneda==='MXN'?1:tc),0);
  const gpRealizadaTotal=tickerList.reduce((s,t)=>s+(t.gpRealizada||0)*(t.moneda==='MXN'?1:tc),0);

  const ingresos=settings.ingresos||{};
  const salaryIsEUR = ingresos.monedaSueldo === 'EUR';
  const sueldoEUR = salaryIsEUR ? (ingresos.sueldoRaw||0) : (ingresos.sueldo||0);
  const extrasEUR = ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR = ingresos.otrosEUR||ingresos.otros||0;
  const ingresoMensualEUR = sueldoEUR + extrasEUR + otrosEUR;
  const dashCur = salaryIsEUR ? 'EUR' : 'MXN';
  const fmtD = v => fmt(v, dashCur);

  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesG=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Gasto';});
  const mesI=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Ingreso';});

  const toDisplayCur = m => {
    if (salaryIsEUR) {
      if(m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
      return Math.round(m.importe/eurmxn*100)/100;
    }
    return m.importe||0;
  };

  const totGastoMes=mesG.reduce((s,m)=>s+toDisplayCur(m),0);
  const totIngMes=mesI.reduce((s,m)=>s+toDisplayCur(m),0);
  const ingReferenciaBalance=totIngMes>0?totIngMes:ingresoMensualEUR;
  const balMes=ingReferenciaBalance-totGastoMes;
  const pctAhorro=ingReferenciaBalance>0?balMes/ingReferenciaBalance:0;
  const salud=pctAhorro>=0.2?'🟢 Óptima':pctAhorro>=0.1?'🟡 Aceptable':pctAhorro>=0?'🟠 Ajustada':'🔴 Déficit';
  const byCat={};mesG.forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+toDisplayCur(m);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalInvMXN=tickerListUSD.reduce((s,t)=>s+(t.valorActual||t.costoPosicion||0)*tc,0)+totalMXNCurrent;
  const patrimonio=totalMXN+totalInvMXN;
  const isr=totalRend>0?totalRend*0.2:0;
  const budgets=settings.budgets||{};
  const totalPresupuesto=EXPENSE_CATS.reduce((s,c)=>s+(budgets[c.id]||0),0);
  const pctPresUsado=totalPresupuesto>0?totGastoMes/totalPresupuesto:0;
  const priceSummary=getPriceSummary();
  const hasFinnhub=!!(settings.finnhubKey);
  const bannerStatus=priceSummary.live>0
    ?`<span class="price-banner-dot dot-live"></span><strong style="color:var(--green)">${priceSummary.live}/${priceSummary.total} precios actualizados hoy</strong>`
    :`<span class="price-banner-dot dot-none"></span><span style="color:var(--text2)">${priceSummary.total>0?'Sin precios del día — presiona Actualizar':'Sin inversiones registradas'}</span>`;
  const btnLabel=priceUpdateState.loading?`<span class="spinner"></span> Actualizando...`:'🔄 Actualizar precios';
  const alerts=getBudgetAlerts();
  const alertsHtml=alerts.length>0?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">${alerts.map(a=>`<div style="padding:10px 16px;background:${a.level==='error'?'rgba(255,69,58,0.06)':'rgba(255,159,10,0.06)'};border:1px solid ${a.level==='error'?'rgba(255,69,58,0.2)':'rgba(255,159,10,0.2)'};border-radius:10px;font-size:13px">${a.msg}</div>`).join('')}</div>`:'';
  _recalcAndSaveSnapshot();
  const applied=applyRecurrentes();

  const hist=[...patrimonioHistory].sort((a,b)=>new Date(a.date)-new Date(b.date));

  const todayStr = today();
  const todaySnap = hist.find(s => s.date === todayStr);
  const prevSnap = hist.filter(s => s.date < todayStr).slice(-1)[0];

  function getChangeForMonths(months) {
    if (hist.length < 2) return null;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const ref = hist.filter(s => s.date <= cutoffStr).slice(-1)[0];
    if (!ref) return null;
    return patrimonio - ref.value;
  }

  let histFiltered = hist;
  const selInterval = CHART_INTERVALS.find(i => i.key === _chartRange);
  if (selInterval) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - selInterval.months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    histFiltered = hist.filter(s => s.date >= cutoffStr);
    if (histFiltered.length === 0) histFiltered = hist.slice(-2);
  }
  const realDatesFiltered = histFiltered.map(s => s.date);
  const realValsFiltered = histFiltered.map(s => s.value);

  const curLabel = salaryIsEUR ? '🇪🇺 EUR' : '🇲🇽 MXN';

  const projInterval = CHART_INTERVALS.find(i => i.key === _projKey) || CHART_INTERVALS[3];
  const projMonths = projInterval.months;
  const patrimonioEsperado = Math.round(patrimonio * Math.pow(1 + re/12, projMonths));
  const gananciaProy = patrimonioEsperado - patrimonio;

  const periodOptions = [
    ...CHART_INTERVALS,
    { key:'all', label:'Todo', months:null }
  ];

  const rangeButtonsHTML = periodOptions.map(r => {
    const change = r.months !== null ? getChangeForMonths(r.months) : (hist.length>=2 ? patrimonio - hist[0].value : null);
    const col = change === null ? 'var(--text3)' : pctCol(change);
    const val = change !== null ? (change >= 0 ? '+' : '') + fmt(change) : '—';
    const isActive = _chartRange === r.key;
    return `<button class="chart-ctrl-btn ${isActive ? 'active' : ''}" onclick="setChartRange('${r.key}')">
      <span>${r.label}</span>
      <span class="btn-val" style="color:${isActive ? 'inherit' : col}">${val}</span>
    </button>`;
  }).join('');

  const projButtonsHTML = CHART_INTERVALS.map(r => {
    const pv = Math.round(patrimonio * Math.pow(1 + re/12, r.months));
    const gain = pv - patrimonio;
    const isActive = _projKey === r.key;
    return `<button class="chart-ctrl-btn proj-btn ${isActive ? 'active' : ''}" onclick="setChartProj('${r.key}')">
      <span>${r.label}</span>
      <span class="btn-val" style="color:${isActive ? 'inherit' : 'var(--blue)'}">+${fmt(gain)}</span>
    </button>`;
  }).join('');

  document.getElementById('page-dashboard').innerHTML=`
    ${applied>0?`<div class="snapshot-banner" style="background:rgba(191,90,242,0.06);border-color:rgba(191,90,242,0.2);margin-bottom:16px"><span class="snap-dot" style="background:var(--purple)"></span><span style="color:var(--purple)">✅ Se aplicaron <strong>${applied} gastos recurrentes</strong> automáticamente este mes</span></div>`:''}
    ${alertsHtml}
    <div class="price-banner">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        ${bannerStatus}
        ${priceSummary.missing>0?`<span style="color:var(--text3)">· ${priceSummary.missing} sin precio</span>`:''}
        ${platsConTasa>0?`<span style="color:var(--teal);font-weight:600">· 🏦 ${platsConTasa} con tasa auto</span>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${!hasFinnhub&&priceSummary.total>0?`<span style="font-size:11px;color:var(--orange)">⚠️ Acciones USA/ETF requieren Finnhub key</span>`:''}
        ${(()=>{const fx=_fxCache||LS.get('fxCache');if(fx&&isCacheFresh(fx.ts))return`<span style="font-size:11px;color:var(--teal)">💱 USD $${fx.usdmxn?.toFixed(2)} · EUR $${fx.eurmxn?.toFixed(2)}</span>`;return`<span style="font-size:11px;color:var(--text3)">💱 USD $${tc} (manual)</span>`;})()}
        <button class="btn btn-primary btn-sm" onclick="updateAllPrices(false)" ${priceUpdateState.loading?'disabled':''} id="btnUpdate">${btnLabel}</button>
        <button class="btn btn-secondary btn-sm" onclick="updateAllPrices(true)" ${priceUpdateState.loading?'disabled':''}>↺ Forzar</button>
      </div>
    </div>

    <div class="grid-6" style="margin-bottom:10px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Valor Plataformas</div><div class="stat-value">${fmt(totalMXN)}</div><div class="stat-sub"><span style="color:${pctCol(totalRend)};font-weight:700">${fmtPct(invInicial?totalRend/invInicial:0)}</span></div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Rend. Plataformas</div><div class="stat-value" style="color:${pctCol(totalRend)}">${fmt(totalRend)}</div><div class="stat-sub">${platsConTasa>0?`<span style="color:var(--teal)">⚡${fmt(totalRendAuto)} auto</span>`:''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 Cartera USD</div><div class="stat-value">${fmt(totalUSDCurrent,'USD')}</div><div class="stat-sub">${priceSummary.live>0?'precios de hoy':'costo de compra'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 G/P No Realizada</div><div class="stat-value" style="color:${pctCol(gpNoRealizadaTotal)}">${fmt(gpNoRealizadaTotal)}</div><div class="stat-sub">${fmtPct(totalInvertidoUSD?gpNoRealizadaTotal/(totalInvertidoUSD*tc):0)} MXN</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Ingresos Mes ${curLabel}</div><div class="stat-value">${fmtD(totIngMes>0?totIngMes:ingresoMensualEUR)}</div><div class="stat-sub">${totIngMes>0?`registrado ${MONTHS[cm-1]}`:ingresoMensualEUR>0?`<span style="color:var(--text3)">planeado</span>`:`<span style="color:var(--text3)">config. en Gastos</span>`}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Gastos Mes ${curLabel}</div><div class="stat-value" style="color:var(--red)">${fmtD(totGastoMes)}</div><div class="stat-sub">${totalPresupuesto>0?(pctPresUsado*100).toFixed(0)+'% presupuesto':''}</div></div>
    </div>

    <div class="grid-6" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Concentración</div><div class="stat-value" style="font-size:14px">${topPlat?.name||'—'}</div><div class="stat-sub"><span style="color:var(--orange);font-weight:700">${(maxConc*100).toFixed(1)}%</span> · ${riskLvl}</div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Aportaciones</div><div class="stat-value">${fmt(totalAport)}</div><div class="stat-sub">- ${fmt(totalRetiros)} retiros</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 G/P Realizada</div><div class="stat-value" style="color:${pctCol(gpRealizadaTotal)}">${fmt(gpRealizadaTotal)}</div><div class="stat-sub">ventas cerradas</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 Capital Invertido</div><div class="stat-value">${fmt(totalInvertidoUSD,'USD')}</div><div class="stat-sub">${tickerList.length} posiciones</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Balance Mes ${curLabel}</div><div class="stat-value" style="color:${pctCol(balMes)}">${fmtD(balMes)}</div><div class="stat-sub">${(pctAhorro*100).toFixed(0)}% ahorro${totIngMes===0&&ingresoMensualEUR>0?' (est.)':''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Salud Financiera</div><div class="stat-value" style="font-size:14px">${salud}</div><div class="stat-sub">${totalPresupuesto>0?fmt(totalPresupuesto,dashCur)+' presup.':'→ Config. en Gastos'}</div></div>
    </div>

    ${maxConc>0.25?`<div style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(255,159,10,0.06);border:1px solid rgba(255,159,10,0.15);border-radius:12px;margin-bottom:16px;font-size:13px"><span style="font-size:18px">⚠️</span><span><strong>${topPlat?.name}</strong> concentra el <strong style="color:var(--orange)">${(maxConc*100).toFixed(1)}%</strong> de tu portafolio.</span></div>`:''}

    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="padding:24px 28px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);margin-bottom:4px">📈 Evolución del Patrimonio</div>
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--green);line-height:1">${fmt(patrimonio)}</div>
            <div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:16px;height:2.5px;background:#30D158;border-radius:2px"></span>Real</span>
              <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:16px;height:2px;background:rgba(10,132,255,0.6);border-radius:2px"></span>Proyectado</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--blue);margin-bottom:4px">Esperado en ${projInterval.label}</div>
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--blue);line-height:1">${fmt(patrimonioEsperado)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px">+${fmt(gananciaProy)} · <span style="font-weight:700;color:var(--blue)">${(re*100).toFixed(0)}%/año</span></div>
          </div>
        </div>
      </div>
      <div style="padding:0 28px 0px">
        <div class="chart-container" style="height:240px"><canvas id="chartEvo"></canvas></div>
      </div>
      <div style="padding:8px 28px 12px;display:flex;justify-content:flex-end">
        <button class="chart-toggle-btn" id="chartToggleBtn" onclick="toggleChartPanel()">▼ Controles</button>
      </div>
      <div class="chart-controls-panel" id="chartControlsPanel">
        <div class="chart-controls-inner">
          <div class="chart-ctrl-row">
            <span class="chart-ctrl-label">📅 Período</span>
            ${rangeButtonsHTML}
          </div>
          <div style="height:1px;background:var(--border)"></div>
          <div class="chart-ctrl-row">
            <span class="chart-ctrl-label">🔵 Proyección</span>
            ${projButtonsHTML}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-1-1-1" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">📊 Distribución por Tipo</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="chart-container" style="height:140px;width:140px;flex-shrink:0"><canvas id="chartDistro"></canvas></div>
          <div style="flex:1">
            ${(()=>{const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);at[t.type+' USD']=(at[t.type+' USD']||0)+v;}});const sorted=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);const total=sorted.reduce((s,[,v])=>s+v,0)||1;return sorted.map(([k,v],i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0"><span style="display:flex;align-items:center;gap:5px;font-size:11px"><span style="width:7px;height:7px;border-radius:2px;background:${COLORS[i%COLORS.length]};display:inline-block;flex-shrink:0"></span>${k}</span><span style="font-size:11px;font-weight:700">${((v/total)*100).toFixed(1)}%</span></div>`).join('');})()}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">💰 Estimación Fiscal</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
          ${[['Rend. Bruto',fmt(totalRend),pctCol(totalRend)],['ISR 20%',fmt(-isr),'var(--red)'],['Rend. Neto',fmt(totalRend-isr),pctCol(totalRend-isr)],['ISR Anual est.',fmt(isr),'var(--text)']].map(([l,v,c])=>`<div style="background:var(--card2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:0.06em">${l}</div><div style="font-size:15px;font-weight:800;color:${c};margin-top:2px">${v}</div></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">🔥 Top Gastos — ${MONTHS[cm-1]} ${curLabel}</div>
        ${topCats.length>0?topCats.map(([id,v],i)=>{const medals=['🥇','🥈','🥉','4️⃣','5️⃣'];return`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;border-bottom:${i<topCats.length-1?'0.5px solid var(--border)':'none'}"><span>${medals[i]} ${catName(id)}</span><span style="font-weight:700">${fmtD(v)}</span></div>`;}).join(''):'<div style="text-align:center;color:var(--text2);padding:24px;font-size:13px">Sin gastos este mes</div>'}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="card-title" style="margin:0">🏆 Top Plataformas</div></div>
        ${[...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a)).slice(0,10).map((p,i)=>`
          <div class="list-item">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="rank" style="background:${COLORS[i]}">${i+1}</div>
              <div><div style="font-size:13px;font-weight:600">${p.name} ${monedaBadge(p.moneda)} ${p.tasaAnual>0?`<span class="tasa-badge${p.tasaAnual>=10?' alta':p.tasaAnual>=5?' media':''}">⚡${p.tasaAnual}%</span>`:''}</div><div style="font-size:10px;color:var(--text2)">${p.type} · ${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</div></div>
            </div>
            <div style="text-align:right"><div style="font-size:13px;font-weight:700">${fmtPlat(p.saldo, p.moneda)}</div><div style="font-size:10px;font-weight:600;color:${pctCol(p.rendimiento)}">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento, p.moneda)}</div></div>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">📊 Posiciones</div>
        ${tickerList.length>0?tickerList.sort((a,b)=>b.costoTotal-a.costoTotal).map(t=>{
          const tipoClass=t.type==='Acción'?'badge-green':t.type==='ETF'?'badge-blue':t.type==='Crypto'?'badge-orange':'badge-gray';
          const monedaLabel=t.moneda==='MXN'?'MXN':'USD';
          return`<div class="list-item" style="flex-direction:column;align-items:flex-start;gap:6px;padding:10px 0">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
              <div style="display:flex;align-items:center;gap:6px"><span style="font-size:15px;font-weight:800">${t.ticker}</span><span class="badge ${tipoClass}">${t.type}</span><span class="badge badge-gray">${monedaLabel}</span>${t.cantActual<=0?'<span class="badge badge-gray">CERRADA</span>':''}</div>
              <div style="text-align:right">${t.gpNoRealizada!==null?`<div style="font-size:14px;font-weight:800;color:${pctCol(t.gpNoRealizada)}">${t.gpNoRealizada>=0?'+':''}${fmtFull(t.gpNoRealizada)} ${monedaLabel}</div><div style="font-size:10px;color:${pctCol(t.pctNoRealizada)};font-weight:600">${fmtPct(t.pctNoRealizada)}</div>`:`<div style="font-size:11px;color:var(--text3)">sin precio hoy</div>`}</div>
            </div>
            <div style="display:flex;gap:16px;font-size:11px">
              <span><span style="color:var(--text2)">Compra: </span><span style="font-weight:700">${t.moneda==='MXN'?'$':'US$'}${t.precioCostoPromedio.toFixed(2)}</span></span>
              <span><span style="color:var(--text2)">Actual: </span><span class="${t.priceCssClass}" style="font-weight:700">${t.priceLabel}</span></span>
              <span><span style="color:var(--text2)">Cant: </span><span style="font-weight:700">${t.cantActual}</span></span>
            </div>
          </div>`;
        }).join(''):'<div style="text-align:center;color:var(--text2);padding:32px">Sin operaciones</div>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">🎯 Progreso de Metas</div>
        <button class="btn btn-secondary btn-sm" onclick="switchTab('metas')">Ver todas →</button>
      </div>
      ${goals.length>0?`<div class="grid-2">${goals.slice(0,4).map(g=>{let actual=0;const patrimonioTotal=totalMXN+totalInvMXN;if(g.clase==='Patrimonio Total'||g.clase==='Todos')actual=patrimonioTotal;else if(g.clase==='Plataformas')actual=totalMXN;else if(g.clase==='Inversiones')actual=totalInvMXN;else if(g.clase==='Ingreso Mensual')actual=ingresoMensualEUR;else actual=patrimonioTotal;const pct=g.meta>0?actual/g.meta:0;const sc=pct>=1?'var(--green)':pct>=0.8?'var(--orange)':pct>=0.3?'var(--blue)':'var(--text2)';const st=pct>=1?'🏆 LOGRADA':pct>=0.8?'🔥 Casi':pct>=0.3?'⏳ En proceso':'💤 Inicio';return`<div style="padding:12px;background:var(--card2);border-radius:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:700">${g.nombre}</div><span style="font-size:11px;font-weight:700;color:${sc}">${st}</span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:6px"><span style="font-weight:700;color:var(--text)">${fmt(actual)}</span><span>meta: ${fmt(g.meta)}</span></div><div class="progress-bg"><div class="progress-fill" style="background:${sc};width:${Math.min(pct*100,100).toFixed(1)}%"></div></div><div style="text-align:right;font-size:11px;font-weight:800;color:${sc};margin-top:4px">${(pct*100).toFixed(1)}%</div></div>`;}).join('')}</div>`:`<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px">Sin metas — <button class="btn btn-primary btn-sm" onclick="switchTab('metas')">Crear →</button></div>`}
    </div>

    <div class="grid-4">
      ${statCard('Patrimonio Total',fmt(patrimonio),'MXN + inversiones',null,'var(--blue)')}
      ${statCard('Rend. Esperado',(re*100).toFixed(0)+'% anual','≈ '+fmt(patrimonio*re)+' / año',null,'var(--green)')}
      ${statCard('Balance Mes '+curLabel,fmtD(balMes),salud,pctCol(balMes),'var(--orange)')}
      ${statCard('Total Movimientos',movements.length+'','registrados',null,'var(--purple)')}
    </div>
  `;

  updateNav(patrimonio,totalMXN,totalUSDCurrent,tc,totalRend);

  setTimeout(()=>{
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)';
    const tickColor=isDark?'#636366':'#C7C7CC';

    const realDates = realDatesFiltered;
    const realVals = realValsFiltered;

    const now = new Date();
    const projDates=[];
    const projVals=[];
    for(let i=0; i<=projMonths; i++){
      const d=new Date(now.getFullYear(), now.getMonth()+i, 1);
      projDates.push(d.toISOString().split('T')[0]);
      projVals.push(Math.round(patrimonio * Math.pow(1+re/12, i)));
    }

    const ctxE=document.getElementById('chartEvo');
    if(ctxE){
      chartInstances.chartEvo=new Chart(ctxE,{type:'line',data:{
        datasets:[
          {
            label:'Patrimonio Real',
            data:realDates.map((d,i)=>({x:d,y:realVals[i]})),
            borderColor:'#30D158', backgroundColor:'transparent', borderWidth:2.5,fill:false,tension:0.4,
            pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#30D158',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff', pointHoverBorderWidth:2,
          },
          {
            label:'Rendimiento Esperado '+((re*100).toFixed(0))+'%',
            data:projDates.map((d,i)=>({x:d,y:projVals[i]})),
            borderColor:'rgba(10,132,255,0.7)', backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,4],
            fill:false,tension:0.1, pointRadius:0, pointHoverRadius:4,
            pointHoverBackgroundColor:'rgba(10,132,255,0.8)',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff', pointHoverBorderWidth:2,
          }
        ]
      },options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{intersect:false,mode:'index'},
        plugins:{
          legend:{display:false},
          tooltip:{ backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)', cornerRadius:14,padding:14, bodyFont:{size:13,family:'DM Sans'}, callbacks:{label:ctx=>' '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y)} }
        },
        scales:{
          x:{ type:'category', grid:{display:false}, ticks:{font:{size:10},color:tickColor,maxTicksLimit:10,callback:function(val){const v=this.getLabelForValue(val);if(!v)return'';const p=v.split('-');return p.length===3?p[2]==='01'?MONTHS[parseInt(p[1])-1]:p[1]+'-'+p[2]:v;}}, border:{display:false} },
          y:{ grid:{color:gridColor}, ticks:{font:{size:11},color:tickColor,callback:v=>fmt(v),maxTicksLimit:5}, border:{display:false} }
        }
      }});
    }

    const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});
    tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);at[t.type]=(at[t.type]||0)+v;}});
    const de=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const ctxD=document.getElementById('chartDistro');
    if(ctxD&&de.length>0){chartInstances.chartDistro=new Chart(ctxD,{type:'doughnut',data:{labels:de.map(([k])=>k),datasets:[{data:de.map(([,v])=>v),backgroundColor:de.map((_,i)=>COLORS[i%COLORS.length]),borderWidth:2,borderColor:isDark?'#1C1C1E':'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:12,padding:10,bodyFont:{family:'DM Sans',size:12},callbacks:{label:ctx=>' '+ctx.label+': '+((ctx.parsed/de.reduce((s,[,v])=>s+v,0)*100)).toFixed(1)+'%'}}}}});}
  },50);
}

// ============================================
// MOVIMIENTOS
// ============================================
function renderMovimientos(){
  const transferGroups={};
  movements.forEach(m=>{ if(m.transferId) transferGroups[m.transferId]=(transferGroups[m.transferId]||[]).concat(m); });
  const filtered=movements.filter(m=>{
    if(movFilter.seccion!=='todas'&&m.seccion!==movFilter.seccion) return false;
    if(m.tipoPlat==='Transferencia entrada'&&m.transferId&&movFilter.seccion==='todas') return false;
    if(movFilter.search){const s=movFilter.search.toLowerCase();const text=[m.platform,m.ticker,m.broker,m.tipoPlat,m.tipoMov,m.tipo,m.notas,m.desc,m.categoria].filter(Boolean).join(' ').toLowerCase();if(!text.includes(s))return false;}
    return true;
  }).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  document.getElementById('page-movimientos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Movimientos</div><div class="section-sub">Registro unificado · ${movements.length} total</div></div>
      <button class="btn btn-primary" onclick="openMovModal()">+ Nuevo</button>
    </div>
    <div class="filter-pills">
      ${['todas','plataformas','inversiones','gastos'].map(s=>`<button class="pill ${movFilter.seccion===s?'active':''}" onclick="movFilter.seccion='${s}';renderMovimientos()">${s==='todas'?'Todas':s==='plataformas'?'🏦 Plataformas':s==='inversiones'?'📈 Inversiones':'💳 Gastos'}</button>`).join('')}
      <input class="pill-search" placeholder="Buscar..." value="${movFilter.search}" oninput="movFilter.search=this.value;renderMovimientos()">
      <span style="font-size:12px;color:var(--text2);margin-left:4px">${filtered.length} movimientos</span>
    </div>
    <div class="card-flat"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Sección</th><th>Detalle</th><th>Tipo</th><th>Monto</th><th>Extra</th><th>Notas</th><th style="width:70px"></th></tr></thead>
      <tbody>
        ${filtered.slice(0,100).map(m=>{
          let det='',tipo='',monto='',extra='';const notas=m.notas||m.desc||'';let rowClass='';
          if(m.seccion==='plataformas'){
            if(m.tipoPlat==='Transferencia salida'&&m.transferId){const grp=transferGroups[m.transferId]||[];const entrada=grp.find(
