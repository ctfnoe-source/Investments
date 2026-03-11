// ============================================================
// data.js — Constantes, datos por defecto y helpers
// ============================================================
// Aquí viven: listas de categorías, plataformas demo, 
// movimientos demo, metas demo, funciones de formato (fmt, fmtFull, etc.)
// y utilidades pequeñas (uid, today, MONTHS, COLORS...)
// ============================================================

// ── Utilidades básicas ──────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().split('T')[0];

// ── Listas de opciones ──────────────────────────────────────
const COLORS = ['#0A84FF','#30D158','#FF9F0A','#BF5AF2','#FF375F','#64D2FF','#FFD60A','#AC8E68','#5E5CE6','#FF6482','#32D74B','#00C7BE','#FF453A','#5856D6','#AF52DE','#FF2D55','#A2845E','#30B0C7'];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const EXPENSE_CATS = [
  {id:'vivienda',    name:'Vivienda',      icon:'🏠'},
  {id:'alimentacion',name:'Alimentación',  icon:'🍔'},
  {id:'luz',         name:'Luz',           icon:'💡'},
  {id:'agua',        name:'Agua',          icon:'🚰'},
  {id:'celular',     name:'Celular',       icon:'📱'},
  {id:'salud',       name:'Salud',         icon:'💊'},
  {id:'seguro',      name:'Seguro',        icon:'🛡'},
  {id:'ocio',        name:'Ocio',          icon:'🎮'},
  {id:'suscripciones',name:'Suscripciones',icon:'📲'},
  {id:'transporte',  name:'Transporte',    icon:'🚗'},
  {id:'educacion',   name:'Educación',     icon:'🎓'},
  {id:'otros',       name:'Otros',         icon:'📦'},
];

const ASSET_TYPES  = ['Acción','ETF','Crypto','Efectivo USD','Acción MX','ETF MX'];
const BROKERS      = ['Interactive Brokers','Fidelity','Binance','Robinhood','Bitso','GBM','OKX','Kraken','Coinbase','Actinver','Charles Schwab','BBVA Bancomer','Bursanet'];
const PLAT_TYPES   = ['BANCO','SOFIPO','CUENTA DIGITAL','BOLSA/ETFs','FONDOS','FONDOS RETIRO','DEUDA/CETES'];
const PLAT_GROUPS  = ['Ahorro/Liquidez','Cuenta Digital','Bolsa/ETFs','Fondos','Deuda/CETES'];
const PLAT_MONEDAS = ['MXN','USD','EUR'];
const FRECUENCIAS  = ['Mensual','Quincenal','Semanal','Anual','Trimestral'];

// ── Datos demo / por defecto ────────────────────────────────
const DEFAULT_PLATFORMS = [
  {id:'nu',       name:'Nu Bank',       type:'BANCO',         group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:171436, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'klar',     name:'Klar',          type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:151400, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'finsus',   name:'Finsus',        type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:107271, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'supert',   name:'Super Tasas',   type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:128480, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'stori',    name:'Stori',         type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:159522, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'mpago',    name:'Mercado Pago',  type:'CUENTA DIGITAL',group:'Cuenta Digital',   moneda:'MXN', saldoInicial:38674,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'uala',     name:'Ualá',          type:'BANCO',         group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:49727,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'kubo',     name:'Kubo',          type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:5917,   tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'gbm',      name:'GBM',           type:'BOLSA/ETFs',    group:'Bolsa/ETFs',       moneda:'MXN', saldoInicial:558468, tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'finamex',  name:'Finamex',       type:'BOLSA/ETFs',    group:'Bolsa/ETFs',       moneda:'MXN', saldoInicial:87269,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'heybanco', name:'Hey Banco',     type:'BANCO',         group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:27608,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'actinver', name:'Actinver',      type:'BOLSA/ETFs',    group:'Bolsa/ETFs',       moneda:'MXN', saldoInicial:15205,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'dinn',     name:'Dinn',          type:'FONDOS',        group:'Fondos',           moneda:'MXN', saldoInicial:5303,   tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'fintual',  name:'Fintual',       type:'FONDOS RETIRO', group:'Fondos',           moneda:'MXN', saldoInicial:44864,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'mifel',    name:'Mifel',         type:'BANCO',         group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:17290,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'didi',     name:'Didi',          type:'SOFIPO',        group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:24620,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'openbank', name:'Openbank',      type:'BANCO',         group:'Ahorro/Liquidez',  moneda:'MXN', saldoInicial:20000,  tasaAnual:0, fechaInicio:'2026-02-01'},
  {id:'cetes',    name:'CETES',         type:'DEUDA/CETES',   group:'Deuda/CETES',      moneda:'MXN', saldoInicial:12000,  tasaAnual:0, fechaInicio:'2026-02-01'},
];

