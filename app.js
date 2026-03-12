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
function isFxCacheFresh(ts) { if (!ts) return false; return (Date.now() - ts) < 6 * 60 * 60 * 1000; }
function getCachedPrice(t) { const c=getPriceCache(); return c[t]||null; }
let _fxCache = null;

// Validar que un precio sea razonable según moneda y tipo
function isPriceReasonable(price, cacheKey) {
  if (!price || price <= 0 || !isFinite(price)) return false;
  if (cacheKey.endsWith('_MXN')) {
    // ETF/acción en MXN: mínimo $100, máximo $5,000,000
    // (VUAA~$2600, VOO~$100k, acciones baratas ~$100)
    return price >= 100 && price <= 5000000;
  } else {
    // ETF/acción en USD: mínimo $0.50, máximo $100,000
    // (VUAA~$131, VOO~$550, BRK.A~$700k — pero no tenemos esos)
    return price >= 0.5 && price <= 100000;
  }
}

function setCachedPrice(t, p, s) {
  if (!isPriceReasonable(p, t)) {
    console.warn(`[Cache] Precio inválido descartado — ${t}: ${p} (source: ${s})`);
    return;
  }
  const c = getPriceCache();
  c[t] = {price: p, ts: Date.now(), source: s};
  setPriceCache(c);
}

function clearPriceCache(ticker, moneda) {
  const c = getPriceCache();
  const key = (moneda||'').toUpperCase()==='MXN' ? ticker.toUpperCase()+'_MXN' : ticker.toUpperCase();
  delete c[key]; setPriceCache(c);
}

// Al arrancar: limpiar cualquier precio que no pase la validación
(function cleanCorruptedPrices(){
  const c = getPriceCache();
  let changed = false;
  Object.entries(c).forEach(([k, v]) => {
    if (v.source === 'coingecko') return;
    // Borrar TODOS los precios MXN de acciones/ETFs al arrancar — pueden tener conversión incorrecta
    if (k.endsWith('_MXN')) { delete c[k]; changed = true; console.warn(`[Cache] MXN limpiado al arrancar — ${k}: ${v.price}`); return; }
    if (!isPriceReasonable(v.price, k)) { delete c[k]; changed = true; console.warn(`[Cache] Inválido limpiado — ${k}: ${v.price}`); }
  });
  if (changed) setPriceCache(c);
  // Limpiar fxCache si está expirado (>6h) o sin GBP o fuera de rango absoluto
  const fx = LS.get('fxCache');
  if (fx && (!fx.gbpmxn || !isFxCacheFresh(fx.ts) || fx.usdmxn < 14 || fx.usdmxn > 35)) {
    console.warn(`[fxCache] Limpiando — USD/MXN: ${fx.usdmxn}`);
    LS.set('fxCache', null);
    _fxCache = null;
  }
})();

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
async function fetchAlphaVantagePrice(ticker, targetMoneda) {
  const k = settings.alphaVantageKey || ''; if (!k) return null;
  const base = ticker.toUpperCase().replace(/\.(L|DE|AS|PA|MI|SW|LON|DEX)$/i, '');

  // Recordar qué sufijo funciona para cada ticker — evita probar los 4 cada vez
  const suffixKey = 'av_suffix_' + base;
  const knownSuffix = LS.get(suffixKey);
  const symbols = knownSuffix ? [base + knownSuffix] : [base+'.LON', base+'.DEX', base+'.EPA', base+'.AMS'];
  const symbolsUSD = knownSuffix ? [base + knownSuffix] : [base+'.LON', base];
  const allSymbols = targetMoneda === 'MXN' ? symbols : (knownSuffix ? [base + knownSuffix] : [...symbols, base]);

  // Asegurar que tengamos tipos de cambio frescos ANTES de convertir
  if (!_fxCache || !_fxCache.gbpmxn) await fetchFX();
  const fx = _fxCache || LS.get('fxCache');
  const tc = (fx?.usdmxn) || settings.tipoCambio || 20;
  const eurmxn = (fx?.eurmxn) || settings.tipoEUR || 21.5;
  const gbpmxn = (fx?.gbpmxn) || settings.tipoGBP || 25.5;
  const usdgbp = (fx?.usdgbp) || 0.79;
  const usdeur = (fx?.usdeur) || 0.92;
  console.log(`[AlphaVantage] FX listo — USD/MXN:${tc} GBP/MXN:${gbpmxn}`);

  for (const sym of allSymbols) {
    try {
      const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${k}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.Note || d.Information) { console.warn('[AlphaVantage] Límite alcanzado'); return null; }
      const q = d['Global Quote'];
      if (!q || !q['01. symbol'] || !q['05. price']) continue;
      let price = parseFloat(q['05. price']);
      if (!price || price <= 0) continue;

      // Guardar qué sufijo funcionó para este ticker
      const suffix = sym.replace(base, '');
      if (suffix) LS.set(suffixKey, suffix);

      console.log(`[AlphaVantage] ${sym} = ${price} raw → ${targetMoneda}`);
      if (targetMoneda === 'MXN') {
        if (sym.includes('.LON')) price = price * tc;
        else if (sym.includes('.DEX') || sym.includes('.EPA') || sym.includes('.AMS')) price = price * eurmxn;
        else price = price * tc;
      } else if (targetMoneda === 'USD') {
        if (sym.includes('.DEX') || sym.includes('.EPA') || sym.includes('.AMS')) price = price / usdeur;
      }
      console.log(`[AlphaVantage] ${sym} = ${price} ${targetMoneda} ✅`);
      return price;
    } catch(e) { console.warn('[AlphaVantage] error:', sym, e); }
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}


async function fetchFX() {
  const cached = LS.get('fxCache');
  // Caché válido: fresco (< 6h), tiene GBP, y USD/MXN entre 15 y 30
  const isValid = cached && isFxCacheFresh(cached.ts) && cached.gbpmxn && cached.usdmxn >= 15 && cached.usdmxn <= 30;
  if (isValid) { _fxCache = cached; return cached; }
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN,EUR,GBP');
    if (!r.ok) throw new Error();
    const d = await r.json();
    const gbpmxn = d.rates.MXN / d.rates.GBP;
    const result = { usdmxn: d.rates.MXN, usdeur: d.rates.EUR, eurmxn: d.rates.MXN / d.rates.EUR, gbpmxn, usdgbp: d.rates.GBP, ts: Date.now() };
    console.log(`[FX] Frankfurter: USD/MXN=${result.usdmxn.toFixed(4)}`);
    if (result.usdmxn >= 15 && result.usdmxn <= 30) {
      LS.set('fxCache', result);
      _fxCache = result;
    } else {
      console.warn(`[FX] Valor fuera de rango, descartando: ${result.usdmxn}`);
    }
    return result;
  } catch { return _fxCache || { usdmxn: settings.tipoCambio||20, usdeur: 0.92, eurmxn: (settings.tipoCambio||20)/0.92, gbpmxn: (settings.tipoCambio||20)*1.27, usdgbp: 0.79, ts: 0 }; }
}

async function updateFX() {
  const fx = await fetchFX();
  if (fx && fx.usdmxn && fx.ts && isCacheFresh(fx.ts)) {
    settings.tipoCambio = Math.round(fx.usdmxn * 100) / 100;
    settings.tipoEUR = Math.round(fx.eurmxn * 100) / 100;
    settings.tipoGBP = Math.round(fx.gbpmxn * 100) / 100;
    LS.set('settings', settings);
    const inpUSD = document.getElementById('inputTCUSD');
    const inpEUR = document.getElementById('inputTCEUR');
    const inpGBP = document.getElementById('inputTCGBP');
    if (inpUSD) inpUSD.value = settings.tipoCambio;
    if (inpEUR) inpEUR.value = settings.tipoEUR;
    if (inpGBP) inpGBP.value = settings.tipoGBP;
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
  const gbp = fx?.gbpmxn ? `<span>GBP $${fx.gbpmxn.toFixed(2)}</span>` : '';
  const sep = '<span style="opacity:0.3">·</span>';
  const parts = [usd, eur, gbp].filter(Boolean);
  if (parts.length) sub.innerHTML = parts.join(sep);
}

async function fetchPrice(ticker, type, moneda) {
  ticker = ticker.toUpperCase();
  moneda = (moneda || 'USD').toUpperCase();
  if (ticker === 'USD' || type === 'Efectivo USD') return {price:1, source:'fixed', cached:false, ts:Date.now()};
  const cacheKey = moneda === 'MXN' ? ticker + '_MXN' : ticker;
  const cached = getCachedPrice(cacheKey);
  if (cached && isCacheFresh(cached.ts)) return {...cached, cached:true};

  let price = null, source = 'none';
  if (type === 'Crypto') {
    price = await fetchCryptoPrice(ticker);
    if (price !== null) source = 'coingecko';
  }
  else if ((type === 'Acción' || type === 'ETF') && moneda === 'MXN') {
    // 1. Finnhub primero — si lo encuentra no gasta cuota de Alpha Vantage
    let priceUSD = await fetchStockPrice(ticker);
    if (priceUSD !== null) {
      const fx = _fxCache || LS.get('fxCache');
      const tcLive = (fx?.usdmxn) || settings.tipoCambio || 20;
      price = priceUSD * tcLive; source = 'finnhub-converted';
    }
    // 2. Alpha Vantage directo a MXN — solo si Finnhub no lo encontró
    if (price === null && settings.alphaVantageKey) { price = await fetchAlphaVantagePrice(ticker, 'MXN'); if (price !== null) source = 'alphavantage-mxn'; }
    // 3. Fallback: caché USD × tipoCambio
    if (price === null) {
      const cachedUSD = getCachedPrice(ticker.toUpperCase());
      if (cachedUSD && isCacheFresh(cachedUSD.ts) && isPriceReasonable(cachedUSD.price, ticker.toUpperCase())) {
        const fx = _fxCache || LS.get('fxCache');
        const tcLive = (fx?.usdmxn) || settings.tipoCambio || 20;
        const derived = cachedUSD.price * tcLive;
        if (isPriceReasonable(derived, ticker.toUpperCase()+'_MXN')) { price = derived; source = 'usd-cache-converted'; }
      }
    }
    // 4. Último recurso: Alpha Vantage USD × tipoCambio
    if (price === null && settings.alphaVantageKey) {
      const priceUSD2 = await fetchAlphaVantagePrice(ticker, 'USD');
      if (priceUSD2 !== null) {
        const fx = _fxCache || LS.get('fxCache');
        price = priceUSD2 * ((fx?.usdmxn) || settings.tipoCambio || 20);
        source = 'alphavantage-usd-converted';
      }
    }
  }
  else if (type === 'Acción' || type === 'ETF') {
    // 0. Si ya tenemos precio MXN en caché hoy, derivar USD sin gastar llamada API
    const cachedMXN = getCachedPrice(ticker.toUpperCase() + '_MXN');
    if (cachedMXN && isCacheFresh(cachedMXN.ts) && isPriceReasonable(cachedMXN.price, ticker.toUpperCase()+'_MXN')) {
      const fx = _fxCache || LS.get('fxCache');
      const tcLive = (fx?.usdmxn) || settings.tipoCambio || 20;
      const derived = cachedMXN.price / tcLive;
      if (isPriceReasonable(derived, ticker.toUpperCase())) { price = derived; source = 'mxn-cache-converted'; }
    }
    if (price === null) { price = await fetchStockPrice(ticker); if (price !== null) source = 'finnhub'; }
    // Alpha Vantage para ETFs europeos (VUAA, etc.) que Finnhub no tiene
    if (price === null && settings.alphaVantageKey) { price = await fetchAlphaVantagePrice(ticker, moneda); if (price !== null) source = 'alphavantage'; }
  }
  if (price !== null) { setCachedPrice(cacheKey, price, source); return {price, source, cached:false, ts:Date.now()}; }
  console.warn(`[fetchPrice] Sin precio para ${ticker} (${moneda}, ${type}) — todas las fuentes fallaron`);
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
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); tickerSet.set(key, {type: m.tipoActivo, moneda: m.moneda||'USD', ticker: m.ticker.toUpperCase()}); } });
  if (forceRefresh) { const c = getPriceCache(); tickerSet.forEach((_, k) => { delete c[k]; }); setPriceCache(c); }
  // Ordenar: USD primero, MXN después — así el cross-cache siempre encuentra el precio USD listo
  const tickerArr = [...tickerSet.entries()].sort((a, b) => {
    const aIsMXN = a[1].moneda === 'MXN' ? 1 : 0;
    const bIsMXN = b[1].moneda === 'MXN' ? 1 : 0;
    return aIsMXN - bIsMXN;
  });
  for (const [key, info] of tickerArr) { const b = document.getElementById('btnUpdate'); if (b) b.innerHTML = `<span class="spinner"></span> ${info.ticker}...`; await fetchPrice(info.ticker, info.type, info.moneda); await new Promise(r => setTimeout(r, 300)); }
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
const ASSET_TYPES=['Acción','ETF','Crypto','Efectivo USD'];
const BROKERS=['Interactive Brokers','Fidelity','Binance','Robinhood','Bitso','GBM','OKX','Kraken','Coinbase','Actinver','Charles Schwab','BBVA Bancomer','Bursanet'];
const PLAT_TYPES=['BANCO','SOFIPO','CUENTA DIGITAL','BOLSA/ETFs','FONDOS','FONDOS RETIRO','DEUDA/CETES'];
const PLAT_GROUPS=['Ahorro/Liquidez','Cuenta Digital','Bolsa/ETFs','Fondos','Deuda/CETES'];
const PLAT_MONEDAS=['MXN','USD','EUR'];
const FRECUENCIAS=['Mensual','Quincenal','Semanal','Anual','Trimestral'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().split('T')[0];
const isMobile = () => window.innerWidth <= 768;

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
const DEFAULT_SETTINGS={tipoCambio:20,tipoEUR:21.5,tipoGBP:25.5,rendimientoEsperado:0.06,finnhubKey:''};
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
let settings = {...DEFAULT_SETTINGS, ...(LS.get('settings') || {})};
let recurrentes = LS.get('recurrentes') || DEFAULT_RECURRENTES;
let patrimonioHistory = LS.get('patrimonioHistory') || [];
// Limpiar snapshots sintéticos de versiones anteriores
(function(){ const f=patrimonioHistory.filter(s=>!s.synthetic); if(f.length!==patrimonioHistory.length){patrimonioHistory=f;LS.set('patrimonioHistory',patrimonioHistory);} })();

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
  const patrimonioTotal = totalMXN + totalInvMXN;

  // Capital base = dinero que el usuario HA METIDO (saldos iniciales + aportaciones - retiros)
  // No incluye rendimientos — solo movimientos de capital propios
  const capitalPlats = plats.reduce((s,p) => {
    const toMXN = v => p.moneda === 'USD' ? v*tc : p.moneda === 'EUR' ? v*eurmxn : v;
    return s + toMXN(p.saldoInicial||0) + toMXN(p.aportacion||0) - toMXN(p.retiro||0);
  }, 0);
  const capitalInv = tickers.reduce((s,t) => s + (t.moneda === 'MXN' ? t.costoTotal : t.costoTotal * tc), 0);
  const capitalBase = capitalPlats + capitalInv;

  savePatrimonioSnapshot(patrimonioTotal, capitalBase);
}

