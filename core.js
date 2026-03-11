// core.js - Módulo de datos y lógica de negocio

// ==================== CONSTANTES ====================
export const COLORS = ['#0A84FF','#30D158','#FF9F0A','#BF5AF2','#FF375F','#64D2FF','#FFD60A','#AC8E68','#5E5CE6','#FF6482','#32D74B','#00C7BE','#FF453A','#5856D6','#AF52DE','#FF2D55','#A2845E','#30B0C7'];
export const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const EXPENSE_CATS = [
  {id:'vivienda',name:'Vivienda',icon:'🏠'},{id:'alimentacion',name:'Alimentación',icon:'🍔'},{id:'luz',name:'Luz',icon:'💡'},{id:'agua',name:'Agua',icon:'🚰'},
  {id:'celular',name:'Celular',icon:'📱'},{id:'salud',name:'Salud',icon:'💊'},{id:'seguro',name:'Seguro',icon:'🛡'},{id:'ocio',name:'Ocio',icon:'🎮'},
  {id:'suscripciones',name:'Suscripciones',icon:'📲'},{id:'transporte',name:'Transporte',icon:'🚗'},{id:'educacion',name:'Educación',icon:'🎓'},{id:'otros',name:'Otros',icon:'📦'},
];
export const ASSET_TYPES = ['Acción','ETF','Crypto','Efectivo USD','Acción MX','ETF MX'];
export const BROKERS = ['Interactive Brokers','Fidelity','Binance','Robinhood','Bitso','GBM','OKX','Kraken','Coinbase','Actinver','Charles Schwab','BBVA Bancomer','Bursanet'];
export const PLAT_TYPES = ['BANCO','SOFIPO','CUENTA DIGITAL','BOLSA/ETFs','FONDOS','FONDOS RETIRO','DEUDA/CETES'];
export const PLAT_GROUPS = ['Ahorro/Liquidez','Cuenta Digital','Bolsa/ETFs','Fondos','Deuda/CETES'];
export const PLAT_MONEDAS = ['MXN','USD','EUR'];
export const FRECUENCIAS = ['Mensual','Quincenal','Semanal','Anual','Trimestral'];

// ==================== ESTADO GLOBAL ====================
export let platforms = [];
export let movements = [];
export let goals = [];
export let settings = {};
export let recurrentes = [];
export let patrimonioHistory = [];

// ==================== LOCALSTORAGE UTILS ====================
const LS = {
  get(k) { try { const v = localStorage.getItem('fp_'+k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem('fp_'+k, JSON.stringify(v)); } catch {} },
};

// ==================== CARGA INICIAL ====================
export function loadInitialData() {
  platforms = LS.get('platforms') || DEFAULT_PLATFORMS.map(p => ({tasaAnual:0, fechaInicio:'2026-02-01', moneda:'MXN', ...p}));
  movements = LS.get('movements') || DEFAULT_MOVS;
  goals = LS.get('goals') || DEFAULT_GOALS;
  settings = LS.get('settings') || DEFAULT_SETTINGS;
  recurrentes = LS.get('recurrentes') || DEFAULT_RECURRENTES;
  patrimonioHistory = LS.get('patrimonioHistory') || [];
}

export function saveAllToStorage() {
  LS.set('platforms', platforms);
  LS.set('movements', movements);
  LS.set('goals', goals);
  LS.set('settings', settings);
  LS.set('recurrentes', recurrentes);
  LS.set('patrimonioHistory', patrimonioHistory);
}

// ==================== PRICE CACHE ====================
const PRICE_CACHE_KEY = 'price_cache';
function getPriceCache() { return LS.get(PRICE_CACHE_KEY) || {}; }
function setPriceCache(c) { LS.set(PRICE_CACHE_KEY, c); }
export function isCacheFresh(ts) { if (!ts) return false; const n = new Date(), c = new Date(ts); return n.getFullYear()===c.getFullYear() && n.getMonth()===c.getMonth() && n.getDate()===c.getDate(); }
export function getCachedPrice(t) { const c=getPriceCache(); return c[t]||null; }
export function setCachedPrice(t,p,s) { const c=getPriceCache(); c[t]={price:p,ts:Date.now(),source:s}; setPriceCache(c); }

// ==================== CRYPTO MAP ====================
const CRYPTO_MAP = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','ADA':'cardano','DOT':'polkadot','DOGE':'dogecoin',
  'LINK':'chainlink','MATIC':'matic-network','UNI':'uniswap','XRP':'ripple','BNB':'binancecoin',
  'AVAX':'avalanche-2','SHIB':'shiba-inu','LTC':'litecoin','ATOM':'cosmos','TRX':'tron',
  'TON':'the-open-network','PEPE':'pepe','WIF':'dogwifcoin',
};

// ==================== FETCH PRICES (MEJORADO CON PARALELISMO) ====================
export async function fetchCryptoPrice(ticker) {
  const coinId = CRYPTO_MAP[ticker.toUpperCase()]; if(!coinId) return null;
  try { const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`); if(!r.ok) throw new Error(); const d = await r.json(); return d[coinId]?.usd || null; } catch { return null; }
}
export async function fetchStockPrice(ticker) {
  const k = settings.finnhubKey||''; if(!k) return null;
  try { const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${k}`); if(!r.ok) throw new Error(); const d = await r.json(); return (d.c && d.c > 0) ? d.c : null; } catch { return null; }
}
export async function fetchMXPrice(ticker) {
  const baseTicker = ticker.toUpperCase().replace(/\.MX$/i, '');
  const variations = [baseTicker + '.MX', baseTicker];
  const proxies = ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/'];
  for (const sym of variations) { for (const proxyBase of proxies) { const url = `${proxyBase}${sym}?interval=1d&range=1d`; try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) continue; const d = await r.json(); const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice; if (price && price > 0) return price; } catch { } await new Promise(r => setTimeout(r, 200)); } } return null;
}