const DEFAULT_MOVS = [
  {id:uid(),fecha:'2026-02-10',seccion:'inversiones',tipoActivo:'Crypto', ticker:'BTC', broker:'Binance',               tipoMov:'Compra',cantidad:0.5,precioUnit:94000,montoTotal:47000,  moneda:'USD',comision:0,notas:'Bitcoin'},
  {id:uid(),fecha:'2026-02-15',seccion:'inversiones',tipoActivo:'Crypto', ticker:'ETH', broker:'Binance',               tipoMov:'Compra',cantidad:4,  precioUnit:3200, montoTotal:12800,  moneda:'USD',comision:0,notas:'Ethereum'},
  {id:uid(),fecha:'2026-02-20',seccion:'inversiones',tipoActivo:'ETF',    ticker:'VOO', broker:'Fidelity',              tipoMov:'Compra',cantidad:3,  precioUnit:520,  montoTotal:1560,   moneda:'USD',comision:0,notas:'Vanguard S&P500'},
  {id:uid(),fecha:'2026-02-22',seccion:'inversiones',tipoActivo:'ETF',    ticker:'QQQ', broker:'Interactive Brokers',   tipoMov:'Compra',cantidad:2,  precioUnit:470,  montoTotal:940,    moneda:'USD',comision:0,notas:'Nasdaq 100'},
  {id:uid(),fecha:'2026-02-25',seccion:'inversiones',tipoActivo:'Acción', ticker:'NVDA',broker:'Interactive Brokers',   tipoMov:'Compra',cantidad:5,  precioUnit:135,  montoTotal:675,    moneda:'USD',comision:0,notas:'Nvidia'},
  {id:uid(),fecha:'2026-02-28',seccion:'inversiones',tipoActivo:'Acción', ticker:'AAPL',broker:'Fidelity',              tipoMov:'Compra',cantidad:4,  precioUnit:230,  montoTotal:920,    moneda:'USD',comision:0,notas:'Apple'},
  {id:uid(),fecha:'2026-03-01',seccion:'gastos',categoria:'vivienda',  tipo:'Gasto',  importe:430,  notas:'Alquiler marzo'},
  {id:uid(),fecha:'2026-03-05',seccion:'gastos',categoria:'alimentacion',tipo:'Gasto',importe:200,  notas:'Supermercado'},
  {id:uid(),fecha:'2026-03-08',seccion:'gastos',categoria:'luz',       tipo:'Gasto',  importe:80,   notas:'Factura luz'},
  {id:uid(),fecha:'2026-03-01',seccion:'gastos',categoria:'otros',     tipo:'Ingreso',importe:25000,notas:'Nómina'},
  {id:uid(),fecha:'2026-02-15',seccion:'plataformas',platform:'Nu Bank',tipoPlat:'Saldo Actual',monto:172760,desc:'Actualización feb'},
];