function savePatrimonioSnapshot(value, capital) {
  const todayStr = today();
  const existingIndex = patrimonioHistory.findIndex(s => s.date === todayStr);
  const newSnapshot = { date: todayStr, value: Math.round(value), capital: Math.round(capital || value) };
  if (existingIndex === -1) { patrimonioHistory.push(newSnapshot); if (patrimonioHistory.length > 365) patrimonioHistory = patrimonioHistory.slice(-365); }
  else { patrimonioHistory[existingIndex] = newSnapshot; }
  LS.set('patrimonioHistory', patrimonioHistory);
}

// Reconstruye snapshots históricos desde movimientos pasados
// Para cada fecha calcula el capital aportado hasta ese día.
// La ganancia se interpola linealmente entre 0 y la ganancia real de hoy
// para evitar el salto vertical al no tener precios históricos.
function buildHistoricalSnapshots() {
  const tc = settings.tipoCambio || 20;
  const eurmxn = getEurMxn();
  const todayStr = today();

  // Recopilar todas las fechas relevantes de movimientos pasados
  const fechas = new Set();
  movements.forEach(m => { if (m.fecha && m.fecha < todayStr) fechas.add(m.fecha); });
  platforms.forEach(p => { if (p.fechaInicio && p.fechaInicio < todayStr) fechas.add(p.fechaInicio); });
  if (fechas.size === 0) return;

  // Eliminar todos los sintéticos anteriores — siempre se recalculan frescos
  patrimonioHistory = patrimonioHistory.filter(s => !s.synthetic);

  const fechasOrdenadas = [...fechas].sort();

  // Calcular capital por fecha
  const capitalPorFecha = [];
  fechasOrdenadas.forEach(fecha => {
    if (patrimonioHistory.find(s => s.date === fecha)) return; // hay snapshot real, no tocar

    let capitalPlats = 0;
    platforms.forEach(p => {
      if (p.fechaInicio && p.fechaInicio > fecha) return;
      const toMXN = v => p.moneda === 'USD' ? v*tc : p.moneda === 'EUR' ? v*eurmxn : v;
      capitalPlats += toMXN(p.saldoInicial || 0);
      movements.filter(m => m.seccion === 'plataformas' && m.plataforma === p.name && m.fecha <= fecha).forEach(m => {
        if (m.tipo === 'Aportación') capitalPlats += toMXN(m.monto || 0);
        if (m.tipo === 'Retiro') capitalPlats -= toMXN(m.monto || 0);
      });
    });

    let capitalInv = 0;
    movements.filter(m => m.seccion === 'inversiones' && m.tipo === 'Compra' && m.fecha <= fecha)
      .forEach(m => { const monto = (m.cantidad||0)*(m.precio||0); capitalInv += m.moneda==='MXN' ? monto : monto*tc; });
    movements.filter(m => m.seccion === 'inversiones' && m.tipo === 'Venta' && m.fecha <= fecha)
      .forEach(m => { const monto = (m.cantidad||0)*(m.precio||0); capitalInv -= m.moneda==='MXN' ? monto : monto*tc; });

    const capital = Math.round(capitalPlats + Math.max(0, capitalInv));
    if (capital > 0) capitalPorFecha.push({ date: fecha, capital });
  });

  if (capitalPorFecha.length === 0) return;

  // Ganancia real de hoy (del snapshot de hoy si existe)
  const todaySnap = patrimonioHistory.find(s => s.date === todayStr && !s.synthetic);
  const gananciaHoy = todaySnap ? todaySnap.value - (todaySnap.capital || todaySnap.value) : 0;

  // Rango de tiempo para interpolación
  const fechaInicio = new Date(capitalPorFecha[0].date);
  const fechaHoy = new Date(todayStr);
  const diasTotal = Math.max(1, (fechaHoy - fechaInicio) / (1000*60*60*24));

  // Crear snapshots sintéticos con ganancia interpolada
  capitalPorFecha.forEach(({ date, capital }) => {
    const diasDesdeInicio = (new Date(date) - fechaInicio) / (1000*60*60*24);
    const progreso = diasDesdeInicio / diasTotal;
    const gananciaInterpolada = Math.round(gananciaHoy * progreso);
    patrimonioHistory.push({ date, value: capital + gananciaInterpolada, capital, synthetic: true });
  });

  // Ordenar y limpiar duplicados (reales tienen prioridad sobre sintéticos)
  patrimonioHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
  const seen = new Map();
  patrimonioHistory.forEach(s => { if (!seen.has(s.date) || !s.synthetic) seen.set(s.date, s); });
  patrimonioHistory = [...seen.values()];
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
  // Merge con defaults para que campos nuevos (tipoGBP, etc.) nunca se pierdan al cargar de Firebase
  if(remote.settings)settings={...DEFAULT_SETTINGS,...remote.settings};
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

  // RENDIMIENTO PURO: valor - capital en ese snapshot
  // = cuánto has ganado/perdido sobre lo que tenías invertido en ese momento
  // Cuando aportas más capital, la línea verde NO salta — solo sube si ganas
  function pureYield(snap) {
    if (!snap) return 0;
    const cap = snap.capital || snap.value;
    return snap.value - cap; // ganancia neta sobre capital aportado
  }

  // Para la GRÁFICA anclamos la línea verde en 0 al inicio y mostramos ganancia acumulada
  // Así aportaciones no hacen saltar la línea — solo las ganancias la mueven
  function pureYieldAnchored(snap) {
    return snap.value - (snap.capital || snap.value);
  }

  // Rendimiento puro actual
  const tc2 = settings.tipoCambio || 20;
  const eurmxn2 = getEurMxn();
  const plats2 = calcPlatforms();
  const capitalPlatsHoy = plats2.reduce((s,p) => {
    const toMXN = v => p.moneda==='USD' ? v*tc2 : p.moneda==='EUR' ? v*eurmxn2 : v;
    return s + toMXN(p.saldoInicial||0) + toMXN(p.aportacion||0) - toMXN(p.retiro||0);
  }, 0);
  const tickers2 = getTickerPositions();
  const capitalInvHoy = tickers2.reduce((s,t) => s + (t.moneda==='MXN' ? t.costoTotal : t.costoTotal*tc2), 0);
  const capitalHoy = capitalPlatsHoy + capitalInvHoy;
  const patrimonioRendPuro = patrimonio - capitalHoy; // ganancia neta total hoy

  function getChangeForMonths(months) {
    if (hist.length < 2) return null;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const ref = hist.filter(s => s.date <= cutoffStr).slice(-1)[0];
    if (!ref) return null;
    const now = todaySnap || hist[hist.length-1];
    return pureYieldAnchored(now) - pureYieldAnchored(ref);
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
  // Línea verde = ganancia neta acumulada (valor - capital aportado en ese momento)
  // Aportaciones NO la mueven, solo las ganancias reales sí
  const realValsFiltered = histFiltered.map(s => pureYieldAnchored(s));

  const curLabel = salaryIsEUR ? '🇪🇺 EUR' : '🇲🇽 MXN';

  const projInterval = CHART_INTERVALS.find(i => i.key === _projKey) || CHART_INTERVALS[3];
  const projMonths = projInterval.months;

  const periodOptions = [
    ...CHART_INTERVALS,
    { key:'all', label:'Todo', months:null }
  ];

  const rangeButtonsHTML = periodOptions.map(r => {
    const change = r.months !== null ? getChangeForMonths(r.months) : (hist.length>=2 ? pureYield(hist[hist.length-1]) - pureYield(hist[0]) : null);
    const col = change === null ? 'var(--text3)' : pctCol(change);
    const val = change !== null ? (change >= 0 ? '+' : '') + fmt(change) : '—';
    const isActive = _chartRange === r.key;
    return `<button class="chart-ctrl-btn ${isActive ? 'active' : ''}" onclick="setChartRange('${r.key}')">
      <span>${r.label}</span>
      <span class="btn-val" style="color:${isActive ? 'inherit' : col}">${val}</span>
    </button>`;
  }).join('');

  const projButtonsHTML = CHART_INTERVALS.map(r => {
    const pv = Math.round(capitalHoy * Math.pow(1 + re/12, r.months));
    const gain = pv - capitalHoy;
    const isActive = _projKey === r.key;
    return `<button class="chart-ctrl-btn proj-btn ${isActive ? 'active' : ''}" onclick="setChartProj('${r.key}')">
      <span>${r.label}</span>
      <span class="btn-val" style="color:${isActive ? 'inherit' : 'var(--blue)'}">+${fmt(gain)}</span>
    </button>`;
  }).join('');

  // Rentabilidad anualizada real (CAGR) usando snapshots históricos
  let rendAnualReal = null;
  if (hist.length >= 2) {
    const first = hist[0], last = hist[hist.length - 1];
    const diasTotal = (new Date(last.date) - new Date(first.date)) / (1000*60*60*24);
    if (diasTotal > 30 && first.value > 0) {
      const cagr = Math.pow(last.value / first.value, 365 / diasTotal) - 1;
      rendAnualReal = cagr;
    }
  }
  // Delta del patrimonio vs ayer
  const ayerSnap = hist.filter(s => s.date < todayStr).slice(-1)[0];
  const deltaHoy = ayerSnap ? patrimonio - ayerSnap.value : 0;
  const deltaHoyPct = ayerSnap && ayerSnap.value > 0 ? deltaHoy / ayerSnap.value : 0;

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

    <div class="grid-8" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Valor Plataformas</div><div class="stat-value">${fmt(totalMXN)}</div><div class="stat-sub"><span style="color:${pctCol(totalRend)};font-weight:700">${fmtPct(invInicial?totalRend/invInicial:0)}</span> rendimiento</div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Rend. Plataformas</div><div class="stat-value" style="color:${pctCol(totalRend)}">${fmt(totalRend)}</div><div class="stat-sub">${platsConTasa>0?`<span style="color:var(--teal)">⚡${fmt(totalRendAuto)} auto</span>`:'rendimiento total'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 Valor Inversiones</div><div class="stat-value">${fmt(totalInvMXN)}</div><div class="stat-sub">${tickerList.length} posiciones · ${priceSummary.live>0?'precios hoy':'costo compra'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 G/P No Realizada</div><div class="stat-value" style="color:${pctCol(gpNoRealizadaTotal)}">${fmt(gpNoRealizadaTotal)}</div><div class="stat-sub">${fmtPct(totalInvertidoUSD?gpNoRealizadaTotal/(totalInvertidoUSD*tc):0)} sobre invertido</div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">📊 CAGR Real</div><div class="stat-value" style="color:${rendAnualReal!==null?pctCol(rendAnualReal):'var(--text2)'}">${rendAnualReal!==null?(rendAnualReal>=0?'+':'')+(rendAnualReal*100).toFixed(1)+'%':'—'}</div><div class="stat-sub">${rendAnualReal!==null?'rentabilidad anualizada':'sin historial aún'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">📊 Concentración</div><div class="stat-value" style="font-size:14px">${topPlat?.name||'—'}</div><div class="stat-sub"><span style="color:var(--orange);font-weight:700">${(maxConc*100).toFixed(1)}%</span> · ${riskLvl}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Gastos Mes ${curLabel}</div><div class="stat-value" style="color:${totGastoMes>0?'var(--red)':'var(--text)'}">${fmtD(totGastoMes)}</div><div class="stat-sub">${totalPresupuesto>0?(pctPresUsado*100).toFixed(0)+'% presupuesto':totIngMes>0||ingresoMensualEUR>0?fmtD(totIngMes>0?totIngMes:ingresoMensualEUR)+' ingreso':''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Balance Mes ${curLabel}</div><div class="stat-value" style="color:${pctCol(balMes)}">${fmtD(balMes)}</div><div class="stat-sub">${(pctAhorro*100).toFixed(0)}% ahorro${totIngMes===0&&ingresoMensualEUR>0?' (est.)':''}</div></div>
    </div>

    ${maxConc>0.25?`<div style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(255,159,10,0.06);border:1px solid rgba(255,159,10,0.15);border-radius:12px;margin-bottom:16px;font-size:13px"><span style="font-size:18px">⚠️</span><span><strong>${topPlat?.name}</strong> concentra el <strong style="color:var(--orange)">${(maxConc*100).toFixed(1)}%</strong> de tu portafolio.</span></div>`:''}

    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="padding:24px 28px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);margin-bottom:4px">📈 Evolución del Patrimonio</div>
            <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
              <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:${pctCol(patrimonio - capitalHoy)};line-height:1">${fmt(patrimonio - capitalHoy)}</div>
              <span style="font-size:12px;color:var(--text2)">ganancia · ${fmt(capitalHoy)} invertidos</span>
              <span id="chartPeriodChange" style="display:inline-flex;align-items:center;gap:5px;font-size:13px;padding:3px 10px;border-radius:20px;background:var(--card2)"></span>
            </div>
            <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:18px;height:3px;background:linear-gradient(90deg,#30D158,#34D35A);border-radius:2px;box-shadow:0 0 6px rgba(48,209,88,0.4)"></span>
                Ganancia real
              </span>
              <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">
                <span style="display:inline-flex;gap:2px;align-items:center"><span style="width:4px;height:2px;background:rgba(10,132,255,0.65);border-radius:1px"></span><span style="width:4px;height:2px;background:rgba(10,132,255,0.65);border-radius:1px"></span><span style="width:4px;height:2px;background:rgba(10,132,255,0.65);border-radius:1px"></span></span>
                Proyección ${(re*100).toFixed(0)}%/año
              </span>
            </div>
          </div>
          <div style="display:flex;gap:24px;align-items:flex-start">
            <div style="text-align:right">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);margin-bottom:2px">Patrimonio Total</div>
              <div style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:var(--text);line-height:1">${fmt(patrimonio)}</div>
            </div>
            <div style="width:1px;background:var(--border);align-self:stretch;margin:2px 0"></div>
            <div style="text-align:right">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--blue);margin-bottom:2px">Ganancia esperada en ${projInterval.label}</div>
              <div style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:var(--blue);line-height:1">+${fmt(Math.round(capitalHoy * (Math.pow(1+re/12, projMonths) - 1)))}</div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:5px">
                <span style="font-size:12px;color:var(--text2);font-weight:700">sobre ${fmt(capitalHoy)} capital</span>
                <span style="font-size:11px;color:var(--text3)">·</span>
                <span style="font-size:11px;font-weight:700;color:var(--blue)">${(re*100).toFixed(0)}%/año</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style="padding:0 20px 0px">
        <div class="chart-container" style="height:260px">${hist.length < 2 ? `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text3)"><div style="font-size:32px">📈</div><div style="font-size:13px;font-weight:600;color:var(--text2)">La gráfica aparecerá mañana</div><div style="font-size:11px;text-align:center;max-width:220px;line-height:1.5">Necesitas al menos 2 días de datos.<br>Vuelve mañana y verás tu evolución.</div></div>` : `<canvas id="chartEvo"></canvas>`}</div>
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
        <div class="card-title">💼 Inversiones por Tipo</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="chart-container" style="height:140px;width:140px;flex-shrink:0"><canvas id="chartInvTipo"></canvas></div>
          <div style="flex:1">
            ${(()=>{
              const inv={};
              tickerList.forEach(t=>{
                if(t.cantActual>0){
                  const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);
                  inv[t.type]=(inv[t.type]||0)+v;
                }
              });
              // También incluir plataformas agrupadas como "Plataformas"
              const totalPlats=totalMXN;
              if(totalPlats>0) inv['Plataformas']=totalPlats;
              const sorted=Object.entries(inv).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
              const total=sorted.reduce((s,[,v])=>s+v,0)||1;
              const gpTotal=gpNoRealizadaTotal+gpRealizadaTotal;
              const gpRow=`<div style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border)"><div style="font-size:10px;color:var(--text2)">G/P Total</div><div style="font-size:14px;font-weight:800;color:${pctCol(gpTotal)}">${gpTotal>=0?'+':''}${fmt(gpTotal)}</div></div>`;
              return sorted.map(([k,v],i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0"><span style="display:flex;align-items:center;gap:5px;font-size:11px"><span style="width:7px;height:7px;border-radius:2px;background:${COLORS[i%COLORS.length]};display:inline-block;flex-shrink:0"></span>${k}</span><span style="font-size:11px;font-weight:700">${((v/total)*100).toFixed(1)}%</span></div>`).join('')+gpRow;
            })()}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🔥 Top Gastos — ${MONTHS[cm-1]} ${curLabel}</div>
        ${topCats.length>0?topCats.map(([id,v],i)=>{const medals=['🥇','🥈','🥉','4️⃣','5️⃣'];return`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;border-bottom:${i<topCats.length-1?'0.5px solid var(--border)':'none'}"><span>${medals[i]} ${catName(id)}</span><span style="font-weight:700">${fmtD(v)}</span></div>`;}).join(''):'<div style="text-align:center;color:var(--text2);padding:24px;font-size:13px">Sin gastos este mes</div>'}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;align-items:stretch">
      <div class="card" style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="card-title" style="margin:0">🏆 Top Plataformas</div></div>
        <div style="flex:1;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${[...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a)).slice(0,10).map((p,i)=>`
          <div class="list-item">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="rank" style="background:${COLORS[i]}">${i+1}</div>
              <div><div style="font-size:13px;font-weight:600">${p.name} ${monedaBadge(p.moneda)} ${p.tasaAnual>0?`<span class="tasa-badge${p.tasaAnual>=10?' alta':p.tasaAnual>=5?' media':''}">⚡${p.tasaAnual}%</span>`:''}</div><div style="font-size:10px;color:var(--text2)">${p.type} · ${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</div></div>
            </div>
            <div style="text-align:right"><div style="font-size:13px;font-weight:700">${fmtPlat(p.saldo, p.moneda)}</div><div style="font-size:10px;font-weight:600;color:${pctCol(p.rendimiento)}">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento, p.moneda)}</div></div>
          </div>`).join('')}
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div class="card-title">📊 Posiciones</div>
        <div style="flex:1;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${tickerList.length>0?tickerList.sort((a,b)=>b.costoTotal-a.costoTotal).map(t=>{
          const tipoClass=t.type==='Acción'?'badge-green':t.type==='ETF'?'badge-blue':t.type==='Crypto'?'badge-orange':'badge-gray';
          const monedaLabel=t.moneda==='MXN'?'MXN':'USD';
          return`<div class="list-item" style="padding:8px 0;gap:4px">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
              <span style="font-size:13px;font-weight:800;flex-shrink:0">${t.ticker}</span>
              <span class="badge ${tipoClass}" style="font-size:9px">${t.type}</span>
              ${t.cantActual<=0?'<span class="badge badge-gray" style="font-size:9px">CERRADA</span>':''}
              <span style="font-size:10px;color:var(--text2);white-space:nowrap">×${t.cantActual} · ${t.moneda==='MXN'?'$':'US$'}${t.precioCostoPromedio.toFixed(1)}→<span class="${t.priceCssClass}">${t.priceLabel}</span></span>
            </div>
            <div style="text-align:right;flex-shrink:0">${t.gpNoRealizada!==null?`<div style="font-size:13px;font-weight:800;color:${pctCol(t.gpNoRealizada)}">${t.gpNoRealizada>=0?'+':''}${fmtFull(t.gpNoRealizada)}</div><div style="font-size:10px;color:${pctCol(t.pctNoRealizada)};font-weight:600">${fmtPct(t.pctNoRealizada)}</div>`:`<div style="font-size:11px;color:var(--text3)">sin precio</div>`}</div>
          </div>`;
        }).join(''):'<div style="text-align:center;color:var(--text2);padding:32px">Sin operaciones</div>'}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">🎯 Progreso de Metas</div>
        <button class="btn btn-secondary btn-sm" onclick="switchTab('metas')">Ver todas →</button>
      </div>
      ${goals.length>0?`<div class="grid-2">${goals.slice(0,4).map(g=>{let actual=0;const patrimonioTotal=totalMXN+totalInvMXN;if(g.clase==='Patrimonio Total'||g.clase==='Todos')actual=patrimonioTotal;else if(g.clase==='Plataformas')actual=totalMXN;else if(g.clase==='Inversiones')actual=totalInvMXN;else if(g.clase==='Ingreso Mensual')actual=ingresoMensualEUR;else actual=patrimonioTotal;const pct=g.meta>0?actual/g.meta:0;const sc=pct>=1?'var(--green)':pct>=0.8?'var(--orange)':pct>=0.3?'var(--blue)':'var(--text2)';const st=pct>=1?'🏆 LOGRADA':pct>=0.8?'🔥 Casi':pct>=0.3?'⏳ En proceso':'💤 Inicio';return`<div style="padding:12px;background:var(--card2);border-radius:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:700">${g.nombre}</div><span style="font-size:11px;font-weight:700;color:${sc}">${st}</span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:6px"><span style="font-weight:700;color:var(--text)">${fmt(actual)}</span><span>meta: ${fmt(g.meta)}</span></div><div class="progress-bg"><div class="progress-fill" style="background:${sc};width:${Math.min(pct*100,100).toFixed(1)}%"></div></div><div style="text-align:right;font-size:11px;font-weight:800;color:${sc};margin-top:4px">${(pct*100).toFixed(1)}%</div></div>`;}).join('')}</div>`:`<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px">Sin metas — <button class="btn btn-primary btn-sm" onclick="switchTab('metas')">Crear →</button></div>`}
    </div>

  `;

  updateNav(patrimonio,totalMXN,totalUSDCurrent,tc,totalRend,deltaHoy,deltaHoyPct);

  setTimeout(()=>{
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)';
    const tickColor=isDark?'#636366':'#C7C7CC';

    const realDates = realDatesFiltered;
    const realVals = realValsFiltered;

    // Proyección azul: ganancia esperada sobre el capital actual al % esperado
    // Mismo eje que la línea verde (ganancia neta) — si verde está encima = vas mejor ✅
    const now = new Date();
    const lastRealDate = realDates.length > 0 ? realDates[realDates.length - 1] : now.toISOString().split('T')[0];
    const lastRealVal = realVals.length > 0 ? realVals[realVals.length - 1] : patrimonioRendPuro;
    const projDates=[];
    const projVals=[];
    projDates.push(lastRealDate);
    projVals.push(lastRealVal);
    // Ganancia esperada = capital actual × ((1+re)^i - 1) — crece con el capital pero no con ganancias
    for(let i=1; i<=projMonths; i++){
      const d=new Date(now.getFullYear(), now.getMonth()+i, 1);
      projDates.push(d.toISOString().split('T')[0]);
      projVals.push(Math.round(capitalHoy * (Math.pow(1+re/12, i) - 1) + patrimonioRendPuro));
    }

    // Calcular cambio del período para badge en la cabecera
    const periodChange = realVals.length >= 2 ? realVals[realVals.length-1] - realVals[0] : null;
    const periodChangePct = (realVals.length >= 2 && realVals[0] > 0) ? (realVals[realVals.length-1] - realVals[0]) / realVals[0] : null;
    const changeEl = document.getElementById('chartPeriodChange');
    if(changeEl && periodChange !== null){
      const sign = periodChange >= 0 ? '+' : '';
      const col = periodChange >= 0 ? 'var(--green)' : 'var(--red)';
      changeEl.innerHTML = `<span style="color:${col};font-weight:800">${sign}${fmt(periodChange)}</span> <span style="color:var(--text3);font-size:10px">${sign}${(periodChangePct*100).toFixed(2)}%</span>`;
      changeEl.style.display = 'inline-flex';
    } else if(changeEl){
      changeEl.style.display = 'none';
    }

    const ctxE=document.getElementById('chartEvo');
    if(ctxE){
      // Gradiente bajo la curva real
      const ctx2d = ctxE.getContext('2d');
      const gradReal = ctx2d.createLinearGradient(0, 0, 0, ctxE.offsetHeight || 240);
      gradReal.addColorStop(0, isDark ? 'rgba(48,209,88,0.18)' : 'rgba(48,209,88,0.13)');
      gradReal.addColorStop(0.7, isDark ? 'rgba(48,209,88,0.04)' : 'rgba(48,209,88,0.02)');
      gradReal.addColorStop(1, 'rgba(48,209,88,0)');

      // pointRadius dinámico: visible si pocos puntos
      const dynRadius = realDates.length <= 12 ? 3 : realDates.length <= 30 ? 2 : 0;
      const dynLastRadius = realDates.length > 0 ? 5 : 0;

      chartInstances.chartEvo=new Chart(ctxE,{type:'line',data:{
        datasets:[
          {
            label:'Patrimonio Real',
            data:realDates.map((d,i)=>({x:d,y:realVals[i]})),
            borderColor:'#30D158',
            backgroundColor: gradReal,
            borderWidth:2.5,
            fill:true,
            tension:0.4,
            pointRadius: realDates.map((_,i) => i === realDates.length-1 ? dynLastRadius : dynRadius),
            pointBackgroundColor:'#30D158',
            pointBorderColor: isDark?'#1C1C1E':'#fff',
            pointBorderWidth:2,
            pointHoverRadius:6,
            pointHoverBackgroundColor:'#30D158',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff',
            pointHoverBorderWidth:2,
          },
          {
            label:'Proyección '+((re*100).toFixed(0))+'% anual',
            data:projDates.map((d,i)=>({x:d,y:projVals[i]})),
            borderColor:'rgba(10,132,255,0.65)',
            backgroundColor:'transparent',
            borderWidth:1.5,
            borderDash:[6,4],
            fill:false,
            tension:0.1,
            pointRadius:0,
            pointHoverRadius:4,
            pointHoverBackgroundColor:'rgba(10,132,255,0.8)',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff',
            pointHoverBorderWidth:2,
          }
        ]
      },options:{
        responsive:true,
        maintainAspectRatio:false,
        interaction:{intersect:false,mode:'index'},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:isDark?'rgba(28,28,30,0.98)':'rgba(29,29,31,0.95)',
            borderColor: isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.1)',
            borderWidth:1,
            cornerRadius:14,
            padding:{top:12,bottom:12,left:16,right:16},
            titleFont:{size:11,family:'DM Sans',weight:'600'},
            bodyFont:{size:13,family:'DM Sans'},
            titleColor:isDark?'#98989D':'#86868B',
            callbacks:{
              title: items => {
                if(!items.length) return '';
                const raw = items[0].label || items[0].raw?.x || '';
                const p = raw.split('-');
                if(p.length===3){ const d=new Date(raw+'T12:00:00'); return d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}); }
                return raw;
              },
              label: ctx => {
                const val = ctx.parsed.y;
                const isReal = ctx.datasetIndex === 0;
                const icon = isReal ? '🟢' : '🔵';
                return ` ${icon} ${ctx.dataset.label}: ${fmtFull(val)}`;
              },
              afterBody: items => {
                if(items.length < 2) return [];
                const real = items.find(i=>i.datasetIndex===0);
                const proj = items.find(i=>i.datasetIndex===1);
                if(!real||!proj) return [];
                const diff = proj.parsed.y - real.parsed.y;
                if(diff === 0) return [];
                const sign = diff > 0 ? '+' : '';
                return ['', ` Potencial: ${sign}${fmtFull(diff)}`];
              }
            }
          }
        },
        scales:{
          x:{
            type:'time',
            time:{
              unit:'month',
              displayFormats:{ month:'MMM yy', day:'d MMM' },
              tooltipFormat:'yyyy-MM-dd'
            },
            adapters:{ date:{} },
            grid:{display:false},
            ticks:{
              font:{size:10},
              color:tickColor,
              maxTicksLimit:10,
              maxRotation:0,
            },
            border:{display:false}
          },
          y:{
            grid:{color:gridColor},
            ticks:{font:{size:11},color:tickColor,callback:v=>fmt(v),maxTicksLimit:5},
            border:{display:false}
          }
        }
      }});
    }

    const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});
    tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);at[t.type]=(at[t.type]||0)+v;}});
    const de=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const ctxD=document.getElementById('chartDistro');
    if(ctxD&&de.length>0){chartInstances.chartDistro=new Chart(ctxD,{type:'doughnut',data:{labels:de.map(([k])=>k),datasets:[{data:de.map(([,v])=>v),backgroundColor:de.map((_,i)=>COLORS[i%COLORS.length]),borderWidth:2,borderColor:isDark?'#1C1C1E':'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:12,padding:10,bodyFont:{family:'DM Sans',size:12},callbacks:{label:ctx=>' '+ctx.label+': '+((ctx.parsed/de.reduce((s,[,v])=>s+v,0)*100)).toFixed(1)+'%'}}}}});}

    // Dona: inversiones por tipo de activo
    const inv={};
    tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);inv[t.type]=(inv[t.type]||0)+v;}});
    if(totalMXN>0) inv['Plataformas']=totalMXN;
    const invE=Object.entries(inv).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const ctxI=document.getElementById('chartInvTipo');
    if(ctxI&&invE.length>0){chartInstances.chartInvTipo=new Chart(ctxI,{type:'doughnut',data:{labels:invE.map(([k])=>k),datasets:[{data:invE.map(([,v])=>v),backgroundColor:invE.map((_,i)=>COLORS[i%COLORS.length]),borderWidth:2,borderColor:isDark?'#1C1C1E':'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:12,padding:10,bodyFont:{family:'DM Sans',size:12},callbacks:{label:ctx=>{const total=invE.reduce((s,[,v])=>s+v,0);return ' '+ctx.label+': '+((ctx.parsed/total)*100).toFixed(1)+'% ('+fmt(ctx.parsed)+')';}}}}}});}
  },50);
}

// ============================================
// MOVIMIENTOS
// ============================================
let _movPage = 1;
const MOV_PAGE_SIZE = 30;
let _movFiltered = [];

function _buildMovRow(m, transferGroups) {
  let det='',tipo='',monto='',extra='';
  const notas=m.notas||m.desc||'';
  let rowClass='';
  if(m.seccion==='plataformas'){
    if(m.tipoPlat==='Transferencia salida'&&m.transferId){
      const grp=transferGroups[m.transferId]||[];
      const entrada=grp.find(x=>x.tipoPlat==='Transferencia entrada');
      det=`<strong>${m.platform}</strong> → <strong>${entrada?.platform||'?'}</strong>`;
      tipo='↔ Transferencia'; monto=fmt(m.monto); rowClass='transfer-row';
    } else { det=m.platform; tipo=m.tipoPlat; monto=fmt(m.monto); }
  } else if(m.seccion==='inversiones'){
    det=`<strong>${m.ticker}</strong> · ${m.broker}`;
    tipo=m.tipoMov+' · '+m.tipoActivo+' · '+(m.moneda||'USD');
    monto=fmt(m.montoTotal,m.moneda);
    extra=m.cantidad+'×'+fmtFull(m.precioUnit);
  } else {
    det=catName(m.categoria);
    tipo=m.tipo+(m.esRecurrente?' 🔄':'');
    monto=fmt(m.importe);
  }
  const secCell = m.tipoPlat==='Transferencia salida'&&m.transferId
    ? `<span class="badge badge-teal">↔ TRANSFER</span>`
    : secBadge(m.seccion);
  return `<tr class="${rowClass}">
    <td style="color:var(--text2);font-size:12px">${m.fecha}</td>
    <td>${secCell}</td>
    <td>${det}</td>
    <td style="color:var(--text2);font-size:12px">${tipo}</td>
    <td style="font-weight:700">${monto}</td>
    <td style="color:var(--text2);font-size:11px">${extra}</td>
    <td style="color:var(--text2);font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${notas||'—'}</td>
    <td style="white-space:nowrap">
      <button class="edit-btn" onclick="openEditMovModal('${m.id}')" title="Editar">✏️</button>
      <button class="del-btn" onclick="deleteMovement('${m.id}')" title="Eliminar">×</button>
    </td>
  </tr>`;
}

function _appendMovRows() {
  const tbody = document.getElementById('movTbody');
  const sentinel = document.getElementById('movSentinel');
  if (!tbody) return;
  const transferGroups = {};
  movements.forEach(m => { if(m.transferId) transferGroups[m.transferId]=(transferGroups[m.transferId]||[]).concat(m); });
  const start = (_movPage - 1) * MOV_PAGE_SIZE;
  const chunk = _movFiltered.slice(start, start + MOV_PAGE_SIZE);
  if (chunk.length === 0) { if (sentinel) sentinel.style.display='none'; return; }
  chunk.forEach(m => { tbody.insertAdjacentHTML('beforeend', _buildMovRow(m, transferGroups)); });
  _movPage++;
  const counter = document.getElementById('movCounter');
  const loaded = Math.min((_movPage-1)*MOV_PAGE_SIZE, _movFiltered.length);
  if (counter) counter.textContent = `${loaded} de ${_movFiltered.length}`;
  if (loaded >= _movFiltered.length) { if (sentinel) sentinel.style.display='none'; }
}

function _setupMovScroll() {
  const sentinel = document.getElementById('movSentinel');
  if (!sentinel) return;
  if (window._movObserver) window._movObserver.disconnect();
  window._movObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) _appendMovRows();
  }, { rootMargin: '200px' });
  window._movObserver.observe(sentinel);
}

function renderMovimientos(){
  const transferGroups={};
  movements.forEach(m=>{ if(m.transferId) transferGroups[m.transferId]=(transferGroups[m.transferId]||[]).concat(m); });
  _movFiltered=movements.filter(m=>{
    if(movFilter.seccion!=='todas'&&m.seccion!==movFilter.seccion) return false;
    if(m.tipoPlat==='Transferencia entrada'&&m.transferId&&movFilter.seccion==='todas') return false;
    if(movFilter.search){const s=movFilter.search.toLowerCase();const text=[m.platform,m.ticker,m.broker,m.tipoPlat,m.tipoMov,m.tipo,m.notas,m.desc,m.categoria].filter(Boolean).join(' ').toLowerCase();if(!text.includes(s))return false;}
    return true;
  }).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  _movPage=1;

  const isEmpty = _movFiltered.length===0;
  const noMovsAtAll = movements.length===0;
  const emptyHtml = isEmpty ? `
    <tr><td colspan="8">
      <div style="text-align:center;padding:56px 24px">
        <div style="font-size:44px;margin-bottom:14px">${noMovsAtAll?'📋':movFilter.search?'🔍':'📭'}</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">
          ${movFilter.search?'Sin resultados para "'+movFilter.search+'"':noMovsAtAll?'Aún no tienes movimientos':'Sin movimientos en esta sección'}
        </div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:24px">
          ${movFilter.search?'Prueba con otro término':'Registra plataformas, inversiones o gastos para llevar el control'}
        </div>
        ${!movFilter.search?`<button class="btn btn-primary" onclick="openMovModal()">+ Agregar primer movimiento</button>`:''}
      </div>
    </td></tr>` : '';

  document.getElementById('page-movimientos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <div class="section-title">Movimientos</div>
        <div class="section-sub">Registro unificado · ${movements.length} total</div>
      </div>
      <button class="btn btn-primary" onclick="openMovModal()">+ Nuevo</button>
    </div>
    <div class="filter-pills">
      ${['todas','plataformas','inversiones','gastos'].map(s=>`<button class="pill ${movFilter.seccion===s?'active':''}" onclick="movFilter.seccion='${s}';renderMovimientos()">${s==='todas'?'Todas':s==='plataformas'?'🏦 Plataformas':s==='inversiones'?'📈 Inversiones':'💳 Gastos'}</button>`).join('')}
      <input class="pill-search" placeholder="Buscar..." value="${movFilter.search}" oninput="movFilter.search=this.value;renderMovimientos()">
      <span style="font-size:12px;color:var(--text2);margin-left:4px">
        ${_movFiltered.length>0?`<span id="movCounter">0 de ${_movFiltered.length}</span> movimientos`:`0 movimientos`}
      </span>
    </div>
    <div class="card-flat">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Sección</th><th>Detalle</th><th>Tipo</th><th>Monto</th><th>Extra</th><th>Notas</th><th style="width:70px"></th></tr></thead>
          <tbody id="movTbody">${emptyHtml}</tbody>
        </table>
        <div id="movSentinel" style="height:4px"></div>
      </div>
    </div>
  `;

  if (!isEmpty) {
    _appendMovRows();
    setTimeout(_setupMovScroll, 60);
  }
}
function openMovModal(sec){
  const s=sec||'plataformas';
  openModal(`
    <div class="modal-header"><div class="modal-title">Nuevo Movimiento</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="sec-tabs">
      <button class="sec-tab ${s==='plataformas'?'active-plat':''}" onclick="closeModal();openMovModal('plataformas')">🏦 Plataforma</button>
      <button class="sec-tab ${s==='inversiones'?'active-inv':''}" onclick="closeModal();openMovModal('inversiones')">📈 Inversión</button>
      <button class="sec-tab ${s==='gastos'?'active-gasto':''}" onclick="closeModal();openMovModal('gastos')">💳 Gasto</button>
      <button class="sec-tab ${s==='transferencia'?'active-transfer':''}" onclick="closeModal();openMovModal('transferencia')">↔ Transferencia</button>
    </div>
    <form id="movForm" onsubmit="saveMovement('${s}');return false">
      ${s==='plataformas'?`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Plataforma</label><select class="form-select" name="platform" required><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipoPlat">${['Saldo Actual','Aportación','Retiro','Gasto'].map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Monto</label><input type="number" step="any" class="form-input" name="monto" placeholder="0" required></div></div>
        <div class="form-group"><label class="form-label">Descripción</label><input class="form-input" name="desc" placeholder="Opcional..."></div>
      `:s==='inversiones'?`
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Tipo Activo</label><select class="form-select" name="tipoActivo">${ASSET_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Movimiento</label><select class="form-select" name="tipoMov">${['Compra','Venta','Dividendo','Comisión'].map(t=>`<option>${t}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Ticker</label><input class="form-input" name="ticker" placeholder="AAPL, BTC..." required style="text-transform:uppercase"></div><div class="form-group"><label class="form-label">Broker</label><input list="brokerList" class="form-input" name="broker" required placeholder="Escribir..."><datalist id="brokerList">${BROKERS.map(b=>`<option value="${b}">`).join('')}</datalist></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" name="moneda"><option value="USD">USD 🇺🇸</option><option value="MXN">MXN 🇲🇽</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" step="any" class="form-input" name="cantidad" placeholder="0" required></div><div class="form-group"><label class="form-label">Precio Unitario</label><input type="number" step="any" class="form-input" name="precioUnit" placeholder="0.00" required></div><div class="form-group"><label class="form-label">Comisión</label><input type="number" step="any" class="form-input" name="comision" value="0"></div></div>
        <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" placeholder="Opcional..."></div>
      `:s==='transferencia'?`
        <div class="form-group" style="margin-bottom:12px"><div style="display:flex;gap:8px">
          <button type="button" id="btnTipoPlat" onclick="setTipoTransfer('plat')" style="flex:1;padding:10px;border-radius:10px;border:2px solid var(--cyan);background:rgba(100,210,255,0.12);color:var(--cyan);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)">🏦 Entre plataformas</button>
          <button type="button" id="btnTipoSob" onclick="setTipoTransfer('sob')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--card2);color:var(--text2);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font)">💰 Capital sobrante → Plataforma</button>
        </div></div>
        <div id="formTransferPlat">
          <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div>
          <div class="form-row form-row-2">
            <div class="form-group"><label class="form-label">Cuenta Origen</label><select class="form-select" name="platOrigen"><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Cuenta Destino</label><select class="form-select" name="platDestino"><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
          </div>
          <div class="form-group"><label class="form-label">Monto</label><input type="number" step="any" class="form-input" name="monto" placeholder="0"></div>
          <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="desc" placeholder="Ej: Transferencia de liquidez..."></div>
        </div>
        <div id="formTransferSob" style="display:none">
          <div class="form-row form-row-2">
            <div class="form-group"><label class="form-label">Mes del sobrante</label><select class="form-select" name="mesSobrante" onchange="actualizarMontoSobrante(this.value)">${(()=>{const opts=[];const now=new Date();for(let i=0;i<6;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');opts.push('<option value="'+key+'">'+MONTHS[d.getMonth()]+' '+d.getFullYear()+'</option>');}return opts.join('');})()}</select></div>
            <div class="form-group"><label class="form-label">Monto a transferir</label><input type="number" step="any" class="form-input" name="montoSob" id="inputMontoSob" placeholder="0"></div>
          </div>
          <div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fechaSob" value="${today()}"></div>
          <div class="form-group"><label class="form-label">Plataforma destino</label><select class="form-select" name="platDestinoSob"><option value="">Seleccionar...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="descSob" placeholder="Ej: Ahorro de marzo..."></div>
        </div>
      `:`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipo"><option>Gasto</option><option>Ingreso</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Categoría</label><select class="form-select" name="categoria">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Importe</label><input type="number" step="any" class="form-input" name="importe" placeholder="0" required></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" name="monedaGasto"><option value="MXN">MXN 🇲🇽</option><option value="EUR">EUR 🇪🇺</option></select></div></div>
        <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notas" placeholder="Opcional..."></div>
      `}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px;font-size:15px">Guardar</button>
    </form>
  `);
}

function saveMovement(sec){
  const f=document.getElementById('movForm');const d=Object.fromEntries(new FormData(f));
  if(sec==='transferencia'){
    const sobForm=document.getElementById('formTransferSob');const esSobrante=sobForm&&sobForm.style.display!=='none';
    if(esSobrante){
      if(!d.platDestinoSob||!d.montoSob)return;
      const montoEUR=Number(d.montoSob);if(!montoEUR||montoEUR<=0){alert('⚠️ El monto debe ser mayor a 0');return;}
      const eurmxn=getEurMxn();const montoMXN=Math.round(montoEUR*eurmxn*100)/100;
      const mov={id:uid(),seccion:'plataformas',fecha:d.fechaSob||today(),platform:d.platDestinoSob,tipoPlat:'Aportación',monto:montoMXN,desc:(d.descSob||('Sobrante '+d.mesSobrante))+` · €${montoEUR} → $${montoMXN} MXN (TC ${eurmxn.toFixed(2)})`};
      movements=[mov,...movements];saveAll();closeModal();return;
    }
    if(!d.platOrigen||!d.platDestino||!d.monto)return;
    if(d.platOrigen===d.platDestino){alert('⚠️ Origen y destino deben ser distintos');return;}
    const tid=uid();
    const salida={id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platOrigen,tipoPlat:'Transferencia salida',monto:Number(d.monto),desc:d.desc||'Transferencia',transferId:tid};
    const entrada={id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platDestino,tipoPlat:'Transferencia entrada',monto:Number(d.monto),desc:d.desc||'Transferencia',transferId:tid};
    movements=[salida,entrada,...movements];saveAll();closeModal();return;
  }
  let mov={id:uid(),seccion:sec,fecha:d.fecha||today()};
  if(sec==='plataformas'){if(!d.platform||!d.monto)return;mov.platform=d.platform;mov.tipoPlat=d.tipoPlat;mov.monto=Number(d.monto);mov.desc=d.desc||'';}
  else if(sec==='inversiones'){if(!d.ticker||!d.cantidad||!d.precioUnit)return;mov.tipoActivo=d.tipoActivo;mov.ticker=d.ticker.toUpperCase();mov.broker=d.broker;mov.tipoMov=d.tipoMov;mov.cantidad=Number(d.cantidad);mov.precioUnit=Number(d.precioUnit);mov.montoTotal=mov.cantidad*mov.precioUnit;mov.moneda=d.moneda||'USD';mov.comision=Number(d.comision)||0;mov.notas=d.notas||'';}
  else{if(!d.importe)return;mov.categoria=d.categoria;mov.tipo=d.tipo;
    const importeRaw=Number(d.importe);const monedaGasto=d.monedaGasto||'MXN';
    if(monedaGasto==='EUR'){const fx=_fxCache||LS.get('fxCache');const eurmxn=fx?.eurmxn||settings.tipoEUR||21.5;mov.importe=Math.round(importeRaw*eurmxn*100)/100;mov.notas=(d.notas?d.notas+' · ':'')+'€'+importeRaw+' → $'+mov.importe+' MXN (TC '+eurmxn.toFixed(2)+')';}
    else{mov.importe=importeRaw;mov.notas=d.notas||'';}
  }
  movements=[mov,...movements];saveAll();closeModal();
}

function deleteMovement(id){const mov=movements.find(m=>m.id===id);if(mov&&mov.transferId){if(confirm('¿Eliminar la transferencia completa?')){movements=movements.filter(m=>m.transferId!==mov.transferId);}else return;}else{movements=movements.filter(m=>m.id!==id);}saveAll();}

function openEditMovModal(id){
  const m=movements.find(x=>x.id===id);if(!m)return;const sec=m.seccion;
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

function updateMovement(id){
  const f=document.getElementById('editForm');const d=Object.fromEntries(new FormData(f));
  movements=movements.map(m=>{
    if(m.id!==id)return m;const sec=m.seccion;let updated={...m,fecha:d.fecha||m.fecha};
    if(sec==='plataformas'){updated.platform=d.platform;updated.tipoPlat=d.tipoPlat;updated.monto=Number(d.monto);updated.desc=d.desc||'';}
    else if(sec==='inversiones'){updated.tipoActivo=d.tipoActivo;updated.ticker=d.ticker.toUpperCase();updated.broker=d.broker;updated.tipoMov=d.tipoMov;updated.cantidad=Number(d.cantidad);updated.precioUnit=Number(d.precioUnit);updated.montoTotal=updated.cantidad*updated.precioUnit;updated.moneda=d.moneda||'USD';updated.comision=Number(d.comision)||0;updated.notas=d.notas||'';}
    else{updated.categoria=d.categoria;updated.tipo=d.tipo;updated.importe=Number(d.importe);updated.notas=d.notas||'';}
    return updated;
  });
  saveAll();closeModal();
}

// ============================================
// PLATAFORMAS
// ============================================
function renderPlataformas(){
  const plats=calcPlatforms();
  const total=plats.reduce((s,p)=>s+platSaldoToMXN(p),0);
  const totalRendAuto=plats.reduce((s,p)=>s+(p.rendimientoAuto||0),0);
  const platsConTasa=plats.filter(p=>(p.tasaAnual||0)>0);
  document.getElementById('page-plataformas').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Plataformas</div><div class="section-sub">Bancos · SOFIPOs · ETFs · Fondos · CETES · Multi-moneda</div></div>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary btn-sm" onclick="openMovModal('transferencia')">↔ Transferir</button><button class="btn btn-secondary" onclick="openAddPlatformModal()">+ Plataforma</button></div>
    </div>
    ${platsConTasa.length>0?`<div class="yield-info" style="margin-bottom:16px">⚡ <strong>${platsConTasa.length} plataformas</strong> con tasa automática · Rend. auto total: <strong>${fmtFull(totalRendAuto)}</strong></div>`:''}
    <div class="card-flat">
      ${isMobile() ? `
        <div style="display:flex;flex-direction:column;gap:10px;padding:12px">
          ${plats.map((p,i)=>{
            const cur=p.moneda||'MXN';
            const tasaBadge=p.tasaAnual>0?`<span class="tasa-badge${p.tasaAnual>=10?' alta':p.tasaAnual>=5?' media':''}">${p.tasaAnual}%</span>`:'';
            const rendAutoStr=p.rendimientoAuto>0?`<span style="color:var(--teal);font-weight:700">⚡+${fmtFull(p.rendimientoAuto,cur)}</span>`:'';
            const pctPort=total>0?((platSaldoToMXN(p)/total)*100).toFixed(1)+'%':'0%';
            return`<div style="background:var(--card2);border-radius:14px;padding:14px 16px;border:0.5px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="font-size:15px;font-weight:800">${p.name}</div>
                  ${monedaBadge(cur)} ${typeBadge(p.type)} ${tasaBadge}
                </div>
                <div style="text-align:right">
                  <div style="font-size:16px;font-weight:800">${fmtPlat(p.saldo,cur)}</div>
                  <div style="font-size:11px;color:${pctCol(p.rendimiento)};font-weight:700">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento,cur)} ${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</div>
                </div>
              </div>
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text2);flex-wrap:wrap">
                <span>Inicial: <strong style="color:var(--text)">${fmtPlat(p.saldoInicial,cur)}</strong></span>
                ${p.aportacion>0?`<span>+<strong style="color:var(--text)">${fmtPlat(p.aportacion,cur)}</strong> aport.</span>`:''}
                ${p.retiro>0?`<span>-<strong style="color:var(--text)">${fmtPlat(p.retiro,cur)}</strong> retiro</span>`:''}
                ${rendAutoStr}
                <span style="margin-left:auto;color:var(--text3)">${pctPort} portafolio</span>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
                <button class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:none;border:1px solid var(--border);color:var(--text2)" onclick="editPlatField('${p.id}','saldoInicial',this,'number')">✏️ Editar</button>
                <button class="del-btn" style="opacity:0.5;font-size:18px" onclick="deletePlatform('${p.id}')">×</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Plataforma</th><th>Moneda ✏️</th><th>Tipo</th><th>Saldo Ini. ✏️</th><th>⚡ Tasa % ✏️</th><th>Desde ✏️</th><th>Días</th><th>+ Aport. 🔍</th><th>Retiros</th><th>Gastos</th><th style="color:var(--teal)">⚡ Auto</th><th>Rend. Real</th><th>Saldo Actual</th><th>Rend %</th><th>% Port.</th><th></th></tr></thead>
          <tbody>
            ${plats.map((p,i)=>{
              const cur=p.moneda||'MXN';
              const tasaBadge=p.tasaAnual>0?`<span class="tasa-badge${p.tasaAnual>=10?' alta':p.tasaAnual>=5?' media':''}">${p.tasaAnual}%</span>`:`<span style="color:var(--text3);font-size:11px">—</span>`;
              const rendAutoStr=p.rendimientoAuto>0?`<span class="rend-auto-cell">+${fmtFull(p.rendimientoAuto,cur)}</span>`:`<span style="color:var(--text3)">—</span>`;
              const diasStr=p.tasaAnual>0&&p.diasDesdeRef>0?`<span style="font-size:11px;color:var(--text2)">${p.diasDesdeRef}d</span>`:`<span style="color:var(--text3)">—</span>`;
              const aportLink = p.aportacion > 0 ? `<span class="editable" onclick="showAportaciones('${p.id}')" style="cursor:pointer;color:var(--blue);border-bottom:1px dashed var(--blue)">${fmtPlat(p.aportacion,cur)}</span>` : fmtPlat(p.aportacion,cur);
              const retirosStr = p.retiro > 0 ? `<span style="color:var(--text2);font-size:12px">-${fmtPlat(p.retiro,cur)}</span>` : `<span style="color:var(--text3)">—</span>`;
              const gastosStr = p.gasto > 0 ? `<span style="color:var(--text2);font-size:12px">-${fmtPlat(p.gasto,cur)}</span>` : `<span style="color:var(--text3)">—</span>`;
              const pctPort=total>0?((platSaldoToMXN(p)/total)*100).toFixed(1)+'%':'0%';
              return`<tr><td style="color:var(--text3);font-size:11px">${i+1}</td><td style="font-weight:700">${p.name}</td><td><span class="editable" onclick="editPlatField('${p.id}','moneda',this,'moneda')">${monedaBadge(cur)}</span></td><td>${typeBadge(p.type)}</td><td><span class="editable" onclick="editPlatField('${p.id}','saldoInicial',this,'number')">${fmtPlat(p.saldoInicial,cur)}</span></td><td><span class="editable" onclick="editPlatField('${p.id}','tasaAnual',this,'percent')">${tasaBadge}</span></td><td><span class="editable" onclick="editPlatField('${p.id}','fechaInicio',this,'date')" style="font-size:11px;color:var(--text2)">${p.fechaInicio||'—'}</span></td><td>${diasStr}</td><td>${aportLink}</td><td>${retirosStr}</td><td>${gastosStr}</td><td>${rendAutoStr}</td><td style="color:${pctCol(p.rendimientoManual)};font-weight:600">${p.rendimientoManual!==0?(p.rendimientoManual>=0?'+':'')+fmtPlat(p.rendimientoManual,cur):'<span style="color:var(--text3)">—</span>'}</td><td style="font-weight:800;font-size:14px">${fmtPlat(p.saldo,cur)}</td><td style="font-weight:600;color:${pctCol(p.rendimiento)}">${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</td><td style="font-size:11px;color:var(--text2)">${pctPort}</td><td><button class="del-btn" onclick="deletePlatform('${p.id}')">×</button></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
    <div style="margin-top:12px;padding:12px 16px;background:var(--card2);border-radius:10px;font-size:12px;color:var(--text2);line-height:1.6">
      <strong>Moneda:</strong> Cada plataforma maneja su propia moneda (MXN, USD, EUR). Haz clic en la columna Moneda para cambiarla.<br>
      <strong>Rendimiento:</strong> Solo se contabiliza con "Saldo Actual" o tasa automática.
    </div>
  `;
}

function editPlatField(id,field,el,inputType){
  const p=platforms.find(x=>x.id===id);if(!p)return;
  let input;
  if(inputType==='date'){input=document.createElement('input');input.type='date';input.value=p[field]||today();input.className='form-input';input.style.cssText='width:130px;padding:4px 8px;font-size:12px';}
  else if(inputType==='percent'){input=document.createElement('input');input.type='number';input.step='0.01';input.min='0';input.max='100';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:90px;padding:4px 8px;font-size:12px';input.placeholder='ej: 13.5';}
  else if(inputType==='moneda'){
    input=document.createElement('select');input.className='form-select';input.style.cssText='width:100px;padding:4px 8px;font-size:12px';
    PLAT_MONEDAS.forEach(m=>{const opt=document.createElement('option');opt.value=m;opt.textContent=m==='MXN'?'🇲🇽 MXN':m==='USD'?'🇺🇸 USD':'🇪🇺 EUR';if(p[field]===m)opt.selected=true;input.appendChild(opt);});
  }
  else{input=document.createElement('input');input.type='number';input.step='any';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:110px;padding:4px 8px;font-size:12px';}
  const finish=()=>{const raw=input.value;let val=inputType==='date'||inputType==='moneda'?raw:(Number(raw)||0);platforms=platforms.map(x=>x.id!==id?x:{...x,[field]:val});saveAll();};
  input.onblur=finish;input.onkeydown=e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape')saveAll();};
  if(inputType==='moneda')input.onchange=finish;
  el.replaceWith(input);input.focus();
}
function deletePlatform(id){platforms=platforms.filter(p=>p.id!==id);saveAll();}
function openAddPlatformModal(){
  openModal(`<div class="modal-header"><div class="modal-title">Nueva Plataforma</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form onsubmit="addPlatform();return false">
      <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="npName" placeholder="Ej: Banco Azteca" required></div>
      <div class="form-row form-row-3"><div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="npType">${PLAT_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Grupo</label><select class="form-select" id="npGroup">${PLAT_GROUPS.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Moneda</label><select class="form-select" id="npMoneda"><option value="MXN">🇲🇽 MXN</option><option value="USD">🇺🇸 USD</option><option value="EUR">🇪🇺 EUR</option></select></div></div>
      <div class="form-row form-row-2"><div class="form-group"><label class="form-label">Saldo Inicial</label><input type="number" class="form-input" id="npSaldo" placeholder="0" value="0"></div><div class="form-group"><label class="form-label">⚡ Tasa Anual %</label><input type="number" step="0.01" min="0" max="100" class="form-input" id="npTasa" placeholder="ej: 13.5" value="0"></div></div>
      <div class="form-group"><label class="form-label">Fecha inicio</label><input type="date" class="form-input" id="npFecha" value="${today()}"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">Agregar</button>
    </form>`);
}
function addPlatform(){
  const name=document.getElementById('npName').value;if(!name)return;
  platforms.push({id:uid(),name,type:document.getElementById('npType').value,group:document.getElementById('npGroup').value,moneda:document.getElementById('npMoneda').value||'MXN',saldoInicial:Number(document.getElementById('npSaldo').value)||0,tasaAnual:Number(document.getElementById('npTasa').value)||0,fechaInicio:document.getElementById('npFecha').value||today()});
  saveAll();closeModal();
}

// ============================================
// GASTOS
// ============================================
function renderGastos(){
  const cm=new Date().getMonth()+1,cy=new Date().getFullYear();
  const budgets=settings.budgets||{},ingresos=settings.ingresos||{};
  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesMovs=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy;});
  const sueldoEUR=ingresos.monedaSueldo==='EUR'?(ingresos.sueldoRaw||0):(ingresos.sueldo||0);
  const extrasEUR=ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR=ingresos.otrosEUR||ingresos.otros||0;
  const fmtEUR=v=>'€'+Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
  const eurmxn=getEurMxn();
  const toEUR=m=>{
    if(m.monedaOrig==='EUR') return m.importeEUR||m.importe;
    if(m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
    return Math.round(m.importe/eurmxn*100)/100;
  };
  const totGastoEUR=mesMovs.filter(m=>m.tipo==='Gasto').reduce((s,m)=>s+toEUR(m),0);
  const totIngEUR=mesMovs.filter(m=>m.tipo==='Ingreso').reduce((s,m)=>s+toEUR(m),0);
  const totalIngPlaneadoEUR=sueldoEUR+extrasEUR+otrosEUR;
  const ingRefEUR=totIngEUR>0?totIngEUR:totalIngPlaneadoEUR;
  const totalPresupuestoEUR=EXPENSE_CATS.reduce((s,c)=>s+(budgets[c.id]||0),0);
  const sinAsignarEUR=totalIngPlaneadoEUR-totalPresupuestoEUR;
  const disponibleEUR=ingRefEUR-totGastoEUR;
  const byCat={};mesMovs.filter(m=>m.tipo==='Gasto').forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+toEUR(m);});
  const barPct=totalIngPlaneadoEUR>0?Math.min((totGastoEUR/totalIngPlaneadoEUR)*100,100).toFixed(1):0;
  const barColor=totGastoEUR>totalIngPlaneadoEUR?'var(--red)':totGastoEUR>totalPresupuestoEUR?'var(--orange)':'var(--green)';
  const barLabel=totGastoEUR>totalIngPlaneadoEUR?'🔴 Déficit':totGastoEUR>totalPresupuestoEUR?'🟡 Sobre presupuesto':'🟢 Dentro del plan';
  const totalRecurrente=recurrentes.filter(r=>r.activo).reduce((s,r)=>s+r.importe,0);

  const startDate = new Date(2026, 2, 1);
  const now = new Date();
  let acumTotal = 0;
  let mesConDatos = 0;
  const sobranteRows = [];
  let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (d <= now) {
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const gM = expMovs.filter(mv => mv.tipo==='Gasto' && mv.fecha?.startsWith(key));
    const iM = expMovs.filter(mv => mv.tipo==='Ingreso' && mv.fecha?.startsWith(key));
    const tG = gM.reduce((s,mv)=>s+toEUR(mv),0);
    const tI = iM.reduce((s,mv)=>s+toEUR(mv),0);
    const ingR = tI>0 ? tI : (sueldoEUR+extrasEUR+otrosEUR);
    const sob = Math.round((ingR-tG)*100)/100;
    if(sob>0) acumTotal += sob;
    mesConDatos++;
    const isCur = d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    sobranteRows.push(`<tr>
      <td style="font-weight:600">${MONTHS[d.getMonth()]} ${d.getFullYear()}${isCur?' <span style="font-size:10px;color:var(--teal);font-weight:700">● actual</span>':''}</td>
      <td style="color:var(--text2)">${fmtEUR(ingR)}</td>
      <td style="color:var(--red)">${fmtEUR(tG)}</td>
      <td style="font-weight:800;color:${sob>=0?'var(--green)':'var(--red)'}">${fmtEUR(sob)}</td>
    </tr>`);
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }

  const catRows=EXPENSE_CATS.map(cat=>{
    const pres=budgets[cat.id]||0,real=byCat[cat.id]||0,rest=pres-real;
    // Ocultar categorías sin presupuesto y sin gastos reales
    if (pres===0 && real===0) return '';
    const pctUso=pres>0?(real/pres*100):0;const pctIng=totalIngPlaneadoEUR>0?(pres/totalIngPlaneadoEUR*100).toFixed(1)+'%':'—';
    const barC=pctUso>100?'var(--red)':pctUso>85?'var(--orange)':'var(--green)';
    const restStr=pres>0?(rest>=0?'+':'')+fmtEUR(rest):'—';const restCol=rest>=0?'var(--green)':'var(--red)';
    const barHtml=pres>0?`<div style="display:flex;align-items:center;gap:6px"><div class="progress-bg" style="flex:1;height:6px"><div class="progress-fill" style="background:${barC};width:${Math.min(pctUso,100).toFixed(0)}%"></div></div><span style="font-size:10px;font-weight:700;color:${pctUso>100?'var(--red)':'var(--text2)'}"> ${pctUso.toFixed(0)}%</span></div>`:`<span style="font-size:10px;color:var(--text3)">sin asignar</span>`;
    return`<tr><td style="font-weight:600">${cat.icon} ${cat.name}</td><td><input type="number" class="form-input" style="width:100px;padding:5px 8px;font-size:13px;font-weight:700;text-align:right" value="${pres||''}" placeholder="0" onchange="updateBudget('${cat.id}',this.value)"></td><td style="font-size:12px;color:var(--text2)">${pctIng}</td><td style="font-weight:600;${real>pres&&pres>0?'color:var(--red)':''}">${fmtEUR(real)}</td><td style="font-weight:600;color:${restCol}">${restStr}</td><td style="width:150px">${barHtml}</td></tr>`;
  }).join('');
  const hiddenCatCount = EXPENSE_CATS.filter(cat=>(budgets[cat.id]||0)===0 && (byCat[cat.id]||0)===0).length;
  const hiddenHint = hiddenCatCount>0?`<tr><td colspan="6" style="text-align:center;padding:10px 0;font-size:11px;color:var(--text3)">${hiddenCatCount} categorías sin asignar ocultas · <button class="btn btn-sm" style="font-size:11px;padding:2px 8px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="this.closest('table').querySelectorAll('tr.cat-hidden').forEach(r=>r.style.display='')">Mostrar todas</button></td></tr>`:'';

  const movRows=mesMovs.length>0?mesMovs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(m=>`<tr><td style="color:var(--text2);font-size:12px">${m.fecha}</td><td style="font-weight:500">${m.tipo==='Ingreso'?'💰 Ingreso':catName(m.categoria)} ${m.esRecurrente?'<span class="badge badge-purple">🔄 Auto</span>':''}</td><td><span class="badge ${m.tipo==='Ingreso'?'badge-green':'badge-red'}">${m.tipo}</span></td><td style="font-weight:700">${fmtEUR(toEUR(m))}</td><td style="color:var(--text2);font-size:11px">${m.notas||'—'}</td><td><button class="edit-btn" onclick="openEditMovModal('${m.id}')">✏️</button><button class="del-btn" onclick="deleteMovement('${m.id}')">×</button></td></tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px">Sin movimientos este mes</td></tr>`;

  document.getElementById('page-gastos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Control de Gastos 🇪🇺</div><div class="section-sub">${MONTHS[cm-1]} ${cy} · Todo en Euros</div></div>
      <button class="btn btn-secondary" onclick="switchTab('movimientos');openMovModal('gastos')">+ Gasto</button>
    </div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--purple)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="card-title" style="margin:0">🔄 Gastos Recurrentes — ${fmtEUR(totalRecurrente)}/mes</div>
        <button class="btn btn-sm" style="background:rgba(191,90,242,0.1);color:var(--purple);border:none;font-weight:700" onclick="openRecurrentesModal()">⚙️ Gestionar</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
        ${recurrentes.filter(r=>r.activo).slice(0,6).map(r=>`<div class="recurrente-card"><div class="recurrente-icon" style="background:${r.color||'var(--card2)'}22">${r.icon||'📌'}</div><div class="recurrente-info"><div class="recurrente-name">${r.nombre}</div><div class="recurrente-meta">${r.frecuencia} · día ${r.dia}</div></div><div class="recurrente-amount" style="color:var(--red)">-${fmtEUR(r.importe)}</div></div>`).join('')}
        ${recurrentes.filter(r=>r.activo).length===0?'<div style="color:var(--text2);font-size:13px;padding:8px">Sin recurrentes.</div>':''}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--green)">
      <div class="card-title">💰 Mis Ingresos del Mes (EUR 🇪🇺)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:8px">
        <div><label class="form-label">Sueldo fijo (€)</label><div style="display:flex;gap:6px;align-items:center"><input type="number" class="form-input" placeholder="0" value="${ingresos.sueldoRaw||sueldoEUR||''}" onchange="updateIngresoConMoneda('sueldo',this.value,'EUR')" style="font-size:16px;font-weight:700;flex:1"><span style="font-size:13px;font-weight:700;color:var(--text2)">€</span></div></div>
        <div><label class="form-label">Extras / Bonos (€)</label><input type="number" class="form-input" placeholder="0" value="${extrasEUR||''}" onchange="if(!settings.ingresos)settings.ingresos={};settings.ingresos.extrasEUR=Number(this.value)||0;settings.ingresos.extras=Number(this.value)||0;saveAll()" style="font-size:16px;font-weight:700"></div>
        <div><label class="form-label">Otros (€)</label><input type="number" class="form-input" placeholder="0" value="${otrosEUR||''}" onchange="if(!settings.ingresos)settings.ingresos={};settings.ingresos.otrosEUR=Number(this.value)||0;settings.ingresos.otros=Number(this.value)||0;saveAll()" style="font-size:16px;font-weight:700"></div>
        <div style="background:var(--card2);border-radius:12px;padding:12px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase">Total</div><div style="font-size:22px;font-weight:800;color:var(--green);margin-top:4px">${fmtEUR(totalIngPlaneadoEUR)}</div></div>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--teal)">
        <div class="stat-label">💰 Saldo Acumulado</div>
        <div class="stat-value" style="color:${acumTotal>=0?'var(--teal)':'var(--red)'}">${fmtEUR(acumTotal)}</div>
        <div class="stat-sub">desde mar 2026 · ${mesConDatos} ${mesConDatos===1?'mes':'meses'}</div>
      </div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">📋 Presupuesto</div><div class="stat-value">${fmtEUR(totalPresupuestoEUR)}</div><div class="stat-sub">${sinAsignarEUR>=0?`<span style="color:var(--green);font-weight:700">+${fmtEUR(sinAsignarEUR)} libre</span>`:`<span style="color:var(--red);font-weight:700">${fmtEUR(sinAsignarEUR)} excedido</span>`}</div></div>
      <div class="card stat" style="border-top:3px solid var(--red)"><div class="stat-label">💳 Gasto Real</div><div class="stat-value" style="color:var(--red)">${fmtEUR(totGastoEUR)}</div><div class="stat-sub">registrado este mes</div></div>
      <div class="card stat" style="border-top:3px solid ${disponibleEUR>=0?'var(--green)':'var(--red)'}"><div class="stat-label">✅ Disponible</div><div class="stat-value" style="color:${disponibleEUR>=0?'var(--green)':'var(--red)'}">${fmtEUR(disponibleEUR)}</div><div class="stat-sub">${totIngEUR>0?'real: '+fmtEUR(totIngEUR):'según planeado'}</div></div>
    </div>

    ${totalIngPlaneadoEUR>0?`<div class="card" style="margin-bottom:16px;padding:16px 24px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:13px;font-weight:700">Uso del presupuesto global</div><div style="font-size:13px;font-weight:800;color:${barColor}">${barLabel}</div></div><div class="progress-bg" style="height:14px;border-radius:8px"><div class="progress-fill" style="height:14px;border-radius:8px;background:${barColor};width:${barPct}%"></div></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:6px"><span>Gastado: ${fmtEUR(totGastoEUR)}</span><span>Presupuesto: ${fmtEUR(totalPresupuestoEUR)}</span><span>Ingreso: ${fmtEUR(totalIngPlaneadoEUR)}</span></div></div>`:''}

    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--teal)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title" style="margin:0">💰 Capital Sobrante por Mes</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">Lo que te sobró · en EUR · desde mar 2026</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(0,199,190,0.1);color:var(--teal);border:none;font-weight:700" onclick="switchTab('movimientos');openMovModal('transferencia')">💸 Transferir sobrante →</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ingreso ref.</th><th>Gastos</th><th>Sobrante</th></tr></thead>
        <tbody>
          ${sobranteRows.join('')}
          <tr style="font-weight:800;background:var(--card2);border-top:2px solid var(--border2)">
            <td>Acumulado</td><td colspan="2"></td>
            <td style="color:var(--teal);font-weight:800">${fmtEUR(acumTotal)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div class="card-flat" style="margin-bottom:16px"><div style="padding:16px 20px 0;display:flex;justify-content:space-between;align-items:center"><div class="card-title" style="margin:0">Presupuesto por Categoría (€)</div></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Presupuesto €</th><th>% ingreso</th><th>Real €</th><th>Restante</th><th>Uso</th></tr></thead><tbody>${catRows||`<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text2);font-size:13px">Asigna presupuestos o registra gastos para verlos aquí</td></tr>`}${hiddenHint}<tr style="font-weight:800;background:var(--card2);border-top:2px solid var(--border2)"><td>TOTAL</td><td>${fmtEUR(totalPresupuestoEUR)}</td><td>${totalIngPlaneadoEUR>0?((totalPresupuestoEUR/totalIngPlaneadoEUR)*100).toFixed(1)+'%':'—'}</td><td style="color:${totGastoEUR>totalPresupuestoEUR?'var(--red)':'var(--text)'}">${fmtEUR(totGastoEUR)}</td><td style="color:${totalPresupuestoEUR-totGastoEUR>=0?'var(--green)':'var(--red)'}">${totalPresupuestoEUR>0?(totalPresupuestoEUR-totGastoEUR>=0?'+':'')+fmtEUR(totalPresupuestoEUR-totGastoEUR):'—'}</td><td>${totalPresupuestoEUR>0?`<span style="font-size:12px;font-weight:800">${(totGastoEUR/totalPresupuestoEUR*100).toFixed(0)}%</span>`:''}</td></tr></tbody></table></div></div>
    <div class="card-flat"><div style="padding:16px 20px 0"><div class="card-title">Movimientos — ${MONTHS[cm-1]} ${cy}</div></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Tipo</th><th>Importe €</th><th>Notas</th><th></th></tr></thead><tbody>${movRows}</tbody></table></div></div>
  `;
}

function updateBudget(catId,value){if(!settings.budgets)settings.budgets={};settings.budgets[catId]=Number(value)||0;saveAll();}
function updateIngreso(tipo,value){if(!settings.ingresos)settings.ingresos={};settings.ingresos[tipo]=Number(value)||0;saveAll();}
function updateIngresoConMoneda(tipo,value,moneda){
  if(!settings.ingresos)settings.ingresos={};
  const raw=Number(value)||0;settings.ingresos.monedaSueldo=moneda;settings.ingresos.sueldoRaw=raw;
  if(moneda==='EUR'){settings.ingresos[tipo]=Math.round(raw*getEurMxn()*100)/100;}else{settings.ingresos[tipo]=raw;}
  saveAll();
}

function openRecurrentesModal(){
  openModal(`
    <div class="modal-header"><div class="modal-title">🔄 Gastos Recurrentes</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="recList">
      ${recurrentes.map(r=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card2);border-radius:12px;margin-bottom:8px">
          <div style="font-size:20px">${r.icon||'📌'}</div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${r.nombre}</div><div style="font-size:11px;color:var(--text2)">${r.frecuencia} · día ${r.dia}</div></div>
          <div style="font-size:15px;font-weight:800;color:var(--red);margin-right:8px">-${fmt(r.importe)}</div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0"><input type="checkbox" ${r.activo?'checked':''} onchange="toggleRecurrente('${r.id}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px"><span style="font-size:11px;color:var(--text2)">${r.activo?'Activo':'Off'}</span></label>
          <button class="del-btn" onclick="deleteRecurrente('${r.id}')" style="opacity:0.5">×</button>
        </div>`).join('')}
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">+ Nuevo recurrente</div>
      <form id="recForm" onsubmit="addRecurrente();return false">
        <div class="form-row form-row-2">
          <div class="form-group"><label class="form-label">Categoría</label><select class="form-select" id="rCat" onchange="syncRecurrenteName()">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="rNombre" required></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">Importe</label><input type="number" class="form-input" id="rImporte" required></div>
          <div class="form-group"><label class="form-label">Frecuencia</label><select class="form-select" id="rFrec">${FRECUENCIAS.map(f=>`<option>${f}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Día</label><input type="number" class="form-input" id="rDia" value="1" min="1" max="28"></div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px">Agregar</button>
      </form>
    </div>
  `);
}
function syncRecurrenteName(){const cat=document.getElementById('rCat')?.value;const nombreEl=document.getElementById('rNombre');if(!cat||!nombreEl)return;const c=EXPENSE_CATS.find(x=>x.id===cat);if(c)nombreEl.value=c.name;}
function addRecurrente(){const nombre=document.getElementById('rNombre').value,importe=Number(document.getElementById('rImporte').value);if(!nombre||!importe)return;recurrentes.push({id:uid(),nombre,importe,categoria:document.getElementById('rCat').value,frecuencia:document.getElementById('rFrec').value,dia:Number(document.getElementById('rDia').value)||1,icon:'📌',color:'#0A84FF',activo:true});saveAll();openRecurrentesModal();}
function toggleRecurrente(id,val){recurrentes=recurrentes.map(r=>r.id!==id?r:{...r,activo:val});saveAll();}
function deleteRecurrente(id){recurrentes=recurrentes.filter(r=>r.id!==id);saveAll();openRecurrentesModal();}

// ============================================
// METAS — FIX: Ingreso Mensual en EUR
// ============================================
function renderMetas(){
  const tc=settings.tipoCambio||20;
  const eurmxn=getEurMxn();
  const plats=calcPlatforms();
  const totalMXN=plats.reduce((s,p)=>s+platSaldoToMXN(p),0);
  const tickerPos=getTickerPositions();
  const totalInvMXN=tickerPos.reduce((s,t)=>s+((t.valorActual||t.costoPosicion||0)*(t.moneda==='MXN'?1:tc)),0);
  const patrimonioTotal=totalMXN+totalInvMXN;

  const ingresos=settings.ingresos||{};
  const sueldoEUR=ingresos.monedaSueldo==='EUR'?(ingresos.sueldoRaw||0):(ingresos.sueldo||0);
  const extrasEUR=ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR=ingresos.otrosEUR||ingresos.otros||0;
  const ingresoMensualEUR=sueldoEUR+extrasEUR+otrosEUR;
  const fmtEUR=v=>'€'+Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});

  document.getElementById('page-metas').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Metas Financieras</div></div>
      <button class="btn btn-primary" onclick="openGoalModal()">+ Meta</button>
    </div>
    <div class="grid-4" style="margin-bottom:20px">
      ${statCard('🏦 Plataformas MXN',fmt(totalMXN),'saldo total','var(--blue)','var(--blue)')}
      ${statCard('📈 Inversiones MXN',fmt(totalInvMXN),'a precios actuales','#BF5AF2','#BF5AF2')}
      ${statCard('💰 Patrimonio Total',fmt(patrimonioTotal),'todo incluido','var(--green)','var(--green)')}
      ${statCard('💳 Ingreso Mensual',fmtEUR(ingresoMensualEUR),'sueldo + extras (EUR)','','var(--orange)')}
    </div>
    <div class="grid-2">
      ${goals.map(g=>{
        let actual=0;
        if(g.clase==='Patrimonio Total'||g.clase==='Todos')actual=patrimonioTotal;
        else if(g.clase==='Plataformas')actual=totalMXN;
        else if(g.clase==='Inversiones')actual=totalInvMXN;
        else if(g.clase==='Ingreso Mensual')actual=ingresoMensualEUR;
        else actual=patrimonioTotal;
        const pct=g.meta>0?actual/g.meta:0;
        const st=pct>=1?'🏆 LOGRADA':pct>=0.8?'🔥 Casi':pct>=0.3?'⏳ En proceso':'💤 Inicio';
        const sc=pct>=1?'var(--green)':pct>=0.8?'var(--orange)':pct>=0.3?'var(--blue)':'var(--text2)';
        const restante=g.meta-actual;const re=settings.rendimientoEsperado||0.06;
        const mesesEstimados=restante>0&&actual>0?Math.ceil(Math.log(g.meta/actual)/Math.log(1+re/12)):0;
        const isEUR = g.clase==='Ingreso Mensual';
        const fmtVal = v => isEUR ? fmtEUR(v) : fmt(v);
        return`<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:16px;font-weight:700">${g.nombre}</div><div style="font-size:11px;color:var(--text2)">${g.clase} · ${g.fechaLimite||'Sin fecha'}</div></div><div style="display:flex;gap:6px;align-items:center"><span class="badge" style="background:${sc}18;color:${sc}">${st}</span><button class="del-btn" onclick="deleteGoal('${g.id}')">×</button></div></div><div style="margin-top:16px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="font-weight:600">${fmtVal(actual)}</span><span style="color:var(--text2)">${fmtVal(g.meta)}</span></div><div class="progress-bg"><div class="progress-fill" style="background:${sc};width:${Math.min(pct*100,100)}%"></div></div><div style="text-align:right;font-size:12px;font-weight:700;color:${sc};margin-top:4px">${(pct*100).toFixed(1)}%</div></div>${pct<1&&mesesEstimados>0?`<div style="font-size:11px;color:var(--text2);margin-top:8px">⏱ ~${mesesEstimados} meses al ${(re*100).toFixed(0)}% anual · Faltan ${fmtVal(restante)}</div>`:''}</div>`;
      }).join('')}
    </div>
  `;
}
function openGoalModal(){openModal(`<div class="modal-header"><div class="modal-title">Nueva Meta</div><button class="modal-close" onclick="closeModal()">✕</button></div><form onsubmit="addGoal();return false"><div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="gName" required></div><div class="form-row form-row-2"><div class="form-group"><label class="form-label">Clase</label><select class="form-select" id="gClase"><option>Patrimonio Total</option><option>Plataformas</option><option>Inversiones</option><option>Ingreso Mensual</option></select></div><div class="form-group"><label class="form-label">Meta</label><input type="number" class="form-input" id="gMeta" required></div></div><div class="form-group"><label class="form-label">Fecha Límite</label><input type="date" class="form-input" id="gFecha"></div><div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="gDesc"></div><button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">Crear Meta</button></form>`);}
function addGoal(){const nombre=document.getElementById('gName').value,meta=Number(document.getElementById('gMeta').value);if(!nombre||!meta)return;goals.push({id:uid(),nombre,clase:document.getElementById('gClase').value,meta,fechaLimite:document.getElementById('gFecha').value,descripcion:document.getElementById('gDesc').value});saveAll();closeModal();}
function deleteGoal(id){goals=goals.filter(g=>g.id!==id);saveAll();}

// ============================================
// AJUSTES
// ============================================
function renderAjustes(){
  const hasFinnhub=!!(settings.finnhubKey);const priceSummary=getPriceSummary();
  const cache=getPriceCache();const cacheEntries=Object.entries(cache);
  const currentUser=window._currentUser;const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  document.getElementById('page-ajustes').innerHTML=`
    <div class="section-title" style="margin-bottom:24px">⚙️ Ajustes</div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--blue)">
      <div class="card-title">👤 Cuenta</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:8px;flex-wrap:wrap">
        ${currentUser?.photoURL?`<img src="${currentUser.photoURL}" style="width:48px;height:48px;border-radius:24px">`:`<div style="width:48px;height:48px;border-radius:24px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff">👤</div>`}
        <div style="flex:1"><div style="font-size:16px;font-weight:700">${currentUser?.displayName||'Usuario'}</div><div style="font-size:13px;color:var(--text2)">${currentUser?.email||''}</div></div>
        <button class="btn btn-danger btn-sm" onclick="window.signOutUser()">Cerrar sesión</button>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">💱 Tipo de Cambio</div>
        <div id="tcCardContent">
          ${(()=>{
            const fx=_fxCache||LS.get('fxCache');
            const isLive=fx&&isCacheFresh(fx.ts);
            const ts=isLive?new Date(fx.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'';
            const vUSD=isLive&&fx.usdmxn?fx.usdmxn.toFixed(2):(settings.tipoCambio||20);
            const vEUR=isLive&&fx.eurmxn?fx.eurmxn.toFixed(2):(settings.tipoEUR||21.5);
            const vGBP=isLive&&fx.gbpmxn?fx.gbpmxn.toFixed(2):(settings.tipoGBP||25.5);
            const statusBadge=isLive
              ? '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;color:var(--green)"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span>En vivo \xb7 BCE \xb7 actualizado '+ts+'</div>'
              : '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;color:var(--orange)"><span style="width:7px;height:7px;border-radius:50%;background:var(--orange);display:inline-block"></span>Manual \xb7 presiona actualizar para valores en vivo</div>';
            return statusBadge
              + '<div style="display:flex;flex-direction:column;gap:10px">'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddfa\ud83c\uddf8 USD =</span><input type="number" step="0.01" id="inputTCUSD" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vUSD+'" onchange="settings.tipoCambio=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddea\ud83c\uddfa EUR =</span><input type="number" step="0.01" id="inputTCEUR" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vEUR+'" onchange="settings.tipoEUR=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddec\ud83c\udde7 GBP =</span><input type="number" step="0.01" id="inputTCGBP" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vGBP+'" onchange="settings.tipoGBP=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<button class="btn btn-secondary btn-sm" onclick="updateFX().then(()=>renderPage(\'ajustes\'))">🔄 Actualizar en vivo (BCE)</button>'
              + '</div>';
          })()}
        </div>
      </div>
      <div class="card"><div class="card-title">📈 Rendimiento Esperado Anual</div><div style="display:flex;align-items:center;gap:10px;margin-top:8px"><input type="number" step="0.5" class="form-input" style="width:80px;font-size:20px;font-weight:700;text-align:center" value="${((settings.rendimientoEsperado||0.06)*100)}" onchange="settings.rendimientoEsperado=Number(this.value)/100;saveAll()"><span style="font-size:14px;color:var(--text2)">% anual</span></div></div>
    </div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">🔑 API Key — Finnhub <span style="font-weight:400;color:var(--text3)">(acciones USA)</span></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input type="text" class="form-input" style="flex:1;min-width:200px;font-family:monospace;font-size:13px" id="finnhubKeyInput" placeholder="Pega tu API key" value="${settings.finnhubKey||''}" oninput="settings.finnhubKey=this.value.trim();LS.set('settings',settings)"><button class="btn btn-primary" onclick="testFinnhub()">🧪 Probar</button>${hasFinnhub?`<span style="font-size:12px;color:var(--green)">✅</span>`:''}</div>
        <div id="finnhubTestResult" style="margin-top:8px;font-size:12px"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3)">Gratis en <a href="https://finnhub.io" target="_blank" style="color:var(--blue)">finnhub.io</a></div>
      </div>

      <div class="card">
        <div class="card-title">🔑 API Key — Alpha Vantage <span style="font-weight:400;color:var(--text3)">(VUAA.LON, ETFs Londres/Xetra)</span></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input type="text" class="form-input" style="flex:1;min-width:200px;font-family:monospace;font-size:13px" id="alphaVantageKeyInput" placeholder="Pega tu API key" value="${settings.alphaVantageKey||''}" oninput="settings.alphaVantageKey=this.value.trim();LS.set('settings',settings)"><button class="btn btn-primary" onclick="testAlphaVantage()">🧪 Probar</button>${settings.alphaVantageKey?`<span style="font-size:12px;color:var(--green)">✅</span>`:''}</div>
        <div id="alphaVantageTestResult" style="margin-top:8px;font-size:12px"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3)">Gratis en <a href="https://alphavantage.co" target="_blank" style="color:var(--blue)">alphavantage.co</a> · 25 req/día</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-title">💾 Exportar / Importar</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><button class="btn btn-primary" onclick="exportData()">📥 Exportar JSON</button><button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">📤 Importar JSON</button><input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)"></div></div>
      <div class="card"><div class="card-title">⚠️ Zona de Peligro</div><button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="if(confirm('¿Borrar TODOS los datos?'))resetAll()">🗑 Resetear Todo</button></div>
    </div>
    <div class="card" style="margin-top:16px;padding:16px 20px">
      <div class="card-title">🔐 Reglas Firebase</div>
      <div class="uid-box" onclick="navigator.clipboard.writeText(this.textContent.trim()).then(()=>this.style.borderColor='var(--green)')" title="Clic para copiar" style="margin-top:6px;font-size:11px;white-space:pre">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /finanzas/main {
      allow read, write: if request.auth != null
        && request.auth.uid == '${currentUser?.uid||'TU_UID_AQUI'}';
    }
  }
}</div>
    </div>
  `;
}

async function testAlphaVantage(){
  const inputEl=document.getElementById('alphaVantageKeyInput');
  const k=(inputEl?inputEl.value.trim():'')||settings.alphaVantageKey||'';
  if(k){settings.alphaVantageKey=k;LS.set('settings',settings);if(typeof window.saveToFirebase==='function')window.saveToFirebase();}
  const el=document.getElementById('alphaVantageTestResult');
  if(!el)return;
  if(!k){el.innerHTML='<span style="color:var(--red)">⚠️ Ingresa tu API key</span>';return;}
  el.innerHTML='<span class="spinner"></span> Probando con VUAA.LON...';
  try {
    const r=await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VUAA.LON&apikey=${k}`);
    const d=await r.json();
    const q=d['Global Quote'];
    if(q&&q['05. price']&&parseFloat(q['05. price'])>0){
      el.innerHTML=`<span style="color:var(--green)">✅ VUAA.LON: ${parseFloat(q['05. price']).toFixed(2)} GBp</span>`;
    } else if(d.Note){
      el.innerHTML=`<span style="color:var(--orange)">⚠️ Límite de requests alcanzado (25/día)</span>`;
    } else {
      el.innerHTML=`<span style="color:var(--orange)">⚠️ ${d.Information||d.message||'Respuesta inesperada'}</span>`;
    }
  } catch(e){el.innerHTML=`<span style="color:var(--red)">❌ ${e.message}</span>`;}
}

async function testFinnhub(){const finEl=document.getElementById('finnhubKeyInput');const k=(finEl?finEl.value.trim():'')||settings.finnhubKey||'';if(k){settings.finnhubKey=k;saveAll();}const el=document.getElementById('finnhubTestResult');if(!k){el.innerHTML='<span style="color:var(--red)">⚠️ Ingresa tu API key</span>';return;}el.innerHTML='<span class="spinner"></span> Probando...';try{const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`),d=await r.json();if(d.c&&d.c>0)el.innerHTML=`<span style="color:var(--green)">✅ AAPL: $${d.c.toFixed(2)}</span>`;else el.innerHTML='<span style="color:var(--orange)">⚠️ Respuesta inesperada</span>';}catch(e){el.innerHTML=`<span style="color:var(--red)">❌ ${e.message}</span>`;}}

function updateNav(patrimonio,totalMXN,totalUSD,tc,totalRend,deltaHoy,deltaHoyPct){
  const el1=document.getElementById('navTotal'),el2=document.getElementById('navSub');
  if(el1)el1.textContent=fmt(patrimonio);
  const fx=_fxCache||LS.get('fxCache');
  const eurStr=fx?.eurmxn?`<span>EUR $${fx.eurmxn.toFixed(2)}</span>`:'';
  const deltaStr=deltaHoy!==0&&deltaHoy!=null?`<span style="color:${pctCol(deltaHoy)};font-weight:700;background:${deltaHoy>=0?'rgba(48,209,88,0.12)':'rgba(255,69,58,0.10)'};padding:1px 6px;border-radius:6px">${deltaHoy>=0?'▲':'▼'} ${fmt(Math.abs(deltaHoy))} hoy</span>`:'';
  if(el2)el2.innerHTML=`<span>🇲🇽 ${fmt(totalMXN)}</span><span>🇺🇸 ${fmt(totalUSD,'USD')}</span><span>💱 $${tc}</span>${eurStr}${deltaStr}`;
}
function updateNavUser(user){
  const el=document.getElementById('navUser');if(!el)return;
  const darkBtn=`<button class="dark-toggle" onclick="toggleDark()" title="Modo oscuro" style="margin-right:4px"><span class="dark-toggle-icon dark-toggle-moon">🌙</span><span class="dark-toggle-icon dark-toggle-sun">☀️</span></button>`;
  if(user)el.innerHTML=`${darkBtn}${user.photoURL?`<img src="${user.photoURL}" class="nav-avatar">`:`<div class="nav-avatar-placeholder">${(user.displayName||user.email||'U')[0].toUpperCase()}</div>`}<button class="btn-signout" onclick="window.signOutUser()">Salir</button>`;
}

function exportData(){const data={platforms,movements,goals,settings,recurrentes,patrimonioHistory,exportDate:new Date().toISOString(),version:'4.4'};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`finanzas-pro-${today()}.json`;a.click();URL.revokeObjectURL(url);}
function importData(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.platforms)platforms=d.platforms.map(p=>({tasaAnual:0,fechaInicio:'2026-02-01',moneda:'MXN',...p}));if(d.movements)movements=d.movements;if(d.goals)goals=d.goals;if(d.settings)settings=d.settings;if(d.recurrentes)recurrentes=d.recurrentes;if(d.patrimonioHistory)patrimonioHistory=d.patrimonioHistory;saveAll();alert('✅ Datos importados');}catch{alert('❌ Archivo inválido');}};r.readAsText(file);}
function resetAll(){platforms=DEFAULT_PLATFORMS.map(p=>({...p}));movements=JSON.parse(JSON.stringify(DEFAULT_MOVS));goals=[...DEFAULT_GOALS];settings={...DEFAULT_SETTINGS};recurrentes=JSON.parse(JSON.stringify(DEFAULT_RECURRENTES));patrimonioHistory=[];LS.set('price_cache',{});saveAll();setTimeout(()=>updateAllPrices(false),500);}

function renderPageInternal(tab){
  if(tab==='dashboard')renderDashboard();else if(tab==='movimientos')renderMovimientos();else if(tab==='plataformas')renderPlataformas();else if(tab==='gastos')renderGastos();else if(tab==='metas')renderMetas();else if(tab==='ajustes')renderAjustes();
}
function renderPage(tab){renderPageInternal(tab);}
window.renderPage=renderPage;
window.showAportaciones = showAportaciones;

// ==================== FIREBASE (MÓDULO) ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig={apiKey:"AIzaSyDUAOlDXmkBRQNoYgmax9KOMjQrZd061Q8",authDomain:"control-de-inversion.firebaseapp.com",projectId:"control-de-inversion",storageBucket:"control-de-inversion.firebasestorage.app",messagingSenderId:"955139190781",appId:"1:955139190781:web:b73653484f5f96b7e23394"};
const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
const DOC_REF=doc(db,"finanzas","main");

function setFbStatus(s){let el=document.getElementById('fbStatus');if(!el){el=document.createElement('div');el.id='fbStatus';el.style.cssText='font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;white-space:nowrap;transition:all 0.3s;flex-shrink:0';const nav=document.querySelector('.nav-inner');if(nav)nav.appendChild(el);}const map={syncing:['⏳ Sync...','rgba(10,132,255,0.1)','#0A84FF'],ok:['☁️ Sincronizado','rgba(48,209,88,0.1)','#30D158'],error:['⚠️ Sin conexión','rgba(255,69,58,0.1)','#FF453A'],offline:['📴 Offline','rgba(0,0,0,0.06)','#86868B']};const[text,bg,color]=map[s]||map.offline;el.textContent=text;el.style.background=bg;el.style.color=color;}
function showApp(){document.getElementById('loginOverlay').classList.add('hidden');document.getElementById('mainNav').style.display='';document.getElementById('mainContainer').style.display='';document.getElementById('mobileNav').style.display='';document.getElementById('accessDenied').classList.remove('show');}
function showLogin(msg){document.getElementById('loginOverlay').classList.remove('hidden');document.getElementById('mainNav').style.display='none';document.getElementById('mainContainer').style.display='none';document.getElementById('mobileNav').style.display='none';document.getElementById('accessDenied').classList.remove('show');if(msg){const el=document.getElementById('loginError');el.textContent=msg;el.style.display='block';}}

window.signOutUser=async()=>{await signOut(auth);showLogin();};
document.getElementById('btnGoogleLogin').addEventListener('click',async()=>{const btn=document.getElementById('btnGoogleLogin');btn.disabled=true;btn.innerHTML='<span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(10,132,255,0.2);border-top-color:#0A84FF;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle"></span> Conectando...';try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" style="width:22px;height:22px"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continuar con Google';showLogin(e.code==='auth/popup-closed-by-user'?'':'Error al iniciar sesión.');}});

let _ignoreSnap=false,_saveTimeout=null,_unsub=null;

function setupFirestore(){
  if(_unsub){_unsub();_unsub=null;}
  _unsub=onSnapshot(DOC_REF,snap=>{if(_ignoreSnap){_ignoreSnap=false;return;}if(!snap.exists()){window.saveToFirebase();return;}setFbStatus('ok');if(window.loadFromRemote)window.loadFromRemote(snap.data());},err=>{console.error(err);setFbStatus('error');});
}

window.saveToFirebase=async(forceImmediate=false)=>{
  const doSave=async()=>{
    setFbStatus('syncing');
    try{
      _ignoreSnap=true;
      const d=window.getAppData?window.getAppData():{};
      await setDoc(DOC_REF,{platforms:d.platforms||[],movements:d.movements||[],goals:d.goals||[],settings:d.settings||{},recurrentes:d.recurrentes||[],patrimonioHistory:d.patrimonioHistory||[],updatedAt:serverTimestamp(),device:navigator.userAgent.substring(0,60)});
      setFbStatus('ok');
    }catch(e){setFbStatus('error');console.error(e);if(!navigator.onLine){window.queueSave&&window.queueSave(window.getAppData&&window.getAppData());}throw e;}
  };
  if(forceImmediate){await doSave();return;}
  clearTimeout(_saveTimeout);_saveTimeout=setTimeout(doSave,1500);
};

onAuthStateChanged(auth,user=>{
  if(user){
    window._currentUser=user;
    if(typeof updateNavUser==='function')updateNavUser(user);
    showApp();setupFirestore();
    if(window.renderPage)window.renderPage(window.currentTab||'dashboard');
    setTimeout(()=>{
      if(typeof updateFX==='function')updateFX();
      // Precios solo se actualizan cuando el usuario presiona el botón — no automáticamente
      if(typeof flushOfflineQueue==='function')flushOfflineQueue();
    },1200);
  }else{window._currentUser=null;if(_unsub){_unsub();_unsub=null;}showLogin();}
});
window.addEventListener('online',()=>setFbStatus('ok'));
window.addEventListener('offline',()=>setFbStatus('offline'));

// Exportar funciones al ámbito global
window.toggleDark = toggleDark;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.setChartRange = setChartRange;
window.setChartProj = setChartProj;
window.toggleChartPanel = toggleChartPanel;
window.setTipoTransfer = setTipoTransfer;
window.actualizarMontoSobrante = actualizarMontoSobrante;
window.showAportaciones = showAportaciones;
window.editPlatField = editPlatField;
window.deletePlatform = deletePlatform;
window.openAddPlatformModal = openAddPlatformModal;
window.addPlatform = addPlatform;
window.updateBudget = updateBudget;
window.updateIngreso = updateIngreso;
window.updateIngresoConMoneda = updateIngresoConMoneda;
window.openRecurrentesModal = openRecurrentesModal;
window.syncRecurrenteName = syncRecurrenteName;
window.addRecurrente = addRecurrente;
window.toggleRecurrente = toggleRecurrente;
window.deleteRecurrente = deleteRecurrente;
window.openGoalModal = openGoalModal;
window.addGoal = addGoal;
window.deleteGoal = deleteGoal;
window.testFinnhub = testFinnhub;
window.testAlphaVantage = testAlphaVantage;
window.exportData = exportData;
window.importData = importData;
window.resetAll = resetAll;
window.openMovModal = openMovModal;
window.saveMovement = saveMovement;
window.deleteMovement = deleteMovement;
window.openEditMovModal = openEditMovModal;
window.updateMovement = updateMovement;
window.updateAllPrices = updateAllPrices;