export let _fxCache = null;
export async function fetchFX() {
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

export async function fetchPrice(ticker, type, moneda) {
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

// ==================== ACTUALIZACIÓN DE PRECIOS EN PARALELO ====================
export let priceUpdateState = {loading:false, lastUpdate:null};

export async function updateAllPrices(forceRefresh=false) {
  if (priceUpdateState.loading) return;
  priceUpdateState.loading = true;

  // Notificar a la UI (se maneja desde fuera)
  // ...

  await fetchFX();

  const tickerSet = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); tickerSet.set(key, {type: m.tipoActivo, moneda: m.moneda || 'USD', ticker: m.ticker.toUpperCase()}); } });

  if (forceRefresh) { const c = getPriceCache(); tickerSet.forEach((_, k) => { delete c[k]; }); setPriceCache(c); }

  // Agrupar criptos para una sola llamada (opcional, mejora)
  const cryptos = [...tickerSet.values()].filter(info => info.type === 'Crypto');
  const stocks = [...tickerSet.values()].filter(info => info.type !== 'Crypto');

  // Llamadas en paralelo con límite de concurrencia
  const promises = [];
  for (const info of stocks) {
    promises.push(fetchPrice(info.ticker, info.type, info.moneda).catch(() => null));
  }
  // Para criptos podríamos usar el endpoint de varios IDs, pero por simplicidad lo dejamos igual
  for (const info of cryptos) {
    promises.push(fetchPrice(info.ticker, info.type, info.moneda).catch(() => null));
  }

  await Promise.all(promises);

  priceUpdateState.loading = false;
  priceUpdateState.lastUpdate = new Date();

  // Guardar snapshot
  _recalcAndSaveSnapshot();

  // Devolver para que la UI pueda re-renderizar
  return true;
}

// ==================== CÁLCULOS ====================
export function getEurMxn(){
  const fx = _fxCache || LS.get('fxCache');
  if(fx&&fx.eurmxn) return fx.eurmxn;
  return settings.tipoEUR||21.5;
}

export function calcPlatforms() {
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

function calcAutoYield(p, saldoBase, fechaRef) {
  const tasa = p.tasaAnual||0; if(tasa<=0||saldoBase<=0) return 0;
  let refDate = fechaRef ? new Date(fechaRef) : p.fechaInicio ? new Date(p.fechaInicio) : null;
  if(!refDate||isNaN(refDate.getTime())) return 0;
  const diffMs = new Date() - refDate; if(diffMs<=0) return 0;
  return saldoBase * (tasa/100) * (diffMs/(1000*60*60*24*365));
}

export function getTickerPositions(){
  const tickers = {};
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

export function getPriceInfo(ticker, type, moneda) {
  ticker = ticker.toUpperCase(); moneda = (moneda || 'USD').toUpperCase();
  if (ticker === 'USD' || type === 'Efectivo USD') return {price:1, label:'$1.00', status:'fixed', cssClass:'price-cached'};
  const cacheKey = moneda === 'MXN' ? ticker + '_MXN' : ticker;
  const c = getCachedPrice(cacheKey);
  if (c && isCacheFresh(c.ts)) { const t = new Date(c.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); const cur = moneda === 'MXN' ? '$' : 'US$'; return {price:c.price, label:cur+c.price.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}), status:'cached', cssClass:'price-live', tooltip:`${c.source} · hoy ${t}`, moneda}; }
  return {price:null, label:'—', status:'none', cssClass:'price-fallback', tooltip:'Sin precio hoy', moneda};
}

export function getPriceSummary() {
  const ts = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); ts.set(key, {type: m.tipoActivo, moneda: m.moneda || 'USD'}); } });
  let live=0, missing=0;
  ts.forEach((_, k) => { const c=getCachedPrice(k); if(c&&isCacheFresh(c.ts))live++; else missing++; });
  return {live, missing, total: ts.size};
}

// ==================== FORMATOS ====================
export function fmt(n, cur) {
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
export function fmtFull(n, cur) {
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
export function fmtPct(n) { return (n==null||isNaN(n)) ? '0.00%' : (n>=0?'+':'') + (n*100).toFixed(2) + '%'; }
export function pctCol(n) { return n >= 0 ? 'var(--green)' : 'var(--red)'; }
export function fmtPlat(n, moneda) { return fmt(n, moneda || 'MXN'); }

// ==================== UTILS ====================
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
export const today = () => new Date().toISOString().split('T')[0];

// ==================== RECALCULAR SNAPSHOT ====================
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

// ==================== DATOS POR DEFECTO (RELLENA CON TUS VALORES) ====================
const DEFAULT_PLATFORMS = [
  // ... (copia aquí tus plataformas por defecto)
];
const DEFAULT_MOVS = [
  // ... (copia aquí tus movimientos por defecto)
];
const DEFAULT_GOALS = [
  // ... (copia aquí tus metas por defecto)
];
const DEFAULT_SETTINGS = {tipoCambio:20,tipoEUR:21.5,rendimientoEsperado:0.06,finnhubKey:''};
const DEFAULT_RECURRENTES = [
  // ... (copia aquí tus recurrentes por defecto)
];