const DEFAULT_GOALS = [
  {id:uid(),nombre:'Meta Conservadora $2M',clase:'Todos',  meta:2000000, fechaLimite:'2031-12-31',descripcion:'Portafolio MX a 2 millones'},
  {id:uid(),nombre:'Meta Ambiciosa $5M',   clase:'Todos',  meta:5000000, fechaLimite:'2036-12-31',descripcion:'5 millones en 10 años'},
  {id:uid(),nombre:'Portafolio $100K USD', clase:'Todos',  meta:100000,  fechaLimite:'2027-12-31',descripcion:'Meta maestra inversión'},
  {id:uid(),nombre:'Cartera Crypto $20K',  clase:'Crypto', meta:20000,   fechaLimite:'2027-06-30',descripcion:'Alta volatilidad controlada'},
];

const DEFAULT_SETTINGS = {tipoCambio:20, tipoEUR:21.5, rendimientoEsperado:0.06, finnhubKey:''};

const DEFAULT_RECURRENTES = [
  {id:uid(),nombre:'Renta / Hipoteca', icon:'🏠',categoria:'vivienda',      importe:8500, frecuencia:'Mensual',dia:1, activo:true,color:'#FF9F0A'},
  {id:uid(),nombre:'Luz',              icon:'💡',categoria:'luz',            importe:350,  frecuencia:'Mensual',dia:1, activo:true,color:'#FFD60A'},
  {id:uid(),nombre:'Agua',             icon:'🚰',categoria:'agua',           importe:200,  frecuencia:'Mensual',dia:1, activo:true,color:'#64D2FF'},
  {id:uid(),nombre:'Celular',          icon:'📱',categoria:'celular',        importe:400,  frecuencia:'Mensual',dia:1, activo:true,color:'#30D158'},
  {id:uid(),nombre:'Seguro',           icon:'🛡',categoria:'seguro',         importe:1200, frecuencia:'Mensual',dia:15,activo:true,color:'#BF5AF2'},
  {id:uid(),nombre:'Suscripciones',    icon:'📲',categoria:'suscripciones',  importe:350,  frecuencia:'Mensual',dia:1, activo:true,color:'#5856D6'},
];

// ── Helpers de formato ──────────────────────────────────────
function fmt(n, cur) {
  if (n == null || isNaN(n)) {
    if (cur === 'USD') return 'US$0';
    if (cur === 'EUR') return '€0';
    return '$0';
  }
  const sign = n < 0 ? '-' : '';
  if (cur === 'USD') return sign + 'US$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits:0});
  if (cur === 'EUR') return sign + '€'   + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits:0});
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', {maximumFractionDigits:0});
}

function fmtFull(n, cur) {
  if (n == null || isNaN(n)) {
    if (cur === 'USD') return 'US$0.00';
    if (cur === 'EUR') return '€0.00';
    return '$0.00';
  }
  const sign = n < 0 ? '-' : '';
  if (cur === 'USD') return sign + 'US$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2});
  if (cur === 'EUR') return sign + '€'   + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2});
  return sign + '$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2});
}

function fmtPct(n) { return (n==null||isNaN(n)) ? '0.00%' : (n>=0?'+':'') + (n*100).toFixed(2) + '%'; }
function pctCol(n) { return n >= 0 ? 'var(--green)' : 'var(--red)'; }
function fmtPlat(n, moneda) { return fmt(n, moneda || 'MXN'); }

// Nombre legible de categoría de gasto
function catName(id) {
  const c = EXPENSE_CATS.find(x => x.id === id);
  return c ? `${c.icon} ${c.name}` : id || 'Sin categoría';
}

// Badge de sección
function secBadge(sec) {
  if (sec === 'plataformas') return '<span class="badge badge-blue">🏦 PLAT</span>';
  if (sec === 'inversiones')  return '<span class="badge badge-purple">📈 INV</span>';
  return '<span class="badge badge-orange">💳 GASTO</span>';
}

// ── Toast — reemplaza los alert() feos ──────────────────────
// Uso: showToast('✅ Guardado', 'success')   → verde
//      showToast('❌ Error',    'error')     → rojo
//      showToast('⚠️ Atención','warn')      → naranja
//      showToast('ℹ️ Info',    'info')      → azul (default)
function showToast(msg, type = 'info', duration = 3000) {
  // Crear contenedor si no existe
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

  // Inyectar keyframes si no existen
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
