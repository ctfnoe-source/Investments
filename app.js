import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// ==================== MÓDULO PRINCIPAL ====================

window._log = function(msg){ try{ const d=document.getElementById("_debugLog"); if(!d) return; const p=document.createElement("p"); p.style.margin="0"; p.textContent=new Date().toLocaleTimeString()+" "+msg; d.prepend(p); }catch(e){} };
window._log("APP.JS CARGADO");

function escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
const LS = {
  get(k) { try { const v = localStorage.getItem('fp_'+k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem('fp_'+k, JSON.stringify(v)); } catch {} },
};

let _offlineQueue = LS.get('offlineQueue') || [];
let _isOnline = navigator.onLine;

// ==================== i18n ====================
const I18N = {
  es: {
    // Nav tabs
    tabDashboard:'📊 Dashboard', tabMovimientos:'📋 Movimientos', tabPlataformas:'🏦 Plataformas',
    tabInversiones:'📈 Inversiones', tabGastos:'💳 Gastos', tabMetas:'🎯 Metas', tabAjustes:'⚙️ Ajustes',
    // Gastos page
    gastosTitulo:'Control de Gastos', gastosSubtitulo:'Todo en', gastosMoneda:'Euros',
    ingresosMes:'💰 Mis Ingresos del Mes',
    sueldoLabel:'Sueldo fijo', extrasLabel:'Extras / Bonos', otrosLabel:'Otros', totalLabel:'Total',
    monedaSueldo:'Moneda del sueldo',
    recurrentesTitulo:'🔄 Gastos Recurrentes', recurrentesGestionar:'⚙️ Gestionar',
    sinRecurrentes:'Sin recurrentes.',
    presupuestoTitulo:'Presupuesto por Categoría',
    movsTitulo:'Movimientos',
    sinMovs:'Sin movimientos este mes',
    catHeader:['Categoría','Presupuesto','% ingreso','Real','Restante','Uso'],
    sinAsignar:'sin presupuesto asignado',
    asignar:'asignar', usado:'usado',
    catOcultas1:'categorías ocultas', catOcultas2:'Mostrar todas',
    catOcultasSA:'categorías sin asignar ocultas',
    // offline/sync
    offlineMsg:'Sin internet — cambios guardados localmente',
    syncingMsg:'Sincronizando cambios pendientes…',
    syncedMsg:'¡Sincronizado!',
    // login
    loginTitle:'TrackFolio',
    loginSub:'Tu dashboard financiero personal.<br>Inicia sesión con tu cuenta de Google para continuar.',
    loginBtn:'Continuar con Google',
    loginLock:'🔒 Solo el propietario autorizado puede acceder',
    // access denied
    accessTitle:'Acceso denegado',
    accessSub:'Esta aplicación es privada.<br>Tu cuenta no tiene permiso de acceso.',
    accessBtn:'← Cerrar sesión',
    // months
    months:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    // Dashboard
    patrimonioTotal:'Patrimonio Total', patrimonioReal:'Patrimonio Real',
    valorPlataformas:'🏦 Valor Plataformas', rendPlataformas:'🏦 Rend. Plataformas',
    valorInversiones:'📈 Valor Inversiones', gpNoRealizada:'📈 G/P No Realizada',
    rentabilidadTotal:'📊 Rentabilidad Total', concentracion:'📊 Concentración',
    gastosMes:'💳 Gastos Mes', balanceMes:'💳 Balance Mes',
    ingresoMensual:'Ingreso Mensual', saldoActual:'Saldo Actual',
    proyeccion:'Proyección', topPlataformas:'🏆 Top Plataformas',
    gastosPorCat:'💳 Gastos por categoría',
    sinGastosEsteMes:'Sin gastos este mes', sinInversiones:'Sin inversiones registradas',
    sinPreciosDia:'Sin precios del día — presiona Actualizar',
    actualizarPrecios:'🔄 Actualizar precios', actualizando:'⏳ Actualizando...',
    ahorro:'ahorro', est:'est.',
    saludFinanciera:'Salud Financiera', resumenMes:'Resumen del Mes',
    // Estados
    lograda:'🏆 LOGRADA', casi:'🔥 Casi', inicio:'💤 Inicio', enProceso:'⏳ En proceso',
    cerrada:'CERRADA', activo:'Activo',
    deficit:'🔴 Déficit', sobrePresupuesto:'🟡 Sobre presupuesto', dentroDelPlan:'🟢 Dentro del plan',
    // Tipos de movimiento
    gasto:'Gasto', ingreso:'Ingreso', transferencia:'↔ Transferencia',
    transferenciaEntrada:'Transferencia entrada', transferenciaSalida:'Transferencia salida',
    todo:'Todo', todos:'Todos',
    // Card titles
    capitalSobrantePorMes:'💰 Capital Sobrante por Mes',
    progresoDeMetas:'🎯 Progreso de Metas',
    inversionesPorTipo:'💼 Inversiones por Tipo',
    distribucionPorTipo:'📊 Distribución por Tipo',
    posicionesAbiertas:'📂 Posiciones Abiertas',
    posicionesCerradas:'🔒 Posiciones Cerradas',
    lineaDeTiempo:'📅 Línea de Tiempo',
    rendimientoEsperado:'📈 Rendimiento Esperado Anual',
    porMoneda:'🌍 Por Moneda',
    porTipoActivo:'🥧 Por Tipo de Activo',
    posiciones:'📊 Posiciones',
    // Plataformas
    agregarPlataforma:'+ Agregar Plataforma', editarPlataforma:'Editar Plataforma',
    sinPlataformas:'No tienes plataformas registradas.',
    agregarPrimera:'+ Agregar primera plataforma',
    archivarMovAnt:'🗜️ Archivar movimientos antiguos',
    // Inversiones
    agregarInversion:'+ Agregar movimiento',
    costoTotal:'💰 Costo Total', valorActual:'📊 Valor Actual',
    gpRealizada:'✅ G/P Realizada', gpTotal:'G/P Total',
    cagrReal:'CAGR Real',
    // Metas
    agregarMeta:'+ Nueva Meta', editarMeta:'Editar Meta',
    sinMetas:'Sin metas registradas. ¡Crea tu primera meta!',
    aportacion:'Aportación', retiro:'Retiro',
    saldoArchivado:'Saldo Archivado', sinFecha:'Sin fecha',
    // Table headers
    fecha:'Fecha', importe:'Importe', notas:'Notas', tipo:'Tipo',
    categoria:'Categoría', descripcion:'Descripción', seccion:'Sección',
    plataforma:'Plataforma', moneda:'Moneda', monto:'Monto',
    mes:'Mes', sobrante:'Sobrante', ingresoRef:'Ingreso ref.',
    gastos:'Gastos', aportaciones:'+ Aport.', rend:'Rend %',
    rendReal:'Rend. Real', saldoIni:'Saldo Ini.', tasaPct:'⚡ Tasa %',
    pctPort:'% Port.', detalle:'Detalle', dias:'Días', extra:'Extra',
    desde:'Desde', retiros:'Retiros', saldoActualTh:'Saldo Actual',
    // Buttons
    agregar:'+ Agregar', editar:'✏️ Editar', eliminar:'× Eliminar',
    guardar:'Guardar', cancelar:'Cancelar', cerrar:'✕',
    exportar:'📤 Exportar', importar:'📥 Importar',
    transferirSobrante:'💸 Transferir sobrante →',
    verDetalle:'Ver detalle', ocultar:'Ocultar',
    mostrarTodas:'Mostrar todas', mostrarMenos:'Mostrar menos',
    probar:'🧪 Probar', salir:'Salir',
    hideValues:'Ocultar valores', showValues:'Mostrar valores',
    resumenDia:'Resumen del día',
    sgDashboard:['¿Cómo está mi balance este mes?','¿Cuál es mi mejor plataforma?','¿Cuánto llevo invertido?','¿Voy bien con mis metas?'],
    sgGastos:['¿En qué categoría gasto más?','¿Estoy dentro del presupuesto?','Resume mis gastos recurrentes','¿Cómo puedo reducir gastos?'],
    sgInversiones:['¿Cuánto llevo invertido en total?','¿Cuál es mi mejor inversión?','¿Estoy bien diversificado?','¿Cuánto he ganado o perdido?'],
    sgPlataformas:['¿Cuál es mi mejor plataforma?','¿Dónde tengo más capital concentrado?','¿Qué plataforma rinde más?','Compara mis plataformas'],
    sgMetas:['¿Voy bien con mis metas?','¿Cuándo alcanzaré mi próxima meta?','¿Cuánto necesito ahorrar por mes?','¿Qué meta está más lejos?'],
    // Secciones
    seccionPlataformas:'Plataformas', seccionInversiones:'Inversiones', seccionGastos:'Gastos',
    // Movimientos
    movimientosTitulo:'Movimientos', movimientosSubtitulo:'Registro unificado',
    nuevoMovimiento:'+ Nuevo', buscar:'Buscar...',
    budgetExceeded:'Presupuesto excedido', atBudget:'Al límite del presupuesto',
    // Plataformas titulos
    plataformasTitulo:'Plataformas', plataformasSubtitulo:'Bancos · SOFIPOs · ETFs · Fondos · CETES · Multi‑moneda',
    transferenciaEntrePlataformas:'↔ Transferencia', nuevaPlataforma:'+ Plataforma',
    // Ajustes
    expectedAnnualReturn:'Rendimiento esperado anual',
    // Misc
    gastoReal:'💳 Gasto Real', disponible:'✅ Disponible', presupuestoLabel:'📋 Presupuesto',
    cuenta:'👤 Cuenta', tipoCambio:'💱 Tipo de Cambio',
    asistenteia:'🤖 Asistente IA', zonaPeligro:'⚠️ Zona de Peligro',
    exportarImportar:'💾 Exportar / Importar',
    reglasFb:'🔐 Reglas Firebase',
    apiKeyFinnhub:'🔑 API Key — Finnhub',
    apiKeyAlpha:'🔑 API Key — Alpha Vantage',
    modelosGratis:'Modelos gratis', casiGratis:'Casi gratis',
    usuario:'Usuario',
    accion:'Acción', crypto:'Crypto', bono:'Bono', otro:'Otro',
    rendimientoSobre:'rendimiento total', preciosHoy:'precios hoy',
    costoPosicion:'costo compra', posiciones2:'posiciones',
    sobreCapital:'sobre capital invertido', sinHistorial:'sin historial aún',
    segunPlaneado:'según planeado', real:'real',
    // NUEVAS CLAVES PARA TEXTO FALTANTE
    pricesUpdatedToday:'precios actualizados hoy',
    sinPrecio:'sin precio',
    conTasaAuto:'con tasa automática',
    requiereFinnhub:'requiere clave Finnhub',
    proyeccion:'Proyección',
    expectedGainIn:'Ganancia esperada en',
    potencial:'Potencial',
    verTodo:'Ver todo →',
    gananciaReal:'Ganancia real',
    patrimonioTotal2:'Patrimonio total',
    gananciaNetaTotal:'Ganancia neta total',
    graficoApareceraManana:'El gráfico aparecerá mañana',
    necesitas2dias:'Necesitas al menos 2 días de datos.',
    vuelveManana:'Vuelve mañana para ver tu evolución.',
    plataformasSinSaldoActual:'Plataformas sin "Saldo Actual" registrado: su rendimiento se cuenta como $0. Para ver ganancias/pérdidas reales, agrega un movimiento "Saldo Actual" a cada una.',
    sinPrecioHoy:'sin precio hoy',
    noResultados:'Sin resultados para',
    intentaOtroTermino:'Intenta con otro término',
    primerMovimiento:'Primer movimiento',
    recurrente:'Recurrente',
    auto:'Auto',
    mes:'Mes',
    catOcultas:'categorías ocultas',
    sinPosicionesAbiertas:'Sin posiciones abiertas',
    registraPrimeraCompra:'Registra tu primera compra',
    goalLabel:'Meta',
    meses:'meses',
    restan:'restan',
    liveECB:'ECB en vivo',
    manual:'manual',
    pressUpdate:'presiona Actualizar',
    apiKey:'Clave API',
    freeAt:'Gratis en',
    resetAll:'Reiniciar todo',
    confirmReset:'¿Estás seguro? Esta acción eliminará todos tus datos.',
    deletePermanently:'Eliminar permanentemente',
    netWorthEvolution:'Evolución del Patrimonio',
    annualized:'anualizado',
    history:'de historial',
    adminPanel:'Panel de Administrador',
    manageUsers:'Gestionar usuarios',
    manageUsersDesc:'Gestionar usuarios y accesos',
    accessPending:'Acceso pendiente',
    welcomeDesc:'Tu dashboard financiero personal para inversiones, gastos y metas.',
    payBtn:'💳 Comprar acceso — $20 USD',
    payDesc:'Pago único · Sin suscripción · Acceso de por vida',
    payOr:'o',
    payProcessing:'Procesando...',
    trialBtn:'Probar 20 minutos gratis',
    trialUsed:'Ya usaste tu prueba gratuita',
    contactBtn:'Contactar para obtener acceso',
    trialBanner:'Modo prueba', trialMinutes:'min restantes',
    trialExpiredTitle:'Tu prueba ha terminado',
    trialExpiredDesc:'Para obtener acceso completo, contáctate con el administrador:',
    trialExpiredBtn:'Contactar administrador',
    pendingExplanation:'Para obtener acceso, contáctate con el administrador: <a href="mailto:ctfnoe@gmail.com" style="color:var(--blue);font-weight:600">ctfnoe@gmail.com</a>',
    active:'Activo', pending:'Pendiente', approve:'Aprobar', revoke:'Revocar',
    trialBanner:'Modo prueba', trialMinutes:'min restantes',
    trialExpiredTitle:'Tu prueba ha terminado',
    trialExpiredDesc:'Para obtener acceso completo, contáctate con el administrador:',
    trialExpiredBtn:'Contactar administrador',
  },
  en: {
    tabDashboard:'📊 Dashboard', tabMovimientos:'📋 Transactions', tabPlataformas:'🏦 Platforms',
    tabInversiones:'📈 Investments', tabGastos:'💳 Expenses', tabMetas:'🎯 Goals', tabAjustes:'⚙️ Settings',
    gastosTitulo:'Expense Tracker', gastosSubtitulo:'All in', gastosMoneda:'Euros',
    ingresosMes:'💰 My Monthly Income',
    sueldoLabel:'Fixed salary', extrasLabel:'Extras / Bonuses', otrosLabel:'Other', totalLabel:'Total',
    monedaSueldo:'Salary currency',
    recurrentesTitulo:'🔄 Recurring Expenses', recurrentesGestionar:'⚙️ Manage',
    sinRecurrentes:'No recurring expenses.',
    presupuestoTitulo:'Budget by Category',
    movsTitulo:'Transactions',
    sinMovs:'No transactions this month',
    catHeader:['Category','Budget','% income','Actual','Remaining','Usage'],
    sinAsignar:'no budget assigned',
    asignar:'assign', usado:'used',
    catOcultas1:'categories hidden', catOcultas2:'Show all',
    catOcultasSA:'unassigned categories hidden',
    offlineMsg:'No internet — changes saved locally',
    syncingMsg:'Syncing pending changes…',
    syncedMsg:'Synced!',
    loginTitle:'TrackFolio',
    loginSub:'Your personal financial dashboard.<br>Sign in with your Google account to continue.',
    loginBtn:'Continue with Google',
    loginLock:'🔒 Only the authorized owner can access',
    accessTitle:'Access denied',
    accessSub:'This application is private.<br>Your account does not have access.',
    accessBtn:'← Sign out',
    months:['January','February','March','April','May','June','July','August','September','October','November','December'],
    patrimonioTotal:'Total Net Worth', patrimonioReal:'Real Net Worth',
    valorPlataformas:'🏦 Platform Value', rendPlataformas:'🏦 Platform Return',
    valorInversiones:'📈 Investment Value', gpNoRealizada:'📈 Unrealized G/L',
    rentabilidadTotal:'📊 Total Return', concentracion:'📊 Concentration',
    gastosMes:'💳 Expenses', balanceMes:'💳 Month Balance',
    ingresoMensual:'Monthly Income', saldoActual:'Current Balance',
    proyeccion:'Projection', topPlataformas:'🏆 Top Platforms',
    gastosPorCat:'💳 Expenses by category',
    sinGastosEsteMes:'No expenses this month', sinInversiones:'No investments registered',
    sinPreciosDia:'No prices today — press Update',
    actualizarPrecios:'🔄 Update prices', actualizando:'⏳ Updating...',
    ahorro:'savings', est:'est.',
    saludFinanciera:'Financial Health', resumenMes:'Month Summary',
    lograda:'🏆 ACHIEVED', casi:'🔥 Almost', inicio:'💤 Starting', enProceso:'⏳ In progress',
    cerrada:'CLOSED', activo:'Active',
    deficit:'🔴 Deficit', sobrePresupuesto:'🟡 Over budget', dentroDelPlan:'🟢 On track',
    gasto:'Expense', ingreso:'Income', transferencia:'↔ Transfer',
    transferenciaEntrada:'Transfer in', transferenciaSalida:'Transfer out',
    todo:'All', todos:'All',
    capitalSobrantePorMes:'💰 Monthly Surplus',
    progresoDeMetas:'🎯 Goals Progress',
    inversionesPorTipo:'💼 Investments by Type',
    distribucionPorTipo:'📊 Distribution by Type',
    posicionesAbiertas:'📂 Open Positions',
    posicionesCerradas:'🔒 Closed Positions',
    lineaDeTiempo:'📅 Timeline',
    rendimientoEsperado:'📈 Expected Annual Return',
    porMoneda:'🌍 By Currency',
    porTipoActivo:'🥧 By Asset Type',
    posiciones:'📊 Positions',
    agregarPlataforma:'+ Add Platform', editarPlataforma:'Edit Platform',
    sinPlataformas:'No platforms registered.',
    agregarPrimera:'+ Add first platform',
    archivarMovAnt:'🗜️ Archive old movements',
    agregarInversion:'+ Add movement',
    costoTotal:'💰 Total Cost', valorActual:'📊 Current Value',
    gpRealizada:'✅ Realized G/L', gpTotal:'Total G/L',
    cagrReal:'Real CAGR',
    agregarMeta:'+ New Goal', editarMeta:'Edit Goal',
    sinMetas:'No goals yet. Create your first goal!',
    aportacion:'Contribution', retiro:'Withdrawal',
    saldoArchivado:'Archived Balance', sinFecha:'No date',
    fecha:'Date', importe:'Amount', notas:'Notes', tipo:'Type',
    categoria:'Category', descripcion:'Description', seccion:'Section',
    plataforma:'Platform', moneda:'Currency', monto:'Amount',
    mes:'Month', sobrante:'Surplus', ingresoRef:'Ref. income',
    gastos:'Expenses', aportaciones:'+ Contrib.', rend:'Return %',
    rendReal:'Real Return', saldoIni:'Init. bal.', tasaPct:'⚡ Rate %',
    pctPort:'% Port.', detalle:'Detail', dias:'Days', extra:'Extra',
    desde:'Since', retiros:'Withdrawals', saldoActualTh:'Current Balance',
    agregar:'+ Add', editar:'✏️ Edit', eliminar:'× Delete',
    guardar:'Save', cancelar:'Cancel', cerrar:'✕',
    exportar:'📤 Export', importar:'📥 Import',
    transferirSobrante:'💸 Transfer surplus →',
    verDetalle:'View detail', ocultar:'Hide',
    mostrarTodas:'Show all', mostrarMenos:'Show less',
    probar:'🧪 Test', salir:'Sign out',
    hideValues:'Hide values', showValues:'Show values',
    resumenDia:'Daily summary',
    sgDashboard:['How is my balance this month?','Which is my best platform?','How much have I invested?','Am I on track with my goals?'],
    sgGastos:['Which category do I spend most on?','Am I within budget?','Summarize my recurring expenses','How can I reduce expenses?'],
    sgInversiones:['How much have I invested in total?','What is my best investment?','Am I well diversified?','How much have I gained or lost?'],
    sgPlataformas:['Which is my best platform?','Where is most of my capital?','Which platform has the best return?','Compare my platforms'],
    sgMetas:['Am I on track with my goals?','When will I reach my nearest goal?','How much do I need to save per month?','Which goal is furthest away?'],
    seccionPlataformas:'Platforms', seccionInversiones:'Investments', seccionGastos:'Expenses',
    movimientosTitulo:'Transactions', movimientosSubtitulo:'Unified log',
    nuevoMovimiento:'+ New', buscar:'Search...',
    budgetExceeded:'Budget exceeded', atBudget:'Near budget limit',
    plataformasTitulo:'Platforms', plataformasSubtitulo:'Banks · SOFIPOs · ETFs · Funds · CETES · Multi‑currency',
    transferenciaEntrePlataformas:'↔ Transfer', nuevaPlataforma:'+ Platform',
    expectedAnnualReturn:'Expected Annual Return',
    gastoReal:'💳 Actual Expenses', disponible:'✅ Available', presupuestoLabel:'📋 Budget',
    cuenta:'👤 Account', tipoCambio:'💱 Exchange Rate',
    asistenteia:'🤖 AI Assistant', zonaPeligro:'⚠️ Danger Zone',
    exportarImportar:'💾 Export / Import',
    reglasFb:'🔐 Firebase Rules',
    apiKeyFinnhub:'🔑 API Key — Finnhub',
    apiKeyAlpha:'🔑 API Key — Alpha Vantage',
    modelosGratis:'Free models', casiGratis:'Almost free',
    usuario:'User',
    accion:'Stock', crypto:'Crypto', bono:'Bond', otro:'Other',
    rendimientoSobre:'total return', preciosHoy:"today's prices",
    costoPosicion:'purchase cost', posiciones2:'positions',
    sobreCapital:'on invested capital', sinHistorial:'no history yet',
    segunPlaneado:'as planned', real:'actual',
    // NUEVAS CLAVES PARA TEXTO FALTANTE
    pricesUpdatedToday:'prices updated today',
    sinPrecio:'no price',
    conTasaAuto:'with auto rate',
    requiereFinnhub:'requires Finnhub key',
    proyeccion:'Projection',
    expectedGainIn:'Expected gain in',
    potencial:'Potential',
    verTodo:'View all →',
    gananciaReal:'Real Gain',
    patrimonioTotal2:'Total net worth',
    gananciaNetaTotal:'total net gain',
    graficoApareceraManana:'Chart will appear tomorrow',
    necesitas2dias:'You need at least 2 days of data.',
    vuelveManana:'Come back tomorrow to see your evolution.',
    plataformasSinSaldoActual:'Platforms without "Current Balance" registered: their return is counted as $0. To see actual gains/losses, add a "Current Balance" movement to each.',
    sinPrecioHoy:'no price today',
    noResultados:'No results for',
    intentaOtroTermino:'Try another term',
    primerMovimiento:'First movement',
    recurrente:'Recurring',
    auto:'Auto',
    mes:'Month',
    catOcultas:'categories hidden',
    sinPosicionesAbiertas:'No open positions',
    registraPrimeraCompra:'Register your first purchase',
    goalLabel:'Goal',
    meses:'months',
    restan:'left',
    liveECB:'Live ECB',
    manual:'manual',
    pressUpdate:'press Update',
    apiKey:'API key',
    freeAt:'Free at',
    resetAll:'Reset all',
    confirmReset:'Are you sure? This action will delete all your data.',
    deletePermanently:'Delete permanently',
    netWorthEvolution:'Net Worth Evolution',
    annualized:'annualized',
    history:'of history',
    adminPanel:'Admin Panel',
    manageUsers:'Manage users',
    manageUsersDesc:'Manage users and access',
    accessPending:'Access pending',
    welcomeDesc:'Your personal financial dashboard for investments, expenses and goals.',
    payBtn:'💳 Buy access — $20 USD',
    payDesc:'One-time payment · No subscription · Lifetime access',
    payOr:'or',
    payProcessing:'Processing...',
    trialBtn:'Try free for 20 minutes',
    trialUsed:'Your free trial has been used',
    contactBtn:'Contact us for full access',
    trialBanner:'Trial mode', trialMinutes:'min remaining',
    trialExpiredTitle:'Your trial has ended',
    trialExpiredDesc:'To get full access, contact the administrator:',
    trialExpiredBtn:'Contact administrator',
    pendingExplanation:'To get access, please contact the administrator: <a href="mailto:ctfnoe@gmail.com" style="color:var(--blue);font-weight:600">ctfnoe@gmail.com</a>',
    active:'Active', pending:'Pending', approve:'Approve', revoke:'Revoke',
    trialBanner:'Trial mode', trialMinutes:'min remaining',
    trialExpiredTitle:'Your trial has ended',
    trialExpiredDesc:'To get full access, contact the administrator:',
    trialExpiredBtn:'Contact administrator',
  }
};
let _lang = (typeof window.__initLang !== 'undefined' ? window.__initLang : null) || LS.get('lang') || 'es';
function t(key) { return (I18N[_lang] || I18N.en)[key] || (I18N.en[key] || key); }
function toggleLang() {
  _lang = _lang === 'es' ? 'en' : 'es';
  LS.set('lang', _lang);
  _applyLangToNav();
  if(typeof renderPageInternal === 'function') renderPageInternal(currentTab);
}
function _applyLangToNav() {
  const tabMap = {
    dashboard:'tabDashboard', movimientos:'tabMovimientos', plataformas:'tabPlataformas',
    inversiones:'tabInversiones', gastos:'tabGastos', metas:'tabMetas', ajustes:'tabAjustes'
  };
  document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
    const key = tabMap[btn.dataset.tab];
    if(key) btn.textContent = t(key);
  });
  document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(btn => {
    const key = tabMap[btn.dataset.tab];
    const label = btn.querySelector('.mob-label');
    if(key && label) {
      const full = t(key);
      label.textContent = full.replace(/^\S+\s+/, '');
    }
  });
  const btn = document.getElementById('langToggleBtn');
  if(btn) btn.textContent = _lang === 'es' ? '🌐 EN' : '🌐 ES';
}
window.toggleLang = toggleLang;

function toggleValues() {
  _valuesHidden = !_valuesHidden;
  LS.set('valuesHidden', _valuesHidden);
  const btn = document.getElementById('hideValuesBtn');
  if (btn) {
    btn.textContent = _valuesHidden ? '🙈' : '👁';
    btn.title = _valuesHidden ? t('showValues') : t('hideValues');
    btn.style.opacity = _valuesHidden ? '0.5' : '1';
  }
  if (typeof renderPageInternal === 'function') renderPageInternal(currentTab);
}
window.toggleValues = toggleValues;

function _getAiSuggestions() {
  const tab = window.currentTab || 'dashboard';
  const map = { gastos:'sgGastos', inversiones:'sgInversiones', plataformas:'sgPlataformas', metas:'sgMetas' };
  return t(map[tab] || 'sgDashboard') || [];
}

function _renderMd(raw) {
  let s = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) =>
    '<pre style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:11px;overflow-x:auto;margin:6px 0;font-family:monospace;white-space:pre">' + c.trim() + '</pre>');
  s = s.replace(/`([^`]+)`/g,'<code style="background:var(--card2);border-radius:4px;padding:1px 5px;font-size:11px;font-family:monospace">$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  s = s.replace(/^### (.+)$/gm,'<div style="font-size:13px;font-weight:700;margin:8px 0 3px">$1</div>');
  s = s.replace(/^## (.+)$/gm,'<div style="font-size:14px;font-weight:700;margin:10px 0 4px">$1</div>');
  s = s.replace(/((?:^[-*] .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l=>l.replace(/^[-*] /,''));
    return '<ul style="margin:4px 0 4px 4px;padding-left:16px;font-size:13px;line-height:1.7">'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul>';
  });
  s = s.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l=>l.replace(/^\d+\.\s/,''));
    return '<ol style="margin:4px 0 4px 4px;padding-left:16px;font-size:13px;line-height:1.7">'+items.map(i=>'<li>'+i+'</li>').join('')+'</ol>';
  });
  s = s.replace(/\n/g,'<br>');
  s = s.replace(/(<\/(?:ul|ol|pre|div)>)<br>/g,'$1');
  return s;
}

async function _runProactiveAiAlert() {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (LS.get('lastProactiveAlert') === today) return;
    const hasKey = Object.values(settings.aiKeys||{}).some(v=>!!v);
    if (!hasKey) return;
    LS.set('lastProactiveAlert', today);
    const prompt = _lang === 'es'
      ? 'Dame un resumen financiero muy breve: patrimonio actual, balance del mes y UN consejo concreto. Máximo 4 líneas.'
      : 'Give me a very brief financial summary: current net worth, month balance, and ONE concrete tip. Max 4 lines.';
    const reply = await _aiCall([{role:'user', content:prompt}]);
    if (!reply) return;
    const notif = document.createElement('div');
    notif.style.cssText = 'position:fixed;top:70px;right:20px;z-index:9999;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 18px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-size:13px;line-height:1.6;color:var(--text);transition:opacity 0.5s';
    notif.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span>✦</span><strong style="font-size:12px">' + t('resumenDia') + '</strong><button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:16px;color:var(--text3)">✕</button></div>' + _renderMd(reply);
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.opacity='0'; setTimeout(()=>notif.remove(),500); }, 9000);
  } catch(e) { /* silencioso */ }
}

function setOfflineBanner(state) {
  const b = document.getElementById('offlineBanner');
  const icon = document.getElementById('offlineIcon');
  const text = document.getElementById('offlineText');
  if (!b) return;
  if (state === 'offline') { b.className = 'offline-banner show'; icon.textContent = '📴'; text.textContent = t('offlineMsg'); }
  else if (state === 'syncing') { b.className = 'offline-banner show syncing'; icon.textContent = '⏳'; text.textContent = t('syncingMsg'); }
  else if (state === 'synced') { b.className = 'offline-banner show synced'; icon.textContent = '✅'; text.textContent = t('syncedMsg'); setTimeout(() => { b.className = 'offline-banner'; }, 2500); }
  else { b.className = 'offline-banner'; }
}

function queueSave(data) {
  // Guardar solo un snapshot por "tipo" de dato, no acumular estados completos
  // Esto evita que al reconectar se sobrescriban datos de Firebase con estados viejos
  const existing = _offlineQueue.findIndex(q => q.type === 'fullState');
  const entry = { type: 'fullState', data, ts: Date.now() };
  if (existing >= 0) {
    _offlineQueue[existing] = entry; // reemplazar en lugar de acumular
  } else {
    _offlineQueue.push(entry);
  }
  LS.set('offlineQueue', _offlineQueue);
}

async function flushOfflineQueue() {
  if (!_offlineQueue.length) return;
  if (typeof window.saveToFirebase !== 'function') return;
  setOfflineBanner('syncing');
  try {
    // Antes de aplicar el queue, verificar que no haya datos más nuevos en Firebase
    // Solo sincronizar si el timestamp del queue es más reciente que el último sync
    const lastSync = LS.get('lastFirebaseSync') || 0;
    const latestQueued = Math.max(..._offlineQueue.map(q => q.ts));
    if (latestQueued > lastSync) {
      await window.saveToFirebase(true);
      LS.set('lastFirebaseSync', Date.now());
    }
    _offlineQueue = [];
    LS.set('offlineQueue', []);
    setOfflineBanner('synced');
  }
  catch(e) { setOfflineBanner('offline'); }
}

window.addEventListener('online', () => { _isOnline = true; flushOfflineQueue(); });
window.addEventListener('offline', () => { _isOnline = false; setOfflineBanner('offline'); });

let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { renderPageInternal(currentTab); }, 300);
});

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

function applyInitialLang() {
  _applyLangToNav();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyInitialLang);
} else {
  setTimeout(applyInitialLang, 0);
}

const PRICE_CACHE_KEY = 'price_cache';


function getPriceCache() { return LS.get(PRICE_CACHE_KEY) || {}; }
function setPriceCache(c) { LS.set(PRICE_CACHE_KEY, c); }
function isCacheFresh(ts) { if (!ts) return false; const n = new Date(), c = new Date(ts); return n.getFullYear()===c.getFullYear() && n.getMonth()===c.getMonth() && n.getDate()===c.getDate(); }
function isFxCacheFresh(ts) { if (!ts) return false; return (Date.now() - ts) < 6 * 60 * 60 * 1000; }
function getCachedPrice(t) { const c=getPriceCache(); return c[t]||null; }
let _fxCache = null;

function isPriceReasonable(price, cacheKey) {
  if (!price || price <= 0 || !isFinite(price)) return false;
  if (cacheKey.endsWith('_MXN')) {
    return price >= 100 && price <= 10000000;
  } else {
    return price >= 0.5 && price <= 1000000;
  }
}

function setCachedPrice(t, p, s) {
  if (!isPriceReasonable(p, t)) {
    // Silently discard
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

// Clean corrupted prices at startup
(function cleanCorruptedPrices(){
  const c = getPriceCache();
  let changed = false;
  Object.entries(c).forEach(([k, v]) => {
    if (v.source === 'coingecko') return;
    if (!isPriceReasonable(v.price, k)) { delete c[k]; changed = true; }
  });
  if (changed) setPriceCache(c);
  const fx = LS.get('fxCache');
  if (fx && (!fx.gbpmxn || !isFxCacheFresh(fx.ts) || fx.usdmxn < 14 || fx.usdmxn > 35)) {
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

// Fetch con timeout para APIs de precios — evita que la app se cuelgue si una API no responde
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return r;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchCryptoPrice(ticker) {
  const coinId = CRYPTO_MAP[ticker.toUpperCase()]; if(!coinId) return null;
  try { const r = await fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`); if(!r.ok) throw new Error(); const d = await r.json(); return d[coinId]?.usd || null; } catch { return null; }
}
async function fetchStockPrice(ticker) {
  const k = settings.finnhubKey||''; if(!k) return null;
  try { const r = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${k}`); if(!r.ok) throw new Error(); const d = await r.json(); return (d.c && d.c > 0) ? d.c : null; } catch { return null; }
}
async function fetchAlphaVantagePrice(ticker, targetMoneda) {
  const k = settings.alphaVantageKey || ''; if (!k) return null;
  const base = ticker.toUpperCase().replace(/\.(L|DE|AS|PA|MI|SW|LON|DEX)$/i, '');
  const suffixKey = 'av_suffix_' + base;
  const knownSuffix = LS.get(suffixKey);
  const allSymbols = knownSuffix
    ? [base + knownSuffix, base]
    : [base+'.LON', base+'.DEX', base+'.EPA', base+'.AMS', base];
  if (!_fxCache || !_fxCache.gbpmxn) await fetchFX();
  const fx    = _fxCache || LS.get('fxCache');
  const tc     = (fx?.usdmxn) || settings.tipoCambio || 18;
  const eurmxn = (fx?.eurmxn) || settings.tipoEUR;
  const gbpmxn = (fx?.gbpmxn) || settings.tipoGBP;
  const usdgbp = (fx?.usdgbp) || (settings.tipoGBP && settings.tipoCambio ? settings.tipoGBP/settings.tipoCambio : null);
  const usdeur = (fx?.usdeur) || (settings.tipoEUR && settings.tipoCambio ? settings.tipoEUR/settings.tipoCambio : null);
  for (const sym of allSymbols) {
    try {
      const r = await fetchWithTimeout(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${k}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.Note || d.Information) { return null; }
      const q = d['Global Quote'];
      if (!q || !q['01. symbol'] || !q['05. price']) continue;
      let price = parseFloat(q['05. price']);
      if (!price || price <= 0) continue;
      const currency = (q['08. currency'] || '').toUpperCase();
      const hasSuffix = sym !== base;
      const isGBp = sym.includes('.LON') && (currency === 'GBP' || currency === 'GBX');
      const isEUR = currency === 'EUR' || sym.includes('.DEX') || sym.includes('.EPA') || sym.includes('.AMS');
      if (hasSuffix && (isGBp || isEUR)) {
        LS.set(suffixKey, sym.replace(base, ''));
      } else if (!hasSuffix) {
        LS.set(suffixKey, null);
      }
      if (targetMoneda === 'MXN') {
        if (isGBp)      price = (price / 100) * gbpmxn;
        else if (isEUR) price = price * eurmxn;
        else            price = price * tc;
      } else if (targetMoneda === 'USD') {
        if (isGBp)      price = (price / 100) / usdgbp;
        else if (isEUR) price = price / usdeur;
      }
      return price;
    } catch(e) { /* ignore */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

async function fetchFX() {
  const cached = LS.get('fxCache');
  const isValid = cached && isFxCacheFresh(cached.ts) && cached.gbpmxn && cached.usdmxn >= 15 && cached.usdmxn <= 30;
  if (isValid) { _fxCache = cached; return cached; }
  try {
    const r = await fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=MXN,EUR,GBP');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const gbpmxn = d.rates.MXN / d.rates.GBP;
    const result = { usdmxn: d.rates.MXN, usdeur: d.rates.EUR, eurmxn: d.rates.MXN / d.rates.EUR, gbpmxn, usdgbp: d.rates.GBP, ts: Date.now(), _live: true };
    const anchor = settings.tipoCambio || 18;
    const isPlausible = result.usdmxn >= anchor * 0.75 && result.usdmxn <= anchor * 1.25;
    if (isPlausible) {
      LS.set('fxCache', result);
      _fxCache = result;
    }
    return result;
  } catch(e) {
    if (!_fxCache) {
      const t = settings.tipoCambio || 18;
      const ev = settings.tipoEUR || (t * 1.15);
      const g = settings.tipoGBP || (t * 1.325);
      _fxCache = { usdmxn: t, usdeur: t > 0 ? ev/t : 0.92, eurmxn: ev, gbpmxn: g, usdgbp: t > 0 ? g/t : 0.79, ts: 0, _live: false };
    }
    return _fxCache;
  }
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

async function forceUpdateFX() {
  const btn = document.querySelector('[onclick*=forceUpdateFX]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ ' + t('actualizando'); }
  try {
    const r = await fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=MXN,EUR,GBP');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const gbpmxn = d.rates.MXN / d.rates.GBP;
    const result = { usdmxn: d.rates.MXN, usdeur: d.rates.EUR, eurmxn: d.rates.MXN / d.rates.EUR, gbpmxn, usdgbp: d.rates.GBP, ts: Date.now(), _live: true };
    const anchor2 = settings.tipoCambio || 18;
    if (result.usdmxn >= anchor2 * 0.65 && result.usdmxn <= anchor2 * 1.45) {
      LS.set('fxCache', result);
      _fxCache = result;
      settings.tipoCambio = Math.round(result.usdmxn * 100) / 100;
      settings.tipoEUR   = Math.round(result.eurmxn * 100) / 100;
      settings.tipoGBP   = Math.round(result.gbpmxn * 100) / 100;
      LS.set('settings', settings);
      updateNavFX();
      _recalcAndSaveSnapshot();
      renderPage('ajustes');
    } else {
      throw new Error('Valor fuera de rango: ' + result.usdmxn);
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 ' + t('updateLive'); }
    const tcCard = document.getElementById('tcCardContent');
    if (tcCard) {
      const old = tcCard.querySelector('.fx-error');
      if (old) old.remove();
      const div = document.createElement('div');
      div.className = 'fx-error';
      div.style.cssText = 'color:var(--orange);font-size:12px;margin-top:8px';
      div.textContent = '⚠️ ' + t('couldNotConnect') + ' ' + e.message;
      tcCard.appendChild(div);
    }
  }
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
    let priceUSD = await fetchStockPrice(ticker);
    if (priceUSD !== null) {
      const fx = _fxCache || LS.get('fxCache');
      const tcLive = (fx?.usdmxn) || settings.tipoCambio || 18;
      price = priceUSD * tcLive; source = 'finnhub-converted';
    }
    if (price === null && settings.alphaVantageKey) { price = await fetchAlphaVantagePrice(ticker, 'MXN'); if (price !== null) source = 'alphavantage-mxn'; }
    if (price === null) {
      const cachedUSD = getCachedPrice(ticker.toUpperCase());
      if (cachedUSD && isCacheFresh(cachedUSD.ts) && isPriceReasonable(cachedUSD.price, ticker.toUpperCase())) {
        const fx = _fxCache || LS.get('fxCache');
        const tcLive = (fx?.usdmxn) || settings.tipoCambio || 18;
        const derived = cachedUSD.price * tcLive;
        if (isPriceReasonable(derived, ticker.toUpperCase()+'_MXN')) { price = derived; source = 'usd-cache-converted'; }
      }
    }
    if (price === null && settings.alphaVantageKey) {
      const priceUSD2 = await fetchAlphaVantagePrice(ticker, 'USD');
      if (priceUSD2 !== null) {
        const fx = _fxCache || LS.get('fxCache');
        price = priceUSD2 * ((fx?.usdmxn) || settings.tipoCambio || 18);
        source = 'alphavantage-usd-converted';
      }
    }
  }
  else if (type === 'Acción' || type === 'ETF') {
    const cachedMXN = getCachedPrice(ticker.toUpperCase() + '_MXN');
    if (cachedMXN && isCacheFresh(cachedMXN.ts) && isPriceReasonable(cachedMXN.price, ticker.toUpperCase()+'_MXN')) {
      const fx = _fxCache || LS.get('fxCache');
      const tcLive = (fx?.usdmxn) || settings.tipoCambio || 18;
      const derived = cachedMXN.price / tcLive;
      if (isPriceReasonable(derived, ticker.toUpperCase())) { price = derived; source = 'mxn-cache-converted'; }
    }
    const knownEuropeanSuffix = LS.get('av_suffix_' + ticker.toUpperCase());
    const isLikelyEuropean = knownEuropeanSuffix && (knownEuropeanSuffix.includes('.LON') || knownEuropeanSuffix.includes('.DEX') || knownEuropeanSuffix.includes('.EPA') || knownEuropeanSuffix.includes('.AMS'));
    if (price === null && isLikelyEuropean && settings.alphaVantageKey) {
      price = await fetchAlphaVantagePrice(ticker, moneda); if (price !== null) source = 'alphavantage';
    }
    if (price === null) {
      const finnhubPrice = await fetchStockPrice(ticker);
      // Solo aplicar ratio check si hay caché MXN para comparar; si no, aceptar directamente
      if (finnhubPrice !== null) {
        const cachedMXN2 = getCachedPrice(ticker.toUpperCase() + '_MXN');
        const fx2 = _fxCache || LS.get('fxCache');
        const tcLive2 = (fx2?.usdmxn) || settings.tipoCambio;
        if (cachedMXN2 && tcLive2) {
          const expectedUSD = cachedMXN2.price / tcLive2;
          const ratio = finnhubPrice / expectedUSD;
          if (ratio >= 0.1 && ratio <= 10) { price = finnhubPrice; source = 'finnhub'; }
        } else {
          price = finnhubPrice; source = 'finnhub';
        }
      }
    }
    if (price === null && settings.alphaVantageKey) { price = await fetchAlphaVantagePrice(ticker, moneda); if (price !== null) source = 'alphavantage'; }
  }
  if (price !== null) { setCachedPrice(cacheKey, price, source); return {price, source, cached:false, ts:Date.now()}; }
  return null;
}

let priceUpdateState = {loading:false, lastUpdate:null};
async function updateAllPrices(forceRefresh=false) {
  if (priceUpdateState.loading) return;
  priceUpdateState.loading = true;
  const btn = document.getElementById('btnUpdate');
  if(btn){btn.innerHTML='<span class="spinner"></span>';btn.disabled=true;}
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> '+t('actualizando'); }
  await updateFX();
  const tickerSet = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); tickerSet.set(key, {type: m.tipoActivo, moneda: m.moneda||'USD', ticker: m.ticker.toUpperCase()}); } });
  if (forceRefresh) { const c = getPriceCache(); tickerSet.forEach((_, k) => { delete c[k]; }); setPriceCache(c); LS.set('sp500_history', null); _sp500Data = null; LS.set('qqq_history', null); _qqqData = null; }
  const tickerArr = [...tickerSet.entries()].sort((a, b) => {
    const aIsMXN = a[1].moneda === 'MXN' ? 1 : 0;
    const bIsMXN = b[1].moneda === 'MXN' ? 1 : 0;
    return aIsMXN - bIsMXN;
  });
  for (const [key, info] of tickerArr) { const b = document.getElementById('btnUpdate'); if (b) b.innerHTML = `<span class="spinner"></span> ${info.ticker}...`; await fetchPrice(info.ticker, info.type, info.moneda); await new Promise(r => setTimeout(r, 300)); }
  priceUpdateState.loading = false;
  priceUpdateState.lastUpdate = new Date();
  const _nb=document.getElementById('btnUpdate');if(_nb){_nb.innerHTML='🔄';_nb.disabled=false;}
  _recalcAndSaveSnapshot();
  renderPage(currentTab);
}

// ── S&P 500 histórico ─────────────────────────────────────────────────────
// Histórico mensual via Alpha Vantage (gratis, CORS ok, 1 call/día cacheada)
// Precio de hoy via Finnhub (ya configurado)
const SP500_CACHE_KEY = 'sp500_history';

function getSP500Cache() { return LS.get(SP500_CACHE_KEY) || null; }
function setSP500Cache(data) { LS.set(SP500_CACHE_KEY, { data, ts: Date.now() }); }
function isSP500CacheFresh(cached) {
  if (!cached || !cached.ts) return false;
  const c = new Date(cached.ts), n = new Date();
  return c.getFullYear()===n.getFullYear() && c.getMonth()===n.getMonth() && c.getDate()===n.getDate();
}

async function fetchSP500History() {
  const cached = getSP500Cache();
  const _lastClose = cached?.data?.closes?.[cached.data.closes.length-1];
  const _cacheHasHistory = cached?.data?.closes?.length >= 3;
  if (isSP500CacheFresh(cached) && _lastClose && _lastClose > 0 && _cacheHasHistory) return cached.data;

  const avKey = settings.alphaVantageKey || '';
  const fhKey = settings.finnhubKey || '';
  if (!avKey && !fhKey) return null;

  let result = { dates: [], closes: [] };

  // 1a) Histórico mensual via Alpha Vantage
  if (avKey) {
    try {
      const r = await fetchWithTimeout(
        `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=SPY&apikey=${avKey}`
      );
      if (r.ok) {
        const d = await r.json();
        if (d['Monthly Time Series']) {
          const series = d['Monthly Time Series'];
          const entries = Object.entries(series)
            .map(([date, v]) => ({ date, close: parseFloat(v['4. close']) }))
            .filter(e => e.close > 0)
            .sort((a, b) => a.date.localeCompare(b.date));
          result.dates = entries.map(e => e.date);
          result.closes = entries.map(e => e.close);
        }
      }
    } catch(e) { /* silencioso */ }
  }
  // 1b) Usar Finnhub candles si no hay historial suficiente
  if (fhKey && result.dates.length < 3) {
    // Try monthly candles first (2 years), then weekly (3 months) as fallback
    for (const [res, days] of [['M', 365*2], ['W', 90]]) {
      try {
        const toTs = Math.floor(Date.now()/1000);
        const fromTs = toTs - 60*60*24*days;
        const r = await fetchWithTimeout(`https://finnhub.io/api/v1/stock/candle?symbol=SPY&resolution=${res}&from=${fromTs}&to=${toTs}&token=${fhKey}`);
        if (r.ok) {
          const d = await r.json();
          if (d.s === 'ok' && d.t && d.c && d.t.length > 1) {
            const entries = d.t.map((ts, i) => ({
              date: new Date(ts*1000).toISOString().split('T')[0],
              close: d.c[i]
            })).filter(e => e.close > 0);
            result.dates = entries.map(e => e.date);
            result.closes = entries.map(e => e.close);
            break; // got data, stop trying
          }
        }
      } catch(e) { /* silencioso */ }
    }
  }

  // 2) Precio de hoy via Finnhub (c=current, pc=previous close)
  if (fhKey) {
    try {
      const r = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${fhKey}`);
      if (r.ok) {
        const d = await r.json();
        const _price = (d.c && d.c > 0) ? d.c : (d.pc && d.pc > 0) ? d.pc : 0;
        const _pc = (d.pc && d.pc > 0) ? d.pc : 0;
        if (_price > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const yest = new Date(); yest.setDate(yest.getDate()-1);
          const yesterdayStr = yest.toISOString().split('T')[0];
          if (result.dates.length > 0) {
            // Update or append today's price to existing AV history
            const lastMonth = result.dates[result.dates.length-1].substring(0,7);
            const todayMonth = todayStr.substring(0,7);
            if (lastMonth === todayMonth) {
              result.dates[result.dates.length-1] = todayStr;
              result.closes[result.closes.length-1] = _price;
            } else {
              // Add prev close as last day of previous month anchor
              if (_pc > 0) { result.dates.push(yesterdayStr); result.closes.push(_pc); }
              result.dates.push(todayStr);
              result.closes.push(_price);
            }
          } else {
            // No AV history — build from Finnhub only using pc as anchor
            if (_pc > 0) { result.dates.push(yesterdayStr); result.closes.push(_pc); }
            result.dates.push(todayStr);
            result.closes.push(_price);
          }
        }
      }
    } catch(e) { /* silencioso */ }
  }

  if (result.dates.length > 0) { setSP500Cache(result); return result; }
  return null;
}

// Normaliza la curva del SP500 al capital del portafolio (legacy, no se usa en gráfico comparativo)
function normalizeSP500(sp500data, capitalInicial, fechaOrigen) {
  if (!sp500data || !sp500data.dates.length || !capitalInicial || capitalInicial <= 0) return [];
  const origenStr = fechaOrigen.substring(0, 7);
  let precioOrigen = null;
  for (let i = 0; i < sp500data.dates.length; i++) {
    if (sp500data.dates[i].substring(0,7) <= origenStr) precioOrigen = sp500data.closes[i];
  }
  if (!precioOrigen) precioOrigen = sp500data.closes[0];
  const result = [];
  for (let i = 0; i < sp500data.dates.length; i++) {
    if (sp500data.dates[i] < fechaOrigen) continue;
    const retorno = (sp500data.closes[i] - precioOrigen) / precioOrigen;
    result.push({ date: sp500data.dates[i], ganancia: Math.round(capitalInicial * retorno) });
  }
  return result;
}

// Devuelve array de { date, pct } con el rendimiento % PURO del SP500 desde fechaOrigen
// Completamente independiente del dinero del usuario
function sp500ReturnPct(sp500data, fechaOrigen) {
  if (!sp500data || !sp500data.dates.length || !fechaOrigen) return [];
  const origenStr = fechaOrigen.substring(0, 7);
  // Find precio base: last close on or before fechaOrigen
  let precioOrigen = null;
  for (let i = 0; i < sp500data.dates.length; i++) {
    if (sp500data.dates[i].substring(0, 7) <= origenStr) precioOrigen = sp500data.closes[i];
  }
  // If no price found before fechaOrigen (history too short), use first available
  if (!precioOrigen) precioOrigen = sp500data.closes[0];
  const result = [];
  for (let i = 0; i < sp500data.dates.length; i++) {
    // Include all dates — if history is shorter than user's start date, show what we have
    const pct = ((sp500data.closes[i] - precioOrigen) / precioOrigen) * 100;
    result.push({ date: sp500data.dates[i], pct: Math.round(pct * 100) / 100 });
  }
  return result;
}

let _sp500Data = null; // cache en memoria durante la sesión
const QQQ_CACHE_KEY = 'qqq_history';
function getQQQCache() { return LS.get(QQQ_CACHE_KEY) || null; }
function setQQQCache(data) { LS.set(QQQ_CACHE_KEY, { data, ts: Date.now() }); }
function isQQQCacheFresh(cached) {
  if (!cached || !cached.ts) return false;
  const c = new Date(cached.ts), n = new Date();
  return c.getFullYear()===n.getFullYear() && c.getMonth()===n.getMonth() && c.getDate()===n.getDate();
}
async function fetchQQQHistory() {
  const cached = getQQQCache();
  const _qlastClose = cached?.data?.closes?.[cached.data.closes.length-1];
  const _qcacheHasHistory = cached?.data?.closes?.length >= 3;
  if (isQQQCacheFresh(cached) && _qlastClose && _qlastClose > 0 && _qcacheHasHistory) return cached.data;
  const avKey = settings.alphaVantageKey || '';
  const fhKey = settings.finnhubKey || '';
  if (!avKey && !fhKey) return null;
  let result = { dates: [], closes: [] };
  if (avKey) {
    try {
      const r = await fetchWithTimeout(`https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=QQQ&apikey=${avKey}`);
      if (r.ok) {
        const d = await r.json();
        if (d['Monthly Time Series']) {
          const series = d['Monthly Time Series'];
          const entries = Object.entries(series).map(([date, v]) => ({ date, close: parseFloat(v['4. close']) })).filter(e => e.close > 0).sort((a, b) => a.date.localeCompare(b.date));
          result.dates = entries.map(e => e.date);
          result.closes = entries.map(e => e.close);
        }
      }
    } catch(e) { /* silencioso */ }
  }
  // 1b) Usar Finnhub candles si no hay historial suficiente
  if (fhKey && result.dates.length < 3) {
    for (const [res, days] of [['M', 365*2], ['W', 90]]) {
      try {
        const toTs = Math.floor(Date.now()/1000);
        const fromTs = toTs - 60*60*24*days;
        const r = await fetchWithTimeout(`https://finnhub.io/api/v1/stock/candle?symbol=QQQ&resolution=${res}&from=${fromTs}&to=${toTs}&token=${fhKey}`);
        if (r.ok) {
          const d = await r.json();
          if (d.s === 'ok' && d.t && d.c && d.t.length > 1) {
            const entries = d.t.map((ts, i) => ({ date: new Date(ts*1000).toISOString().split('T')[0], close: d.c[i] })).filter(e => e.close > 0);
            result.dates = entries.map(e => e.date);
            result.closes = entries.map(e => e.close);
            break;
          }
        }
      } catch(e) { /* silencioso */ }
    }
  }
  if (fhKey) {
    try {
      const r = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=QQQ&token=${fhKey}`);
      if (r.ok) {
        const d = await r.json();
        const _qprice = (d.c && d.c > 0) ? d.c : (d.pc && d.pc > 0) ? d.pc : 0;
        const _qpc = (d.pc && d.pc > 0) ? d.pc : 0;
        if (_qprice > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const yestQ = new Date(); yestQ.setDate(yestQ.getDate()-1);
          const yesterdayStrQ = yestQ.toISOString().split('T')[0];
          if (result.dates.length > 0) {
            const lastMonth = result.dates[result.dates.length-1].substring(0,7);
            const todayMonth = todayStr.substring(0,7);
            if (lastMonth === todayMonth) { result.dates[result.dates.length-1] = todayStr; result.closes[result.closes.length-1] = _qprice; }
            else {
              if (_qpc > 0) { result.dates.push(yesterdayStrQ); result.closes.push(_qpc); }
              result.dates.push(todayStr); result.closes.push(_qprice);
            }
          } else {
            if (_qpc > 0) { result.dates.push(yesterdayStrQ); result.closes.push(_qpc); }
            result.dates.push(todayStr); result.closes.push(_qprice);
          }
        }
      }
    } catch(e) { /* silencioso */ }
  }
  if (result.dates.length > 0) { setQQQCache(result); return result; }
  return null;
}
let _qqqData = null; // cache en memoria durante la sesión

function getPriceInfo(ticker, type, moneda) {
  ticker = ticker.toUpperCase(); moneda = (moneda || 'USD').toUpperCase();
  if (ticker === 'USD' || type === 'Efectivo USD') return {price:1, label:'$1.00', status:'fixed', cssClass:'price-cached'};
  const cacheKey = moneda === 'MXN' ? ticker + '_MXN' : ticker;
  const c = getCachedPrice(cacheKey);
  if (c && isCacheFresh(c.ts)) { const t = new Date(c.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); const cur = moneda === 'MXN' ? '$' : 'US$'; return {price:c.price, label:cur+c.price.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}), status:'cached', cssClass:'price-live', tooltip:`${c.source} · ${_lang==="es"?"hoy":"today"} ${t}`, moneda}; }
  return {price:null, label:'—', status:'none', cssClass:'price-fallback', tooltip:t('sinPrecioHoy'), moneda};
}

function getPriceSummary() {
  const ts = new Map();
  movements.forEach(m => { if (m.seccion === 'inversiones' && m.ticker) { const key = (m.moneda === 'MXN' ? m.ticker.toUpperCase() + '_MXN' : m.ticker.toUpperCase()); ts.set(key, {type: m.tipoActivo, moneda: m.moneda || 'USD'}); } });
  let live=0, missing=0;
  ts.forEach((_, k) => { const c=getCachedPrice(k); if(c&&isCacheFresh(c.ts))live++; else missing++; });
  return {live, missing, total: ts.size};
}

const COLORS=['#6E9EF5','#4DC78A','#F5A54A','#A97DD1','#F07070','#52BED8','#D4A843','#8A9BB0','#7B79D4','#E87FA0','#45C27A','#35B5B0','#E8705A','#6F6DC9','#C47AC0','#E05577','#9A8A7A','#4AA8C0'];
const COLORS_BAR=['rgba(99,130,201,0.82)','rgba(72,185,132,0.82)','rgba(228,152,72,0.82)','rgba(160,110,195,0.82)','rgba(220,100,100,0.82)','rgba(72,175,200,0.82)','rgba(195,163,68,0.82)','rgba(130,148,170,0.82)','rgba(115,112,200,0.82)','rgba(210,115,145,0.82)','rgba(68,185,115,0.82)','rgba(55,172,165,0.82)','rgba(215,108,88,0.82)','rgba(105,102,192,0.82)','rgba(180,115,180,0.82)'];
const MONTHS_ES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS=new Proxy([],{get(_,i){const m=_lang==='en'?MONTHS_EN:MONTHS_ES;return typeof i==='string'&&!isNaN(i)?m[+i]:m[i];}});
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
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const isMobile = () => window.innerWidth <= 768;

function fmt(n, cur) {
  if (typeof _valuesHidden !== 'undefined' && _valuesHidden) return '••••';
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

const DEFAULT_PLATFORMS=[];
const DEFAULT_MOVS=[];
const DEFAULT_GOALS=[];
const DEFAULT_SETTINGS={tipoCambio:17.84,tipoEUR:20.52,tipoGBP:23.66,rendimientoEsperado:0.06,finnhubKey:''};
const DEFAULT_RECURRENTES=[];

let platforms = LS.get('platforms') || DEFAULT_PLATFORMS;
let movements = LS.get('movements') || DEFAULT_MOVS;
let goals = LS.get('goals') || DEFAULT_GOALS;
let settings = {...DEFAULT_SETTINGS, ...(LS.get('settings') || {})};
let recurrentes = LS.get('recurrentes') || DEFAULT_RECURRENTES;
let patrimonioHistory = LS.get('patrimonioHistory') || [];
(function(){ const f=patrimonioHistory.filter(s=>!s.synthetic); if(f.length!==patrimonioHistory.length){patrimonioHistory=f;LS.set('patrimonioHistory',patrimonioHistory);} })();

platforms = platforms.map(p => ({tasaAnual:0, fechaInicio:today(), moneda:'MXN', ...p}));

let currentTab = 'dashboard';
let movFilter = {seccion:'todas', search:''};
let _gastosMonth = null;
let _aiChatOpen = false;
let _aiLastProvider = null;
let _aiMessages = LS.get('aiHistory') || [];
let _valuesHidden = LS.get('valuesHidden') || false;
let _aiLoading = false;
let chartInstances = {};

// ── Recuperación de canvas en móvil ─────────────────────────────────────
// iOS/Android descartan el buffer del canvas al hacer scroll o al poner la app en segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentTab === 'dashboard') {
    setTimeout(() => {
      ['chartDistro','chartInvTipo','chartGastosCat'].forEach(k => {
        if (chartInstances[k]) { try { chartInstances[k].resize(); } catch(e) {} }
      });
      if (!chartInstances.chartDistro || !chartInstances.chartInvTipo) renderDashboard();
    }, 150);
  }
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted && currentTab === 'dashboard') setTimeout(() => renderDashboard(), 150);
});

let _barObserver = null;
function _observeBarCharts() {
  if (_barObserver) { _barObserver.disconnect(); _barObserver = null; }
  if (typeof IntersectionObserver === 'undefined') return;
  const ids = ['chartDistro','chartInvTipo','chartGastosCat'];
  _barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const k = entry.target.id;
      if (chartInstances[k]) { try { chartInstances[k].resize(); } catch(e) {} }
      else if (currentTab === 'dashboard') renderDashboard();
    });
  }, { threshold: 0.1 });
  ids.map(id => document.getElementById(id)).filter(Boolean).forEach(el => _barObserver.observe(el));
}
let _lastLocalSave = 0;
let _chartRange = 'all';
let _chartRange2 = 'all';

const CHART_INTERVALS = [
  { key:'1m',  label:'1 month',   months:1  },
  { key:'3m',  label:'3 months', months:3  },
  { key:'6m',  label:'6 months', months:6  },
  { key:'1y',  label:'1 year',   months:12 },
  { key:'3y',  label:'3 years',  months:36 },
  { key:'5y',  label:'5 years',  months:60 },
  { key:'7y',  label:'7 years',  months:84 },
  { key:'10y', label:'10 years', months:120},
];

let _projKey = '1y';

function setChartRange2(range) {
  _chartRange2 = range;
  if(chartInstances.chartComp){chartInstances.chartComp.destroy();delete chartInstances.chartComp;}
  renderDashboard();
}
function switchChartTab(tab) {
  const paneEvo  = document.getElementById('paneEvo');
  const paneComp = document.getElementById('paneComp');
  const rangeEvo  = document.getElementById('rangeEvoRow');
  const rangeComp = document.getElementById('rangeCompRow');
  const tabEvo  = document.getElementById('tabEvoBtn');
  const tabComp = document.getElementById('tabCompBtn');
  if (!paneEvo||!paneComp) return;
  const isEvo = tab === 'evo';
  paneEvo.style.display  = isEvo ? '' : 'none';
  paneComp.style.display = isEvo ? 'none' : '';
  if(rangeEvo)  rangeEvo.style.display  = isEvo ? 'flex' : 'none';
  if(rangeComp) rangeComp.style.display = isEvo ? 'none' : 'flex';
  if(tabEvo){
    tabEvo.style.color       = isEvo ? 'var(--blue)' : 'var(--text2)';
    tabEvo.style.fontWeight  = isEvo ? '600' : '500';
    tabEvo.style.borderBottom = isEvo ? '2px solid var(--blue)' : '2px solid transparent';
  }
  if(tabComp){
    tabComp.style.color       = isEvo ? 'var(--text2)' : 'var(--blue)';
    tabComp.style.fontWeight  = isEvo ? '500' : '600';
    tabComp.style.borderBottom = isEvo ? '2px solid transparent' : '2px solid var(--blue)';
  }
}
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
  btn.innerHTML = isOpen ? '▲ ' + t('hideControls') : '▼ ' + t('showControls');
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
  const tc = settings.tipoCambio || 18;
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
  const totalRendPlats = plats.reduce((s,p) => s + (p.rendimiento||0), 0);
  const totalRendInv = tickers.reduce((s,t) => {
    const gp = t.gpNoRealizada !== null ? t.gpNoRealizada : 0;
    return s + (t.moneda === 'MXN' ? gp : gp * tc);
  }, 0);
  const gananciaReal = totalRendPlats + totalRendInv;
  const capitalBase = Math.max(0, Math.round(patrimonioTotal - gananciaReal));
  savePatrimonioSnapshot(patrimonioTotal, capitalBase);
}

function savePatrimonioSnapshot(value, capital) {
  const todayStr = today();
  const existingIndex = patrimonioHistory.findIndex(s => s.date === todayStr);
  const newSnapshot = { date: todayStr, value: Math.round(value), capital: Math.round(capital || value) };
  if (existingIndex === -1) { patrimonioHistory.push(newSnapshot); if (patrimonioHistory.length > 3650) patrimonioHistory = patrimonioHistory.slice(-3650); }
  else { patrimonioHistory[existingIndex] = newSnapshot; }
  LS.set('patrimonioHistory', patrimonioHistory);
}

function buildHistoricalSnapshots() {
  const tc = settings.tipoCambio || 18;
  const eurmxn = getEurMxn();
  const todayStr = today();
  const fechas = new Set();
  movements.forEach(m => { if (m.fecha && m.fecha < todayStr) fechas.add(m.fecha); });
  platforms.forEach(p => { if (p.fechaInicio && p.fechaInicio < todayStr) fechas.add(p.fechaInicio); });
  if (fechas.size === 0) return;
  patrimonioHistory = patrimonioHistory.filter(s => !s.synthetic);
  const fechasOrdenadas = [...fechas].sort();
  const capitalPorFecha = [];
  fechasOrdenadas.forEach(fecha => {
    if (patrimonioHistory.find(s => s.date === fecha)) return;
    let capitalPlats = 0;
    platforms.forEach(p => {
      if (p.fechaInicio && p.fechaInicio > fecha) return;
      const toMXN = v => p.moneda === 'USD' ? v*tc : p.moneda === 'EUR' ? v*eurmxn : v;
      capitalPlats += toMXN(p.saldoInicial || 0);
      movements.filter(m => m.seccion === 'plataformas' && m.platform === p.name && m.fecha <= fecha).forEach(m => {
        if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') capitalPlats += toMXN(m.monto || 0);
        if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida' || m.tipoPlat === 'Gasto') capitalPlats -= toMXN(m.monto || 0);
      });
    });
    let capitalInv = 0;
    movements.filter(m => m.seccion === 'inversiones' && m.tipoMov === 'Compra' && m.fecha <= fecha)
      .forEach(m => { const monto = m.montoTotal || (m.cantidad||0)*(m.precioUnit||0); capitalInv += m.moneda==='MXN' ? monto : monto*tc; });
    movements.filter(m => m.seccion === 'inversiones' && m.tipoMov === 'Venta' && m.fecha <= fecha)
      .forEach(m => { const monto = m.montoTotal || (m.cantidad||0)*(m.precioUnit||0); capitalInv -= m.moneda==='MXN' ? monto : monto*tc; });
    const capital = Math.round(capitalPlats + Math.max(0, capitalInv));
    if (capital > 0) capitalPorFecha.push({ date: fecha, capital });
  });
  if (capitalPorFecha.length === 0) return;
  const todaySnap = patrimonioHistory.find(s => s.date === todayStr && !s.synthetic);
  const gananciaHoy = todaySnap ? todaySnap.value - (todaySnap.capital || todaySnap.value) : 0;
  const fechaInicio = new Date(capitalPorFecha[0].date);
  const fechaHoy = new Date(todayStr);
  const diasTotal = Math.max(1, (fechaHoy - fechaInicio) / (1000*60*60*24));
  capitalPorFecha.forEach(({ date, capital }) => {
    const diasDesdeInicio = (new Date(date) - fechaInicio) / (1000*60*60*24);
    const progreso = diasDesdeInicio / diasTotal;
    const gananciaInterpolada = Math.round(gananciaHoy * progreso);
    patrimonioHistory.push({ date, value: capital + gananciaInterpolada, capital, synthetic: true });
  });
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
    let totalAportaciones = 0, totalRetiros = 0, totalGastos = 0;
    let aportacionesDetalle = [];
    let rendimientoMov = 0;
    movs.forEach(m => {
      if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') {
        saldoBase += m.monto; totalAportaciones += m.monto;
        aportacionesDetalle.push({ fecha: m.fecha, monto: m.monto, tipo: m.tipoPlat, desc: m.desc });
      } else if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida') {
        saldoBase -= m.monto; totalRetiros += m.monto;
      } else if (m.tipoPlat === 'Gasto') {
        saldoBase -= m.monto; totalGastos += m.monto;
      } else if (m.tipoPlat === 'Saldo Actual') {
        const saldoEsperado = saldoBase;
        rendimientoMov += (m.monto - saldoEsperado);
        saldoBase = m.monto;
        ultimoSaldoFecha = m.fecha; ultimoSaldoValor = m.monto;
      } else if (m.tipoPlat === 'Saldo Archivado') {
        rendimientoMov += (m.gananciaHistorica || 0);
        saldoBase = m.monto;
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

function applyRecurrentes() {
  const now=new Date();
  const cm=now.getMonth()+1, cy=now.getFullYear(), cd=now.getDate();
  const applied=settings.recurrentesApplied||{};
  const key=`${cy}-${cm}`;
  const fullyApplied = applied[key] === true;
  let count=0;
  recurrentes.filter(r=>r.activo).forEach(r=>{
    const exists=movements.some(m=>m.seccion==='gastos'&&m.recurrenteId===r.id&&m.fecha.startsWith(`${cy}-${String(cm).padStart(2,'0')}`));
    if(!exists){
      const dia=r.dia||1;
      if(!fullyApplied || dia <= cd){
        const fechaMov=`${cy}-${String(cm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        movements.unshift({id:uid(),seccion:'gastos',fecha:fechaMov,categoria:r.categoria,tipo:'Gasto',importe:r.importe,notas:r.nombre+' (auto)',recurrenteId:r.id,esRecurrente:true});
        count++;
      }
    }
  });
  if(count>0){ if(!settings.recurrentesApplied)settings.recurrentesApplied={}; settings.recurrentesApplied[key]=true; LS.set('movements',movements);LS.set('settings',settings); }
  return count;
}

function loadFromRemote(remote){
  if(Date.now()-_lastLocalSave<3000) return;
  if(remote.platforms)platforms=remote.platforms.map(p=>({tasaAnual:0,fechaInicio:today(),moneda:'MXN',...p}));
  if(remote.goals)goals=remote.goals;
  if(remote.settings){
    const localAiKeys = settings.aiKeys;
    settings={...DEFAULT_SETTINGS,...remote.settings};
    if(!settings.aiKeys && localAiKeys) settings.aiKeys = localAiKeys;
  }
  if(remote.recurrentes)recurrentes=remote.recurrentes;
  LS.set('platforms',platforms);LS.set('goals',goals);LS.set('settings',settings);
  LS.set('recurrentes',recurrentes);
  window.settings = settings;
}
window.loadFromRemote = loadFromRemote;
window.getAppData = () => ({platforms,movements,goals,settings,recurrentes,patrimonioHistory});
window.currentTab = 'dashboard';

function saveAll(changedMovId, deletedMovId, changedSnapDate){
  window.currentTab = currentTab;
  window.settings = settings;
  _lastLocalSave = Date.now();
  const applied = applyRecurrentes();
  if (applied > 0) window._recurrentesAppliedThisSession = applied;
  LS.set('platforms',platforms);LS.set('movements',movements);LS.set('goals',goals);LS.set('settings',settings);
  LS.set('recurrentes',recurrentes);LS.set('patrimonioHistory',patrimonioHistory);
  _recalcAndSaveSnapshot();
  // Renderizar inmediatamente con los datos actuales para que la UI responda al instante
  // No re-renderizar si hay un input inline activo en plataformas (editPlatField)
  const _activeInPlat = document.activeElement &&
    document.getElementById('page-plataformas') &&
    document.getElementById('page-plataformas').contains(document.activeElement) &&
    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
  if (!_activeInPlat) renderPageInternal(currentTab);
  // buildHistoricalSnapshots es costoso — debounce para que cambios rápidos consecutivos
  // (ej: eliminar varios movimientos seguidos) no apilen múltiples reconstrucciones
  clearTimeout(window._snapshotDebounce);
  window._snapshotDebounce = setTimeout(() => {
    buildHistoricalSnapshots();
    LS.set('patrimonioHistory', patrimonioHistory);
  }, 300);
  if (!_isOnline) { queueSave(window.getAppData()); setOfflineBanner('offline'); }
  else if(typeof window.saveToFirebase==='function') {
    window.saveToFirebase(false, changedMovId, deletedMovId, changedSnapDate);
  }
}

// ==================== ANALYTICS ====================
// Guarda eventos en Firestore: usuarios/{uid}/analytics/{fecha}
// Cada documento es un dia. Se acumulan eventos por tab y sesion.
// Para ver los datos: Firebase Console -> Firestore -> usuarios -> {uid} -> analytics
const _analytics = {
  _sessionStart: Date.now(),
  _tabStart: Date.now(),
  _lastTab: null,

  tabView(tab) {
    try {
      const uid = window._currentUser && window._currentUser.uid;
      if (!uid) return;
      const now = Date.now();
      const timeInPrev = this._lastTab ? Math.round((now - this._tabStart) / 1000) : 0;
      this._flush(uid, {
        type: 'tab_view',
        tab: tab,
        prevTab: this._lastTab,
        timeInPrevSecs: timeInPrev,
        ts: new Date().toISOString(),
      });
      this._lastTab = tab;
      this._tabStart = now;
    } catch(e) {}
  },

  event(name, data) {
    try {
      data = data || {};
      const uid = window._currentUser && window._currentUser.uid;
      if (!uid) return;
      const payload = Object.assign({ type: 'event', name: name, ts: new Date().toISOString() }, data);
      this._flush(uid, payload);
    } catch(e) {}
  },

  async _flush(uid, payload) {
    try {
      const fb = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const dateStr = new Date().toISOString().slice(0, 10);
      const ref = fb.doc(db, 'usuarios', uid, 'analytics', dateStr);
      const snap = await fb.getDoc(ref);
      const existing = snap.exists() ? (snap.data().events || []) : [];
      if (existing.length >= 200) return;
      await fb.setDoc(ref, { events: [...existing, payload], date: dateStr }, { merge: true });
    } catch(e) {}
  },
};
window._analytics = _analytics;
// ==================== FIN ANALYTICS ====================

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
  _analytics.tabView(tab);
  renderPageInternal(tab);
}
document.querySelectorAll('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
function openModal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modalOverlay').classList.add('open');}
function closeModal(){document.getElementById('modalOverlay').classList.remove('open');}

function typeBadge(type){const map={'SOFIPO':'badge-green','BANCO':'badge-blue','BOLSA/ETFs':'badge-orange','CUENTA DIGITAL':'badge-purple','FONDOS':'badge-purple','FONDOS RETIRO':'badge-purple','DEUDA/CETES':'badge-blue'};return`<span class="badge ${map[type]||'badge-blue'}">${type}</span>`;}
function monedaBadge(moneda){return`<span class="moneda-flag moneda-${moneda||'MXN'}">${moneda==='USD'?'🇺🇸 USD':moneda==='EUR'?'🇪🇺 EUR':'🇲🇽 MXN'}</span>`;}
function secBadge(sec){const map={plataformas:['PLATFORM','badge-blue'],inversiones:['INVESTMENT','badge-green'],gastos:['EXPENSE','badge-orange'],transferencia:['TRANSFER','badge-teal']};const[label,cls]=map[sec]||['—',''];return`<span class="badge ${cls}">${label}</span>`;}
function catName(id){const c=EXPENSE_CATS.find(x=>x.id===id);return c?c.icon+' '+c.name:id;}
function statCard(label,value,sub,color,borderColor){
  let tint='';
  if(borderColor){if(borderColor.includes('green'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(48,209,88,0.04) 100%);';else if(borderColor.includes('red'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(255,69,58,0.04) 100%);';else if(borderColor.includes('blue'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(10,132,255,0.04) 100%);';else if(borderColor.includes('orange'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(255,159,10,0.04) 100%);';else if(borderColor.includes('purple')||borderColor.includes('BF5AF2'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(191,90,242,0.04) 100%);';else if(borderColor.includes('C7BE')||borderColor.includes('teal'))tint='background:linear-gradient(160deg,var(--card) 0%,rgba(0,199,190,0.04) 100%);';}
  const accent=borderColor?'border-top:3px solid '+borderColor+';':'';
  return '<div class="card stat" style="'+accent+tint+'">'+'<div class="stat-label">'+label+'</div>'+'<div class="stat-value" style="'+(color?'color:'+color:'')+' ">'+value+'</div>'+(sub?'<div class="stat-sub">'+sub+'</div>':'')+'</div>';
}

function getTickerPositions(){
  const tickers={};
  movements.filter(m=>m.seccion==='inversiones' && m.ticker).forEach(m=>{
    const t=m.ticker.toUpperCase();
    const moneda=(m.moneda||'USD').toUpperCase();
    const key = moneda==='MXN' ? t+'_MXN' : t;
    if(!tickers[key])tickers[key]={ticker:t,type:m.tipoActivo,moneda,cantC:0,cantV:0,costoTotal:0,ventasTotal:0,comisionTotal:0,dividendoTotal:0,movs:[],brokers:{}};
    if(m.tipoMov==='Compra'){tickers[key].cantC+=m.cantidad||0;tickers[key].costoTotal+=(m.montoTotal||0)+(m.comision||0);tickers[key].comisionTotal+=m.comision||0;}
    if(m.tipoMov==='Venta'){tickers[key].cantV+=m.cantidad||0;tickers[key].ventasTotal+=m.montoTotal||0;tickers[key].comisionTotal+=m.comision||0;}
    if(m.tipoMov==='Dividendo'){tickers[key].dividendoTotal+=(m.montoTotal||m.precioUnit||0);}
    if(m.tipoMov==='Comisión'){tickers[key].costoTotal+=(m.montoTotal||m.precioUnit||0);tickers[key].comisionTotal+=(m.montoTotal||m.precioUnit||0);}
    tickers[key].movs.push(m);
    // Track per-broker breakdown
    const broker=m.broker||'';
    if(broker){
      if(!tickers[key].brokers[broker])tickers[key].brokers[broker]={cantC:0,cantV:0,costoTotal:0};
      if(m.tipoMov==='Compra'){tickers[key].brokers[broker].cantC+=m.cantidad||0;tickers[key].brokers[broker].costoTotal+=m.montoTotal||0;}
      if(m.tipoMov==='Venta'){tickers[key].brokers[broker].cantV+=m.cantidad||0;}
    }
  });
  return Object.values(tickers).map(tkp=>{
    tkp.cantActual=tkp.cantC-tkp.cantV;
    // precioCostoPromedio ya incluye comisiones de compra en costoTotal
    tkp.precioCostoPromedio=tkp.cantC>0?tkp.costoTotal/tkp.cantC:0;
    // Resolve per-broker available quantities
    tkp.brokersSaldo=Object.entries(tkp.brokers||{}).map(([br,b])=>({broker:br,cantActual:Math.max(0,b.cantC-b.cantV),precioCostoPromedio:b.cantC>0?b.costoTotal/b.cantC:0})).filter(b=>b.cantActual>0);
    const pi=getPriceInfo(tkp.ticker,tkp.type,tkp.moneda);
    tkp.precioActual=pi.price;tkp.priceLabel=pi.label;tkp.priceCssClass=pi.cssClass;tkp.priceTooltip=pi.tooltip||'';
    tkp.valorActual=tkp.precioActual&&tkp.cantActual>0?tkp.cantActual*tkp.precioActual:null;
    tkp.costoPosicion=tkp.cantActual*tkp.precioCostoPromedio;
    // gpNoRealizada: valor actual vs costo (comisiones ya están en el costo)
    tkp.gpNoRealizada=tkp.valorActual!==null?tkp.valorActual-tkp.costoPosicion:null;
    tkp.pctNoRealizada=tkp.costoPosicion>0&&tkp.gpNoRealizada!==null?tkp.gpNoRealizada/tkp.costoPosicion:null;
    // gpRealizada: incluye dividendos recibidos
    tkp.gpRealizada=(tkp.cantV>0?tkp.ventasTotal-(tkp.precioCostoPromedio*tkp.cantV):0)+(tkp.dividendoTotal||0);
    return tkp;
  });
}

function getBudgetAlerts(){
  const alerts=[];
  const cm=new Date().getMonth()+1,cy=new Date().getFullYear();
  const budgets=settings.budgets||{};
  const eurmxn=getEurMxn();
  const ingresos=settings.ingresos||{};
  const monedaMostrar=ingresos.monedaSueldo||'EUR';
  const fx=_fxCache||LS.get('fxCache');
  const usdeur=fx?.usdeur||(settings.tipoCambio&&settings.tipoEUR?settings.tipoCambio/settings.tipoEUR:0.88);
  const gbpeur=fx?(fx.usdeur/(fx.usdgbp||1)):1.17;
  // Convert a movement's importe (always stored in MXN) back to EUR
  const movToEUR=m=>{
    if(m.montoOriginal!=null&&m.monedaOrig==='EUR')return m.montoOriginal;
    if(m.montoOriginal!=null&&m.monedaOrig==='USD')return m.montoOriginal*usdeur;
    if(m.montoOriginal!=null&&m.monedaOrig==='GBP')return m.montoOriginal*gbpeur;
    if(m.notas){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
    return Math.round((m.importe||0)/eurmxn*100)/100;
  };
  // Convert EUR value to display currency
  const eurToDisp=v=>{
    if(monedaMostrar==='EUR')return v;
    if(monedaMostrar==='MXN')return v*eurmxn;
    if(monedaMostrar==='USD')return v/usdeur;
    if(monedaMostrar==='GBP')return v*gbpeur;
    return v;
  };
  const sym={EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[monedaMostrar]||'€';
  const fmtA=v=>sym+(eurToDisp(v)).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
  const mesMovs=movements.filter(m=>{const d=new Date(m.fecha);return m.seccion==='gastos'&&m.tipo==='Gasto'&&d.getMonth()+1===cm&&d.getFullYear()===cy;});
  const byCat={};mesMovs.forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+movToEUR(m);});
  EXPENSE_CATS.forEach(cat=>{
    const pres=budgets[cat.id]||0,real=byCat[cat.id]||0;
    if(pres>0){
      const pct=real/pres;
      if(pct>1.001)alerts.push({level:'error',msg:`🔴 <strong>${cat.icon} ${cat.name}</strong>: ${t('budgetExceeded')} (${fmtA(real)} / ${fmtA(pres)})`});
    }
  });
  // Total monthly budget check
  const totalPres=EXPENSE_CATS.reduce((s,cat)=>s+(budgets[cat.id]||0),0);
  const totalReal=EXPENSE_CATS.reduce((s,cat)=>s+(byCat[cat.id]||0),0);
  if(totalPres>0&&totalReal>totalPres*1.001&&!alerts.some(a=>a.level==='error')){
    alerts.unshift({level:'warn',msg:`🟡 ${t('sobrePresupuesto')}: ${fmtA(totalReal)} / ${fmtA(totalPres)}`});
  }
  return alerts;
}

function showAportaciones(platformId) {
  const plats = calcPlatforms();
  const p = plats.find(p => p.id === platformId);
  if (!p || !p.aportacionesDetalle || p.aportacionesDetalle.length === 0) { alert(t('noContributions')); return; }
  let html = `<div class="modal-header"><div class="modal-title">📋 ${t('contributionDetails')} - ${p.name}</div><button class="modal-close" onclick="closeModal()">✕</button></div>`;
  html += `<table style="width:100%"><thead><tr><th>${t('fecha')}</th><th>${t('tipo')}</th><th>${t('monto')}</th><th>${t('descripcion')}</th></tr></thead><tbody>`;
  p.aportacionesDetalle.forEach(d => { html += `<tr><td>${d.fecha}</td><td>${d.tipo}</td><td>${fmtPlat(d.monto, p.moneda)}</td><td>${d.desc || '—'}</td></tr>`; });
  html += '</tbody></table>';
  openModal(html);
}
window.showAportaciones = showAportaciones;

function getEurMxn(){
  const fx=_fxCache||LS.get('fxCache');
  if(fx&&fx.eurmxn) return fx.eurmxn;
  return settings.tipoEUR;
}

function platSaldoToMXN(p) {
  const tc = settings.tipoCambio || 18;
  const eurmxn = getEurMxn();
  const saldo = p.saldo || 0;
  if (p.moneda === 'USD') return saldo * tc;
  if (p.moneda === 'EUR') return saldo * eurmxn;
  return saldo;
}

// ============================================
// RENDER DASHBOARD
// ============================================

// Toggle series visibility in chartEvo
if (!window._hiddenSeries) window._hiddenSeries = new Set();
window._toggleEvoSeries = function(key) {
  if (window._hiddenSeries.has(key)) window._hiddenSeries.delete(key);
  else window._hiddenSeries.add(key);
  const chart = chartInstances && chartInstances.chartEvo;
  if (chart) {
    // Match datasets by label substring — robust to order changes
    const labelMap = {
      patrimonio: s => s.includes('atrimonio'),
      ganancia:   s => s.includes('anancia real') || s.includes('eal Gain'),
      sp500:      s => s.includes('S&P'),
      nasdaq:     s => s.includes('NASDAQ') || s.includes('QQQ'),
      rendPlat:   s => s.includes('Plataformas') || s.includes('Platforms'),
      gpInv:      s => s.includes('No Realizada') || s.includes('Unrealized'),
    };
    chart.data.datasets.forEach(ds => {
      for (const [k, test] of Object.entries(labelMap)) {
        if (test(ds.label || '')) { ds.hidden = window._hiddenSeries.has(k); break; }
      }
    });
    chart.update('none');
    // Update chip styles
    const leg = document.getElementById('chartEvoLegend');
    if (leg) {
      leg.querySelectorAll('span[onclick]').forEach(el => {
        const k = el.getAttribute('onclick').match(/'([^']+)'/)?.[1];
        if (k) {
          const hidden = window._hiddenSeries.has(k);
          el.style.opacity = hidden ? '0.35' : '1';
          el.style.borderColor = hidden ? 'var(--border)' : 'transparent';
        }
      });
    }
  }
};

function _renderHTMLBars(containerId, entries, total, fmtFn, colorArr) {
  const el = document.getElementById(containerId);
  if (!el || !entries.length) return;
  const max = entries[0][1];
  el.innerHTML = entries.map(([label, val], i) => {
    const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0';
    const barW = max > 0 ? (val / max * 100).toFixed(1) : '0';
    const col = colorArr[i % colorArr.length];
    return \`<div style="display:flex;align-items:center;gap:8px;padding:3px 4px">
      <div style="font-size:11px;color:var(--text2);width:90px;flex-shrink:0;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${label}</div>
      <div style="flex:1;height:14px;background:var(--card2);border-radius:7px;overflow:hidden">
        <div style="height:100%;width:\${barW}%;background:\${col};border-radius:7px;transition:width 0.4s ease"></div>
      </div>
      <div style="font-size:11px;color:var(--text3);width:38px;flex-shrink:0;text-align:right">\${pct}%</div>
    </div>\`;
  }).join('');
}

function renderDashboard(){
  const tc=settings.tipoCambio,re=settings.rendimientoEsperado??0.06;
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
  const riskLvl=maxConc>0.4?'🔴 HIGH':maxConc>0.25?'🟡 MEDIUM':'🟢 LOW';
  const platsConTasa=plats.filter(p=>(p.tasaAnual||0)>0).length;
  const todayIso = today();
  const platsSinActualizar = plats.filter(p => {
    const movsSaldoActual = movements.filter(m => m.seccion==='plataformas' && m.platform===p.name && m.tipoPlat==='Saldo Actual');
    return movsSaldoActual.length === 0 && (p.tasaAnual||0) === 0;
  });
  const tickerList=getTickerPositions();
  const tickerListUSD=tickerList.filter(tk=>tk.moneda!=='MXN');
  const tickerListMXN=tickerList.filter(tk=>tk.moneda==='MXN');
  const totalUSDCurrent=tickerListUSD.reduce((s,tk)=>s+(tk.valorActual||tk.costoPosicion||0),0);
  const totalInvertidoUSD=tickerListUSD.reduce((s,tk)=>s+tk.costoTotal,0);
  const totalMXNCurrent=tickerListMXN.reduce((s,tk)=>s+(tk.valorActual||tk.costoPosicion||0),0);
  const gpNoRealizadaTotal=tickerList.reduce((s,tk)=>s+(tk.gpNoRealizada||0)*(tk.moneda==='MXN'?1:tc),0);
  const gpRealizadaTotal=tickerList.reduce((s,tk)=>s+(tk.gpRealizada||0)*(tk.moneda==='MXN'?1:tc),0);

  const ingresos=settings.ingresos||{};
  const monedaSueldo = ingresos.monedaSueldo || 'EUR';
  const salaryIsEUR = monedaSueldo === 'EUR';
  const sueldoEUR = salaryIsEUR ? (ingresos.sueldoRaw||0) : (ingresos.sueldo||0);
  const extrasEUR = ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR = ingresos.otrosEUR||ingresos.otros||0;
  const ingresoMensualEUR = sueldoEUR + extrasEUR + otrosEUR;
  const dashCur = monedaSueldo;
  const fxD = _fxCache||LS.get('fxCache');
  const usdeurD = fxD?.usdeur||(settings.tipoCambio&&settings.tipoEUR?settings.tipoCambio/settings.tipoEUR:0.88);
  const gbpeurD = fxD?(fxD.usdeur/(fxD.usdgbp||1)):(settings.tipoGBP&&settings.tipoEUR?settings.tipoEUR/settings.tipoGBP:1.17);
  const eurToDash = v => {
    if(monedaSueldo==='EUR') return v;
    if(monedaSueldo==='USD') return v/usdeurD;
    if(monedaSueldo==='MXN') return v*eurmxn;
    if(monedaSueldo==='GBP') return v/gbpeurD;
    return v;
  };
  const dashSymbol = {EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[monedaSueldo]||'€';
  const fmtD = v => dashSymbol + eurToDash(Number(v||0)).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});

  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesG=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Gasto';});
  const mesI=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Ingreso';});

  const toDisplayCur = m => {
    if(m.monedaOrig==='EUR'){const v=m.montoOriginal!=null?m.montoOriginal:(()=>{const match=m.notas&&m.notas.match(/€([\d.]+)/);return match?Number(match[1]):(m.importeEUR||Math.round(m.importe/eurmxn*100)/100);})();if(monedaSueldo==='EUR')return v;return eurToDash(v);}
    if(m.monedaOrig==='USD'){const v=m.montoOriginal!=null?m.montoOriginal:(()=>{const match=m.notas&&m.notas.match(/US\$([\d.]+)/);return match?Number(match[1]):Math.round(m.importe/(usdeurD?(1/usdeurD)*eurmxn:eurmxn)*100)/100;})();if(monedaSueldo==='USD')return v;return eurToDash(v*usdeurD);}
    if(m.monedaOrig==='GBP'){const v=m.montoOriginal!=null?m.montoOriginal:(()=>{const match=m.notas&&m.notas.match(/£([\d.]+)/);return match?Number(match[1]):Math.round(m.importe/((1/gbpeurD)*eurmxn)*100)/100;})();if(monedaSueldo==='GBP')return v;return eurToDash(v/gbpeurD);}
    const valEUR=Math.round(m.importe/eurmxn*100)/100;
    return eurToDash(valEUR);
  };

  const totGastoMes=mesG.reduce((s,m)=>s+toDisplayCur(m),0);
  const totIngMes=mesI.reduce((s,m)=>s+toDisplayCur(m),0);
  const ingReferenciaBalance=totIngMes>0?totIngMes:eurToDash(ingresoMensualEUR);
  const balMes=ingReferenciaBalance-totGastoMes;
  const pctAhorro=ingReferenciaBalance>0?balMes/ingReferenciaBalance:0;
  const salud=pctAhorro>=0.2?'🟢 '+t('optimal'):pctAhorro>=0.1?'🟡 '+t('acceptable'):pctAhorro>=0?'🟠 '+t('tight'):t('deficit');
  const byCat={};mesG.forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+toDisplayCur(m);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalInvMXN=tickerListUSD.reduce((s,tk)=>s+(tk.valorActual||tk.costoPosicion||0)*tc,0)+totalMXNCurrent;
  const patrimonio=totalMXN+totalInvMXN;
  const budgets=settings.budgets||{};
  const totalPresupuesto=EXPENSE_CATS.reduce((s,c)=>s+(budgets[c.id]||0),0);
  const pctPresUsado=totalPresupuesto>0?totGastoMes/totalPresupuesto:0;
  const priceSummary=getPriceSummary();
  const hasFinnhub=!!(settings.finnhubKey);
  const bannerStatus=priceSummary.live>0
    ?`<span class="price-banner-dot dot-live"></span><strong style="color:var(--green)">${priceSummary.live}/${priceSummary.total} ${t('pricesUpdatedToday')}</strong>`
    :`<span class="price-banner-dot dot-none"></span><span style="color:var(--text2)">${priceSummary.total>0?t('sinPreciosDia'):t('sinInversiones')}</span>`;
  const btnLabel=priceUpdateState.loading?`<span class="spinner"></span> ${t('actualizando')}`:t('actualizarPrecios');
  const alerts=getBudgetAlerts();
  const alertsHtml=alerts.length>0?`<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">${alerts.map(a=>`<div style="padding:6px 14px;background:${a.level==='error'?'rgba(255,69,58,0.06)':'rgba(255,159,10,0.06)'};border:1px solid ${a.level==='error'?'rgba(255,69,58,0.2)':'rgba(255,159,10,0.2)'};border-radius:10px;font-size:13px">${a.msg}</div>`).join('')}</div>`:'';
  const platsSinActualizarHtml = platsSinActualizar.length > 0
    ? `<div style="display:flex;align-items:center;gap:10px;padding:6px 14px;background:rgba(10,132,255,0.05);border:1px solid rgba(10,132,255,0.15);border-radius:10px;font-size:12px;margin-bottom:10px">
        <span style="font-size:16px">ℹ️</span>
        <span><strong style="color:var(--blue)">${platsSinActualizar.length} ${t('plataformasSinSaldoActual').split(' ')[0]}</strong> ${t('plataformasSinSaldoActual').split(' ').slice(1).join(' ')} <em style="color:var(--text3)">(${platsSinActualizar.slice(0,4).map(p=>p.name).join(', ')}${platsSinActualizar.length>4?'…':''})</em></span>
      </div>`
    : '';

  _recalcAndSaveSnapshot();
  const applied = window._recurrentesAppliedThisSession || 0;

  const hist=[...patrimonioHistory].sort((a,b)=>new Date(a.date)-new Date(b.date));

  const todayStr = today();
  const todaySnap = hist.find(s => s.date === todayStr);
  const prevSnap = hist.filter(s => s.date < todayStr).slice(-1)[0];

  function pureYield(snap) {
    if (!snap) return 0;
    const cap = snap.capital || snap.value;
    return snap.value - cap;
  }

  function pureYieldAnchored(snap) {
    return snap.value - (snap.capital || snap.value);
  }

  const tc2 = settings.tipoCambio || 18;
  const eurmxn2 = getEurMxn();
  const plats2 = calcPlatforms();
  const capitalPlatsHoy = plats2.reduce((s,p) => {
    const toMXN = v => p.moneda==='USD' ? v*tc2 : p.moneda==='EUR' ? v*eurmxn2 : v;
    return s + toMXN(p.saldoInicial||0) + toMXN(p.aportacion||0) - toMXN(p.retiro||0) - toMXN(p.gasto||0);
  }, 0);
  const tickers2 = getTickerPositions();
  const capitalInvHoy = tickers2.reduce((s,tk2) => s + (tk2.moneda==='MXN' ? tk2.costoPosicion : tk2.costoPosicion*tc2), 0);
  const capitalHoy = capitalPlatsHoy + capitalInvHoy;
  const tickers2Rend = tickers2.reduce((s,tk2) => {
    const gp = tk2.gpNoRealizada !== null ? tk2.gpNoRealizada : 0;
    return s + (tk2.moneda === 'MXN' ? gp : gp * tc2);
  }, 0);
  const patrimonioRendPuro = plats.reduce((s,p) => s + (p.rendimiento||0), 0) + tickers2Rend;

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
  if (_chartRange !== 'all') {
    let cutoff = new Date();
    if (_chartRange === '1d') {
      cutoff.setDate(cutoff.getDate() - 1);
    } else if (_chartRange === '1w') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (_chartRange === 'ytd') {
      cutoff = new Date(cutoff.getFullYear(), 0, 1);
    } else if (_chartRange === '1m') {
      cutoff.setMonth(cutoff.getMonth() - 1);
    } else if (_chartRange === '1y') {
      cutoff.setMonth(cutoff.getMonth() - 12);
    } else if (_chartRange === '3y') {
      cutoff.setMonth(cutoff.getMonth() - 36);
    }
    const cutoffStr = cutoff.toISOString().split('T')[0];
    histFiltered = hist.filter(s => s.date >= cutoffStr);
    if (histFiltered.length === 0) histFiltered = hist.slice(-2);
  }
  const realDatesFiltered = histFiltered.map(s => s.date);
  const realValsFiltered = histFiltered.map(s => pureYieldAnchored(s));
  const patrimonioValsFiltered = histFiltered.map(s => s.value || 0);

  const curLabel = salaryIsEUR ? '🇪🇺 EUR' : '🇲🇽 MXN';

  const projInterval = CHART_INTERVALS.find(i => i.key === _projKey) || CHART_INTERVALS[3];
  const projMonths = projInterval.months;

  const periodOptions = [
    { key:'1d',  label:'1D',   days:1    },
    { key:'1w',  label:'1W',   days:7    },
    { key:'1m',  label:'1M',   months:1  },
    { key:'ytd', label:'YTD',  ytd:true  },
    { key:'1y',  label:'1Y',   months:12 },
    { key:'3y',  label:'3Y',   months:36 },
    { key:'all', label:t('todo'), months:null },
  ];

  const rangeButtonsHTML = periodOptions.map(r => {
    const isActive = _chartRange === r.key;
    return `<button onclick="setChartRange('${r.key}')" style="padding:4px 10px;border-radius:20px;border:1px solid ${isActive?'var(--blue)':'var(--border)'};background:${isActive?'var(--blue)':'transparent'};color:${isActive?'#fff':'var(--text2)'};font-size:12px;font-weight:${isActive?'700':'500'};cursor:pointer;font-family:var(--font);transition:all 0.15s">${r.label}</button>`;
  }).join('');

  // Botones de rango para la segunda gráfica (chartComp)
  const rangeButtonsHTML2 = periodOptions.map(r => {
    const isActive = _chartRange2 === r.key;
    return `<button onclick="setChartRange2('${r.key}')" style="padding:4px 10px;border-radius:20px;border:1px solid ${isActive?'var(--blue)':'var(--border)'};background:${isActive?'var(--blue)':'transparent'};color:${isActive?'#fff':'var(--text2)'};font-size:12px;font-weight:${isActive?'700':'500'};cursor:pointer;font-family:var(--font);transition:all 0.15s">${r.label}</button>`;
  }).join('');

  const projButtonsHTML = CHART_INTERVALS.map(r => {
    const gain = Math.round(capitalHoy * (Math.pow(1 + re/12, r.months) - 1));
    const isActive = _projKey === r.key;
    return `<button class="chart-ctrl-btn proj-btn ${isActive ? 'active' : ''}" onclick="setChartProj('${r.key}')">
      <span>${r.label}</span>
      <span class="btn-val" style="color:${isActive ? 'inherit' : 'var(--blue)'}">+${fmt(gain)}</span>
    </button>`;
  }).join('');

  let rendAnualReal = null;
  let rentabilidadTotal = null;
  if (hist.length >= 2) {
    const first = hist[0], last = hist[hist.length - 1];
    const diasTotal = (new Date(last.date) - new Date(first.date)) / (1000*60*60*24);
    const capitalActual = last.capital != null ? last.capital : last.value;
    const gananciaActual = last.value - capitalActual;
    if (capitalActual > 0) {
      rentabilidadTotal = gananciaActual / capitalActual;
      if (diasTotal >= 30) {
        rendAnualReal = Math.pow(1 + rentabilidadTotal, 365 / diasTotal) - 1;
      }
    }
  }
  const ayerSnap = hist.filter(s => s.date < todayStr).slice(-1)[0];
  const deltaHoy = ayerSnap ? patrimonio - ayerSnap.value : 0;
  const deltaHoyPct = ayerSnap && ayerSnap.value > 0 ? deltaHoy / ayerSnap.value : 0;

  document.getElementById('page-dashboard').innerHTML=`
    ${applied>0?`<div class="snapshot-banner" style="background:rgba(191,90,242,0.06);border-color:rgba(191,90,242,0.2);margin-bottom:16px"><span class="snap-dot" style="background:var(--purple)"></span><span style="color:var(--purple)">✅ <strong>${applied} ${t('recurrentesAplicadas')}</strong> ${t('esteMes')}</span></div>`:''}
    ${alertsHtml}
    ${platsSinActualizarHtml}

    <div class="grid-8" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">${t('valorPlataformas')}</div><div class="stat-value">${fmt(totalMXN)}</div><div class="stat-sub"><span style="color:${pctCol(totalRend)};font-weight:700">${fmtPct(invInicial?totalRend/invInicial:0)}</span> ${t('return')}</div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">${t('rendPlataformas')}</div><div class="stat-value" style="color:${pctCol(totalRend)}">${fmt(totalRend)}</div><div class="stat-sub">${platsConTasa>0?`<span style="color:var(--teal)">⚡${fmt(totalRendAuto)} ${t('auto')}</span>`:t('rendimientoSobre')}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">${t('valorInversiones')}</div><div class="stat-value">${fmt(totalInvMXN)}</div><div class="stat-sub">${tickerList.length} ${t('posiciones2')} · ${priceSummary.live>0?t('preciosHoy'):t('costoPosicion')}</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">${t('gpTotal')}</div><div class="stat-value" style="color:${pctCol(gpNoRealizadaTotal+gpRealizadaTotal)}">${(gpNoRealizadaTotal+gpRealizadaTotal)>=0?'+':''}${fmt(gpNoRealizadaTotal+gpRealizadaTotal)}</div><div class="stat-sub" style="display:flex;flex-direction:column;gap:1px"><span style="color:var(--text2)">No real.: <span style="color:${pctCol(gpNoRealizadaTotal)};font-weight:600">${gpNoRealizadaTotal>=0?'+':''}${fmt(gpNoRealizadaTotal)}</span></span><span style="color:var(--text2)">Realiz.: <span style="color:${pctCol(gpRealizadaTotal)};font-weight:600">${gpRealizadaTotal>=0?'+':''}${fmt(gpRealizadaTotal)}</span></span></div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">${t('rentabilidadTotal')}</div><div class="stat-value" style="color:${rentabilidadTotal!==null?pctCol(rentabilidadTotal):'var(--text2)'}">${rentabilidadTotal!==null?(rentabilidadTotal>=0?'+':'')+(rentabilidadTotal*100).toFixed(2)+'%':'—'}</div><div class="stat-sub">${rentabilidadTotal!==null?t('sobreCapital'):t('sinHistorial')}</div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">${t('concentracion')}</div><div class="stat-value" style="font-size:14px">${topPlat?.name||'—'}</div><div class="stat-sub"><span style="color:var(--orange);font-weight:700">${(maxConc*100).toFixed(1)}%</span> · ${riskLvl}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">${t('gastosMes')} ${curLabel}</div><div class="stat-value" style="color:${totGastoMes>0?'var(--red)':'var(--text)'}">${fmtD(totGastoMes)}</div><div class="stat-sub">${totalPresupuesto>0?(pctPresUsado*100).toFixed(0)+'% '+t('budget'):totIngMes>0||ingresoMensualEUR>0?fmtD(totIngMes>0?totIngMes:ingresoMensualEUR)+' '+t('income'):''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">${t('balanceMes')} ${curLabel}</div><div class="stat-value" style="color:${pctCol(balMes)}">${fmtD(balMes)}</div><div class="stat-sub">${(pctAhorro*100).toFixed(0)}% ${t('ahorro')}${totIngMes===0&&ingresoMensualEUR>0?` (${t('est')})`:''}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="padding:8px 20px 8px;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;border-bottom:0.5px solid var(--border)">
        <div style="display:flex;align-items:baseline;gap:7px">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:rgba(245,166,35,0.85)">📈 ${t('patrimonioTotal')}</span>
          <span style="font-size:14px;font-weight:800;letter-spacing:-0.02em;color:rgba(245,166,35,0.95)">${fmt(patrimonio)}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;justify-content:center">
          <span style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.04em">${t('gananciaNetaTotal')}</span>
          <span style="font-size:13px;font-weight:800;color:${pctCol(patrimonioRendPuro)}">${patrimonioRendPuro>=0?'+':''}${fmt(patrimonioRendPuro)}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end">
          ${rendAnualReal !== null ? `
          <span style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:600;letter-spacing:0.04em">${t('cagrReal')} <span style="font-weight:400;font-size:9px">${Math.round((new Date(hist[hist.length-1].date)-new Date(hist[0].date))/(1000*60*60*24))}d</span></span>
          <span style="font-size:13px;font-weight:800;color:${pctCol(rendAnualReal)}">${rendAnualReal>=0?'+':''}${(rendAnualReal*100).toFixed(1)}%</span>
          ` : '<span></span>'}
        </div>
      </div>
      <div style="padding:5px 16px 6px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:0.5px solid var(--border)">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center" id="chartEvoLegend">
          ${[
            {key:'patrimonio', label:t('patrimonioTotal2'), color:'rgba(245,166,35,0.95)', solid:true},
            {key:'ganancia',   label:t('gananciaReal'),     color:'#30D158',               solid:false},
            {key:'rendPlat',   label:t('rendPlataformas')+' %', color:'rgba(10,132,255,0.85)', solid:false},
            {key:'gpInv',      label:t('gpNoRealizada')+' %',   color:'rgba(48,209,88,0.85)',  solid:false},
            ...((settings.alphaVantageKey||settings.finnhubKey)?[
              {key:'sp500',  label:'S&P 500 %',   color:'rgba(220,50,80,0.9)',  solid:false},
              {key:'nasdaq', label:'NASDAQ %',     color:'rgba(50,130,240,0.9)', solid:false},
            ]:[])
          ].map(s=>{
            const hidden=window._hiddenSeries&&window._hiddenSeries.has(s.key);
            return `<span onclick="window._toggleEvoSeries('${s.key}')" style="cursor:pointer;font-size:10px;display:flex;align-items:center;gap:3px;padding:2px 6px;border-radius:20px;border:1px solid ${hidden?'var(--border)':'transparent'};opacity:${hidden?0.35:1};transition:all 0.15s"><span style="display:inline-block;width:${s.solid?14:10}px;height:${s.solid?3:2}px;background:${s.color};border-radius:2px;${s.solid?'':'border-top:none'}"></span><span style="color:var(--text2)">${s.label}</span></span>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">${rangeButtonsHTML}</div>
      </div>
      <div style="padding:0 20px 14px">
        <div class="chart-container" style="height:200px">${hist.length < 2 ? `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text3)"><div style="font-size:32px">📈</div><div style="font-size:13px;font-weight:600;color:var(--text2)">${t('graficoApareceraManana')}</div><div style="font-size:11px;text-align:center;max-width:220px;line-height:1.5">${t('necesitas2dias')}<br>${t('vuelveManana')}</div></div>` : `<canvas id="chartEvo"></canvas>`}</div>
      </div>
    </div>

    <div class="grid-1-1-1" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">📊 ${t('distribucionPorTipo')}</div>
        <div id="chartDistro" style="padding:4px 0"></div>
      </div>
      <div class="card">
        <div class="card-title">💼 ${t('inversionesPorTipo')}</div>
        <div id="chartInvTipo" style="padding:4px 0"></div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="card-title" style="margin:0">💳 ${t('gastosPorCat')} — ${MONTHS[cm-1]}</div>
          <button class="btn btn-sm" style="font-size:11px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="switchTab('gastos')">${t('verDetalle')} →</button>
        </div>
        ${topCats.length>0?`
          <div id="chartGastosCat" style="padding:4px 0"></div>
          </div>`
        :`<div style="text-align:center;color:var(--text2);padding:24px;font-size:13px">${t('sinGastosEsteMes')}</div>`}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;align-items:stretch">
      <div class="card" style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="card-title" style="margin:0">🏆 ${t('topPlataformas')}</div></div>
        <div style="max-height:380px;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${[...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a)).slice(0,10).map((p,i)=>`
          <div class="list-item">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="rank" style="background:${COLORS[i]}">${i+1}</div>
              <div><div style="font-size:13px;font-weight:600">${escHtml(p.name)} ${monedaBadge(p.moneda)} ${p.tasaAnual>0?`<span class="tasa-badge${p.tasaAnual>=10?' alta':p.tasaAnual>=5?' media':''}">⚡${p.tasaAnual}%</span>`:''}</div><div style="font-size:10px;color:var(--text2)">${p.type} · ${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</div></div>
            </div>
            <div style="text-align:right"><div style="font-size:13px;font-weight:700">${fmtPlat(p.saldo, p.moneda)}</div><div style="font-size:10px;font-weight:600;color:${pctCol(p.rendimiento)}">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento, p.moneda)}</div></div>
          </div>`).join('')}
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="card-title" style="margin:0">📊 ${t('posiciones')}</div>
          <button class="btn btn-sm" style="font-size:11px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="switchTab('inversiones')">${t('verDetalle')} →</button>
        </div>
        ${tickerList.filter(tk=>tk.cantActual>0).length>0?`
        <div style="display:grid;grid-template-columns:1.1fr 0.6fr 0.9fr 0.9fr 0.9fr;gap:0;margin-bottom:6px;padding:0 4px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Activo</div>
          <div style="font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.05em;text-align:right">Div.</div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;text-align:right">P. Compra</div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;text-align:right">P. Actual</div>
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;text-align:right">G/P</div>
        </div>
        <div style="max-height:340px;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${tickerList.filter(tk=>tk.cantActual>0).sort((a,b)=>b.costoTotal-a.costoTotal).map(tk=>{
          const tipoClass=tk.type==='Acción'?'badge-green':tk.type==='ETF'?'badge-blue':tk.type==='Crypto'?'badge-orange':'badge-gray';
          const cur=tk.moneda==='MXN'?'$':'US$';
          const precioCompra=cur+tk.precioCostoPromedio.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
          const cantStr=tk.cantActual%1===0?tk.cantActual:parseFloat(tk.cantActual.toFixed(4));
          const _gpT=(tk.gpNoRealizada||0)+(tk.dividendoTotal||0);
          const _gpPct=tk.costoPosicion>0?_gpT/tk.costoPosicion:null;
          return`<div style="display:grid;grid-template-columns:1.1fr 0.6fr 0.9fr 0.9fr 0.9fr;gap:0;padding:8px 4px;border-bottom:0.5px solid var(--border)">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <span class="badge ${tipoClass}" style="flex-shrink:0">${tk.ticker}</span>
              <span style="font-size:10px;color:var(--text3);white-space:nowrap">×${cantStr}</span>
            </div>
            <div style="text-align:right;align-self:center">
              ${tk.dividendoTotal>0?`<div style="font-size:11px;font-weight:700;color:var(--blue)">+${fmtFull(tk.dividendoTotal)}</div>`:'<div style="font-size:10px;color:var(--text3)">—</div>'}
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:11px;font-weight:600;color:var(--text2)">${precioCompra}</div>
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:11px;font-weight:700" class="${tk.priceCssClass}">${tk.priceLabel}</div>
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:12px;font-weight:800;color:${pctCol(_gpT)}">${tk.gpNoRealizada!==null?(_gpT>=0?'+':'')+fmtFull(_gpT):'—'}</div>
              <div style="font-size:10px;font-weight:600;color:${pctCol(_gpPct)}">${_gpPct!==null?fmtPct(_gpPct):''}</div>
            </div>
          </div>`;
        }).join('')}
        </div>`
        :'<div style="text-align:center;color:var(--text2);padding:32px">'+t('noTrades')+'</div>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">🎯 ${t('progresoDeMetas')}</div>
        <button class="btn btn-secondary btn-sm" onclick="switchTab('metas')">${t('verTodo')}</button>
      </div>
      ${goals.length>0?`<div class="grid-2">${goals.slice(0,4).map(g=>{let actual=0;const patrimonioTotal=totalMXN+totalInvMXN;if(g.clase==='Patrimonio Total'||g.clase==='Todos')actual=patrimonioTotal;else if(g.clase==='Plataformas')actual=totalMXN;else if(g.clase==='Inversiones')actual=totalInvMXN;else if(g.clase==='Ingreso Mensual')actual=ingresoMensualEUR;else actual=patrimonioTotal;const pct=g.meta>0?actual/g.meta:0;const sc=pct>=1?'var(--green)':pct>=0.8?'var(--orange)':pct>=0.3?'var(--blue)':'var(--text2)';const st=pct>=1?t('lograda'):pct>=0.8?t('casi'):pct>=0.3?t('enProceso'):t('inicio');return`<div style="padding:12px;background:var(--card2);border-radius:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:700">${g.nombre}</div><span style="font-size:11px;font-weight:700;color:${sc}">${st}</span></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:6px"><span style="font-weight:700;color:var(--text)">${fmt(actual)}</span><span>${t('goalLabel')}: ${fmt(g.meta)}</span></div><div class="progress-bg"><div class="progress-fill" style="background:${sc};width:${Math.min(pct*100,100).toFixed(1)}%"></div></div><div style="text-align:right;font-size:11px;font-weight:800;color:${sc};margin-top:4px">${(pct*100).toFixed(1)}%</div></div>`;}).join('')}</div>`:`<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px">${t('sinMetas')} — <button class="btn btn-primary btn-sm" onclick="switchTab('metas')">${t('crear')} →</button></div>`}
    </div>

  `;

  updateNav(patrimonio,totalMXN,totalUSDCurrent,tc,totalRend,deltaHoy,deltaHoyPct);

  // Limpiar cache en memoria si el último valor es 0 (mercado cerrado previo fetch)
  if (_sp500Data?.closes?.[_sp500Data.closes.length-1] === 0) { _sp500Data = null; }
  if (_qqqData?.closes?.[_qqqData.closes.length-1] === 0) { _qqqData = null; }
  // Limpiar cache en LS si el último valor guardado es 0
  const _sp5cache=LS.get('sp500_history');
  if(_sp5cache?.data?.closes?.length && (_sp5cache.data.closes[_sp5cache.data.closes.length-1]===0 || _sp5cache.data.closes.length < 3)) LS.set('sp500_history',null);
  const _qqqcache=LS.get('qqq_history');
  if(_qqqcache?.data?.closes?.length && (_qqqcache.data.closes[_qqqcache.data.closes.length-1]===0 || _qqqcache.data.closes.length < 3)) LS.set('qqq_history',null);

  // Fetch SP500 y QQQ de forma asíncrona — re-renderizar chart cuando lleguen
  const _needSP = !_sp500Data && (settings.alphaVantageKey || settings.finnhubKey);
  const _needQQQ = !_qqqData && (settings.alphaVantageKey || settings.finnhubKey);
  if (_needSP || _needQQQ) {
    const _rerender = () => {
      if (currentTab === 'dashboard') {
        if (chartInstances.chartEvo) { chartInstances.chartEvo.destroy(); delete chartInstances.chartEvo; }
        renderDashboard();
      }
    };
    if (_needSP) fetchSP500History().then(data => {
      if (data?.dates?.length > 0) { _sp500Data = data; _rerender(); }
    }).catch(() => {});
    if (_needQQQ) fetchQQQHistory().then(data => {
      if (data?.dates?.length > 0) { _qqqData = data; _rerender(); }
    }).catch(() => {});
  }

  setTimeout(()=>{
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)';
    const tickColor=isDark?'#636366':'#C7C7CC';

    const realDates = realDatesFiltered;
    const realVals = realValsFiltered;
    const patrimonioVals = patrimonioValsFiltered;

    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const projDates=[];
    const projVals=[];
    projDates.push(todayDateStr);
    projVals.push(0);
    for(let i=1; i<=projMonths; i++){
      const d=new Date(now.getFullYear(), now.getMonth()+i, 1);
      projDates.push(d.toISOString().split('T')[0]);
      projVals.push(Math.round(capitalHoy * (Math.pow(1+re/12, i) - 1)));
    }

    const ctxE=document.getElementById('chartEvo');

    // ── Plugin de glow reutilizable por ambos gráficos ───────────────────
    const _makeGlowPlugin = (id) => ({
      id,
      beforeDatasetDraw(chart, args) {
        const color = args.meta._dataset?.borderColor;
        if (!color || typeof color !== 'string') return;
        chart.ctx.save();
        chart.ctx.shadowColor = color;
        chart.ctx.shadowBlur = 10;
      },
      afterDatasetDraw(chart) {
        chart.ctx.shadowColor = 'transparent';
        chart.ctx.shadowBlur = 0;
        chart.ctx.restore();
      }
    });

    if(ctxE){
      if(chartInstances.chartEvo){chartInstances.chartEvo.destroy();delete chartInstances.chartEvo;}
      const ctx2d = ctxE.getContext('2d');
      const gradReal = ctx2d.createLinearGradient(0, 0, 0, ctxE.offsetHeight || 240);
      gradReal.addColorStop(0, isDark ? 'rgba(48,209,88,0.18)' : 'rgba(48,209,88,0.13)');
      gradReal.addColorStop(0.7, isDark ? 'rgba(48,209,88,0.04)' : 'rgba(48,209,88,0.02)');
      gradReal.addColorStop(1, 'rgba(48,209,88,0)');

      const dynRadius = 0;
      const dynLastRadius = realDates.length > 0 ? 2.3 : 0;

      // ── Mapa de eventos: plataformas + inversiones ───────────────────────
      const _evoEvt = {}; // { 'YYYY-MM-DD': 'aport'|'retiro' }
      const _addEvoEvt = (fecha, isPositive) => {
        if (!fecha) return;
        const d = fecha.substring(0, 10);
        if (!_evoEvt[d] || !isPositive) _evoEvt[d] = isPositive ? 'aport' : 'retiro';
      };
      platforms.forEach(p => { if (p.saldoInicial > 0 && p.fechaInicio) _addEvoEvt(p.fechaInicio, true); });
      movements.forEach(m => {
        if (m.seccion === 'plataformas' && m.fecha) {
          if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') _addEvoEvt(m.fecha, true);
          if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida' || m.tipoPlat === 'Gasto') _addEvoEvt(m.fecha, false);
        }
        if (m.seccion === 'inversiones' && m.fecha) {
          if (m.tipoMov === 'Compra') _addEvoEvt(m.fecha, true);
          if (m.tipoMov === 'Venta')  _addEvoEvt(m.fecha, false);
        }
      });
      // Puntos de evento: radio 3 (sutil), del color de la línea, sin borde
      const _evtRadiusPatrimonio = realDates.map((d, i) => i === realDates.length-1 ? 5 : (_evoEvt[d] ? 3 : 0));
      const _evtRadiusGanancia   = realDates.map((d, i) => i === realDates.length-1 ? 5 : (_evoEvt[d] ? 3 : 0));

      // ── Proyección ajustada al rango visible ────────────────────────
      // Cuántos meses hacia adelante mostrar según el rango seleccionado
      const projMonthsMap = {
        '1d': 0.033,   // ~1 día
        '1w': 0.25,    // ~1 semana
        '1m': 1,
        'ytd': 3,
        '1y': 6,
        '3y': 12,
        'all': projMonths, // usa el selector de proyección completo
      };
      const projMonthsVisible = projMonthsMap[_chartRange] ?? projMonths;

      // ── Línea de proyección: benchmark dinámico ──────────────────────
      // Construimos el capital "invertido neto" en cada fecha del historial,
      // acumulando aportaciones/compras y descontando retiros/ventas/gastos.
      // La proyección muestra cuánto debería valer esa ganancia al re% anual.
      //
      // Fuentes de capital:
      //   + plataformas: saldoInicial en fechaInicio, aportaciones, transferencias entrada
      //   - plataformas: retiros, transferencias salida, gastos
      //   + inversiones: compras (montoTotal)
      //   - inversiones: ventas (montoTotal)

      const projDatesAdj = [];
      const projValsAdj  = [];

      // Recopilar todos los eventos de capital ordenados por fecha
      const _evCap = [];

      // Plataformas: saldo inicial en su fechaInicio
      platforms.forEach(p => {
        if (!p.fechaInicio) return;
        const toMXN = v => p.moneda === 'USD' ? v * tc : p.moneda === 'EUR' ? v * eurmxn : v;
        if (p.saldoInicial > 0) _evCap.push({ fecha: p.fechaInicio, delta: toMXN(p.saldoInicial) });
      });

      // Movimientos de plataformas: aportaciones, retiros, transferencias, gastos
      movements.forEach(m => {
        if (m.seccion !== 'plataformas' || !m.fecha) return;
        const plat = platforms.find(p => p.name === m.platform);
        const toMXN = v => plat?.moneda === 'USD' ? v * tc : plat?.moneda === 'EUR' ? v * eurmxn : v;
        const monto = toMXN(m.monto || 0);
        if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') {
          _evCap.push({ fecha: m.fecha, delta: monto });
        } else if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida' || m.tipoPlat === 'Gasto') {
          _evCap.push({ fecha: m.fecha, delta: -monto });
        }
      });

      // Movimientos de inversiones: compras y ventas
      movements.forEach(m => {
        if (m.seccion !== 'inversiones' || !m.fecha) return;
        const monto = (m.montoTotal || (m.cantidad || 0) * (m.precioUnit || 0));
        const enMXN = m.moneda === 'MXN' ? monto : monto * tc;
        if (m.tipoMov === 'Compra')  _evCap.push({ fecha: m.fecha, delta:  enMXN });
        if (m.tipoMov === 'Venta')   _evCap.push({ fecha: m.fecha, delta: -enMXN });
      });

      // Ordenar por fecha
      _evCap.sort((a, b) => a.fecha.localeCompare(b.fecha));

      if (_evCap.length === 0) {
        // Sin datos: proyección vacía
      } else {
        const _fechaOrigen = _evCap[0].fecha;
        const _origenMs = new Date(_fechaOrigen + 'T00:00:00').getTime();

        // Construir mapa de capital acumulado por fecha
        // Para cada fecha del historial filtrado, calcular el capital neto
        // que existía HASTA esa fecha y proyectar su ganancia esperada.

        // Función: capital neto acumulado hasta una fecha dada (inclusive)
        const capitalHastaFecha = (fechaLimite) => {
          return _evCap
            .filter(e => e.fecha <= fechaLimite)
            .reduce((s, e) => s + e.delta, 0);
        };

        // 2) Trazar sobre puntos históricos filtrados
        for (const snap of histFiltered) {
          const capNeto = Math.max(0, capitalHastaFecha(snap.date));
          const snapMs = new Date(snap.date + 'T00:00:00').getTime();
          // Ganancia proyectada = rendimiento esperado sobre el capital neto
          // usando los días transcurridos desde el origen
          const diasDesde = (snapMs - _origenMs) / (1000 * 60 * 60 * 24);
          const anos = Math.max(0, diasDesde / 365);
          projDatesAdj.push(snap.date);
          projValsAdj.push(Math.round(capNeto * (Math.pow(1 + re, anos) - 1)));
        }

        // 3) Continuar hacia el futuro desde hoy
        const capNeto = Math.max(0, capitalHastaFecha(todayDateStr));
        const diasHoy = (now.getTime() - _origenMs) / (1000 * 60 * 60 * 24);
        const steps = Math.max(4, Math.round(projMonthsVisible * 30));
        for (let i = 1; i <= steps; i++) {
          const frac = i / steps;
          const dAdj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          dAdj.setDate(dAdj.getDate() + Math.round(frac * projMonthsVisible * 30.44));
          const diasTotales = diasHoy + (frac * projMonthsVisible * 30.44);
          const anosTotal = Math.max(0, diasTotales / 365);
          projDatesAdj.push(dAdj.toISOString().split('T')[0]);
          projValsAdj.push(Math.round(capNeto * (Math.pow(1 + re, anosTotal) - 1)));
        }
      }

      // ── Calcular límites X según el rango ──────────────────────────
      let xMin = undefined, xMax = undefined;

      // xMin = inicio del período histórico filtrado
      if (realDates.length > 0) {
        xMin = new Date(realDates[0] + 'T00:00:00').getTime();
      }
      // Para rangos fijos, forzar xMin exacto
      if (_chartRange === '1d') {
        const d = new Date(); d.setDate(d.getDate() - 1);
        xMin = d.getTime();
      } else if (_chartRange === '1w') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        xMin = d.getTime();
      } else if (_chartRange === '1m') {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        xMin = d.getTime();
      } else if (_chartRange === 'ytd') {
        const d = new Date(); d.setMonth(0); d.setDate(1);
        xMin = d.getTime();
      } else if (_chartRange === '1y') {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1);
        xMin = d.getTime();
      } else if (_chartRange === '3y') {
        const d = new Date(); d.setFullYear(d.getFullYear() - 3);
        xMin = d.getTime();
      }

      // xMax = siempre hoy — la proyección futura se recorta al borde del gráfico
      const todayMs = new Date(todayDateStr + 'T23:59:59').getTime();
      xMax = todayMs;
      // ──────────────────────────────────────────────────────────────────

      chartInstances.chartEvo=new Chart(ctxE,{type:'line',plugins:[_makeGlowPlugin('glowEvo')],data:{
        datasets:[
          {
            label: t('patrimonioTotal2'),
            data:realDates.map((d,i)=>({x:d,y:patrimonioVals[i]})),
            borderColor:'rgba(245,166,35,0.95)',
            backgroundColor:'transparent',
            borderWidth:1.5,
            fill:false,
            tension:0.4,
            pointRadius: realDates.map((d,i) => i===realDates.length-1 ? dynLastRadius : (_evoEvt[d] ? 1.5 : 0)),
            pointBackgroundColor: realDates.map((_,i) => i===realDates.length-1 ? (isDark?'#1C1C1E':'#fff') : 'rgba(245,166,35,0.9)'),
            pointBorderColor: realDates.map((_,i) => i===realDates.length-1 ? 'rgba(245,166,35,0.95)' : 'transparent'),
            pointBorderWidth: realDates.map((_,i) => i===realDates.length-1 ? 2 : 0),
            pointHoverRadius:6,
            pointHoverBackgroundColor:'rgba(245,166,35,1)',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff',
            pointHoverBorderWidth:2,
            yAxisID:'y2',
          },
          {
            label: t('gananciaReal'),
            data:(()=>{return realDates.map((d,i)=>({x:d,y:patrimonioVals[i]>0?Math.round(realVals[i]/patrimonioVals[i]*10000)/100:0}));})(),
            borderColor:'#30D158',
            backgroundColor: 'transparent',
            borderWidth:1.5,
            borderDash:[4,3],
            fill:false,
            tension:0.4,
            pointRadius: realDates.map((d,i) => i===realDates.length-1 ? dynLastRadius : (_evoEvt[d] ? 1.5 : 0)),
            pointBackgroundColor: realDates.map((_,i) => i===realDates.length-1 ? (isDark?'#1C1C1E':'#fff') : '#30D158'),
            pointBorderColor: realDates.map((_,i) => i===realDates.length-1 ? '#30D158' : 'transparent'),
            pointBorderWidth: realDates.map((_,i) => i===realDates.length-1 ? 2 : 0),
            pointHoverRadius:6,
            pointHoverBackgroundColor:'#30D158',
            pointHoverBorderColor:isDark?'#1C1C1E':'#fff',
            pointHoverBorderWidth:2,
            yAxisID:'yc',
          },

          ...((()=>{if(!_sp500Data||(!(settings.alphaVantageKey||settings.finnhubKey)))return[];const _ed=[];platforms.forEach(p=>{if(p.fechaInicio)_ed.push(p.fechaInicio);});movements.forEach(m=>{if(m.fecha)_ed.push(m.fecha);});_ed.sort();const _fo=_ed.length>0?_ed[0]:todayDateStr;const _pts=sp500ReturnPct(_sp500Data,_fo);const _d=_pts.filter(p=>!xMin||new Date(p.date+'T00:00:00').getTime()>=xMin).map(p=>({x:p.date,y:p.pct}));if(!_d.length)return[];return[{label:'S&P 500 %',data:_d,borderColor:isDark?'rgba(255,90,120,0.9)':'rgba(220,50,80,0.9)',backgroundColor:'transparent',borderWidth:1.5,fill:false,tension:0.4,pointRadius:_d.map((_,i)=>i===_d.length-1?2:0),pointHoverRadius:4,yAxisID:'yc'}];})()),
          ...((()=>{if(!_qqqData||(!(settings.alphaVantageKey||settings.finnhubKey)))return[];const _edq=[];platforms.forEach(p=>{if(p.fechaInicio)_edq.push(p.fechaInicio);});movements.forEach(m=>{if(m.fecha)_edq.push(m.fecha);});_edq.sort();const _foq=_edq.length>0?_edq[0]:todayDateStr;const _ptsq=sp500ReturnPct(_qqqData,_foq);const _dq=_ptsq.filter(p=>!xMin||new Date(p.date+'T00:00:00').getTime()>=xMin).map(p=>({x:p.date,y:p.pct}));if(!_dq.length)return[];return[{label:'NASDAQ (QQQ) %',data:_dq,borderColor:isDark?'rgba(90,160,255,0.9)':'rgba(50,130,240,0.9)',backgroundColor:'transparent',borderWidth:1.5,fill:false,tension:0.4,pointRadius:_dq.map((_,i)=>i===_dq.length-1?2:0),pointHoverRadius:4,yAxisID:'yc'}];})()),
          ...((()=>{const _pd=hist.filter(s=>!xMin||new Date(s.date+'T00:00:00').getTime()>=xMin).map(s=>{const g=Math.round((s.value-(s.capital||s.value))-(tickerList.reduce((sum,tk)=>{const gp=tk.gpNoRealizada||0;return sum+(tk.moneda==='MXN'?gp:gp*tc);},0)));const cap=s.capital||s.value;return{x:s.date,y:cap>0?Math.round((g/cap)*10000)/100:0};});if(!_pd.length)return[];return[{label:t('rendPlataformas')+' %',data:_pd,borderColor:'rgba(10,132,255,0.85)',backgroundColor:'transparent',borderWidth:1.5,fill:false,tension:0.4,pointRadius:_pd.map((_,i)=>i===_pd.length-1?2:0),pointHoverRadius:4,yAxisID:'yc'}];})()),
          ...((()=>{const _tgh=patrimonioRendPuro;const _pph=_tgh!==0?totalRend/_tgh:0;const _id=hist.filter(s=>!xMin||new Date(s.date+'T00:00:00').getTime()>=xMin).map(s=>{const tg=s.value-(s.capital||s.value);const ig=Math.round(tg*(1-_pph));const cap=totalInvertidoUSD>0?totalInvertidoUSD*tc:(s.capital||s.value);return{x:s.date,y:cap>0?Math.round((ig/cap)*10000)/100:0};});if(!_id.length)return[];return[{label:t('gpNoRealizada')+' %',data:_id,borderColor:'rgba(48,209,88,0.85)',backgroundColor:'transparent',borderWidth:1.5,fill:false,tension:0.4,pointRadius:_id.map((_,i)=>i===_id.length-1?2:0),pointHoverRadius:4,yAxisID:'yc'}];})()),
        ]
      },options:{
        responsive:true,
        maintainAspectRatio:false,
        interaction:{intersect:false,mode:'nearest'},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:isDark?'rgba(28,28,30,0.96)':'rgba(29,29,31,0.92)',
            borderColor: isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.1)',
            borderWidth:1,
            cornerRadius:10,
            padding:{top:8,bottom:8,left:12,right:12},
            titleFont:{size:10,family:'DM Sans',weight:'600'},
            bodyFont:{size:11,family:'DM Sans'},
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
                if (ctx.dataset.hidden) return null;
                const val = ctx.parsed.y;
                const sign = val >= 0 ? '+' : '';
                return ` ${ctx.dataset.label}: ${sign}${val.toFixed(2)}%`;
              },
              afterBody: items => {
                const lines = [];
                const real = items.find(i=>i.datasetIndex===0);
                const proj = items.find(i=>i.datasetIndex===2);
                if(real&&proj){ const diff=proj.parsed.y-real.parsed.y; if(diff!==0){ lines.push(''); lines.push(` ${t('potencial')}: ${diff>0?'+':''}${fmtFull(diff)}`); } }
                const d = (items[0]?.raw?.x || items[0]?.label || '').substring(0,10);
                if(_evoEvt[d]){ lines.push(''); lines.push(_evoEvt[d]==='aport' ? ' ↑ aportación / compra' : ' ↓ retiro / venta / gasto'); }
                return lines;
              }
            }
          }
        },
        scales:{
          x:{
            type:'time',
            min: xMin,
            max: xMax,
            time:{
              unit: _chartRange === '1d' ? 'hour'
                  : (_chartRange === '1w' || _chartRange === '1m') ? 'day'
                  : 'month',
              displayFormats:{ hour:'HH:mm', day:'d MMM', month:'MMM yy' },
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
          yc:{
            position:'left',
            grid:{display:false},
            ticks:{font:{size:10},color:isDark?'rgba(200,200,210,0.55)':'rgba(80,80,90,0.5)',callback:v=>(v>=0?'+':'')+v.toFixed(1)+'%',maxTicksLimit:8},
            border:{display:false},
            afterDataLimits(axis){
              // Compress % into bottom 45% of chart, and ensure minimum spread of 4%
              const range=Math.max(axis.max-axis.min, 4);
              axis.min=axis.min-(range*0.1);
              axis.max=axis.min+(range/0.45);
            }
          },
          y2:{
            position:'right',
            grid:{display:false},
            ticks:{font:{size:10},color:isDark?'rgba(245,166,35,0.5)':'rgba(160,100,0,0.5)',callback:v=>fmt(v),maxTicksLimit:5},
            border:{display:false},
            afterDataLimits(axis){
              // Give patrimonio breathing room at top — extend min downward
              const range=axis.max-axis.min||1;
              axis.min=axis.min-(range*0.15);
            }
          }
        }
      }});
    }



    const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});
    tickerList.forEach(tk=>{if(tk.cantActual>0){const v=(tk.valorActual||tk.costoPosicion)*(tk.moneda==='MXN'?1:tc);at[tk.type]=(at[tk.type]||0)+v;}});
    const de=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const _deTotal=de.reduce((s,[,v])=>s+v,0);
    _renderHTMLBars('chartDistro', de, _deTotal, fmt, COLORS_BAR);

    const inv={};
    tickerList.forEach(tk=>{if(tk.cantActual>0){const v=(tk.valorActual||tk.costoPosicion)*(tk.moneda==='MXN'?1:tc);inv[tk.type]=(inv[tk.type]||0)+v;}});
    if(totalMXN>0) inv['Platforms']=totalMXN;
    const invE=Object.entries(inv).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const _invTotal=invE.reduce((s,[,v])=>s+v,0);
    _renderHTMLBars('chartInvTipo', invE, _invTotal, fmt, COLORS_BAR);

        const _gcTotal=topCats.reduce((s,[,v])=>s+v,0);
    _renderHTMLBars('chartGastosCat', topCats.map(([id,v])=>[catName(id),v]), _gcTotal, fmt, COLORS_BAR);


function openMovModal(sec){
  const s=sec||'plataformas';
  openModal(`
    <div class="modal-header"><div class="modal-title">${t('nuevoMovimiento')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="sec-tabs">
      <button class="sec-tab ${s==='plataformas'?'active-plat':''}" onclick="closeModal();openMovModal('plataformas')">🏦 ${t('seccionPlataformas')}</button>
      <button class="sec-tab ${s==='inversiones'?'active-inv':''}" onclick="closeModal();openMovModal('inversiones')">📈 ${t('seccionInversiones')}</button>
      <button class="sec-tab ${s==='gastos'?'active-gasto':''}" onclick="closeModal();openMovModal('gastos')">💳 ${t('seccionGastos')}</button>
      <button class="sec-tab ${s==='transferencia'?'active-transfer':''}" onclick="closeModal();openMovModal('transferencia')">↔ ${t('transferencia')}</button>
    </div>
    <form id="movForm" onsubmit="saveMovement('${s}');return false">
      ${s==='plataformas'?`
        <div class="form-row form-row-2">
          <div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div>
          <div class="form-group"><label class="form-label">${t('plataforma')}</label><select class="form-select" name="platform" required><option value="">${t('seleccionar')}...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" name="tipoPlat">${['Saldo Actual','Aportación','Retiro','Gasto'].map(opt=>`<option>${opt}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">${t('monto')}</label><input type="number" step="any" class="form-input" name="monto" placeholder="0" required></div>
        </div>
        <div class="form-group"><label class="form-label">${t('descripcion')}</label><input class="form-input" name="desc" placeholder="${t('opcional')}..."></div>
      `:s==='inversiones'?`
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div>
          <div class="form-group"><label class="form-label">${t('tipoActivo')}</label><select class="form-select" name="tipoActivo" id="invTipoActivo">${ASSET_TYPES.map(tp=>`<option>${tp}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">${t('movimiento')}</label><select class="form-select" name="tipoMov" id="invTipoMov" onchange="window._invUpdateSellInfo()">${['Compra','Venta','Dividendo','Comisión'].map(tp=>`<option>${tp}</option>`).join('')}</select></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">${t('ticker')}</label><input class="form-input" name="ticker" id="invTicker" placeholder="AAPL, BTC..." required style="text-transform:uppercase" oninput="window._invUpdateSellInfo()" onblur="window._invUpdateSellInfo()"></div>
          <div class="form-group" id="invBrokerGroup"><label class="form-label" id="invBrokerLabel">${t('broker')}</label><input list="brokerList" class="form-input" name="broker" id="invBroker" required placeholder="${t('escribir')}..."><datalist id="brokerList">${BROKERS.map(b=>`<option value="${b}">`).join('')}</datalist></div>
          <div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" name="moneda" id="invMoneda" onchange="window._invUpdateSellInfo()"><option value="USD">USD 🇺🇸</option><option value="MXN">MXN 🇲🇽</option></select></div>
        </div>
        <div id="invSellInfoBox" style="display:none;margin-bottom:12px;padding:10px 14px;background:rgba(255,149,0,0.08);border:1.5px solid rgba(255,149,0,0.25);border-radius:12px;font-size:12px;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
            <span>📦 <span style="color:var(--text2)">${t('disponible')}:</span> <strong id="invSellQty" style="color:var(--text);font-size:13px">—</strong></span>
            <span>💲 <span style="color:var(--text2)">${t('precioMedio')}:</span> <strong id="invSellAvg" style="color:var(--text)">—</strong></span>
          </div>
          <button type="button" onclick="window._invSellAll()" style="flex-shrink:0;padding:6px 16px;border-radius:10px;border:none;background:var(--orange);color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:var(--font);white-space:nowrap">🔴 ${t('venderTodo')}</button>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label" id="invCantLabel">${t('cantidad')}</label><input type="number" step="any" class="form-input" name="cantidad" id="invCantidad" placeholder="0" required oninput="window._invUpdateTotal()"></div>
          <div class="form-group"><label class="form-label">${t('precioUnitario')}</label><input type="number" step="any" class="form-input" name="precioUnit" id="invPrecioUnit" placeholder="0.00" oninput="window._invUpdateTotal()"></div>
          <div class="form-group"><label class="form-label">${t('comision')}</label><input type="number" step="any" class="form-input" name="comision" value="0"></div>
        </div>
        <div id="invTotalBox" style="display:none;margin:-4px 0 10px;padding:7px 14px;background:var(--card2);border-radius:10px;font-size:12px;color:var(--text2)">
          ${t('totalOperacion')}: <strong id="invTotalVal" style="color:var(--text);font-size:13px">—</strong>
        </div>
        <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="notas" placeholder="${t('opcional')}..."></div>

      `:s==='transferencia'?`
        <div class="form-group" style="margin-bottom:12px"><div style="display:flex;gap:8px">
          <button type="button" id="btnTipoPlat" onclick="setTipoTransfer('plat')" class="btn btn-secondary" style="flex:1">🏦 ${t('transferenciaEntrePlataformas')}</button>
          <button type="button" id="btnTipoSob" onclick="setTipoTransfer('sob')" class="btn btn-secondary" style="flex:1">💰 ${t('transferirSobrante')}</button>
        </div></div>
        <div id="formTransferPlat">
          <div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div>
          <div class="form-row form-row-2">
            <div class="form-group"><label class="form-label">${t('origen')}</label><select class="form-select" name="platOrigen"><option value="">${t('seleccionar')}...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">${t('destino')}</label><select class="form-select" name="platDestino"><option value="">${t('seleccionar')}...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
          </div>
          <div class="form-group"><label class="form-label">${t('monto')}</label><input type="number" step="any" class="form-input" name="monto" placeholder="0"></div>
          <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="desc" placeholder="${t('ejTransferencia')}..."></div>
        </div>
        <div id="formTransferSob" style="display:none">
          <div class="form-row form-row-2">
            <div class="form-group"><label class="form-label">${t('mesSobrante')}</label><select class="form-select" name="mesSobrante" onchange="actualizarMontoSobrante(this.value)">${(()=>{const opts=[];const now=new Date();for(let i=0;i<6;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');opts.push('<option value="'+key+'">'+MONTHS[d.getMonth()]+' '+d.getFullYear()+'</option>');}return opts.join('');})()}</select></div>
            <div class="form-group"><label class="form-label">${t('montoATransferir')}</label><input type="number" step="any" class="form-input" name="montoSob" id="inputMontoSob" placeholder="0"></div>
          </div>
          <div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fechaSob" value="${today()}"></div>
          <div class="form-group"><label class="form-label">${t('plataformaDestino')}</label><select class="form-select" name="platDestinoSob"><option value="">${t('seleccionar')}...</option>${platforms.map(p=>`<option value="${p.name}">${p.name} (${p.moneda||'MXN'})</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="descSob" placeholder="${t('ejAhorro')}..."></div>
        </div>
      `:`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${today()}" required></div><div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" name="tipo"><option>Gasto</option><option>Ingreso</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('categoria')}</label><select class="form-select" name="categoria">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('importe')}</label><input type="number" step="any" class="form-input" name="importe" placeholder="0" required></div><div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" name="monedaGasto"><option value="MXN">MXN 🇲🇽</option><option value="EUR">EUR 🇪🇺</option><option value="USD">USD 🇺🇸</option><option value="GBP">GBP 🇬🇧</option></select></div></div>
        <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="notas" placeholder="${t('opcional')}..."></div>
      `}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px;font-size:15px">${t('guardar')}</button>
    </form>
  `);
}

function saveMovement(sec){
  const f=document.getElementById('movForm');const d=Object.fromEntries(new FormData(f));
  if(sec==='transferencia'){
    const sobForm=document.getElementById('formTransferSob');const esSobrante=sobForm&&sobForm.style.display!=='none';
    if(esSobrante){
      if(!d.platDestinoSob||!d.montoSob)return;
      const montoEUR=Number(d.montoSob);if(!montoEUR||montoEUR<=0){alert('⚠️ '+t('amountMustBePositive'));return;}
      const eurmxn=getEurMxn();const montoMXN=Math.round(montoEUR*eurmxn*100)/100;
      const mov={id:uid(),seccion:'plataformas',fecha:d.fechaSob||today(),platform:d.platDestinoSob,tipoPlat:'Aportación',monto:montoMXN,desc:(d.descSob||(t('surplus')+' '+d.mesSobrante))+` · €${montoEUR} → $${montoMXN} MXN (FX ${eurmxn.toFixed(2)})`};
      movements=[mov,...movements];saveAll(mov.id);closeModal();return;
    }
    if(!d.platOrigen||!d.platDestino||!d.monto)return;
    if(d.platOrigen===d.platDestino){alert('⚠️ '+t('origenDestinoDiferentes'));return;}
    const tid=uid();
    const salida={id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platOrigen,tipoPlat:'Transferencia salida',monto:Number(d.monto),desc:d.desc||t('transferencia'),transferId:tid};
    const entrada={id:uid(),seccion:'plataformas',fecha:d.fecha||today(),platform:d.platDestino,tipoPlat:'Transferencia entrada',monto:Number(d.monto),desc:d.desc||t('transferencia'),transferId:tid};
    movements=[salida,entrada,...movements];saveAll(salida.id+'|'+entrada.id);closeModal();return;
  }
  let mov={id:uid(),seccion:sec,fecha:d.fecha||today()};
  if(sec==='plataformas'){if(!d.platform||!d.monto)return;mov.platform=d.platform;mov.tipoPlat=d.tipoPlat;mov.monto=Number(d.monto);mov.desc=d.desc||'';}
  else if(sec==='inversiones'){
    if(!d.ticker)return;
    const _tipo=d.tipoMov||'Compra';
    if(_tipo==='Dividendo'||_tipo==='Comisión'){
      if(!d.cantidad)return;
      mov.tipoActivo=d.tipoActivo||'ETF';mov.ticker=d.ticker.toUpperCase();mov.broker=d.broker||'';
      mov.tipoMov=_tipo;mov.cantidad=Number(d.cantidad);mov.precioUnit=1;
      mov.montoTotal=Number(d.cantidad);mov.moneda=d.moneda||'USD';mov.comision=0;mov.notas=d.notas||'';
    } else {
      if(!d.cantidad||!d.precioUnit)return;
      mov.tipoActivo=d.tipoActivo;mov.ticker=d.ticker.toUpperCase();mov.broker=d.broker;mov.tipoMov=_tipo;
      mov.cantidad=Number(d.cantidad);mov.precioUnit=Number(d.precioUnit);
      mov.montoTotal=mov.cantidad*mov.precioUnit;mov.moneda=d.moneda||'USD';
      mov.comision=Number(d.comision)||0;mov.notas=d.notas||'';
    }
  }
  else{if(!d.importe)return;mov.categoria=d.categoria;mov.tipo=d.tipo;
    const importeRaw=Number(d.importe);const monedaGasto=d.monedaGasto||'MXN';
    {const _fx=_fxCache||LS.get('fxCache');const _eurmxn=(_fx?.eurmxn)||settings.tipoEUR||17;const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;const _gbpmxn=_usdmxn/(_fx?.usdgbp||0.78);
    if(monedaGasto==='EUR'){mov.importe=Math.round(importeRaw*_eurmxn*100)/100;mov.monedaOrig='EUR';mov.montoOriginal=importeRaw;mov.notas=(d.notas?d.notas+' · ':'')+'€'+importeRaw+' → $'+mov.importe+' MXN (FX '+_eurmxn.toFixed(2)+')';}
    else if(monedaGasto==='USD'){mov.importe=Math.round(importeRaw*_usdmxn*100)/100;mov.monedaOrig='USD';mov.montoOriginal=importeRaw;mov.notas=(d.notas?d.notas+' · ':'')+'US$'+importeRaw+' → $'+mov.importe+' MXN (FX '+_usdmxn.toFixed(2)+')';}
    else if(monedaGasto==='GBP'){mov.importe=Math.round(importeRaw*_gbpmxn*100)/100;mov.monedaOrig='GBP';mov.montoOriginal=importeRaw;mov.notas=(d.notas?d.notas+' · ':'')+'£'+importeRaw+' → $'+mov.importe+' MXN (FX '+_gbpmxn.toFixed(2)+')';}
    else{mov.importe=importeRaw;mov.monedaOrig='MXN';mov.notas=d.notas||'';}}
  }
  movements=[mov,...movements];saveAll(mov.id);closeModal();
}

function deleteMovement(id){
  const mov=movements.find(m=>m.id===id);
  let deletedIds = [];
  if(mov&&mov.transferId){
    if(confirm(t('deleteEntireTransfer'))){
      deletedIds = movements.filter(m=>m.transferId===mov.transferId).map(m=>m.id);
      movements=movements.filter(m=>m.transferId!==mov.transferId);
    }else return;
  }else{
    if(!confirm(t('deleteMovementConfirm')))return;
    deletedIds = [id];
    movements=movements.filter(m=>m.id!==id);
  }
  saveAll(null, deletedIds.join('|'));
}

function openEditMovModal(id){
  const m=movements.find(x=>x.id===id);if(!m)return;const sec=m.seccion;
  openModal(`
    <div class="modal-header"><div class="modal-title">✏️ ${t('editar')} ${t('movimiento')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="editForm" onsubmit="updateMovement('${id}');return false">
      ${sec==='plataformas'?`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">${t('plataforma')}</label><select class="form-select" name="platform" required>${platforms.map(p=>`<option value="${p.name}" ${m.platform===p.name?'selected':''}>${p.name}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" name="tipoPlat">${['Saldo Actual','Aportación','Retiro','Gasto'].map(opt=>`<option ${m.tipoPlat===opt?'selected':''}>${opt}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('monto')}</label><input type="number" step="any" class="form-input" name="monto" value="${m.monto}" required></div></div>
        <div class="form-group"><label class="form-label">${t('descripcion')}</label><input class="form-input" name="desc" value="${escHtml(m.desc||'')}"></div>
      `:sec==='inversiones'?`
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">${t('tipoActivo')}</label><select class="form-select" name="tipoActivo">${ASSET_TYPES.map(opt=>`<option ${m.tipoActivo===opt?'selected':''}>${opt}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('movimiento')}</label><select class="form-select" name="tipoMov">${['Compra','Venta','Dividendo','Comisión'].map(opt=>`<option ${m.tipoMov===opt?'selected':''}>${opt}</option>`).join('')}</select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('ticker')}</label><input class="form-input" name="ticker" value="${m.ticker}" required style="text-transform:uppercase"></div><div class="form-group"><label class="form-label">${t('broker')}</label><input list="brokerListE" class="form-input" name="broker" value="${m.broker||''}"><datalist id="brokerListE">${BROKERS.map(b=>`<option value="${b}">`).join('')}</datalist></div><div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" name="moneda"><option value="USD" ${(m.moneda||'USD')==='USD'?'selected':''}>USD</option><option value="MXN" ${m.moneda==='MXN'?'selected':''}>MXN</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('cantidad')}</label><input type="number" step="any" class="form-input" name="cantidad" value="${m.cantidad}" required></div><div class="form-group"><label class="form-label">${t('precioUnitario')}</label><input type="number" step="any" class="form-input" name="precioUnit" value="${m.precioUnit}" required></div><div class="form-group"><label class="form-label">${t('comision')}</label><input type="number" step="any" class="form-input" name="comision" value="${m.comision||0}"></div></div>
        <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="notas" value="${escHtml(m.notas||'')}"></div>
      `:`
        <div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('fecha')}</label><input type="date" class="form-input" name="fecha" value="${m.fecha}" required></div><div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" name="tipo"><option ${m.tipo==='Gasto'?'selected':''}>Gasto</option><option ${m.tipo==='Ingreso'?'selected':''}>Ingreso</option></select></div></div>
        <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('categoria')}</label><select class="form-select" name="categoria">${EXPENSE_CATS.map(c=>`<option value="${c.id}" ${m.categoria===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('importe')}</label><input type="number" step="any" class="form-input" name="importe" value="${(()=>{if(m.monedaOrig&&m.monedaOrig!=='MXN'){if(m.montoOriginal!=null)return m.montoOriginal;const _fx=_fxCache||LS.get('fxCache');if(m.monedaOrig==='EUR'){const match=m.notas&&m.notas.match(/€([\d.]+)/);return match?Number(match[1]):Math.round(m.importe/getEurMxn()*100)/100;}if(m.monedaOrig==='USD'){const match=m.notas&&m.notas.match(/US\$([\d.]+)/);return match?Number(match[1]):Math.round(m.importe/((_fx?.usdmxn)||settings.tipoCambio||17)*100)/100;}if(m.monedaOrig==='GBP'){const match=m.notas&&m.notas.match(/£([\d.]+)/);return match?Number(match[1]):Math.round(m.importe/20*100)/100;}}return m.importe;})()}" required></div><div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" name="monedaGasto"><option value="MXN" ${(m.monedaOrig||'MXN')==='MXN'?'selected':''}>MXN 🇲🇽</option><option value="EUR" ${m.monedaOrig==='EUR'?'selected':''}>EUR 🇪🇺</option><option value="USD" ${m.monedaOrig==='USD'?'selected':''}>USD 🇺🇸</option><option value="GBP" ${m.monedaOrig==='GBP'?'selected':''}>GBP 🇬🇧</option></select></div></div>
        <div class="form-group"><label class="form-label">${t('notas')}</label><input class="form-input" name="notas" value="${escHtml(m.notas||'')}"></div>
      `}
      <div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary" style="flex:1;padding:14px">💾 ${t('guardar')}</button><button type="button" class="btn btn-secondary" onclick="closeModal()">${t('cancelar')}</button></div>
    </form>
  `);
}

function updateMovement(id){
  const f=document.getElementById('editForm');const d=Object.fromEntries(new FormData(f));
  movements=movements.map(m=>{
    if(m.id!==id)return m;const sec=m.seccion;let updated={...m,fecha:d.fecha||m.fecha};
    if(sec==='plataformas'){updated.platform=d.platform;updated.tipoPlat=d.tipoPlat;updated.monto=Number(d.monto);updated.desc=d.desc||'';}
    else if(sec==='inversiones'){updated.tipoActivo=d.tipoActivo;updated.ticker=d.ticker.toUpperCase();updated.broker=d.broker;updated.tipoMov=d.tipoMov;updated.cantidad=Number(d.cantidad);updated.precioUnit=Number(d.precioUnit);updated.montoTotal=updated.cantidad*updated.precioUnit;updated.moneda=d.moneda||'USD';updated.comision=Number(d.comision)||0;updated.notas=d.notas||'';}
    else{
      updated.categoria=d.categoria;updated.tipo=d.tipo;
      const importeRaw=Number(d.importe);const monedaGasto=d.monedaGasto||'MXN';
      {const _fx=_fxCache||LS.get('fxCache');const _eurmxn=(_fx?.eurmxn)||settings.tipoEUR||17;const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;const _gbpmxn=_usdmxn/(_fx?.usdgbp||0.78);
      if(monedaGasto==='EUR'){updated.importe=Math.round(importeRaw*_eurmxn*100)/100;updated.monedaOrig='EUR';updated.montoOriginal=importeRaw;updated.notas=(d.notas?d.notas+' · ':'')+'€'+importeRaw+' → $'+updated.importe+' MXN (FX '+_eurmxn.toFixed(2)+')';}
      else if(monedaGasto==='USD'){updated.importe=Math.round(importeRaw*_usdmxn*100)/100;updated.monedaOrig='USD';updated.montoOriginal=importeRaw;updated.notas=(d.notas?d.notas+' · ':'')+'US$'+importeRaw+' → $'+updated.importe+' MXN (FX '+_usdmxn.toFixed(2)+')';}
      else if(monedaGasto==='GBP'){updated.importe=Math.round(importeRaw*_gbpmxn*100)/100;updated.monedaOrig='GBP';updated.montoOriginal=importeRaw;updated.notas=(d.notas?d.notas+' · ':'')+'£'+importeRaw+' → $'+updated.importe+' MXN (FX '+_gbpmxn.toFixed(2)+')';}
      else{updated.importe=importeRaw;updated.monedaOrig='MXN';updated.notas=d.notas||'';}}
    }
    return updated;
  });
  saveAll(id);closeModal();
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
      <div><div class="section-title">${t('plataformasTitulo')}</div><div class="section-sub">${t('plataformasSubtitulo')}</div></div>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary btn-sm" onclick="openMovModal('transferencia')">↔ ${t('transferencia')}</button><button class="btn btn-secondary" onclick="openAddPlatformModal()">${t('nuevaPlataforma')}</button></div>
    </div>
    ${platsConTasa.length>0?`<div class="yield-info" style="margin-bottom:16px">⚡ <strong>${platsConTasa.length} ${t('plataformasConTasa')}</strong> · ${t('rendimientoAutoTotal')}: <strong>${fmtFull(totalRendAuto)}</strong></div>`:''}
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
                  <div style="font-size:15px;font-weight:800">${escHtml(p.name)}</div>
                  ${monedaBadge(cur)} ${typeBadge(p.type)} ${tasaBadge}
                </div>
                <div style="text-align:right">
                  <div style="font-size:16px;font-weight:800">${fmtPlat(p.saldo,cur)}</div>
                  <div style="font-size:11px;color:${pctCol(p.rendimiento)};font-weight:700">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento,cur)} ${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</div>
                </div>
              </div>
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text2);flex-wrap:wrap">
                <span>${t('saldoInicial')}: <strong style="color:var(--text)">${fmtPlat(p.saldoInicial,cur)}</strong></span>
                ${p.aportacion>0?`<span>+<strong style="color:var(--text)">${fmtPlat(p.aportacion,cur)}</strong> ${t('aportaciones')}</span>`:''}
                ${p.retiro>0?`<span>-<strong style="color:var(--text)">${fmtPlat(p.retiro,cur)}</strong> ${t('retiros')}</span>`:''}
                ${rendAutoStr}
                <span style="margin-left:auto;color:var(--text3)">${pctPort} ${t('portfolio')}</span>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
                <button class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:none;border:1px solid var(--border);color:var(--text2)" onclick="openEditPlatModal('${p.id}')">✏️ ${t('editar')}</button>
                <button class="del-btn" style="opacity:0.8;font-size:18px" onclick="deletePlatform('${p.id}')">×</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>${t('plataforma')}</th><th>${t('moneda')} ✏️</th><th>${t('tipo')}</th><th>${t('saldoInicial')} ✏️</th><th>⚡ ${t('tasa')} % ✏️</th><th>${t('desde')} ✏️</th><th>${t('dias')}</th><th>+ ${t('aportaciones')} 🔍</th><th>${t('retiros')}</th><th>${t('gastos')}</th><th style="color:var(--teal)">⚡ ${t('auto')}</th><th>${t('rendReal')}</th><th>${t('saldoActualTh')}</th><th>${t('rend')}</th><th>${t('pctPort')}</th><th></th></tr></thead>
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
              return`<tr><td style="color:var(--text3);font-size:11px">${i+1}</td><td style="font-weight:700">${escHtml(p.name)}</td><td><span class="editable" onclick="editPlatField('${p.id}','moneda',this,'moneda')">${monedaBadge(cur)}</span></td><td>${typeBadge(p.type)}</td><td><span class="editable" onclick="editPlatField('${p.id}','saldoInicial',this,'number')">${fmtPlat(p.saldoInicial,cur)}</span></td><td><span class="editable" onclick="editPlatField('${p.id}','tasaAnual',this,'percent')">${tasaBadge}</span></td><td><span class="editable" onclick="editPlatField('${p.id}','fechaInicio',this,'date')" style="font-size:11px;color:var(--text2)">${p.fechaInicio||'—'}</span></td><td>${diasStr}</td><td>${aportLink}</td><td>${retirosStr}</td><td>${gastosStr}</td><td>${rendAutoStr}</td><td style="color:${pctCol(p.rendimientoManual)};font-weight:600">${p.rendimientoManual!==0?(p.rendimientoManual>=0?'+':'')+fmtPlat(p.rendimientoManual,cur):'<span style="color:var(--text3)">—</span>'}</td><td style="font-weight:800;font-size:14px">${fmtPlat(p.saldo,cur)}</td><td style="font-weight:600;color:${pctCol(p.rendimiento)}">${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</td><td style="font-size:11px;color:var(--text2)">${pctPort}</td><td><button class="del-btn" onclick="deletePlatform('${p.id}')">×</button></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
    <div style="margin-top:12px;padding:12px 16px;background:var(--card2);border-radius:10px;font-size:12px;color:var(--text2);line-height:1.6">
      <strong>${t('moneda')}:</strong> ${t('cadaPlataformaMoneda')}<br>
      <strong>${t('rendimiento')}:</strong> ${t('rendimientoExplicacion')}
    </div>
  `;
}

function editPlatField(id,field,el,inputType){
  const p=platforms.find(x=>x.id===id);if(!p)return;
  const originalEl=el.cloneNode(true);
  let input;
  if(inputType==='date'){input=document.createElement('input');input.type='date';input.value=p[field]||today();input.className='form-input';input.style.cssText='width:130px;padding:4px 8px;font-size:12px';}
  else if(inputType==='percent'){input=document.createElement('input');input.type='number';input.step='0.01';input.min='0';input.max='100';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:90px;padding:4px 8px;font-size:12px';input.placeholder='e.g. 13.5';}
  else if(inputType==='moneda'){
    input=document.createElement('select');input.className='form-select';input.style.cssText='width:100px;padding:4px 8px;font-size:12px';
    PLAT_MONEDAS.forEach(m=>{const opt=document.createElement('option');opt.value=m;opt.textContent=m==='MXN'?'🇲🇽 MXN':m==='USD'?'🇺🇸 USD':'🇪🇺 EUR';if(p[field]===m)opt.selected=true;input.appendChild(opt);});
  }
  else{input=document.createElement('input');input.type='number';input.step='any';input.value=p[field]||0;input.className='form-input';input.style.cssText='width:110px;padding:4px 8px;font-size:12px';}
  let _committed=false;
  const finish=()=>{if(_committed)return;_committed=true;const raw=input.value;let val=inputType==='date'||inputType==='moneda'?raw:(Number(raw)||0);platforms=platforms.map(x=>x.id!==id?x:{...x,[field]:val});saveAll();};
  const cancel=()=>{if(_committed)return;_committed=true;input.replaceWith(originalEl);};
  input.onblur=finish;
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){e.preventDefault();cancel();}};
  if(inputType==='moneda')input.onchange=finish;
  el.replaceWith(input);input.focus();
}
function deletePlatform(id){if(!confirm(t('deletePlatformConfirm')))return;platforms=platforms.filter(p=>p.id!==id);saveAll();}

function openEditPlatModal(id){
  const p = platforms.find(x=>x.id===id); if(!p) return;
  openModal(`<div class="modal-header"><div class="modal-title">✏️ ${t('editar')} ${t('plataforma')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="epName" value="${escHtml(p.name||'')}"></div>
    <div class="form-row form-row-2">
      <div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" id="epType">${PLAT_TYPES.map(opt=>`<option ${p.type===opt?'selected':''}>${opt}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" id="epMoneda"><option value="MXN" ${(p.moneda||'MXN')==='MXN'?'selected':''}>🇲🇽 MXN</option><option value="USD" ${p.moneda==='USD'?'selected':''}>🇺🇸 USD</option><option value="EUR" ${p.moneda==='EUR'?'selected':''}>🇪🇺 EUR</option></select></div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group"><label class="form-label">${t('saldoInicial')}</label><input type="number" step="any" class="form-input" id="epSaldo" value="${p.saldoInicial||0}"></div>
      <div class="form-group"><label class="form-label">⚡ ${t('tasaAnual')} %</label><input type="number" step="0.01" min="0" max="100" class="form-input" id="epTasa" value="${p.tasaAnual||0}" placeholder="e.g. 13.5"></div>
    </div>
    <div class="form-group"><label class="form-label">${t('fechaInicio')}</label><input type="date" class="form-input" id="epFecha" value="${p.fechaInicio||today()}"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="saveEditPlat('${id}')">${t('guardar')}</button>`);
}
function saveEditPlat(id){
  platforms = platforms.map(p => p.id!==id ? p : {
    ...p,
    name: document.getElementById('epName').value || p.name,
    type: document.getElementById('epType').value,
    moneda: document.getElementById('epMoneda').value,
    saldoInicial: Number(document.getElementById('epSaldo').value)||0,
    tasaAnual: Number(document.getElementById('epTasa').value)||0,
    fechaInicio: document.getElementById('epFecha').value || p.fechaInicio,
  });
  saveAll(); closeModal();
}
window.openEditPlatModal = openEditPlatModal;
window.saveEditPlat = saveEditPlat;
function openAddPlatformModal(){
  openModal(`<div class="modal-header"><div class="modal-title">${t('nuevaPlataforma')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form onsubmit="addPlatform();return false">
      <div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="npName" placeholder="e.g. Banco Azteca" required></div>
      <div class="form-row form-row-3"><div class="form-group"><label class="form-label">${t('tipo')}</label><select class="form-select" id="npType">${PLAT_TYPES.map(opt=>`<option>${opt}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('grupo')}</label><select class="form-select" id="npGroup">${PLAT_GROUPS.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">${t('moneda')}</label><select class="form-select" id="npMoneda"><option value="MXN">🇲🇽 MXN</option><option value="USD">🇺🇸 USD</option><option value="EUR">🇪🇺 EUR</option></select></div></div>
      <div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('saldoInicial')}</label><input type="number" class="form-input" id="npSaldo" placeholder="0" value="0"></div><div class="form-group"><label class="form-label">⚡ ${t('tasaAnual')} %</label><input type="number" step="0.01" min="0" max="100" class="form-input" id="npTasa" placeholder="e.g. 13.5" value="0"></div></div>
      <div class="form-group"><label class="form-label">${t('fechaInicio')}</label><input type="date" class="form-input" id="npFecha" value="${today()}"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">${t('agregar')}</button>
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
  const _now = new Date();
  const _gmParts = _gastosMonth ? _gastosMonth.split('-').map(Number) : [_now.getFullYear(), _now.getMonth()+1];
  const cy = _gmParts[0], cm = _gmParts[1];
  const isCurrentMonth = cy === _now.getFullYear() && cm === _now.getMonth()+1;
  const budgets=settings.budgets||{},ingresos=settings.ingresos||{};
  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesMovs=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy;});
  const sueldoEUR=ingresos.monedaSueldo==='EUR'?(ingresos.sueldoRaw||0):(ingresos.sueldo||0);
  const extrasEUR=ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR=ingresos.otrosEUR||ingresos.otros||0;
  const eurmxn=getEurMxn();
  const monedaMostrar=ingresos.monedaSueldo||'EUR';
  const fx=_fxCache||LS.get('fxCache');
  const usdeur=fx?.usdeur||(settings.tipoCambio&&settings.tipoEUR?settings.tipoCambio/settings.tipoEUR:0.88);
  const gbpeur=fx?(fx.usdeur/(fx.usdgbp||1)):(settings.tipoGBP&&settings.tipoEUR?settings.tipoEUR/settings.tipoGBP:1.17);
  const eurToMon=v=>{
    if(monedaMostrar==='EUR') return v;
    if(monedaMostrar==='USD') return v/usdeur;
    if(monedaMostrar==='MXN') return v*eurmxn;
    if(monedaMostrar==='GBP') return v/gbpeur;
    return v;
  };
  const monSymbol={EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[monedaMostrar]||'€';
  const fmtEUR=v=>{const conv=eurToMon(Number(v||0));return monSymbol+conv.toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});};
  const toEUR=m=>{
    if(m.monedaOrig==='EUR'){
      if(m.montoOriginal!=null)return m.montoOriginal;
      const match=m.notas&&m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);
      return m.importeEUR||Math.round(m.importe/eurmxn*100)/100;
    }
    if(m.monedaOrig==='USD'){
      if(m.montoOriginal!=null){const _fx=_fxCache||LS.get('fxCache');const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;return Math.round(m.montoOriginal*_usdmxn/eurmxn*100)/100;}
      const match=m.notas&&m.notas.match(/US\$([\d.]+)/);if(match){const _fx=_fxCache||LS.get('fxCache');const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;return Math.round(Number(match[1])*_usdmxn/eurmxn*100)/100;}
      return Math.round(m.importe/eurmxn*100)/100;
    }
    if(m.monedaOrig==='GBP'){
      if(m.montoOriginal!=null){const _fx=_fxCache||LS.get('fxCache');const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;const _gbpmxn=_usdmxn/(_fx?.usdgbp||0.78);return Math.round(m.montoOriginal*_gbpmxn/eurmxn*100)/100;}
      const match=m.notas&&m.notas.match(/£([\d.]+)/);if(match){const _fx=_fxCache||LS.get('fxCache');const _usdmxn=(_fx?.usdmxn)||settings.tipoCambio||17;const _gbpmxn=_usdmxn/(_fx?.usdgbp||0.78);return Math.round(Number(match[1])*_gbpmxn/eurmxn*100)/100;}
      return Math.round(m.importe/eurmxn*100)/100;
    }
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
  const barLabel=totGastoEUR>totalIngPlaneadoEUR?t('deficit'):totGastoEUR>totalPresupuestoEUR?t('sobrePresupuesto'):t('dentroDelPlan');
  const totalRecurrente=recurrentes.filter(r=>r.activo).reduce((s,r)=>s+r.importe,0);

  const firstMovFecha = expMovs.length > 0
    ? expMovs.reduce((min, m) => m.fecha < min ? m.fecha : min, expMovs[0].fecha)
    : today();
  const firstMovDate = new Date(firstMovFecha);
  const startDate = new Date(firstMovDate.getFullYear(), firstMovDate.getMonth(), 1);
  const now = new Date();
  let acumTotal = 0;
  let mesConDatos = 0;
  const sobranteRows = [];
  let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (d <= now) {
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const gM = expMovs.filter(mv => mv.tipo==='Gasto' && mv.fecha?.startsWith(key));
    const iM = expMovs.filter(mv => mv.tipo==='Ingreso' && mv.fecha?.startsWith(key));
    const tG = eurToMon(gM.reduce((s,mv)=>s+toEUR(mv),0));
    const tI = eurToMon(iM.reduce((s,mv)=>s+toEUR(mv),0));
    const ingR = tI>0 ? tI : eurToMon(sueldoEUR+extrasEUR+otrosEUR);
    const sob = Math.round((ingR-tG)*100)/100;
    if(sob>0) acumTotal += sob;
    mesConDatos++;
    const isCur = d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    sobranteRows.push(`<tr>
      <td style="font-weight:600">${MONTHS[d.getMonth()]} ${d.getFullYear()}${isCur?' <span style="font-size:10px;color:var(--teal);font-weight:700">● '+t('current')+'</span>':''}</td>
      <td style="color:var(--text2)">${fmtEUR(ingR)}</td>
      <td style="color:var(--red)">${fmtEUR(tG)}</td>
      <td style="font-weight:800;color:${sob>=0?'var(--green)':'var(--red)'}">${fmtEUR(sob)}</td>
    </tr>`);
    d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  }

  const catRows=EXPENSE_CATS.map(cat=>{
    const presEUR=budgets[cat.id]||0,realEUR=byCat[cat.id]||0;
    const pres=eurToMon(presEUR),real=eurToMon(realEUR),rest=pres-real;
    if (!window._showAllCats && presEUR===0 && realEUR===0) return '';
    const pctUso=pres>0?(real/pres*100):0;const pctIng=totalIngPlaneadoEUR>0?(presEUR/totalIngPlaneadoEUR*100).toFixed(1)+'%':'—';
    const barC=pctUso>100?'var(--red)':pctUso>85?'var(--orange)':'var(--green)';
    const restStr=pres>0?(rest>=0?'+':'')+fmtEUR(rest):'—';const restCol=rest>=0?'var(--green)':'var(--red)';
    const barHtml=pres>0?`<div style="display:flex;align-items:center;gap:6px"><div class="progress-bg" style="flex:1;height:6px"><div class="progress-fill" style="background:${barC};width:${Math.min(pctUso,100).toFixed(0)}%"></div></div><span style="font-size:10px;font-weight:700;color:${pctUso>100?'var(--red)':'var(--text2)'}"> ${pctUso.toFixed(0)}%</span></div>`:`<span style="font-size:10px;color:var(--text3)">${t('sinAsignar')}</span>`;
    const presDisplay=presEUR?Math.round(eurToMon(presEUR)*100)/100:'';
    return`<tr><td style="font-weight:600">${cat.icon} ${cat.name}</td><td><input type="number" class="form-input" style="width:100px;padding:5px 8px;font-size:13px;font-weight:700;text-align:right" value="${presDisplay}" placeholder="0" onchange="updateBudget('${cat.id}',this.value,${JSON.stringify(monedaMostrar)})"></td><td style="font-size:12px;color:var(--text2)">${pctIng}</td><td style="font-weight:600;${real>pres&&pres>0?'color:var(--red)':''}">${fmtEUR(real)}</td><td style="font-weight:600;color:${restCol}">${restStr}</td><td style="width:150px">${barHtml}</td></tr>`;
  }).join('');
  const hiddenCatCount = EXPENSE_CATS.filter(cat=>(budgets[cat.id]||0)===0 && (byCat[cat.id]||0)===0).length;
  const hiddenHint = (!window._showAllCats && hiddenCatCount>0) ? `<tr><td colspan="6" style="text-align:center;padding:10px 0;font-size:11px;color:var(--text3)">${hiddenCatCount} ${t('catOcultas')} · <button class="btn btn-sm" style="font-size:11px;padding:2px 8px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="window._showAllCats=true;renderGastos()">${t('mostrarTodas')}</button></td></tr>` : '';

  const movRows=mesMovs.length>0?mesMovs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(m=>`<tr><td style="color:var(--text2);font-size:12px">${m.fecha}</td><td style="font-weight:500">${m.tipo==='Ingreso'?'💰 '+t('ingreso'):catName(m.categoria)} ${m.esRecurrente?'<span class="badge badge-purple">🔄 '+t('auto')+'</span>':''}</td><td><span class="badge ${m.tipo==='Ingreso'?'badge-green':'badge-red'}">${m.tipo}</span></td><td style="font-weight:700">${fmtEUR(toEUR(m))}</td><td style="color:var(--text2);font-size:11px">${m.notas||'—'}</td><td><button class="edit-btn" onclick="openEditMovModal('${m.id}')">✏️</button><button class="del-btn" onclick="deleteMovement('${m.id}')">×</button></td></tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px">${t('sinMovs')}</td></tr>`;

  document.getElementById('page-gastos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div>
        <div class="section-title">${t('gastosTitulo')}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <button onclick="window.gastosNavMonth(-1)" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:3px 10px;font-size:16px;cursor:pointer;line-height:1;color:var(--text2)">‹</button>
          <span style="font-size:14px;font-weight:700;min-width:110px;text-align:center">${t('months')[cm-1]} ${cy}</span>
          <button onclick="window.gastosNavMonth(1)" ${isCurrentMonth?'disabled style="opacity:0.3;cursor:default;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:3px 10px;font-size:16px;line-height:1"':'style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:3px 10px;font-size:16px;cursor:pointer;line-height:1;color:var(--text2)"'}>›</button>
          ${!isCurrentMonth?`<button onclick="window.gastosNavToday()" style="background:none;border:1px solid var(--blue);color:var(--blue);border-radius:10px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">${t('hoy')}</button>`:''}
        </div>
      </div>
      <button class="btn btn-secondary" onclick="switchTab('movimientos');openMovModal('gastos')">+ ${t('gasto')}</button>
    </div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--purple)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="card-title" style="margin:0">${t('recurrentesTitulo')} — ${fmtEUR(totalRecurrente)}/${t('mes')}</div>
        <button class="btn btn-sm" style="background:rgba(191,90,242,0.1);color:var(--purple);border:none;font-weight:700" onclick="openRecurrentesModal()">${t('recurrentesGestionar')}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
        ${recurrentes.filter(r=>r.activo).slice(0,6).map(r=>`<div class="recurrente-card"><div class="recurrente-icon" style="background:${r.color||'var(--card2)'}22">${r.icon||'📌'}</div><div class="recurrente-info"><div class="recurrente-name">${r.nombre}</div><div class="recurrente-meta">${r.frecuencia} · ${t('dia')} ${r.dia}</div></div><div class="recurrente-amount" style="color:var(--red)">-${fmtEUR(r.importe)}</div></div>`).join('')}
        ${recurrentes.filter(r=>r.activo).length===0?'<div style="color:var(--text2);font-size:13px;padding:8px">'+t('sinRecurrentes')+'</div>':''}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--green)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin:0">${t('ingresosMes')}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-size:11px;font-weight:600;color:var(--text2)">${t('monedaSueldo')}:</label>
          <select class="form-select" style="padding:4px 10px;font-size:13px;font-weight:700;border-radius:10px;width:auto" id="selMonedaSueldo" onchange="updateIngresoConMoneda('sueldo',document.getElementById('inputSueldo').value,this.value);renderGastos()">
            <option value="EUR" ${(ingresos.monedaSueldo||'EUR')==='EUR'?'selected':''}>🇪🇺 EUR</option>
            <option value="USD" ${ingresos.monedaSueldo==='USD'?'selected':''}>🇺🇸 USD</option>
            <option value="MXN" ${ingresos.monedaSueldo==='MXN'?'selected':''}>🇲🇽 MXN</option>
            <option value="GBP" ${ingresos.monedaSueldo==='GBP'?'selected':''}>🇬🇧 GBP</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:8px">
        <div><label class="form-label">${t('sueldoLabel')}</label><div style="display:flex;gap:6px;align-items:center"><input id="inputSueldo" type="number" class="form-input" placeholder="0" value="${ingresos.sueldoRaw||sueldoEUR||''}" onchange="updateIngresoConMoneda('sueldo',this.value,document.getElementById('selMonedaSueldo')?.value||(settings.ingresos?.monedaSueldo)||'EUR');renderGastos()" style="font-size:16px;font-weight:700;flex:1"><span class="sueldo-symbol" style="font-size:13px;font-weight:700;color:var(--text2)">${{EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[ingresos.monedaSueldo||'EUR']||'€'}</span></div></div>
        <div><label class="form-label">${t('extrasLabel')}</label><input type="number" class="form-input" placeholder="0" value="${extrasEUR||''}" onchange="if(!settings.ingresos)settings.ingresos={};settings.ingresos.extrasEUR=Number(this.value)||0;settings.ingresos.extras=Number(this.value)||0;saveAll()" style="font-size:16px;font-weight:700"></div>
        <div><label class="form-label">${t('otrosLabel')}</label><input type="number" class="form-input" placeholder="0" value="${otrosEUR||''}" onchange="if(!settings.ingresos)settings.ingresos={};settings.ingresos.otrosEUR=Number(this.value)||0;settings.ingresos.otros=Number(this.value)||0;saveAll()" style="font-size:16px;font-weight:700"></div>
        <div style="background:var(--card2);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase">${t('totalLabel')}</div>
          <div style="font-size:22px;font-weight:800;color:var(--green);margin-top:4px">${(()=>{
            const mon=ingresos.monedaSueldo||'EUR';
            const fx=_fxCache||LS.get('fxCache');
            const eurmxn=getEurMxn();
            const usdeur=fx?.usdeur||(settings.tipoEUR&&settings.tipoCambio?settings.tipoCambio/settings.tipoEUR:0.88);
            const gbpeur=fx?((fx.usdeur||0.88)/(fx.usdgbp||0.79)):(settings.tipoGBP&&settings.tipoEUR?settings.tipoEUR/settings.tipoGBP:1.17);
            let val=totalIngPlaneadoEUR;
            if(mon==='MXN') val=totalIngPlaneadoEUR*eurmxn;
            else if(mon==='USD') val=totalIngPlaneadoEUR/usdeur;
            else if(mon==='GBP') val=totalIngPlaneadoEUR/gbpeur;
            const sym={EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[mon]||'€';
            const num=Math.round(val).toLocaleString('es-MX');
            return (mon==='USD'||mon==='MXN'?sym+num:sym+num);
          })()}</div>
          ${(ingresos.monedaSueldo&&ingresos.monedaSueldo!=='EUR')?`<div style="font-size:10px;color:var(--text3);margin-top:2px">= ${fmtEUR(totalIngPlaneadoEUR)} EUR</div>`:''}
        </div>
      </div>
    </div>

    ${totIngEUR===0&&totalIngPlaneadoEUR>0?`<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(10,132,255,0.06);border:1px solid rgba(10,132,255,0.15);border-radius:10px;margin-bottom:16px;font-size:12px;color:var(--text2)"><span>💡</span><span>${t('usandoIngresoPlaneado', fmtEUR(totalIngPlaneadoEUR))} <button class="btn btn-sm" style="font-size:11px;padding:2px 8px;margin-left:4px;background:none;border:1px solid var(--border);cursor:pointer" onclick="switchTab('movimientos');openMovModal('gastos')">+ ${t('registrarIngreso')}</button></span></div>`:''}

    <div class="grid-4" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--teal)">
        <div class="stat-label">${t('capitalSobrantePorMes')}</div>
        <div class="stat-value" style="color:${acumTotal>=0?'var(--teal)':'var(--red)'}">${fmtEUR(acumTotal)}</div>
        <div class="stat-sub">${t('desde')} ${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()} · ${mesConDatos} ${mesConDatos===1?t('mes'):t('meses')}</div>
      </div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">${t('presupuestoLabel')}</div><div class="stat-value">${fmtEUR(totalPresupuestoEUR)}</div><div class="stat-sub">${sinAsignarEUR>=0?`<span style="color:var(--green);font-weight:700">+${fmtEUR(sinAsignarEUR)} ${t('libre')}</span>`:`<span style="color:var(--red);font-weight:700">${fmtEUR(sinAsignarEUR)} ${t('excedido')}</span>`}</div></div>
      <div class="card stat" style="border-top:3px solid var(--red)"><div class="stat-label">${t('gastoReal')}</div><div class="stat-value" style="color:var(--red)">${fmtEUR(totGastoEUR)}</div><div class="stat-sub">${t('registradoEsteMes')}</div></div>
      <div class="card stat" style="border-top:3px solid ${disponibleEUR>=0?'var(--green)':'var(--red)'}"><div class="stat-label">${t('disponible')}</div><div class="stat-value" style="color:${disponibleEUR>=0?'var(--green)':'var(--red)'}">${fmtEUR(disponibleEUR)}</div><div class="stat-sub">${totIngEUR>0?t('actual')+': '+fmtEUR(totIngEUR):t('segunPlaneado')}</div></div>
    </div>

    ${totalIngPlaneadoEUR>0?`<div class="card" style="margin-bottom:16px;padding:16px 24px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:13px;font-weight:700">${t('usoPresupuesto')}</div><div style="font-size:13px;font-weight:800;color:${barColor}">${barLabel}</div></div><div class="progress-bg" style="height:14px;border-radius:8px"><div class="progress-fill" style="height:14px;border-radius:8px;background:${barColor};width:${barPct}%"></div></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:6px"><span>${t('gastado')}: ${fmtEUR(totGastoEUR)}</span><span>${t('presupuesto')}: ${fmtEUR(totalPresupuestoEUR)}</span><span>${t('ingreso')}: ${fmtEUR(totalIngPlaneadoEUR)}</span></div></div>`:''}

    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--teal)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title" style="margin:0">💰 ${t('capitalSobrantePorMes')}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">${t('sobranteExplicacion')} · ${t('enEUR')} · ${t('desde')} ${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(0,199,190,0.1);color:var(--teal);border:none;font-weight:700" onclick="switchTab('movimientos');openMovModal('transferencia')">💸 ${t('transferirSobrante')}</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>${t('mes')}</th><th>${t('ingresoRef')}</th><th>${t('gastos')}</th><th>${t('sobrante')}</th></tr></thead>
        <tbody>
          ${sobranteRows.join('')}
          <tr style="font-weight:800;background:var(--card2);border-top:2px solid var(--border2)">
            <td>${t('acumulado')}</td><td colspan="2"></td>
            <td style="color:var(--teal);font-weight:800">${fmtEUR(acumTotal)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div class="card-flat" style="margin-bottom:16px">
      <div style="padding:16px 20px 0;display:flex;justify-content:space-between;align-items:center">
        <div class="card-title" style="margin:0">${t('presupuestoTitulo')} (${monSymbol})</div>
      </div>
      ${isMobile() ? `
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
          ${(()=>{
            const rows = EXPENSE_CATS.map(cat => {
              const pres=budgets[cat.id]||0, real=byCat[cat.id]||0;
              if(!window._showAllCats && pres===0 && real===0) return '';
              const pctUso = pres>0 ? real/pres*100 : 0;
              const barC = pctUso>100?'var(--red)':pctUso>85?'var(--orange)':'var(--green)';
              const rest = pres - real;
              return `<div style="background:var(--card2);border-radius:10px;padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-size:13px;font-weight:700">${cat.icon} ${cat.name}</span>
                  <div style="text-align:right">
                    <span style="font-size:13px;font-weight:800;color:${real>pres&&pres>0?'var(--red)':'var(--text)'}">${fmtEUR(real)}</span>
                    ${pres>0?`<span style="font-size:11px;color:var(--text2)"> / ${fmtEUR(pres)}</span>`:''}
                  </div>
                </div>
                ${pres>0?`
                  <div class="progress-bg" style="height:5px;margin-bottom:4px">
                    <div class="progress-fill" style="background:${barC};width:${Math.min(pctUso,100).toFixed(0)}%;height:5px"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2)">
                    <span>${pctUso.toFixed(0)}% ${t('usado')}</span>
                    <span style="color:${rest>=0?'var(--green)':'var(--red)'};font-weight:700">${rest>=0?'+':''}${fmtEUR(rest)}</span>
                  </div>
                `:`<div style="font-size:10px;color:var(--text3)">${t('sinAsignar')} · <button class="btn btn-sm" style="font-size:10px;padding:1px 6px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="switchTab('ajustes')">${t('asignar')}</button></div>`}
              </div>`;
            }).filter(Boolean);
            const hiddenCount = EXPENSE_CATS.filter(cat=>(budgets[cat.id]||0)===0&&(byCat[cat.id]||0)===0).length;
            return rows.join('') + ((!window._showAllCats && hiddenCount>0) ? `<div style="text-align:center;font-size:11px;color:var(--text3);padding:6px 0">${hiddenCount} ${t('catOcultas')} · <button class="btn btn-sm" style="font-size:11px;padding:2px 8px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer" onclick="window._showAllCats=true;renderGastos()">${t('mostrarTodas')}</button></div>` : '');
          })()}
        </div>
      ` : `<div class="table-wrap"><table><thead><tr><th>${t('catHeader')[0]}</th><th>${t('catHeader')[1]}</th><th>${t('catHeader')[2]}</th><th>${t('catHeader')[3]}</th><th>${t('catHeader')[4]}</th><th>${t('catHeader')[5]}</th></tr></thead><tbody>${catRows||`<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text2);font-size:13px">${t('asignarPresupuestos')}</td></tr>`}${hiddenHint}<tr style="font-weight:800;background:var(--card2);border-top:2px solid var(--border2)"><td>TOTAL</td><td>${fmtEUR(totalPresupuestoEUR)}</td><td>${totalIngPlaneadoEUR>0?((totalPresupuestoEUR/totalIngPlaneadoEUR)*100).toFixed(1)+'%':'—'}</td><td style="color:${totGastoEUR>totalPresupuestoEUR?'var(--red)':'var(--text)'}">${fmtEUR(totGastoEUR)}</td><td style="color:${totalPresupuestoEUR-totGastoEUR>=0?'var(--green)':'var(--red)'}">${totalPresupuestoEUR>0?(totalPresupuestoEUR-totGastoEUR>=0?'+':'')+fmtEUR(totalPresupuestoEUR-totGastoEUR):'—'}</td><td>${totalPresupuestoEUR>0?`<span style="font-size:12px;font-weight:800">${(totGastoEUR/totalPresupuestoEUR*100).toFixed(0)}%</span>`:''}</td></tr></tbody></table></div>`}
    </div>

    <div class="card-flat">
      <div style="padding:16px 20px 0"><div class="card-title">${t('movsTitulo')} — ${t('months')[cm-1]} ${cy}</div></div>
      ${isMobile() ? `
        <div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px">
          ${mesMovs.length>0 ? mesMovs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(m=>`
            <div style="background:var(--card2);border-radius:10px;padding:10px 12px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
                <div>
                  <span style="font-size:13px;font-weight:700">${m.tipo==='Ingreso'?'💰 '+t('ingreso'):catName(m.categoria)}</span>
                  ${m.esRecurrente?'<span class="badge badge-purple" style="margin-left:4px">🔄</span>':''}
                </div>
                <span style="font-size:14px;font-weight:800;color:${m.tipo==='Ingreso'?'var(--green)':'var(--red)'}">${m.tipo==='Ingreso'?'+':'−'}${fmtEUR(toEUR(m))}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:11px;color:var(--text2)">${m.fecha}${m.notas?` · ${escHtml(m.notas)}`:''}</span>
                <div style="display:flex;gap:4px">
                  <button class="edit-btn" onclick="openEditMovModal('${m.id}')" style="opacity:0.8">✏️</button>
                  <button class="del-btn" onclick="deleteMovement('${m.id}')" style="opacity:0.8">×</button>
                </div>
              </div>
            </div>`).join('')
          : '<div style="text-align:center;color:var(--text2);padding:24px;font-size:13px">'+t('sinMovs')+'</div>'}
        </div>
      ` : `<div class="table-wrap"><table><thead><tr><th>${t('fecha')}</th><th>${t('categoria')}</th><th>${t('tipo')}</th><th>${t('importe')}</th><th>${t('notas')}</th><th></th></tr></thead><tbody>${movRows}</tbody></table></div>`}
    </div>
  `;
}

function updateBudget(catId,value,moneda){
  if(!settings.budgets)settings.budgets={};
  let valEUR=Number(value)||0;
  if(moneda&&moneda!=='EUR'){
    const fx=_fxCache||LS.get('fxCache');
    const eurmxn=getEurMxn();
    const usdeur=fx?.usdeur||(settings.tipoCambio&&settings.tipoEUR?settings.tipoCambio/settings.tipoEUR:0.88);
    const gbpeur=fx?(fx.usdeur/(fx.usdgbp||1)):1.17;
    if(moneda==='MXN') valEUR=valEUR/eurmxn;
    else if(moneda==='USD') valEUR=valEUR*usdeur;
    else if(moneda==='GBP') valEUR=valEUR*gbpeur;
  }
  settings.budgets[catId]=Math.round(valEUR*100)/100;
  saveAll();
}
function updateIngreso(tipo,value){if(!settings.ingresos)settings.ingresos={};settings.ingresos[tipo]=Number(value)||0;saveAll();}
function updateIngresoConMoneda(tipo,value,moneda){
  if(!settings.ingresos)settings.ingresos={};
  const raw=Number(value)||0;
  moneda=moneda||'EUR';
  settings.ingresos.monedaSueldo=moneda;
  settings.ingresos.sueldoRaw=raw;
  const eurmxn=getEurMxn();
  const fx=_fxCache||LS.get('fxCache');
  const usdeur=fx?.usdeur||(settings.tipoEUR&&settings.tipoCambio?settings.tipoCambio/settings.tipoEUR:0.88);
  const gbpeur=fx?(fx.usdeur/fx.usdgbp):(settings.tipoGBP&&settings.tipoEUR?settings.tipoEUR/settings.tipoGBP:1.17);
  let asEUR=raw;
  if(moneda==='USD') asEUR=raw*usdeur;
  else if(moneda==='MXN') asEUR=raw/eurmxn;
  else if(moneda==='GBP') asEUR=raw*gbpeur;
  settings.ingresos[tipo]=Math.round(asEUR*100)/100;
  saveAll();
}

function openRecurrentesModal(){
  openModal(`
    <div class="modal-header"><div class="modal-title">🔄 ${t('recurrentesTitulo')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div id="recList">
      ${recurrentes.map(r=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card2);border-radius:12px;margin-bottom:8px">
          <div style="font-size:20px">${r.icon||'📌'}</div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${r.nombre}</div><div style="font-size:11px;color:var(--text2)">${r.frecuencia} · ${t('dia')} ${r.dia}</div></div>
          <div style="font-size:15px;font-weight:800;color:var(--red);margin-right:8px">-${fmt(r.importe)}</div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0"><input type="checkbox" ${r.activo?'checked':''} onchange="toggleRecurrente('${r.id}',this.checked)" style="accent-color:var(--blue);width:16px;height:16px"><span style="font-size:11px;color:var(--text2)">${r.activo?t('activo'):t('inactivo')}</span></label>
          <button class="edit-btn" onclick="openEditRecurrenteModal('${r.id}')">✏️</button>
          <button class="del-btn" onclick="deleteRecurrente('${r.id}')" style="opacity:0.8">×</button>
        </div>`).join('')}
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">+ ${t('nuevoRecurrente')}</div>
      <form id="recForm" onsubmit="addRecurrente();return false">
        <div class="form-row form-row-2">
          <div class="form-group"><label class="form-label">${t('categoria')}</label><select class="form-select" id="rCat" onchange="syncRecurrenteName()">${EXPENSE_CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="rNombre" required></div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">${t('importe')}</label><input type="number" class="form-input" id="rImporte" required></div>
          <div class="form-group"><label class="form-label">${t('frecuencia')}</label><select class="form-select" id="rFrec">${FRECUENCIAS.map(f=>`<option>${f}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">${t('dia')}</label><input type="number" class="form-input" id="rDia" value="1" min="1" max="28"></div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:4px">${t('agregar')}</button>
      </form>
    </div>
  `);
}
function syncRecurrenteName(){const cat=document.getElementById('rCat')?.value;const nombreEl=document.getElementById('rNombre');if(!cat||!nombreEl)return;const c=EXPENSE_CATS.find(x=>x.id===cat);if(c)nombreEl.value=c.name;}
function addRecurrente(){const nombre=document.getElementById('rNombre').value,importe=Number(document.getElementById('rImporte').value);if(!nombre||!importe)return;recurrentes.push({id:uid(),nombre,importe,categoria:document.getElementById('rCat').value,frecuencia:document.getElementById('rFrec').value,dia:Number(document.getElementById('rDia').value)||1,icon:'📌',color:'#0A84FF',activo:true});saveAll();openRecurrentesModal();}
function toggleRecurrente(id,val){recurrentes=recurrentes.map(r=>r.id!==id?r:{...r,activo:val});saveAll();}
function openEditRecurrenteModal(id){
  const r=recurrentes.find(x=>x.id===id); if(!r) return;
  openModal(`<div class="modal-header"><div class="modal-title">✏️ ${t('editar')} ${t('recurrente')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="erNombre" value="${r.nombre||''}" required></div>
    <div class="form-row form-row-2">
      <div class="form-group"><label class="form-label">${t('categoria')}</label><select class="form-select" id="erCat">${EXPENSE_CATS.map(c=>`<option value="${c.id}" ${r.categoria===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">${t('importe')}</label><input type="number" class="form-input" id="erImporte" value="${r.importe||''}" required></div>
    </div>
    <div class="form-row form-row-2">
      <div class="form-group"><label class="form-label">${t('frecuencia')}</label><select class="form-select" id="erFrec">${FRECUENCIAS.map(f=>`<option ${r.frecuencia===f?'selected':''}>${f}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">${t('dia')}</label><input type="number" class="form-input" id="erDia" value="${r.dia||1}" min="1" max="28"></div>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="saveRecurrente('${id}')">${t('guardar')}</button>`);
}
function saveRecurrente(id){
  const nombre=document.getElementById('erNombre').value, importe=Number(document.getElementById('erImporte').value);
  if(!nombre||!importe) return;
  recurrentes=recurrentes.map(r=>r.id!==id?r:{...r,nombre,importe,categoria:document.getElementById('erCat').value,frecuencia:document.getElementById('erFrec').value,dia:Number(document.getElementById('erDia').value)||1});
  saveAll(); openRecurrentesModal();
}
function deleteRecurrente(id){if(!confirm(t('deleteRecurrenteConfirm')))return;recurrentes=recurrentes.filter(r=>r.id!==id);saveAll();openRecurrentesModal();}

// ============================================
// INVERSIONES
// ============================================
function renderInversiones(){
  const tc = settings.tipoCambio || 18;
  const tickers = getTickerPositions();
  const abiertas = tickers.filter(pos => pos.cantActual > 0);
  const cerradas = tickers.filter(pos => pos.cantActual <= 0);

  const totalCosto = abiertas.reduce((s,t) => s + t.costoPosicion * (t.moneda==='MXN'?1:tc), 0);
  const totalValor = abiertas.reduce((s,t) => s + (t.valorActual||t.costoPosicion||0) * (t.moneda==='MXN'?1:tc), 0);
  const totalGP = totalValor - totalCosto;
  const totalGPPct = totalCosto > 0 ? totalGP / totalCosto : 0;
  const gpRealTotal = tickers.reduce((s,t) => s + (t.gpRealizada||0) * (t.moneda==='MXN'?1:tc), 0);

  const porTipo = {};
  abiertas.forEach(t => {
    const tipo = t.type || 'Otro';
    const val = (t.valorActual||t.costoPosicion||0) * (t.moneda==='MXN'?1:tc);
    porTipo[tipo] = (porTipo[tipo]||0) + val;
  });
  const tipoEntries = Object.entries(porTipo).sort((a,b)=>b[1]-a[1]);
  const TIPO_COLORS = {'ETF':'var(--blue)','Acción':'var(--green)','Crypto':'var(--orange)','Bono':'var(--teal)','Otro':'var(--text2)'};

  const porMoneda = {};
  abiertas.forEach(t => {
    const val = (t.valorActual||t.costoPosicion||0) * (t.moneda==='MXN'?1:tc);
    porMoneda[t.moneda||'USD'] = (porMoneda[t.moneda||'USD']||0) + val;
  });

  document.getElementById('page-inversiones').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">📈 ${t('seccionInversiones')}</div><div class="section-sub">${abiertas.length} ${t('posicionesAbiertas')} · ${cerradas.length} ${t('posicionesCerradas')}</div></div>
      <button class="btn btn-primary btn-sm" onclick="openMovModal('inversiones')">${t('nuevoMovimiento')}</button>
    </div>

    <div class="grid-4" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)">
        <div class="stat-label">${t('costoTotal')}</div>
        <div class="stat-value">${fmt(totalCosto)}</div>
        <div class="stat-sub">${abiertas.length} ${t('posiciones')}</div>
      </div>
      <div class="card stat" style="border-top:3px solid var(--green)">
        <div class="stat-label">${t('valorActual')}</div>
        <div class="stat-value">${fmt(totalValor)}</div>
        <div class="stat-sub">${abiertas.some(pos=>pos.gpNoRealizada!==null)?t('preciosHoy'):t('costoCompra')}</div>
      </div>
      <div class="card stat" style="border-top:3px solid ${pctCol(totalGP)}">
        <div class="stat-label">${t('gpNoRealizada')}</div>
        <div class="stat-value" style="color:${pctCol(totalGP)}">${totalGP>=0?'+':''}${fmt(totalGP)}</div>
        <div class="stat-sub" style="color:${pctCol(totalGPPct)}">${fmtPct(totalGPPct)}</div>
      </div>
      <div class="card stat" style="border-top:3px solid ${pctCol(gpRealTotal)}">
        <div class="stat-label">${t('gpRealizada')}</div>
        <div class="stat-value" style="color:${pctCol(gpRealTotal)}">${gpRealTotal>=0?'+':''}${fmt(gpRealTotal)}</div>
        <div class="stat-sub">${cerradas.length} ${t('posicionesCerradas')}${(()=>{const divTotal=tickers.reduce((s,t)=>(s+(t.dividendoTotal||0)*(t.moneda==='MXN'?1:tc)),0);return divTotal>0?` · 💰 ${fmt(Math.round(divTotal))} div.`:'';})()}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">🥧 ${t('porTipoActivo')}</div>
        ${tipoEntries.map(([tipo, val]) => {
          const pct = totalValor > 0 ? val/totalValor : 0;
          const color = TIPO_COLORS[tipo] || 'var(--text2)';
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="font-weight:700;color:${color}">${tipo}</span>
              <span style="color:var(--text2)">${fmt(val)} <strong style="color:var(--text)">${(pct*100).toFixed(1)}%</strong></span>
            </div>
            <div class="progress-bg"><div class="progress-fill" style="background:${color};width:${(pct*100).toFixed(1)}%"></div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="card">
        <div class="card-title">🌍 ${t('porMoneda')}</div>
        ${Object.entries(porMoneda).sort((a,b)=>b[1]-a[1]).map(([mon, val]) => {
          const pct = totalValor > 0 ? val/totalValor : 0;
          const color = mon==='MXN'?'var(--green)':mon==='USD'?'var(--blue)':'var(--purple)';
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
              <span style="font-weight:700;color:${color}">${mon==='MXN'?'🇲🇽':mon==='USD'?'🇺🇸':'🇪🇺'} ${mon}</span>
              <span style="color:var(--text2)">${fmt(val)} <strong style="color:var(--text)">${(pct*100).toFixed(1)}%</strong></span>
            </div>
            <div class="progress-bg"><div class="progress-fill" style="background:${color};width:${(pct*100).toFixed(1)}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,58%) minmax(0,42%);gap:16px;margin-bottom:16px;align-items:start">

      <!-- POSICIONES ABIERTAS -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="card-title" style="margin:0">📂 ${t('posicionesAbiertas')} <span style="font-size:11px;font-weight:600;color:var(--text2);margin-left:4px">${abiertas.length}</span></div>
        </div>
        <div style="max-height:480px;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${abiertas.length > 0 ? abiertas.sort((a,b) => {
          const va = (a.valorActual||a.costoPosicion||0)*(a.moneda==='MXN'?1:tc);
          const vb = (b.valorActual||b.costoPosicion||0)*(b.moneda==='MXN'?1:tc);
          return vb - va;
        }).map(pos => {
          const tipoClass = pos.type==='Acción'?'badge-green':pos.type==='ETF'?'badge-blue':pos.type==='Crypto'?'badge-orange':'badge-gray';
          const valorMXN = (pos.valorActual||pos.costoPosicion||0)*(pos.moneda==='MXN'?1:tc);
          const costoMXN = pos.costoPosicion*(pos.moneda==='MXN'?1:tc);
          const gpMXN = valorMXN - costoMXN;
          const pctPort = totalValor > 0 ? valorMXN/totalValor : 0;
          const brokersInfo = pos.brokersSaldo&&pos.brokersSaldo.length>0 ? pos.brokersSaldo.map(b=>b.broker+(b.cantActual!==pos.cantActual?' ('+( b.cantActual%1===0?b.cantActual:parseFloat(b.cantActual.toFixed(4)))+')':'')).join(', ') : '';
          const _invGpT=(pos.gpNoRealizada||0)+(pos.dividendoTotal||0);
          const _invGpPct=pos.costoPosicion>0?_invGpT/pos.costoPosicion:null;
          const _cur=pos.moneda==='MXN'?'$':'US$';
          return `<div style="display:grid;grid-template-columns:1.4fr 0.7fr 0.9fr 0.9fr 1fr;gap:0;padding:10px 4px;border-bottom:0.5px solid var(--border)">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <span class="badge ${tipoClass}">${pos.ticker}</span>
              <div style="font-size:10px;color:var(--text2);min-width:0;overflow:hidden">
                <div><span>×${pos.cantActual%1===0?pos.cantActual:parseFloat(pos.cantActual.toFixed(4))}</span> <span class="${pos.priceCssClass}">${pos.priceLabel}</span></div>
                <div style="color:var(--text3)">${(pctPort*100).toFixed(1)}% port.${brokersInfo?' · '+brokersInfo:''}</div>
              </div>
            </div>
            <div style="text-align:right;align-self:center">
              ${pos.dividendoTotal>0?`<div style="font-size:12px;font-weight:700;color:var(--blue)">+${fmtFull(pos.dividendoTotal)}</div><div style="font-size:10px;color:var(--text3)">${pos.moneda}</div>`:'<div style="font-size:10px;color:var(--text3)">—</div>'}
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:11px;font-weight:600;color:var(--text2)">${_cur}${pos.precioCostoPromedio.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:11px;font-weight:700" class="${pos.priceCssClass}">${pos.priceLabel}</div>
            </div>
            <div style="text-align:right;align-self:center">
              <div style="font-size:13px;font-weight:800;color:${pctCol(_invGpT)}">${pos.gpNoRealizada!==null?(_invGpT>=0?'+':'')+fmtFull(_invGpT)+' '+pos.moneda:t('sinPrecio')}</div>
              <div style="font-size:10px;font-weight:600;color:${pctCol(_invGpPct)}">${_invGpPct!==null?fmtPct(_invGpPct):''}</div>
            </div>
          </div>`;
        }).join('') : `<div style="text-align:center;color:var(--text2);padding:48px 24px"><div style="font-size:40px;margin-bottom:12px">📈</div><div style="font-size:15px;font-weight:700;margin-bottom:8px;color:var(--text)">${t('sinPosicionesAbiertas')}</div><div style="font-size:13px;margin-bottom:20px">${t('registraPrimeraCompra')}</div><button class="btn btn-primary" onclick="openMovModal('inversiones')">+ ${t('primerMovimiento')}</button></div>`}
        </div>
      </div>

      <!-- POSICIONES CERRADAS -->
      <div class="card" style="${cerradas.length===0?'opacity:0.5':''};padding:${cerradas.length<=3?'14px 20px':'20px 24px'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="card-title" style="margin:0">🔒 ${t('posicionesCerradas')} <span style="font-size:11px;font-weight:600;color:var(--text2);margin-left:4px">${cerradas.length}</span></div>
        </div>
        <div style="max-height:${cerradas.length > 0 ? Math.min(cerradas.length * 58 + 16, 320) : 60}px;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${cerradas.length > 0 ? cerradas.map(cp => {
          const tipoClass = cp.type==='Acción'?'badge-green':cp.type==='ETF'?'badge-blue':cp.type==='Crypto'?'badge-orange':'badge-gray';
          return `<div class="list-item" style="padding:10px 0">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <span class="badge ${tipoClass}">${cp.ticker}</span>
              <div style="font-size:11px;color:var(--text2);min-width:0">
                <span style="font-weight:600">${cp.type}</span>
                <span style="margin:0 4px">·</span>
                <span>${t('costo')} ${fmtFull(cp.costoTotal)} ${cp.moneda}</span>
                ${cp.comisionTotal>0?`<span style="margin-left:4px;color:var(--text3)">· com. ${cp.moneda==='MXN'?'$':'US$'}${cp.comisionTotal.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`:''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:13px;font-weight:800;color:${pctCol(cp.gpRealizada)}">${(cp.gpRealizada||0)>=0?'+':''}${fmtFull(cp.gpRealizada||0)} ${cp.moneda}</div>
              <div style="font-size:10px;font-weight:600;color:var(--text2)">${t('realizada')}</div>
            </div>
          </div>`;
        }).join('') : `<div style="text-align:center;color:var(--text2);padding:20px 16px"><div style="font-size:28px;margin-bottom:6px">🔒</div><div style="font-size:12px;color:var(--text3)">${t('sinResultados')||'Sin posiciones cerradas'}</div></div>`}
        </div>
      </div>

    </div>
  `;
}

function renderMetas(){
  const tc=settings.tipoCambio;
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
  const monedaMostrar2=ingresos.monedaSueldo||'EUR';
  const monSymbol2={EUR:'€',USD:'US$',MXN:'$',GBP:'£'}[monedaMostrar2]||'€';
  const fmtEUR=v=>{
    let conv=Number(v||0);
    if(monedaMostrar2!=='EUR'){const eurmxn2=getEurMxn();const fx2=_fxCache||LS.get('fxCache');const usdeur2=fx2?.usdeur||0.88;const gbpeur2=fx2?(fx2.usdeur/(fx2.usdgbp||1)):1.17;if(monedaMostrar2==='USD')conv=conv/usdeur2;else if(monedaMostrar2==='MXN')conv=conv*eurmxn2;else if(monedaMostrar2==='GBP')conv=conv/gbpeur2;}
    return monSymbol2+conv.toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
  };
  const re=settings.rendimientoEsperado??0.06;

  const metasData = goals.map(g=>{
    let actual=0;
    if(g.clase==='Patrimonio Total'||g.clase==='Todos')actual=patrimonioTotal;
    else if(g.clase==='Plataformas')actual=totalMXN;
    else if(g.clase==='Inversiones')actual=totalInvMXN;
    else if(g.clase==='Ingreso Mensual')actual=ingresoMensualEUR;
    else actual=patrimonioTotal;
    const pct=g.meta>0?Math.min(actual/g.meta,1):0;
    const restante=Math.max(g.meta-actual,0);
    const mesesEstimados=restante>0&&actual>0?Math.ceil(Math.log(g.meta/Math.max(actual,1))/Math.log(1+re/12)):0;
    const sc=pct>=1?'var(--green)':pct>=0.8?'var(--orange)':pct>=0.3?'var(--blue)':'var(--text2)';
    const st=pct>=1?t('lograda'):pct>=0.8?t('casi'):pct>=0.3?t('enProceso'):t('inicio');
    const isEUR=g.clase==='Ingreso Mensual';
    const fmtVal=v=>isEUR?fmtEUR(v):fmt(v);
    let fechaEst='';
    if(pct<1&&mesesEstimados>0){
      const d=new Date();d.setMonth(d.getMonth()+mesesEstimados);
      fechaEst=d.toLocaleDateString('es-ES',{month:'short',year:'numeric'});
    }
    return {...g, actual, pct, restante, mesesEstimados, sc, st, fmtVal, fechaEst, isEUR};
  });

  const metasOrdenadas=[...metasData].sort((a,b)=>{
    if(!a.fechaLimite&&!b.fechaLimite)return 0;
    if(!a.fechaLimite)return 1;
    if(!b.fechaLimite)return -1;
    return a.fechaLimite.localeCompare(b.fechaLimite);
  });

  document.getElementById('page-metas').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">🎯 ${t('agregarMeta')}</div><div class="section-sub">${goals.length} ${t('metas')} · ${t('rendimientoEsperado')} ${(re*100).toFixed(0)}% ${t('anual')}</div></div>
      <button class="btn btn-primary" onclick="openGoalModal()">+ ${t('agregarMeta')}</button>
    </div>

    <div class="grid-4" style="margin-bottom:20px">
      ${statCard('🏦 '+t('seccionPlataformas'),fmt(totalMXN),t('saldoTotal'),'var(--blue)','var(--blue)')}
      ${statCard('📈 '+t('seccionInversiones'),fmt(totalInvMXN),t('aPreciosActuales'),'#BF5AF2','#BF5AF2')}
      ${statCard(`💰 ${t('patrimonioTotal')}`,fmt(patrimonioTotal),t('todoIncluido'),'var(--green)','var(--green)')}
      ${statCard('💳 '+t('ingresoMensual'),fmtEUR(ingresoMensualEUR),t('sueldoExtras'),'','var(--orange)')}
    </div>

    ${goals.length===0?`<div class="card" style="text-align:center;padding:48px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">🎯</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">${t('sinMetas')}</div>
      <div style="font-size:13px;margin-bottom:20px">${t('defineMetas')}</div>
      <button class="btn btn-primary" onclick="openGoalModal()">${t('crearPrimeraMeta')}</button>
    </div>` : `

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">📅 ${t('lineaDeTiempo')}</div>
      <div style="position:relative;padding:8px 0 4px">
        <div style="position:absolute;left:20px;top:0;bottom:0;width:2px;background:var(--border);border-radius:2px"></div>
        ${metasOrdenadas.map((g,i)=>`
          <div style="position:relative;padding-left:52px;margin-bottom:${i<metasOrdenadas.length-1?'24':'8'}px">
            <div style="position:absolute;left:10px;top:4px;width:22px;height:22px;border-radius:50%;background:${g.sc};display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:800;z-index:1;box-shadow:0 0 0 3px var(--card)">${g.pct>=1?'✓':Math.round(g.pct*100)+'%'}</div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:4px">
              <div>
                <div style="font-size:14px;font-weight:700">${g.nombre}</div>
                <div style="font-size:11px;color:var(--text2);margin-top:1px">${g.clase}${g.fechaLimite?' · '+t('fechaLimite')+' '+g.fechaLimite:''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <span class="badge" style="background:${g.sc}18;color:${g.sc}">${g.st}</span>
                <div style="font-size:11px;color:var(--text2);margin-top:3px">${g.fechaEst?'~'+g.fechaEst:g.pct>=1?t('lograda'):''}</div>
              </div>
            </div>
            <div style="margin-top:8px">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                <span style="color:var(--text);font-weight:600">${g.fmtVal(g.actual)}</span>
                <span style="color:var(--text2)">${t('goalLabel')}: ${g.fmtVal(g.meta)}</span>
              </div>
              <div class="progress-bg" style="height:6px"><div class="progress-fill" style="background:${g.sc};width:${(g.pct*100).toFixed(1)}%;height:6px"></div></div>
            </div>
            ${g.pct<1&&g.mesesEstimados>0?`<div style="font-size:11px;color:var(--text2);margin-top:6px">⏱ ~${g.mesesEstimados} ${t('meses')} · ${t('restan')} ${g.fmtVal(g.restante)}</div>`:''}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="grid-2">
      ${metasData.map(g=>`
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:16px;font-weight:700">${g.nombre}</div>
              <div style="font-size:11px;color:var(--text2)">${g.clase} · ${g.fechaLimite||t('sinFecha')}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="badge" style="background:${g.sc}18;color:${g.sc}">${g.st}</span>
              <button class="edit-btn" onclick="openEditGoalModal('${g.id}')">✏️</button>
              <button class="del-btn" onclick="deleteGoal('${g.id}')">×</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
            <span style="font-weight:600">${g.fmtVal(g.actual)}</span>
            <span style="color:var(--text2)">${g.fmtVal(g.meta)}</span>
          </div>
          <div class="progress-bg"><div class="progress-fill" style="background:${g.sc};width:${(g.pct*100).toFixed(1)}%"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px">
            <span style="color:var(--text2)">${g.pct<1&&g.mesesEstimados>0?'⏱ ~'+g.mesesEstimados+' '+t('meses'):''}</span>
            <span style="font-weight:700;color:${g.sc}">${(g.pct*100).toFixed(1)}%</span>
          </div>
        </div>
      `).join('')}
    </div>`}
  `;
}
function openGoalModal(){openModal(`<div class="modal-header"><div class="modal-title">${t('nuevaMeta')}</div><button class="modal-close" onclick="closeModal()">✕</button></div><form onsubmit="addGoal();return false"><div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="gName" required></div><div class="form-row form-row-2"><div class="form-group"><label class="form-label">${t('clase')}</label><select class="form-select" id="gClase"><option>${t('patrimonioTotal')}</option><option>${t('seccionPlataformas')}</option><option>${t('seccionInversiones')}</option><option>${t('ingresoMensual')}</option></select></div><div class="form-group"><label class="form-label">${t('meta')}</label><input type="number" class="form-input" id="gMeta" required></div></div><div class="form-group"><label class="form-label">${t('fechaLimite')}</label><input type="date" class="form-input" id="gFecha"></div><div class="form-group"><label class="form-label">${t('descripcion')}</label><input class="form-input" id="gDesc"></div><button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px">${t('crear')}</button></form>`);}
function openEditGoalModal(id){
  const g=goals.find(x=>x.id===id); if(!g) return;
  openModal(`<div class="modal-header"><div class="modal-title">✏️ ${t('editar')} ${t('meta')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-group"><label class="form-label">${t('nombre')}</label><input class="form-input" id="egName" value="${g.nombre||''}" required></div>
    <div class="form-row form-row-2">
      <div class="form-group"><label class="form-label">${t('clase')}</label><select class="form-select" id="egClase"><option ${g.clase==='Patrimonio Total'?'selected':''}>${t('patrimonioTotal')}</option><option ${g.clase==='Plataformas'?'selected':''}>${t('seccionPlataformas')}</option><option ${g.clase==='Inversiones'?'selected':''}>${t('seccionInversiones')}</option><option ${g.clase==='Ingreso Mensual'?'selected':''}>${t('ingresoMensual')}</option></select></div>
      <div class="form-group"><label class="form-label">${t('meta')}</label><input type="number" class="form-input" id="egMeta" value="${g.meta||''}" required></div>
    </div>
    <div class="form-group"><label class="form-label">${t('fechaLimite')}</label><input type="date" class="form-input" id="egFecha" value="${g.fechaLimite||''}"></div>
    <div class="form-group"><label class="form-label">${t('descripcion')}</label><input class="form-input" id="egDesc" value="${g.descripcion||''}"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="saveGoal('${id}')">${t('guardar')}</button>`);
}
function saveGoal(id){
  const nombre=document.getElementById('egName').value, meta=Number(document.getElementById('egMeta').value);
  if(!nombre||!meta) return;
  goals=goals.map(g=>g.id!==id?g:{...g,nombre,clase:document.getElementById('egClase').value,meta,fechaLimite:document.getElementById('egFecha').value,descripcion:document.getElementById('egDesc').value});
  saveAll(); closeModal();
}
function addGoal(){const nombre=document.getElementById('gName').value,meta=Number(document.getElementById('gMeta').value);if(!nombre||!meta)return;goals.push({id:uid(),nombre,clase:document.getElementById('gClase').value,meta,fechaLimite:document.getElementById('gFecha').value,descripcion:document.getElementById('gDesc').value});saveAll();closeModal();}
function deleteGoal(id){if(!confirm(t('deleteGoalConfirm')))return;goals=goals.filter(g=>g.id!==id);saveAll();}

// ============================================
// AJUSTES
// ============================================
function estimateDocSize() {
  const mainDoc = { platforms, goals, settings, recurrentes };
  const mainBytes = JSON.stringify(mainDoc).length;
  const movBytes = JSON.stringify(movements).length;
  const snapBytes = JSON.stringify(patrimonioHistory).length;
  return { mainBytes, movBytes, snapBytes,
           totalBytes: mainBytes + movBytes + snapBytes };
}

function getStorageInfo() {
  const est = estimateDocSize();
  const totalKb = est.totalBytes / 1024;
  const mainKb = est.mainBytes / 1024;
  const mainPct = (est.mainBytes / (1024 * 1024)) * 100;
  const color = mainPct >= 80 ? 'var(--red)' : mainPct >= 60 ? 'var(--orange)' : 'var(--green)';
  return { kb: totalKb, mainKb, mainPct, color,
           movCount: movements.length, snapCount: patrimonioHistory.length };
}

function openArchivarModal() {
  const plats = calcPlatforms();
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  const movsAArchivar = movements.filter(m => m.seccion === 'plataformas' && m.fecha < cutoffStr);
  const movsBloqueados = movements.filter(m => m.seccion !== 'plataformas' || m.fecha >= cutoffStr);
  const ahorroBytes = JSON.stringify(movsAArchivar).length;

  openModal(`
    <div class="modal-header"><div class="modal-title">🗜️ ${t('archivarMovAnt')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.6">
      ${t('archivoExplicacion', cutoffStr)}
    </div>
    <div style="background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px">
      <div style="font-weight:700;margin-bottom:6px">📦 ${t('queSeArchivara')}</div>
      <div style="color:var(--text2)">${movsAArchivar.length} ${t('movimientosPlataforma')} → <strong style="color:var(--green)">~${(ahorroBytes/1024).toFixed(1)} KB ${t('liberados')}</strong></div>
      <div style="color:var(--text2);margin-top:4px">${t('inversionesGastosNoAfectados')}</div>
    </div>
    <div style="background:var(--card2);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;max-height:200px;overflow-y:auto">
      ${plats.map(p => {
        const movsPlat = movsAArchivar.filter(m => m.platform === p.name);
        if (movsPlat.length === 0) return '';
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600">${escHtml(p.name)}</span>
          <span style="color:var(--text2)">${movsPlat.length} movs → ${t('saldo')} <strong>${fmtPlat(p.saldo, p.moneda)}</strong> · G/L <strong style="color:${pctCol(p.rendimiento)}">${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento, p.moneda)}</strong></span>
        </div>`;
      }).join('')}
    </div>
    <div style="background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.2);border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:var(--text2)">
      ⚠️ <strong>${t('recomendado')}:</strong> ${t('exportarAntes')}
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary" onclick="exportData();closeModal();setTimeout(openArchivarModal,300)">📥 ${t('exportarPrimero')}</button>
      <button class="btn btn-primary" style="flex:1" onclick="ejecutarArchivado('${cutoffStr}')">🗜️ ${t('archivarAhora')}</button>
    </div>
  `);
}

function ejecutarArchivado(cutoffStr) {
  const plats = calcPlatforms();
  const nuevosMovsArchivados = [];
  plats.forEach(p => {
    const movsPlat = movements.filter(m => m.seccion === 'plataformas' && m.platform === p.name && m.fecha < cutoffStr);
    if (movsPlat.length === 0) return;
    let saldoArchivado = p.saldoInicial;
    let gananciaArchivada = 0;
    movements.filter(m => m.seccion === 'plataformas' && m.platform === p.name && m.fecha < cutoffStr)
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
      .forEach(m => {
        if (m.tipoPlat === 'Aportación' || m.tipoPlat === 'Transferencia entrada') saldoArchivado += m.monto;
        else if (m.tipoPlat === 'Retiro' || m.tipoPlat === 'Transferencia salida') saldoArchivado -= m.monto;
        else if (m.tipoPlat === 'Gasto') saldoArchivado -= m.monto;
        else if (m.tipoPlat === 'Saldo Actual') {
          gananciaArchivada += m.monto - saldoArchivado;
          saldoArchivado = m.monto;
        }
      });
    nuevosMovsArchivados.push({
      id: uid(),
      seccion: 'plataformas',
      platform: p.name,
      fecha: cutoffStr,
      tipoPlat: 'Saldo Archivado',
      monto: saldoArchivado,
      gananciaHistorica: gananciaArchivada,
      desc: `${t('historicalArchive')} ${cutoffStr} · ${t('accumulatedGL')}: ${gananciaArchivada >= 0 ? '+' : ''}${fmtPlat(gananciaArchivada, p.moneda)}`,
    });
  });
  movements = [
    ...nuevosMovsArchivados,
    ...movements.filter(m => m.seccion !== 'plataformas' || m.fecha >= cutoffStr)
  ];
  saveAll();
  if(typeof window.saveAllMovementsToFirebase==='function' && window._currentUser?.uid){
    window.saveAllMovementsToFirebase();
  }
  closeModal();
  alert(`✅ ${t('archivoCompletado', nuevosMovsArchivados.length)}`);
}

function renderAjustes(){
  const hasFinnhub=!!(settings.finnhubKey);const priceSummary=getPriceSummary();
  const cache=getPriceCache();const cacheEntries=Object.entries(cache);
  const currentUser=window._currentUser;const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const isAdmin = window._currentUser?.uid === ADMIN_UID;
  const adminFirebaseRulesHTML = isAdmin ? (
    '<div class="card" style="margin-top:16px;padding:16px 20px">' +
    `<div class="card-title">${t('reglasFb')}</div>` +
    '<div class="uid-box" onclick="navigator.clipboard.writeText(this.textContent.trim()).then(()=>this.style.borderColor=\'var(--green)\')" title="Click to copy" style="margin-top:6px;font-size:11px;white-space:pre">' +
    'rules_version = \'2\';\n' +
    'service cloud.firestore {\n' +
    '  match /databases/{database}/documents {\n' +
    '    match /usuarios/{uid}/datos/main {\n' +
    '      allow read, write: if request.auth != null && request.auth.uid == uid;\n' +
    '    }\n' +
    '    match /usuarios/{uid}/meta/perfil {\n' +
    '      allow read, write: if request.auth != null && request.auth.uid == uid;\n' +
    '    }\n' +
    '    match /registros/{uid} {\n' +
    '      allow create: if request.auth != null && request.auth.uid == uid;\n' +
    '      allow update, read: if request.auth != null && (request.auth.uid == uid || request.auth.uid == \'vZBQ7d80yPSxbmar96UqPHXDpd32\');\n' +
    '      allow delete: if request.auth != null && request.auth.uid == \'vZBQ7d80yPSxbmar96UqPHXDpd32\';\n' +
    '    }\n' +
    '  }\n' +
    '}' +
    '</div></div>'
  ) : '';
  document.getElementById('page-ajustes').innerHTML=`
    <div class="section-title" style="margin-bottom:24px">⚙️ ${t('ajustes')}</div>

    ${isAdmin ? `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(191,90,242,0.06);border:1px solid rgba(191,90,242,0.2);border-radius:14px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">👑</span>
        <div><div style="font-size:13px;font-weight:700">${t('adminPanel')}</div><div style="font-size:11px;color:var(--text2)">${t('manageUsersDesc')}</div></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="window.openAdminPanel()">${t('manageUsers')}</button>
    </div>` : ''}

    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--blue)">
      <div class="card-title">${t('cuenta')}</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:8px;flex-wrap:wrap">
        ${currentUser?.photoURL?`<img src="${currentUser.photoURL}" style="width:48px;height:48px;border-radius:24px">`:`<div style="width:48px;height:48px;border-radius:24px;background:var(--blue);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff">👤</div>`}
        <div style="flex:1"><div style="font-size:16px;font-weight:700">${currentUser?.displayName||t('usuario')}</div><div style="font-size:13px;color:var(--text2)">${currentUser?.email||''}</div></div>
        <button class="btn btn-danger btn-sm" onclick="window.signOutUser()">${t('salir')}</button>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">${t('tipoCambio')}</div>
        <div id="tcCardContent">
          ${(()=>{
            const fx=_fxCache||LS.get('fxCache');
            const isLive=fx&&isCacheFresh(fx.ts);
            const ts=isLive?new Date(fx.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'';
            const vUSD=isLive&&fx.usdmxn?fx.usdmxn.toFixed(2):(settings.tipoCambio);
            const vEUR=isLive&&fx.eurmxn?fx.eurmxn.toFixed(2):(settings.tipoEUR);
            const vGBP=isLive&&fx.gbpmxn?fx.gbpmxn.toFixed(2):(settings.tipoGBP);
            const statusBadge=isLive
              ? '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;color:var(--green)"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span>'+t('liveECB')+' · '+ts+'</div>'
              : '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:11px;color:var(--orange)"><span style="width:7px;height:7px;border-radius:50%;background:var(--orange);display:inline-block"></span>'+t('manual')+' · '+t('pressUpdate')+'</div>';
            return statusBadge
              + '<div style="display:flex;flex-direction:column;gap:10px">'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddfa\ud83c\uddf8 USD =</span><input type="number" step="0.01" id="inputTCUSD" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vUSD+'" onchange="window.settings.tipoCambio=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddea\ud83c\uddfa EUR =</span><input type="number" step="0.01" id="inputTCEUR" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vEUR+'" onchange="window.settings.tipoEUR=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">\ud83c\uddec\ud83c\udde7 GBP =</span><input type="number" step="0.01" id="inputTCGBP" class="form-input" style="width:110px;font-size:18px;font-weight:700;text-align:center" value="'+vGBP+'" onchange="window.settings.tipoGBP=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div>'
              + '<button class="btn btn-secondary btn-sm" onclick="forceUpdateFX()">🔄 '+t('updateLive')+'</button>'
              + '</div>';
          })()}
        </div>
      </div>
      
    </div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">🔑 ${t('apiKeyFinnhub')} <span style="font-weight:400;color:var(--text3)">(US stocks)</span></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input type="text" class="form-input" style="flex:1;min-width:200px;font-family:monospace;font-size:13px" id="finnhubKeyInput" placeholder="${t('pasteApiKey')}" value="${settings.finnhubKey||''}" oninput="window.settings.finnhubKey=this.value.trim();saveAll()"><button class="btn btn-primary" onclick="testFinnhub()">${t('probar')}</button>${hasFinnhub?`<span style="font-size:12px;color:var(--green)">✅</span>`:''}</div>
        <div id="finnhubTestResult" style="margin-top:8px;font-size:12px"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3)">${t('freeAt')} <a href="https://finnhub.io" target="_blank" style="color:var(--blue)">finnhub.io</a></div>
      </div>

      <div class="card">
        <div class="card-title">🔑 ${t('apiKeyAlpha')} <span style="font-weight:400;color:var(--text3)">(VUAA.LON, London/Xetra ETFs)</span></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input type="text" class="form-input" style="flex:1;min-width:200px;font-family:monospace;font-size:13px" id="alphaVantageKeyInput" placeholder="${t('pasteApiKey')}" value="${settings.alphaVantageKey||''}" oninput="window.settings.alphaVantageKey=this.value.trim();saveAll()"><button class="btn btn-primary" onclick="testAlphaVantage()">${t('probar')}</button>${settings.alphaVantageKey?`<span style="font-size:12px;color:var(--green)">✅</span>`:''}</div>
        <div id="alphaVantageTestResult" style="margin-top:8px;font-size:12px"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3)">${t('freeAt')} <a href="https://alphavantage.co" target="_blank" style="color:var(--blue)">alphavantage.co</a> · 25 req/day</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-title">${t('exportarImportar')}</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><button class="btn btn-primary" onclick="exportData()">📥 ${t('exportar')} JSON (backup)</button><button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">📤 ${t('importar')} JSON (backup)</button><button class="btn btn-secondary" onclick="openImportCSVModal()">📊 ${t('importarExcel')}</button><input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)"></div></div>
      <div class="card">
        <div class="card-title">${t('archivarMovAnt')}</div>
        <div style="margin-top:8px;font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:14px">${t('archivarDesc')}</div>
        <button class="btn btn-secondary" style="width:100%;font-size:13px" onclick="openArchivarModal()">${t('archivarMovAnt')}</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-title">${t('asistenteia')}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.6">${t('iaDesc')}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:10px 12px;background:rgba(10,132,255,0.06);border-radius:10px;border:1px solid rgba(10,132,255,0.15)">
        ⚡ <strong>${t('fallbackAuto')}</strong>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${(()=>{
          const aiProviders=[
            {id:'groq',   label:'Groq',        badge:'Free',         ph:'gsk_...',    url:'https://console.groq.com',        urlLabel:'console.groq.com'},
            {id:'gemini', label:'Gemini',       badge:'Free',         ph:'AIza...',    url:'https://aistudio.google.com',     urlLabel:'aistudio.google.com'},
            {id:'deepseek',label:'DeepSeek',    badge:'Almost free',    ph:'sk-...',     url:'https://platform.deepseek.com',   urlLabel:'platform.deepseek.com'},
            {id:'openrouter',label:'OpenRouter',badge:'Free models', ph:'sk-or-...',  url:'https://openrouter.ai/keys',      urlLabel:'openrouter.ai/keys'},
          ];
          return aiProviders.map(p=>{
            const val=(settings.aiKeys||{})[p.id]||'';
            const ok=!!val;
            return '<div style="background:var(--card2);border-radius:12px;padding:12px 14px;border:1px solid '+(ok?'rgba(48,209,88,0.3)':'var(--border)')+'">'+
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
                '<div style="display:flex;align-items:center;gap:8px">'+
                  '<span style="font-size:13px;font-weight:700">'+p.label+'</span>'+
                  '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(48,209,88,0.12);color:var(--green)">'+p.badge+'</span>'+
                  (ok?'<span style="font-size:12px">✅</span>':'')+
                '</div>'+
                '<a href="'+p.url+'" target="_blank" style="font-size:11px;color:var(--blue)">'+p.urlLabel+'</a>'+
              '</div>'+
              '<div style="display:flex;gap:8px;align-items:center">'+
                '<input type="password" class="form-input" id="aiKey_'+p.id+'" style="flex:1;font-family:monospace;font-size:12px" placeholder="'+p.ph+'" value="'+val+'" '+
                  'oninput="if(!window.settings.aiKeys)window.settings.aiKeys={};window.settings.aiKeys[\'' + p.id + '\']=this.value.trim();saveAll();this.closest(\'div\').style.borderColor=this.value?\'rgba(48,209,88,0.3)\':\'var(--border)\'">'+
                '<button class="btn btn-sm" style="background:var(--card);border:1px solid var(--border);white-space:nowrap" onclick="testAiKey(\'' + p.id + '\')">' + t('probar') + '</button>'+
              '</div>'+
              '<div id="aiKeyTestResult_'+p.id+'" style="margin-top:6px;font-size:11px"></div>'+
            '</div>';
          }).join('');
        })()}
      </div>

    </div>
    <div class="card" style="margin-top:16px"><div class="card-title">${t('zonaPeligro')}</div><button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="resetAll()">🗑 ${t('resetAll')}</button></div>
    ${isAdmin ? adminFirebaseRulesHTML : ''}
  `;
}

async function testAlphaVantage(){
  const inputEl=document.getElementById('alphaVantageKeyInput');
  const k=(inputEl?inputEl.value.trim():'')||settings.alphaVantageKey||'';
  if(k){settings.alphaVantageKey=k;LS.set('settings',settings);if(typeof window.saveToFirebase==='function')window.saveToFirebase();}
  const el=document.getElementById('alphaVantageTestResult');
  if(!el)return;
  if(!k){el.innerHTML='<span style="color:var(--red)">⚠️ '+t('enterApiKey')+'</span>';return;}
  el.innerHTML='<span class="spinner"></span> '+t('testingWith')+' VUAA.LON...';
  try {
    const r=await fetchWithTimeout(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VUAA.LON&apikey=${k}`);
    const d=await r.json();
    const q=d['Global Quote'];
    if(q&&q['05. price']&&parseFloat(q['05. price'])>0){
      el.innerHTML=`<span style="color:var(--green)">✅ VUAA.LON: ${parseFloat(q['05. price']).toFixed(2)} GBp</span>`;
    } else if(d.Note){
      el.innerHTML=`<span style="color:var(--orange)">⚠️ ${t('requestLimitReached')}</span>`;
    } else {
      el.innerHTML=`<span style="color:var(--orange)">⚠️ ${d.Information||d.message||t('unexpectedResponse')}</span>`;
    }
  } catch(e){el.innerHTML=`<span style="color:var(--red)">❌ ${e.message}</span>`;}
}

async function testFinnhub(){const finEl=document.getElementById('finnhubKeyInput');const k=(finEl?finEl.value.trim():'')||settings.finnhubKey||'';if(k){settings.finnhubKey=k;saveAll();}const el=document.getElementById('finnhubTestResult');if(!k){el.innerHTML='<span style="color:var(--red)">⚠️ '+t('enterApiKey')+'</span>';return;}el.innerHTML='<span class="spinner"></span> '+t('testing')+'...';try{const r=await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`),d=await r.json();if(d.c&&d.c>0)el.innerHTML=`<span style="color:var(--green)">✅ AAPL: $${d.c.toFixed(2)}</span>`;else el.innerHTML='<span style="color:var(--orange)">⚠️ '+t('unexpectedResponse')+'</span>';}catch(e){el.innerHTML=`<span style="color:var(--red)">❌ ${e.message}</span>`;}}

// ============================================
// AI ASSISTANT
// ============================================

function _buildAiContext() {
  try {
    const tc = settings.tipoCambio || 17;
    const plats = calcPlatforms();
    const tickers = getTickerPositions();
    const totalPlats = plats.reduce((s,p)=>s+platSaldoToMXN(p),0);
    const totalInv = tickers.reduce((s,t)=>s+((t.valorActual||t.costoPosicion||0)*(t.moneda==='MXN'?1:tc)),0);
    const patrimonio = totalPlats + totalInv;

    const now = new Date();
    const mesKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const gastosM = movements.filter(m=>m.seccion==='gastos'&&m.fecha&&m.fecha.startsWith(mesKey));
    const totalGastos = gastosM.reduce((s,m)=>s+(m.importe||0),0);
    const bycat = {};
    gastosM.forEach(m=>{bycat[m.categoria]=(bycat[m.categoria]||0)+(m.importe||0);});

    const ing = settings.ingresos||{};
    const sueldo = ing.sueldo||ing.sueldoRaw||0;
    const totalIng = sueldo+(ing.extrasEUR||0)+(ing.otrosEUR||0);

    const topPlats = [...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a)).slice(0,5)
      .map(p=>`${p.name} (${p.type}): ${fmtPlat(p.saldo,p.moneda)}, return ${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento,p.moneda)}`).join('; ');

    const topInv = tickers.filter(t=>t.cantActual>0).slice(0,5)
      .map(tkr=>`${tkr.ticker} (${tkr.type}): ×${tkr.cantActual}, G/L ${tkr.gpNoRealizada!=null?(tkr.gpNoRealizada>=0?'+':'')+tkr.gpNoRealizada.toFixed(0)+' '+tkr.moneda:'no price'}`).join('; ');

    const metasSummary = goals.slice(0,4).map(g=>`${g.nombre}: goal ${fmt(g.meta)}, current ${fmt(g.actual||0)}`).join('; ');

    const balance = totalIng - totalGastos;

    const movRecientes = movements
      .filter(m => m.fecha)
      .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
      .slice(0, 500)
      .map(m => `[${m.fecha}] ${m.seccion||''} | ${m.categoria||''} | ${m.desc||m.notas||''} | ${m.monedaOrig||'MXN'} ${(m.importe||0).toFixed(2)}`)
      .join('\n');

    const recurrentesList = recurrentes
      .filter(r => r.activo !== false)
      .map(r => `${r.nombre}: ${r.importe} ${r.moneda||'EUR'} / ${r.frecuencia||'month'} — ${r.categoria||''}`)
      .join('\n');

    const todasPlats = plats.map(p=>`${p.name} (${p.type}/${p.moneda}): balance ${fmtPlat(p.saldo,p.moneda)}, return ${p.rendimiento>=0?'+':''}${fmtPlat(p.rendimiento,p.moneda)}`).join('\n');

    return `${_lang === 'es' 
      ? 'Eres un asistente financiero personal para la aplicación TrackFolio. Tienes acceso a los datos REALES del usuario. Responde en español, de forma concisa y amigable. NO des consejos de inversión formales. Puedes analizar los datos y dar observaciones útiles. Cuando te pregunten sobre movimientos específicos, búscalos en la lista proporcionada.'
      : 'You are a personal financial assistant for the TrackFolio app. You have access to the user\'s REAL data. Respond in Spanish (if the user writes in Spanish) or English accordingly, concisely and friendly. DO NOT give formal investment advice. You CAN analyze the data and give useful observations. When asked about specific movements, look for them in the provided list.'}

FINANCIAL SUMMARY (${new Date().toLocaleDateString('es-ES')}):
- Total net worth: ${fmt(patrimonio)} MXN (platforms: ${fmt(totalPlats)}, investments: ${fmt(totalInv)})
- Exchange rate: USD/MXN = ${tc}
- Estimated monthly income: EUR ${totalIng.toFixed(0)}
- Expenses this month (${mesKey}): EUR ${totalGastos.toFixed(0)} — by category: ${Object.entries(bycat).map(([k,v])=>k+': EUR '+v.toFixed(0)).join(', ')}
- Month balance: EUR ${balance.toFixed(0)} (${totalIng>0?((balance/totalIng)*100).toFixed(0):'—'}% ${t('ahorro')})
- Goals: ${metasSummary||'no goals'}

PLATFORMS:
${todasPlats||'none'}

OPEN INVESTMENTS:
${topInv||'none'}

ACTIVE RECURRENTS:
${recurrentesList||'none'}

ALL MOVEMENTS (showing ${Math.min(movements.length,500)} of ${movements.length} total):
${movRecientes||'no movements'}`;
  } catch(e) {
    return _lang === 'es' 
      ? 'Eres un asistente financiero personal. Responde en español, de forma concisa y amigable.'
      : 'You are a personal financial assistant. Respond concisely and friendly.';
  }
}

async function testAiKey(provider) {
  if (!provider) return;
  const key = (settings.aiKeys||{})[provider] || '';
  const el = document.getElementById('aiKeyTestResult_' + provider);
  if (!el) return;
  if (!key) { el.innerHTML = '<span style="color:var(--red)">⚠️ '+t('enterApiKey')+'</span>'; return; }
  el.innerHTML = '<span class="spinner"></span> '+t('testing')+'...';
  try {
    const result = await _aiCallSingle(provider, key, [{role:'user',content:'Respond only: OK'}], true);
    if (result) {
      el.innerHTML = '<span style="color:var(--green)">✅ ' + provider.charAt(0).toUpperCase()+provider.slice(1) + ' '+t('ready')+'</span>';
    }
  } catch(e) {
    el.innerHTML = '<span style="color:var(--red)">❌ ' + e.message + '</span>';
  }
}

async function _aiCallSingle(provider, key, messages, test=false) {
  const systemPrompt = _buildAiContext();
  const maxTokens = test ? 10 : 1024;

  if (provider === 'gemini') {
    const rawMsgs = messages.map(m=>({role:m.role==='assistant'?'model':'user', parts:[{text:m.content}]}));
    const geminiMsgs = [];
    for (const msg of rawMsgs) {
      if (geminiMsgs.length > 0 && geminiMsgs[geminiMsgs.length-1].role === msg.role) {
        geminiMsgs[geminiMsgs.length-1].parts[0].text += '\n' + msg.parts[0].text;
      } else { geminiMsgs.push(msg); }
    }
    const _gCtrl=new AbortController();const _gTout=setTimeout(()=>_gCtrl.abort(),15000);
    let r;try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{
      method:'POST',headers:{'Content-Type':'application/json'},signal:_gCtrl.signal,
      body:JSON.stringify({system_instruction:{parts:[{text:systemPrompt}]},contents:geminiMsgs,generationConfig:{maxOutputTokens:maxTokens}})
    });}finally{clearTimeout(_gTout);}
    if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||'Gemini error '+r.status); }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (provider === 'groq') {
    const _grCtrl=new AbortController();const _grTout=setTimeout(()=>_grCtrl.abort(),15000);
    let r;try{r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},signal:_grCtrl.signal,
      body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:maxTokens,messages:[{role:'system',content:systemPrompt},...messages.map(m=>({role:m.role,content:m.content}))]})
    });}finally{clearTimeout(_grTout);}
    if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||'Groq error '+r.status); }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';

  } else if (provider === 'deepseek') {
    const _dsCtrl=new AbortController();const _dsTout=setTimeout(()=>_dsCtrl.abort(),15000);
    let r;try{r=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},signal:_dsCtrl.signal,
      body:JSON.stringify({model:'deepseek-chat',max_tokens:maxTokens,messages:[{role:'system',content:systemPrompt},...messages.map(m=>({role:m.role,content:m.content}))]})
    });}finally{clearTimeout(_dsTout);}
    if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||'DeepSeek error '+r.status); }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';

  } else if (provider === 'openrouter') {
    let freeModels = [];
    try {
      const modelsResp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': 'Bearer ' + key }
      });
      if (modelsResp.ok) {
        const modelsData = await modelsResp.json();
        const blacklist = ['qwen3', 'gemma-3n', 'gemma-3', 'gemma-2'];
        freeModels = (modelsData.data || [])
          .filter(m => {
            if (!m.id.endsWith(':free')) return false;
            if ((m.context_length || 0) < 4096) return false;
            if (blacklist.some(b => m.id.includes(b))) return false;
            return true;
          })
          .sort((a, b) => (a.context_length || 0) - (b.context_length || 0))
          .slice(0, 10)
          .map(m => m.id);
      }
    } catch(e) { /* ignore */ }
    if (freeModels.length === 0) {
      freeModels = ['liquid/lfm-2.5-1.2b-instruct:free'];
    }
    let lastErr = null;
    for (const model of freeModels) {
      try {
        const _orCtrl=new AbortController();const _orTout=setTimeout(()=>_orCtrl.abort(),15000);
        let r;try{r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'HTTP-Referer':window.location.origin,'X-Title':'TrackFolio'},
          signal:_orCtrl.signal,
          body:JSON.stringify({model,max_tokens:maxTokens,messages:[{role:'system',content:systemPrompt},...messages.map(m=>({role:m.role,content:m.content}))]})
        });}finally{clearTimeout(_orTout);}
        if (r.status === 429) { lastErr=new Error('429'); continue; }
        if (!r.ok) { const e=await r.json().catch(()=>({})); lastErr=new Error(e?.error?.message||'Error '+r.status); continue; }
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) { return text; }
      } catch(e) { lastErr=e; }
      await new Promise(r => setTimeout(r, 500));
    }
    throw lastErr || new Error('All OpenRouter models failed');
  }
  throw new Error('Unknown provider: ' + provider);
}

async function _aiCall(messages, test=false) {
  const keys = settings.aiKeys || {};
  const order = ['groq','gemini','deepseek','openrouter'];
  const available = order.filter(p => !!keys[p]);
  if (available.length === 0) throw new Error(t('noApiKeys'));

  let lastError = null;
  for (const provider of available) {
    try {
      const result = await _aiCallSingle(provider, keys[provider], messages, test);
      if (result) {
        _aiLastProvider = provider;
        return result;
      }
    } catch(e) {
      lastError = e;
    }
  }
  throw new Error(t('allProvidersFailed') + ' ' + (lastError?.message || 'unknown'));
}

function _renderAiChat() {
  const panel = document.getElementById('aiChatPanel');
  if (!panel) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const hasKey = Object.values(settings.aiKeys||{}).some(v=>!!v);
  const provider = settings.aiProvider || 'claude';
  const keys = settings.aiKeys||{};
  const activeProviders = ['groq','gemini','deepseek','openrouter'].filter(p=>!!keys[p]);
  const providerLabel = activeProviders.length === 0 ? t('notConfigured') :
    activeProviders.length === 1 ? (activeProviders[0].charAt(0).toUpperCase()+activeProviders[0].slice(1)+' ✦') :
    (_aiLastProvider ? (_aiLastProvider.charAt(0).toUpperCase()+_aiLastProvider.slice(1)+' ✦') : activeProviders.length + ' '+t('providers')+' ✦');

  const msgsHtml = _aiMessages.length === 0
    ? `<div style="text-align:center;padding:32px 20px;color:var(--text2)">
        <div style="font-size:32px;margin-bottom:10px">✦</div>
        <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:6px">${t('financialAssistant')}</div>
        <div style="font-size:12px;line-height:1.6">${t('iaAskMe')}</div>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          ${(_getAiSuggestions()||[]).map(s=>`<button onclick="window._aiSendSuggestion(${JSON.stringify(s)})" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-size:12px;cursor:pointer;color:var(--text);text-align:left;transition:all 0.15s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'">${s}</button>`).join('')}
        </div>
      </div>`
    : _aiMessages.map(m => {
        const isUser = m.role === 'user';
        return `<div style="display:flex;flex-direction:column;align-items:${isUser?'flex-end':'flex-start'};margin-bottom:12px">
          <div style="max-width:85%;padding:10px 14px;border-radius:${isUser?'16px 16px 4px 16px':'16px 16px 16px 4px'};background:${isUser?'var(--blue)':'var(--card2)'};color:${isUser?'#fff':'var(--text)'};font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;border:${isUser?'none':'1px solid var(--border)'}">
            ${isUser ? escHtml(m.content) : _renderMd(m.content)}
          </div>
        </div>`;
      }).join('') + (_aiLoading ? `<div style="display:flex;align-items:flex-start;margin-bottom:12px"><div style="background:var(--card2);border:1px solid var(--border);border-radius:16px 16px 16px 4px;padding:12px 16px;display:flex;gap:5px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:var(--text3);animation:aiDot 1.2s infinite 0s"></span><span style="width:6px;height:6px;border-radius:50%;background:var(--text3);animation:aiDot 1.2s infinite 0.2s"></span><span style="width:6px;height:6px;border-radius:50%;background:var(--text3);animation:aiDot 1.2s infinite 0.4s"></span></div></div>` : '');

  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--purple));display:flex;align-items:center;justify-content:center;font-size:15px">✦</div>
          <div>
            <div style="font-size:14px;font-weight:700">${providerLabel}</div>
            <div style="font-size:10px;color:${hasKey?'var(--green)':'var(--orange)'}">${hasKey?'● '+t('connected'):'● '+t('noApiKey')}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${_aiMessages.length>0?`<button onclick="window._aiClear()" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:4px 8px;border-radius:8px;border:1px solid var(--border)" title="${t('clear')}">🗑 ${t('clear')}</button>`:''}
          <button onclick="window.toggleAiChat()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2);width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px" onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background='none'">✕</button>
        </div>
      </div>
      <div id="aiMsgsContainer" style="flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column">
        ${msgsHtml}
      </div>
      <div style="padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;gap:8px;align-items:flex-end">
          <textarea id="aiInput" placeholder="${hasKey?t('iaPlaceholder'):t('configureApiKeyFirst')}" ${hasKey?'':'disabled'} style="flex:1;resize:none;border-radius:12px;padding:10px 14px;font-size:13px;font-family:var(--font);background:var(--card2);border:1px solid var(--border);color:var(--text);outline:none;max-height:100px;min-height:40px;line-height:1.5;overflow-y:auto" rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._aiSend();}"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"
          ></textarea>
          <button onclick="window._aiSend()" ${hasKey&&!_aiLoading?'':'disabled'} style="width:38px;height:38px;border-radius:50%;background:var(--blue);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;opacity:${hasKey&&!_aiLoading?'1':'0.4'}">↑</button>
        </div>
        <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:6px">${t('dataSentTo')} ${providerLabel.replace(' ✦','')} · ${t('notStored')}</div>
      </div>
    </div>`;

  setTimeout(() => {
    const c = document.getElementById('aiMsgsContainer');
    if (c) c.scrollTop = c.scrollHeight;
  }, 30);
}

window.toggleAiChat = function() {
  _aiChatOpen = !_aiChatOpen;
  const panel = document.getElementById('aiChatPanel');
  const btn = document.getElementById('aiFab');
  if (panel) {
    panel.style.transform = _aiChatOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)';
    panel.style.opacity = _aiChatOpen ? '1' : '0';
    panel.style.pointerEvents = _aiChatOpen ? 'auto' : 'none';
  }
  if (btn) btn.style.transform = _aiChatOpen ? 'scale(0.9)' : 'scale(1)';
  if (_aiChatOpen) _renderAiChat();
};

window._aiSend = async function() {
  const inp = document.getElementById('aiInput');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text || _aiLoading) return;
  inp.value = '';
  inp.style.height = 'auto';
  _aiMessages.push({role:'user', content:text});
  _aiLoading = true;
  _renderAiChat();
  try {
    const reply = await _aiCall(_aiMessages);
    _aiMessages.push({role:'assistant', content:reply});
    LS.set('aiHistory', _aiMessages.slice(-40));
  } catch(e) {
    _aiMessages.push({role:'assistant', content:'⚠️ ' + t('error') + ': ' + e.message});
  }
  _aiLoading = false;
  _renderAiChat();
};

window._aiSendSuggestion = function(text) {
  const inp = document.getElementById('aiInput');
  if (inp) { inp.value = text; }
  window._aiSend();
};

window._aiClear = function() {
  _aiMessages = [];
  LS.set('aiHistory', []);
  _renderAiChat();
};

function updateNav(patrimonio,totalMXN,totalUSD,tc,totalRend,deltaHoy,deltaHoyPct){
  const el1=document.getElementById('navTotal'),el2=document.getElementById('navSub');
  if(el1)el1.textContent=fmt(patrimonio);
  const fx=_fxCache||LS.get('fxCache');
  const eurStr=fx?.eurmxn?`<span>EUR $${fx.eurmxn.toFixed(2)}</span>`:'';
  const deltaStr=deltaHoy!==0&&deltaHoy!=null?`<span style="color:${pctCol(deltaHoy)};font-weight:700;background:${deltaHoy>=0?'rgba(48,209,88,0.12)':'rgba(255,69,58,0.10)'};padding:1px 6px;border-radius:6px">${deltaHoy>=0?'▲':'▼'} ${fmt(Math.abs(deltaHoy))} ${t('today')}</span>`:'';
  if(el2)el2.innerHTML=`<span>🇲🇽 ${fmt(totalMXN)}</span><span>🇺🇸 ${fmt(totalUSD,'USD')}</span><span>💱 $${tc}</span>${eurStr}${deltaStr}`;
  const _ps=getPriceSummary();
  const _nps=document.getElementById('navPriceStatus');
  if(_nps){
    if(_ps.live>0)_nps.innerHTML=`<span style="width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block"></span>${_ps.live}/${_ps.total}`;
    else if(_ps.total>0)_nps.innerHTML=`<span style="width:6px;height:6px;border-radius:50%;background:var(--text3);display:inline-block"></span>${_ps.total}`;
    else _nps.innerHTML='';
  }
}
function updateNavUser(user){
  if(!user)return;
  const slot=document.getElementById('navUserExtra');
  if(!slot)return;
  const hideBtn = `<button id="hideValuesBtn" onclick="window.toggleValues()" title="${_valuesHidden?t('showValues'):t('hideValues')}" style="background:var(--card2);border:1px solid var(--border);border-radius:20px;padding:5px 10px;font-size:14px;cursor:pointer;opacity:${_valuesHidden?'0.5':'1'};flex-shrink:0">${_valuesHidden?'🙈':'👁'}</button>`;
  slot.innerHTML=(hideBtn)+(user.photoURL
    ?`<img src="${user.photoURL}" class="nav-avatar"><button class="btn-signout" onclick="window.signOutUser()">${t('salir')}</button>`
    :`<div class="nav-avatar-placeholder">${(user.displayName||user.email||'U')[0].toUpperCase()}</div><button class="btn-signout" onclick="window.signOutUser()">${t('salir')}</button>`);
}

function exportData(){const data={platforms,movements,goals,settings,recurrentes,patrimonioHistory,exportDate:new Date().toISOString(),version:'4.4'};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`finanzas-pro-${today()}.json`;a.click();URL.revokeObjectURL(url);}

function importData(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=async e=>{try{
  const d=JSON.parse(e.target.result);
  if(d.platforms)platforms=d.platforms.map(p=>({tasaAnual:0,fechaInicio:today(),moneda:'MXN',...p}));
  if(d.movements)movements=d.movements;
  if(d.goals)goals=d.goals;
  if(d.settings)settings=d.settings;
  if(d.recurrentes)recurrentes=d.recurrentes;
  if(d.patrimonioHistory)patrimonioHistory=d.patrimonioHistory;
  saveAll();
  if(typeof window.saveAllMovementsToFirebase==='function' && window._currentUser?.uid){
    await window.saveAllMovementsToFirebase();
  }
  alert('✅ '+t('dataImported'));
}catch(e){alert('❌ '+t('invalidFile')+': '+e.message);}};r.readAsText(file);}

function openImportCSVModal(){
  openModal(`
    <div class="modal-header"><div class="modal-title">📊 ${t('importarExcel')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.6">
      ${t('csvInstrucciones')}
    </div>
    <div style="background:var(--card2);border-radius:10px;padding:12px 14px;font-size:11px;font-family:monospace;color:var(--text);margin-bottom:16px;overflow-x:auto;white-space:nowrap">
      fecha | seccion | tipo | plataforma | importe | moneda | categoria | notas
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.8">
      <strong>fecha</strong> — ${t('formatoFecha')}<br>
      <strong>seccion</strong> — <code>gastos</code> or <code>plataformas</code><br>
      <strong>tipo</strong> — ${t('csvTipoExplicacion')}<br>
      <strong>plataforma</strong> — ${t('csvPlataformaExplicacion')}<br>
      <strong>importe</strong> — ${t('csvImporteExplicacion')}<br>
      <strong>moneda</strong> — ${t('csvMonedaExplicacion')}<br>
      <strong>categoria</strong> — ${t('csvCategoriaExplicacion')}<br>
      <strong>notas</strong> — ${t('csvNotasExplicacion')}
    </div>
    <div style="margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" onclick="downloadCSVTemplate()">⬇️ ${t('descargarPlantilla')}</button>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <input type="file" id="csvImportFile" accept=".csv,.txt" style="display:none" onchange="processCSVImport(this)">
      <button class="btn btn-primary" style="width:100%" onclick="document.getElementById('csvImportFile').click()">📂 ${t('seleccionarCSV')}</button>
    </div>
    <div id="csvImportResult" style="margin-top:12px;font-size:13px"></div>
  `);
}

function downloadCSVTemplate(){
  const rows = [
    'fecha,seccion,tipo,plataforma,importe,moneda,categoria,notas',
    '2026-03-01,gastos,Gasto,,850,MXN,alimentacion,Weekly grocery',
    '2026-03-05,gastos,Gasto,,450,MXN,transporte,Gas',
    '2026-03-10,gastos,Ingreso,,3200,EUR,,March salary',
    '2026-03-15,plataformas,Aportación,Nu Bank,5000,MXN,,Monthly savings',
    '2026-03-28,plataformas,Saldo Actual,Finsus,108500,MXN,,Balance update',
  ].join('\n');
  const blob = new Blob(['\uFEFF'+rows], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='finanzas-pro-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

function processCSVImport(input){
  const file = input.files[0]; if(!file) return;
  const resultEl = document.getElementById('csvImportResult');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target.result;

      // Parseo CSV robusto: soporta comillas, comas y saltos de línea dentro de campos
      function parseCSVRobust(rawText) {
        const rows = [];
        let row = [], field = '', inQuote = false;
        const LF = 10, CR = 13, QUOTE = 34, COMMA = 44, SEMI = 59;
        const bytes = rawText.replace(/^\uFEFF/, '');
        for (let i = 0; i < bytes.length; i++) {
          const ch = bytes[i], code = bytes.charCodeAt(i), next = bytes[i+1], nextCode = bytes.charCodeAt(i+1);
          if (inQuote) {
            if (code === QUOTE && nextCode === QUOTE) { field += '"'; i++; }
            else if (code === QUOTE) { inQuote = false; }
            else { field += ch; }
          } else {
            if (code === QUOTE) { inQuote = true; }
            else if (code === COMMA || code === SEMI) { row.push(field.trim()); field = ''; }
            else if (code === LF || (code === CR && nextCode === LF)) {
              if (code === CR) i++;
              row.push(field.trim()); rows.push(row); row = []; field = '';
            } else if (code === CR) {
              row.push(field.trim()); rows.push(row); row = []; field = '';
            } else { field += ch; }
          }
        }
        if (field || row.length) { row.push(field.trim()); rows.push(row); }
        return rows;
      }

      const allRows = parseCSVRobust(text);
      if (allRows.length < 2) { resultEl.innerHTML='<span style="color:var(--red)">❌ '+t('emptyFile')+'</span>'; return; }
      const sep = ',';
      const headers = allRows[0].map(h => h.toLowerCase().replace(/['"]/g,''));

      const idxFecha    = headers.findIndex(h => h.includes('fecha'));
      const idxSeccion  = headers.findIndex(h => h.includes('seccion') || h.includes('sección'));
      const idxTipo     = headers.findIndex(h => h.includes('tipo'));
      const idxPlat     = headers.findIndex(h => h.includes('plataforma'));
      const idxImporte  = headers.findIndex(h => h.includes('importe') || h.includes('monto'));
      const idxMoneda   = headers.findIndex(h => h.includes('moneda'));
      const idxCat      = headers.findIndex(h => h.includes('categoria') || h.includes('categoría'));
      const idxNotas    = headers.findIndex(h => h.includes('notas') || h.includes('descripcion') || h.includes('descripción'));

      if(idxFecha === -1 || idxImporte === -1){
        resultEl.innerHTML='<span style="color:var(--red)">❌ '+t('missingColumns')+'</span>'; return;
      }

      const parseVal = (row, idx) => idx>=0 ? (row[idx]||'').replace(/['"]/g,'').trim() : '';

      let importados = 0, errores = 0, errorMsgs = [];
      const newMovs = [];

      allRows.slice(1).forEach((row, li) => {
        if(!row.length || row.every(c=>!c)) return;
        const fecha = parseVal(row, idxFecha);
        const seccion = (parseVal(row, idxSeccion) || 'gastos').toLowerCase();
        const tipo = parseVal(row, idxTipo) || (seccion==='gastos' ? 'Gasto' : 'Aportación');
        const platNombre = parseVal(row, idxPlat);
        const importeRaw = parseVal(row, idxImporte).replace(/[,$\s]/g,'');
        const importe = parseFloat(importeRaw);
        const moneda = (parseVal(row, idxMoneda) || 'MXN').toUpperCase();
        const categoria = parseVal(row, idxCat) || 'otros';
        const notas = parseVal(row, idxNotas);

        if(!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)){ errores++; errorMsgs.push(`Row ${li+2}: ${t('invalidDate')} "${fecha}"`); return; }
        if(!importe || importe <= 0){ errores++; errorMsgs.push(`Row ${li+2}: ${t('invalidAmount')} "${importeRaw}"`); return; }

        const mov = { id: uid(), fecha, seccion, tipo };

        if(seccion === 'plataformas'){
          const plat = platforms.find(p => p.name.toLowerCase().trim() === platNombre.toLowerCase().trim());
          if(!plat && platNombre){ errorMsgs.push(`Row ${li+2}: ${t('platformNotFound')} "${platNombre}" — ${t('importedUnlinked')}`); }
          mov.platform = plat ? plat.name : platNombre;
          mov.tipoPlat = tipo;
          mov.monto = importe;
          mov.moneda = moneda;
          mov.desc = notas;
        } else {
          mov.tipo = tipo || 'Gasto';
          mov.importe = importe;
          mov.moneda = moneda;
          mov.categoria = categoria;
          mov.notas = notas;
        }

        newMovs.push(mov);
        importados++;
      });

      if(importados === 0){ resultEl.innerHTML=`<span style="color:var(--red)">❌ ${t('noMovementsImported')} ${errores} errors.</span>`; return; }

      movements = [...newMovs, ...movements];
      saveAll();
      if(typeof window.saveAllMovementsToFirebase==='function' && window._currentUser?.uid){
        window.saveAllMovementsToFirebase();
      }

      let html = `<div style="color:var(--green);font-weight:700;margin-bottom:8px">✅ ${importados} ${t('movementsImported')}</div>`;
      if(errores > 0) html += `<div style="color:var(--orange);margin-bottom:6px">⚠️ ${errores} ${t('rowsSkipped')}</div>`;
      if(errorMsgs.length > 0) html += `<div style="font-size:11px;color:var(--text2);max-height:100px;overflow-y:auto">${errorMsgs.map(m=>`• ${m}`).join('<br>')}</div>`;
      html += `<button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%" onclick="closeModal()">${t('verMovimientos')}</button>`;
      resultEl.innerHTML = html;

    } catch(err){ resultEl.innerHTML=`<span style="color:var(--red)">❌ ${t('errorProcessing')}: ${err.message}</span>`; }
  };
  reader.readAsText(file);
}
window.openImportCSVModal = openImportCSVModal;
window.downloadCSVTemplate = downloadCSVTemplate;
window.processCSVImport = processCSVImport;
window.openArchivarModal = openArchivarModal;
window.ejecutarArchivado = ejecutarArchivado;

function resetAll(){
  openModal(`
    <div class="modal-header"><div class="modal-title" style="color:var(--red)">⚠️ ${t('resetAll')}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="font-size:14px;color:var(--text2);margin-bottom:20px;line-height:1.6">
      ${t('resetConfirm')}
    </div>
    <input class="form-input" id="resetConfirmInput" placeholder="RESET ALL" oninput="document.getElementById('btnConfirmReset').disabled=this.value!=='RESET ALL'">
    <button id="btnConfirmReset" class="btn btn-danger" style="width:100%;margin-top:16px" disabled onclick="confirmResetAll()">${t('deletePermanently')}</button>
  `);
}
function confirmResetAll(){
  platforms=[];
  movements=[];
  goals=[];
  settings={...DEFAULT_SETTINGS};
  recurrentes=[];
  patrimonioHistory=[];
  LS.set('price_cache',{});
  saveAll();
  if(typeof window.saveToFirebase==='function') window.saveToFirebase(true);
  if(typeof window.saveAllMovementsToFirebase==='function') window.saveAllMovementsToFirebase();
  closeModal();
  if(window.renderPage) window.renderPage(window.currentTab||'dashboard');
}

// ── Lazy loading: set de tabs ya renderizadas en esta sesión ─────────────
const _renderedTabs = new Set();

// ── Error boundary: muestra UI de fallback si una sección falla ──────────
function _renderWithBoundary(tab, renderFn) {
  const pageEl = document.getElementById('page-' + tab);
  try {
    renderFn();
    _renderedTabs.add(tab);
  } catch(err) {
    console.error('[renderPage] Error en tab "' + tab + '":', err);
    if (pageEl) {
      pageEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;padding:32px;text-align:center">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <div style="font-size:17px;font-weight:700;margin-bottom:8px;color:var(--text)">
            ${_lang === 'en' ? 'Something went wrong' : 'Algo salió mal'}
          </div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:24px;max-width:320px;line-height:1.6">
            ${_lang === 'en'
              ? 'This section could not load. Your data is safe.'
              : 'Esta sección no pudo cargar. Tus datos están seguros.'}
          </div>
          <button onclick="window._retryTab('${tab}')"
            style="padding:10px 24px;border-radius:20px;border:none;background:var(--blue,#0A84FF);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font)">
            🔄 ${_lang === 'en' ? 'Retry' : 'Reintentar'}
          </button>
          <div style="font-size:11px;color:var(--text3);margin-top:14px;font-family:monospace;max-width:360px;word-break:break-all;opacity:0.6">
            ${err && err.message ? err.message : ''}
          </div>
        </div>`;
    }
  }
}

window._retryTab = function(tab) {
  _renderedTabs.delete(tab);
  renderPageInternal(tab);
};

function renderPageInternal(tab){
  _lang = LS.get('lang') || 'es';
  _applyLangToNav();

  // Lazy loading: si la pestaña NO es la activa, solo marcarla como pendiente
  // y salir — se renderizará cuando el usuario la visite.
  // Excepción: si ya fue renderizada antes en esta sesión, siempre actualizar
  // para que los datos estén frescos (ej: guardaste un movimiento desde otra tab).
  const isActive = (tab === currentTab);
  if (!isActive && !_renderedTabs.has(tab)) return;

  const renderMap = {
    dashboard:    renderDashboard,
    movimientos:  renderMovimientos,
    plataformas:  renderPlataformas,
    inversiones:  renderInversiones,
    gastos:       renderGastos,
    metas:        renderMetas,
    ajustes:      renderAjustes,
  };
  const fn = renderMap[tab];
  if (fn) _renderWithBoundary(tab, fn);
}
function renderPage(tab){renderPageInternal(tab);}
window.renderPage=renderPage;
window.saveAll=saveAll;
window.forceUpdateFX=forceUpdateFX;
window.showAportaciones = showAportaciones;

// ==================== FIREBASE (MÓDULO) ====================

// ── Investment modal sell helpers ──────────────────────────────────────────
(function(){
  function fmtC(v){ return v%1===0?String(v):parseFloat(v.toFixed(8)).toString(); }
  window._invCurrentPos = null;

  window._invUpdateSellInfo = function(){
    var tkEl=document.getElementById('invTicker');
    var mnEl=document.getElementById('invMoneda');
    var tmEl=document.getElementById('invTipoMov');
    var box =document.getElementById('invSellInfoBox');
    var cLbl=document.getElementById('invCantLabel');
    var _tm=tmEl?tmEl.value:'Compra';
    var _pGrp=document.getElementById('invPrecioUnit');
    var _cGrp=document.querySelector('[name="comision"]');
    if(_tm==='Dividendo'||_tm==='Comisión'){
      if(cLbl)cLbl.textContent=_tm==='Dividendo'?'Monto dividendo recibido':'Monto comisión';
      if(_pGrp){_pGrp.closest('.form-group').style.display='none';_pGrp.removeAttribute('required');}
      if(_cGrp)_cGrp.closest('.form-group').style.display='none';
    } else {
      if(cLbl)cLbl.textContent=typeof t==='function'?t('cantidad'):'Cantidad';
      if(_pGrp){_pGrp.closest('.form-group').style.display='';_pGrp.setAttribute('required','');}
      if(_cGrp)_cGrp.closest('.form-group').style.display='';
    }
    var bLbl=document.getElementById('invBrokerLabel');
    var bInp=document.getElementById('invBroker');
    var bDL =document.getElementById('brokerList');
    if(!box||!tkEl) return;
    var ticker=(tkEl.value||'').toUpperCase().trim();
    var moneda=mnEl?mnEl.value:'USD';
    var tipo  =tmEl?tmEl.value:'Compra';
    if(tipo==='Venta'&&ticker){
      var allPos=(typeof getTickerPositions==='function')?getTickerPositions():[];
      var pos=null;
      for(var i=0;i<allPos.length;i++){
        if(allPos[i].ticker===ticker&&allPos[i].cantActual>0){pos=allPos[i];break;}
      }
      if(pos&&mnEl&&mnEl.value!==pos.moneda){mnEl.value=pos.moneda;}
      if(pos){
        var sym=pos.moneda==='MXN'?'$':'US$';
        var brokers=pos.brokersSaldo&&pos.brokersSaldo.length?pos.brokersSaldo:[];
        var qty=fmtC(pos.cantActual);
        var avg=sym+parseFloat(pos.precioCostoPromedio.toFixed(4));
        if(brokers.length===1){
          var b=brokers[0];qty=fmtC(b.cantActual);avg=sym+parseFloat(b.precioCostoPromedio.toFixed(4));
          if(bInp){bInp.value=b.broker;bInp.style.background='rgba(52,199,89,0.08)';bInp.style.borderColor='var(--green)';bInp.readOnly=true;}
          if(bLbl)bLbl.innerHTML=t('exchange')+' <span style="font-size:10px;font-weight:700;color:var(--green);margin-left:4px">&#10003; '+t('auto')+'</span>';
          if(bDL)bDL.innerHTML='<option value="'+b.broker+'">';
          window._invCurrentPos={ticker:pos.ticker,moneda:pos.moneda,cantActual:b.cantActual,precioCostoPromedio:b.precioCostoPromedio};
        } else if(brokers.length>1){
          if(bInp){bInp.value='';bInp.style.background='rgba(10,132,255,0.06)';bInp.style.borderColor='var(--blue)';bInp.readOnly=false;}
          if(bLbl)bLbl.innerHTML=t('exchange')+' <span style="font-size:10px;font-weight:700;color:var(--blue);margin-left:4px">'+brokers.length+' '+t('withBalance')+'</span>';
          if(bDL)bDL.innerHTML=brokers.map(function(b){return'<option value="'+b.broker+'">';}).join('');
          window._invCurrentPos=pos;
          if(bInp)bInp.oninput=function(){
            for(var j=0;j<brokers.length;j++){
              if(brokers[j].broker.toLowerCase()===bInp.value.toLowerCase()){
                var s=brokers[j];
                var qEl=document.getElementById('invSellQty');if(qEl)qEl.textContent=fmtC(s.cantActual);
                var aEl=document.getElementById('invSellAvg');if(aEl)aEl.textContent=sym+parseFloat(s.precioCostoPromedio.toFixed(4));
                if(cLbl)cLbl.textContent=t('cantidad')+' ('+t('youHave')+' '+fmtC(s.cantActual)+' en '+s.broker+')';
                window._invCurrentPos={ticker:pos.ticker,moneda:pos.moneda,cantActual:s.cantActual,precioCostoPromedio:s.precioCostoPromedio};
                break;
              }
            }
          };
        } else {
          if(bInp){bInp.style.background='';bInp.style.borderColor='';bInp.readOnly=false;}
          if(bLbl)bLbl.textContent=t('exchange');
          window._invCurrentPos=pos;
        }
        var qEl=document.getElementById('invSellQty');if(qEl)qEl.textContent=qty;
        var aEl=document.getElementById('invSellAvg');if(aEl)aEl.textContent=avg;
        if(cLbl)cLbl.textContent=t('cantidad')+' ('+t('youHave')+' '+qty+')';
        box.style.display='flex';
      } else {
        box.style.display='none';window._invCurrentPos=null;
        if(cLbl)cLbl.textContent=t('cantidad');
        if(bLbl)bLbl.textContent=t('exchange');
        if(bInp){bInp.style.background='';bInp.style.borderColor='';bInp.readOnly=false;bInp.oninput=null;}
        if(bDL&&typeof BROKERS!=='undefined')bDL.innerHTML=BROKERS.map(function(b){return'<option value="'+b+'">';}).join('');
      }
    } else {
      box.style.display='none';window._invCurrentPos=null;
      if(cLbl)cLbl.textContent=t('cantidad');
      if(bLbl)bLbl.textContent=t('exchange');
      if(bInp){bInp.style.background='';bInp.style.borderColor='';bInp.readOnly=false;bInp.oninput=null;}
      if(bDL&&typeof BROKERS!=='undefined')bDL.innerHTML=BROKERS.map(function(b){return'<option value="'+b+'">';}).join('');
    }
    window._invUpdateTotal();
  };

  window._invSellAll=function(){
    var pos=window._invCurrentPos;if(!pos)return;
    var cInp=document.getElementById('invCantidad');if(cInp)cInp.value=fmtC(pos.cantActual);
    var pInp=document.getElementById('invPrecioUnit');if(pInp&&!pInp.value)pInp.value=parseFloat(pos.precioCostoPromedio.toFixed(4));
    window._invUpdateTotal();
  };

  window._invUpdateTotal=function(){
    var cInp=document.getElementById('invCantidad');
    var pInp=document.getElementById('invPrecioUnit');
    var mEl =document.getElementById('invMoneda');
    var box =document.getElementById('invTotalBox');
    var val =document.getElementById('invTotalVal');
    var cant=parseFloat(cInp?cInp.value:0)||0;
    var precio=parseFloat(pInp?pInp.value:0)||0;
    if(cant>0&&precio>0&&box&&val){
      var sym=(mEl&&mEl.value==='MXN')?'$':'US$';
      val.textContent=sym+(cant*precio).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      box.style.display='block';
    } else if(box){box.style.display='none';}
  };
})();

const firebaseConfig={apiKey:"AIzaSyDUAOlDXmkBRQNoYgmax9KOMjQrZd061Q8",authDomain:"control-de-inversion.firebaseapp.com",projectId:"control-de-inversion",storageBucket:"control-de-inversion.firebasestorage.app",messagingSenderId:"955139190781",appId:"1:955139190781:web:b73653484f5f96b7e23394"};
const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);

const ADMIN_UID = 'vZBQ7d80yPSxbmar96UqPHXDpd32';

let DOC_REF = null;
let USER_META_REF = null;

function getDocRef(uid) {
  return doc(db, 'usuarios', uid, 'datos', 'main');
}
function getMetaRef(uid) {
  return doc(db, 'usuarios', uid, 'meta', 'perfil');
}

function setFbStatus(s){let el=document.getElementById('fbStatus');if(!el)return;el.style.display=s?'block':'none';const map={syncing:['⏳ '+t('sync'),'rgba(10,132,255,0.1)','#0A84FF'],ok:['☁️ '+t('synced'),'rgba(48,209,88,0.1)','#30D158'],error:['⚠️ '+t('noConnection'),'rgba(255,69,58,0.1)','#FF453A'],offline:['📴 '+t('offline'),'rgba(0,0,0,0.06)','#86868B']};const[text,bg,color]=map[s]||map.offline;el.textContent=text;el.style.background=bg;el.style.color=color;if(s==='ok'){setTimeout(()=>{if(el)el.style.display='none';},3000);}}
function showApp(){
  document.getElementById('loginOverlay').classList.add('hidden');
  const lp=document.getElementById('landingPage'); if(lp) lp.style.display='none';
  document.getElementById('mainNav').style.display='';
  document.getElementById('mainContainer').style.display='';
  document.getElementById('mobileNav').style.display='';
  document.getElementById('accessDenied').classList.remove('show');
}
function showLogin(msg){
  const lp=document.getElementById('landingPage');
  const lo=document.getElementById('loginOverlay');
  document.getElementById('mainNav').style.display='none';
  document.getElementById('mainContainer').style.display='none';
  document.getElementById('mobileNav').style.display='none';
  document.getElementById('accessDenied').classList.remove('show');
  if(msg){
    // Error — mostrar overlay de login con mensaje
    if(lp) lp.style.display='none';
    lo.classList.remove('hidden');
    const el=document.getElementById('loginError');
    if(el){el.textContent=msg;el.style.display='block';}
  } else {
    // Sin error — mostrar landing page, ocultar login overlay
    lo.classList.add('hidden');
    if(lp) lp.style.display='block'; else lo.classList.remove('hidden');
  }
}

window.signOutUser=async()=>{
  if(_unsub){_unsub();_unsub=null;}
  if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
  await signOut(auth);window.location.reload();
};

// ── Auth redirect — siempre usar localStorage (sessionStorage se borra en iOS) ──
let _redirectPending = true; // bloquea showLogin hasta que getRedirectResult resuelva
window._log('_redirectPending=true, localStorage._authRedirect='+localStorage.getItem('_authRedirect'));

if(localStorage.getItem('_authRedirect') === '1'){
  localStorage.removeItem('_authRedirect');
  // Ocultar landing, mostrar spinner mientras Firebase procesa
  const lp = document.getElementById('landingPage'); if(lp) lp.style.display='none';
  const lo = document.getElementById('loginOverlay');
  const card = lo && lo.querySelector('.login-card');
  if(lo){ lo.classList.remove('hidden'); }
  if(card) card.innerHTML = '<div style="font-size:40px;margin-bottom:16px">💼</div><div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text)">TrackFolio</div><div style="display:flex;align-items:center;gap:8px;justify-content:center;font-size:14px;color:var(--text2)"><span style="width:18px;height:18px;border:2px solid rgba(10,132,255,0.2);border-top-color:#0A84FF;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block"></span> Iniciando sesión...</div>';
}

getRedirectResult(auth).then(result => {
  _redirectPending = false;
  window._log('getRedirectResult: user='+(result&&result.user?result.user.email:'null'));
  if(!result || !result.user){
    if(!window._currentUser && !window._showingWelcomeGate) showLogin();
  }
}).catch(err => {
  _redirectPending = false;
  window._log('getRedirectResult ERROR: '+err.code+' '+err.message);
  console.error('[Auth] getRedirectResult error:', err.code, err.message);
  if(!window._currentUser) showLogin();
});

// ── Login — función global, llamada desde cualquier botón ──────────────────
window._doGoogleLogin = function(btnEl) {
  const spinnerHtml = '<span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(10,132,255,0.2);border-top-color:#0A84FF;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle"></span> Conectando...';
  if(btnEl){ btnEl.disabled = true; btnEl.innerHTML = spinnerHtml; }
  window._log('_doGoogleLogin llamado');

  // Abrir popup SINCRÓNICAMENTE — sin ningún await antes
  // Safari bloquea popups si hay código async antes de window.open
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).then(result => {
    window._log('signInWithPopup OK: '+result.user.email);
  }).catch(e => {
    window._log('signInWithPopup error: '+e.code);
    if(btnEl){ btnEl.disabled = false; btnEl.innerHTML = 'Continuar con Google'; }
    if(e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request'){
      showLogin(t('signinError'));
    } else {
      showLogin();
    }
  });
};

// Attach también al botón del loginOverlay
const _btnLogin = document.getElementById('btnGoogleLogin');
if(_btnLogin) _btnLogin.addEventListener('click', () => window._doGoogleLogin(_btnLogin));

let _ignoreSnapCount=0,_saveTimeout=null,_unsub=null,_unsubRegistro=null;

async function loadSubcollections(uid){
  const { collection, getDocs: _getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  let platSnap, invSnap, gasSnap, snapSnap;
  try {
    [platSnap, invSnap, gasSnap, snapSnap] = await Promise.all([
      _getDocs(collection(db, 'usuarios', uid, 'movimientos_plataformas')),
      _getDocs(collection(db, 'usuarios', uid, 'movimientos_inversiones')),
      _getDocs(collection(db, 'usuarios', uid, 'movimientos_gastos')),
      _getDocs(collection(db, 'usuarios', uid, 'snapshots')),
    ]);
  } catch(e) {
    setFbStatus('error');
    return;
  }
  movements = [];
  platSnap.forEach(d => movements.push(d.data()));
  invSnap.forEach(d => movements.push(d.data()));
  gasSnap.forEach(d => movements.push(d.data()));
  patrimonioHistory = [];
  snapSnap.forEach(d => patrimonioHistory.push(d.data()));
  patrimonioHistory.sort((a,b) => a.date < b.date ? -1 : 1);
  patrimonioHistory = patrimonioHistory.slice(-3650);
  LS.set('movements', movements);
  LS.set('patrimonioHistory', patrimonioHistory);
  _recalcAndSaveSnapshot();
  buildHistoricalSnapshots();
  renderPageInternal(currentTab);
}

function setupFirestore(uid){
  if(_unsub){_unsub();_unsub=null;}
  if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
  DOC_REF = getDocRef(uid);
  _unsub=onSnapshot(DOC_REF, async snap=>{
    if(_ignoreSnapCount>0){_ignoreSnapCount--;return;}
    if(!snap.exists()){
      resetToEmpty();
      window.saveToFirebase(true);
      return;
    }
    setFbStatus('ok');
    if(window.loadFromRemote) window.loadFromRemote(snap.data());
    await loadSubcollections(uid);
  },err=>{console.error(err);setFbStatus('error');});
}

function resetToEmpty(){
  if(typeof platforms !== 'undefined') platforms = [];
  if(typeof movements !== 'undefined') movements = [];
  if(typeof goals !== 'undefined') goals = [];
  if(typeof recurrentes !== 'undefined') recurrentes = [];
  if(typeof patrimonioHistory !== 'undefined') patrimonioHistory = [];
  if(typeof settings !== 'undefined') settings = typeof DEFAULT_SETTINGS !== 'undefined' ? {...DEFAULT_SETTINGS} : {tipoCambio:17.84,tipoEUR:20.52,tipoGBP:23.66,rendimientoEsperado:0.06,finnhubKey:''};
}

window.saveAllMovementsToFirebase = async function(){
  const uid = window._currentUser?.uid;
  if(!uid) return;
  const { collection, doc: _doc, setDoc: _setDoc, getDocs: _getDocs, deleteDoc: _deleteDoc } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  setFbStatus('syncing');
  try{
    for(const subcol of ['movimientos_plataformas','movimientos_inversiones','movimientos_gastos','snapshots']){
      const snap = await _getDocs(collection(db,'usuarios',uid,subcol));
      await Promise.all(snap.docs.map(d => _deleteDoc(d.ref)));
    }
    const saves = movements.map(mov => {
      const subcol = mov.seccion==='plataformas' ? 'movimientos_plataformas'
                   : mov.seccion==='inversiones' ? 'movimientos_inversiones'
                   : 'movimientos_gastos';
      return _setDoc(_doc(db,'usuarios',uid,subcol,mov.id), mov);
    });
    const snapSaves = patrimonioHistory.map(s =>
      _setDoc(_doc(db,'usuarios',uid,'snapshots',s.date), s)
    );
    await Promise.all([...saves, ...snapSaves]);
    setFbStatus('ok');
    LS.set('lastFirebaseSync', Date.now()); // para cola offline
  }catch(e){ setFbStatus('error'); }
};

window.saveToFirebase=async(forceImmediate=false, changedMovIds='', deletedMovIds='', changedSnapDate='')=>{
  const uid = window._currentUser?.uid;
  if(!uid || !DOC_REF) return;

  const doSave=async()=>{
    setFbStatus('syncing');
    try{
      const { collection, doc: _doc, setDoc: _setDoc, deleteDoc: _deleteDoc } =
        await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

      const d = window.getAppData ? window.getAppData() : {};

      // Calcular cuántos writes se harán para ignorar exactamente esos snapshots
      const _changedMids = changedMovIds ? changedMovIds.split('|').filter(Boolean) : [];
      const _deletedMids = deletedMovIds ? deletedMovIds.split('|').filter(Boolean) : [];
      const _todaySnap = patrimonioHistory.find(s=>s.date===today());
      // 1 por DOC_REF + 1 por cada mov cambiado + 1 por cada mov eliminado (×3 subcols pero solo 1 dispara) + 1 si hay snapshot
      _ignoreSnapCount += 1 + _changedMids.length + _deletedMids.length + (_todaySnap ? 1 : 0);

      await _setDoc(DOC_REF, {
        platforms: d.platforms||[], goals: d.goals||[],
        settings: d.settings||{}, recurrentes: d.recurrentes||[],
        updatedAt: serverTimestamp(), device: navigator.userAgent.substring(0,60)
      });

      if(changedMovIds){
        for(const mid of _changedMids){
          const mov = movements.find(m=>m.id===mid);
          if(!mov) continue;
          const subcol = mov.seccion==='plataformas' ? 'movimientos_plataformas'
                       : mov.seccion==='inversiones' ? 'movimientos_inversiones'
                       : 'movimientos_gastos';
          await _setDoc(_doc(db,'usuarios',uid,subcol,mid), mov);
        }
      }

      if(deletedMovIds){
        for(const mid of _deletedMids){
          for(const subcol of ['movimientos_plataformas','movimientos_inversiones','movimientos_gastos']){
            try{ await _deleteDoc(_doc(db,'usuarios',uid,subcol,mid)); }catch(e){}
          }
        }
      }

      if(_todaySnap){
        await _setDoc(_doc(db,'usuarios',uid,'snapshots',_todaySnap.date), _todaySnap);
      }

      setFbStatus('ok');
    }catch(e){
      _ignoreSnapCount=0; // reset en caso de error para no quedar bloqueado
      setFbStatus('error');
      if(!navigator.onLine){window.queueSave&&window.queueSave(window.getAppData&&window.getAppData());}
    }
  };
  if(forceImmediate){await doSave();return;}
  clearTimeout(_saveTimeout);_saveTimeout=setTimeout(doSave,1500);
};

// ── Trial expired screen ──────────────────────────────────────────────────
function showWelcomeGate(user, trialExpirado){
  // Ocultar app si estaba visible
  document.getElementById('mainNav').style.display='none';
  document.getElementById('mainContainer').style.display='none';
  const mobileNav = document.getElementById('mobileNav');
  if(mobileNav) mobileNav.style.display='none';

  let el = document.getElementById('welcomeGateOverlay');
  if(!el){
    el = document.createElement('div');
    el.id = 'welcomeGateOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:var(--bg,#f2f2f7);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:var(--font,"DM Sans",sans-serif)';
    document.body.appendChild(el);
  }

  const trialBtn = !trialExpirado
    ? `<button id="btnStartTrial" style="width:100%;padding:14px;border-radius:16px;border:none;background:linear-gradient(135deg,#0A84FF,#BF5AF2);color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:10px;letter-spacing:-0.02em">⚡ ${t('trialBtn')}</button>`
    : `<div style="padding:10px 16px;background:rgba(255,69,58,0.06);border:1px solid rgba(255,69,58,0.2);border-radius:12px;font-size:12px;color:#FF453A;font-weight:600;margin-bottom:10px">⏰ ${t('trialUsed')}</div>`;

  const adminEmail = 'ctfnoe@gmail.com';

  el.innerHTML = `<div style="background:var(--card,#fff);border-radius:24px;padding:40px 32px;max-width:400px;width:90%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.12)">
    <div style="font-size:48px;margin-bottom:12px">📊</div>
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.03em;margin-bottom:6px">TrackFolio</div>
    <div style="font-size:13px;color:#888;margin-bottom:24px;line-height:1.5">${t('welcomeDesc')}</div>

    <!-- Botón de pago principal -->
    <button id="btnPagar" style="width:100%;padding:15px;border-radius:16px;border:none;background:linear-gradient(135deg,#00b1ea,#009ee3);color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:6px;letter-spacing:-0.02em;box-shadow:0 4px 16px rgba(0,158,227,0.3)">
      💳 ${t('payBtn')}
    </button>
    <div style="font-size:11px;color:#aaa;margin-bottom:16px">${t('payDesc')}</div>

    <!-- Divisor -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="flex:1;height:1px;background:var(--border,#e5e5ea)"></div>
      <span style="font-size:11px;color:#bbb">${t('payOr')}</span>
      <div style="flex:1;height:1px;background:var(--border,#e5e5ea)"></div>
    </div>

    ${trialBtn}
    <a href="mailto:${adminEmail}" style="display:block;width:100%;padding:13px;border-radius:16px;border:1.5px solid #0A84FF;color:#0A84FF;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;text-decoration:none;box-sizing:border-box">✉️ ${t('contactBtn')}</a>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px">
      <span style="font-size:12px;color:#aaa;user-select:all">${adminEmail}</span>
      <button id="btnCopyAdminEmail" onclick="
        navigator.clipboard.writeText('${adminEmail}').then(()=>{
          this.textContent='✅';
          this.style.color='#30D158';
          setTimeout(()=>{this.textContent='📋';this.style.color='#aaa';},2000);
        }).catch(()=>{
          const ta=document.createElement('textarea');ta.value='${adminEmail}';
          document.body.appendChild(ta);ta.select();document.execCommand('copy');
          ta.remove();this.textContent='✅';this.style.color='#30D158';
          setTimeout(()=>{this.textContent='📋';this.style.color='#aaa';},2000);
        })
      " style="background:none;border:none;cursor:pointer;font-size:14px;color:#aaa;padding:2px 4px;border-radius:6px;transition:color 0.2s" title="Copiar email">📋</button>
    </div>
    <div style="font-size:11px;color:#ccc;margin-bottom:16px;word-break:break-all">${user.email}</div>
    <button onclick="window.signOutUser()" style="padding:8px 20px;border-radius:20px;border:1px solid #ddd;background:none;cursor:pointer;font-size:12px;color:#888;font-family:inherit">← ${t('salir')}</button>
  </div>`;
  el.style.display = 'flex';
  window._showingWelcomeGate = true;

  // Botón probar
  const btnTrial = document.getElementById('btnStartTrial');
  if(btnTrial){
    btnTrial.addEventListener('click', function(){
      const uid = window._currentUser?.uid;
      if(!uid) return;
      const TRIAL_MS = 20 * 60 * 1000;
      const trialKey = 'fp_trial_' + uid;
      const trialStart = Date.now();
      localStorage.setItem(trialKey, trialStart);
      window._trialStart = trialStart;
      window._trialMS = TRIAL_MS;
      window._trialUID = uid;
      window._showingWelcomeGate = false;
      el.style.display = 'none';
      // Iniciar app
      hidePending();
      DOC_REF = getDocRef(uid);
      if(typeof resetToEmpty==='function') resetToEmpty();
      if(typeof updateNavUser==='function') updateNavUser(window._currentUser);
      if(typeof showApp==='function') showApp();
      if(typeof setupFirestore==='function') setupFirestore(uid);
      if(typeof startTrialBanner==='function') startTrialBanner();
      if(window.renderPage) window.renderPage(window.currentTab||'dashboard');
    });
  }

  // Botón pagar con Mercado Pago
  const btnPagar = document.getElementById('btnPagar');
  if(btnPagar){
    btnPagar.addEventListener('click', async function(){
      this.disabled = true;
      this.textContent = t('payProcessing');
      try {
        const resp = await fetch('/mp-create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: user.email, lang: window.__lang || 'es' })
        });
        const data = await resp.json();
        const url = data.init_point || data.sandbox_init_point;
        if(url) { window.location.href = url; }
        else { throw new Error('No se pudo crear el link de pago'); }
      } catch(err) {
        console.error('[Pay] Error:', err);
        this.disabled = false;
        this.textContent = t('payBtn');
        alert('Error al conectar con el sistema de pago. Intenta de nuevo.');
      }
    });
  }
}

function showTrialExpired(user){ showWelcomeGate(user, true); }
// ── Trial banner counter ───────────────────────────────────────────────────
function startTrialBanner(){
  if(!window._trialStart || !window._trialMS) return;
  let banner = document.getElementById('trialCounterBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'trialCounterBanner';
    banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9997;background:linear-gradient(135deg,#FF9F0A,#FF6B00);color:#fff;border-radius:20px;padding:6px 16px;font-size:12px;font-weight:700;font-family:var(--font,"DM Sans",sans-serif);box-shadow:0 4px 16px rgba(255,159,10,0.4);display:flex;align-items:center;gap:8px;white-space:nowrap';
    document.body.appendChild(banner);
  }
  function update(){
    const elapsed = Date.now() - window._trialStart;
    const remaining = Math.max(0, window._trialMS - elapsed);
    if(remaining === 0){
      // Time's up — mostrar welcome gate con trial expirado
      if(window._trialUID){
        banner.remove();
        window._trialStart = null;
        window._showingWelcomeGate = true;
        // Ocultar app
        document.getElementById('mainNav').style.display='none';
        document.getElementById('mainContainer').style.display='none';
        const mn=document.getElementById('mobileNav'); if(mn) mn.style.display='none';
        if(window._currentUser) showWelcomeGate(window._currentUser, true);
        else window.location.reload();
      }
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    banner.innerHTML = `⏱ ${t('trialBanner')} — ${mins}:${secs.toString().padStart(2,'0')} ${t('trialMinutes')}`;
    setTimeout(update, 1000);
  }
  update();
}

function showPending(user){
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('mainNav').style.display='none';
  document.getElementById('mainContainer').style.display='none';
  document.getElementById('mobileNav').style.display='none';
  document.getElementById('accessDenied').classList.remove('show');
  let el = document.getElementById('pendingOverlay');
  if(!el){
    el = document.createElement('div');
    el.id = 'pendingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:var(--bg,#f2f2f7);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:var(--font,"DM Sans",sans-serif)';
    el.innerHTML = `<div style="background:var(--card,#fff);border-radius:24px;padding:40px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.12)">
      <div style="font-size:48px;margin-bottom:16px">⏳</div>
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px">${t('accessPending')}</div>
      <div style="font-size:14px;color:#666;line-height:1.6;margin-bottom:24px">${t('pendingExplanation')}</div>
      <div style="font-size:12px;color:#999;margin-bottom:24px;word-break:break-all">${user.email}</div>
      <button onclick="window.signOutUser()" style="padding:10px 24px;border-radius:20px;border:1px solid #ddd;background:none;cursor:pointer;font-size:13px;font-weight:600">← ${t('salir')}</button>
    </div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}
function hidePending(){
  const el = document.getElementById('pendingOverlay');
  if(el) el.style.display = 'none';
}

window.openAdminPanel = async function(){
  openModal('<div style="padding:8px 0"><div style="font-size:18px;font-weight:800;margin-bottom:16px">👑 '+t('adminPanel')+'</div><div style="text-align:center;padding:32px;color:var(--text2)"><span class="spinner"></span> '+t('loadingUsers')+'...</div></div>');

  const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDocs(collection(db, 'registros'));
  const userMetas = [];
  snap.forEach(d => { if(d.id !== ADMIN_UID) userMetas.push({uid: d.id, ...d.data()}); });

  const usageData = await Promise.all(userMetas.map(async u => {
    try {
      const [platSnap, invSnap, gasSnap, snapSnap] = await Promise.all([
        getDocs(collection(db,'usuarios',u.uid,'movimientos_plataformas')),
        getDocs(collection(db,'usuarios',u.uid,'movimientos_inversiones')),
        getDocs(collection(db,'usuarios',u.uid,'movimientos_gastos')),
        getDocs(collection(db,'usuarios',u.uid,'snapshots')),
      ]);
      return {
        ...u,
        movPlat: platSnap.size,
        movInv: invSnap.size,
        movGas: gasSnap.size,
        snaps: snapSnap.size,
        totalMovs: platSnap.size + invSnap.size + gasSnap.size,
      };
    } catch(e) {
      return { ...u, movPlat:0, movInv:0, movGas:0, snaps:0, totalMovs:0 };
    }
  }));

  usageData.sort((a,b) => {
    if(a.aprobado !== b.aprobado) return a.aprobado ? 1 : -1;
    return b.totalMovs - a.totalMovs;
  });

  // Guardar en memoria para actualizaciones sin recargar desde Firebase
  window._adminUsageData = usageData;

  // Función para re-renderizar solo las filas sin recargar datos
  window._renderAdminRows = function() {
    const data = window._adminUsageData || [];
    const pending = data.filter(u=>!u.aprobado).length;
    const pagados = data.filter(u=>u.pagado).length;
    const ingresos = pagados * 20;
    const pendingEl = document.querySelector('._adminPendingBadge');
    if (pendingEl) pendingEl.textContent = pending > 0 ? `${pending} ${t('pending')}` : '';
    const rowsEl = document.getElementById('_adminRowsContainer');
    if (!rowsEl) return;
    rowsEl.innerHTML = data.map(u => `
    <div style="padding:14px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0">
            ${(u.displayName||u.email||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-size:13px;font-weight:700">${u.displayName||t('noName')}</div>
            <div style="font-size:11px;color:var(--text2)">${u.email||''}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${u.aprobado?'rgba(48,209,88,0.1)':'rgba(255,159,10,0.1)'};color:${u.aprobado?'var(--green)':'var(--orange)'}">${u.aprobado?'✅ '+t('active'):'⏳ '+t('pending')}</span>
          ${u.pagado?`<span style="font-size:10px;font-weight:600;color:var(--green)">💳 $20 USD · ${u.pagadoEn?new Date(u.pagadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span>`:`<span style="font-size:10px;color:var(--text3)">Sin pago registrado</span>`}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">${u.movPlat}</div><div style="font-size:9px;color:var(--text2);text-transform:uppercase">${t('seccionPlataformas')}</div></div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green)">${u.movInv}</div><div style="font-size:9px;color:var(--text2);text-transform:uppercase">${t('seccionInversiones')}</div></div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--orange)">${u.movGas}</div><div style="font-size:9px;color:var(--text2);text-transform:uppercase">${t('seccionGastos')}</div></div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--purple)">${u.snaps}</div><div style="font-size:9px;color:var(--text2);text-transform:uppercase">${t('snapshots')}</div></div>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        ${!u.aprobado?`<button onclick="window.aprobarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--green);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('approve')}</button>`:''}
        ${u.aprobado?`<button onclick="window.revocarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--orange,#ff9f0a);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('revoke')}</button>`:''}
        <button onclick="window.eliminarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--red,#ff453a);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('delete')}</button>
      </div>
    </div>`).join('') || `<div style="text-align:center;padding:32px;color:var(--text2)">${t('noUsers')}</div>`;
  };

  const rows = usageData.map(u => `
    <div style="padding:14px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0">
            ${(u.displayName||u.email||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-size:13px;font-weight:700">${u.displayName||t('noName')}</div>
            <div style="font-size:11px;color:var(--text2)">${u.email||''}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${u.aprobado?'rgba(48,209,88,0.1)':'rgba(255,159,10,0.1)'};color:${u.aprobado?'var(--green)':'var(--orange)'}">${u.aprobado?'✅ '+t('active'):'⏳ '+t('pending')}</span>
          ${u.pagado
            ? `<span style="font-size:10px;font-weight:600;color:var(--green)">💳 $20 USD · ${u.pagadoEn ? new Date(u.pagadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</span>`
            : `<span style="font-size:10px;color:var(--text3)">Sin pago registrado</span>`
          }
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:var(--blue)">${u.movPlat}</div>
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">${t('seccionPlataformas')}</div>
        </div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:var(--green)">${u.movInv}</div>
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">${t('seccionInversiones')}</div>
        </div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:var(--orange)">${u.movGas}</div>
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">${t('seccionGastos')}</div>
        </div>
        <div style="background:var(--card2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:var(--purple)">${u.snaps}</div>
          <div style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">${t('snapshots')}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        ${!u.aprobado?`<button onclick="window.aprobarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--green);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('approve')}</button>`:''}
        ${u.aprobado?`<button onclick="window.revocarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--orange,#ff9f0a);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('revoke')}</button>`:''}
        <button onclick="window.eliminarUsuario('${u.uid}')" style="padding:5px 12px;border-radius:14px;border:none;background:var(--red,#ff453a);color:#fff;font-size:11px;font-weight:700;cursor:pointer">${t('delete')}</button>
      </div>
    </div>`).join('');

  const pending = usageData.filter(u=>!u.aprobado).length;
  const pagados = usageData.filter(u=>u.pagado).length;
  const ingresos = pagados * 20;
  openModal(`<div style="padding:8px 0">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:18px;font-weight:800">👑 ${t('adminPanel')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${pending>0?`<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(255,159,10,0.1);color:var(--orange)">${pending} ${t('pending')}</span>`:''}
        <span style="font-size:11px;color:var(--text2)">${usageData.length} ${usageData.length===1?t('user'):t('users')}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div style="background:var(--card2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--blue)">${usageData.length}</div>
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">Usuarios</div>
      </div>
      <div style="background:var(--card2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--green)">${pagados}</div>
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">Pagados</div>
      </div>
      <div style="background:var(--card2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--green)">$${ingresos}</div>
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">USD ingresados</div>
      </div>
    </div>
    <div id="_adminRowsContainer" style="max-height:420px;overflow-y:auto;margin:0 -4px;padding:0 4px">
      ${rows || '<div style="text-align:center;padding:32px;color:var(--text2)">'+t('noUsers')+'</div>'}
    </div>
  </div>`);
};

window.aprobarUsuario = async function(uid){
  const { doc: _doc, setDoc: _setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  // Actualizar botón inmediatamente sin recargar todo el panel
  const btn = document.querySelector(`button[onclick="window.aprobarUsuario('${uid}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  await _setDoc(_doc(db,'registros',uid), {aprobado:true}, {merge:true});
  // Actualizar solo ese usuario en el cache del panel
  if (window._adminUsageData) {
    const u = window._adminUsageData.find(x => x.uid === uid);
    if (u) u.aprobado = true;
    window._renderAdminRows();
  }
};

window.revocarUsuario = async function(uid){
  const { doc: _doc, setDoc: _setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const btn = document.querySelector(`button[onclick="window.revocarUsuario('${uid}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  await _setDoc(_doc(db,'registros',uid), {aprobado:false}, {merge:true});
  if (window._adminUsageData) {
    const u = window._adminUsageData.find(x => x.uid === uid);
    if (u) u.aprobado = false;
    window._renderAdminRows();
  }
};

window.eliminarUsuario = async function(uid){
  if(!confirm(t('deleteUserConfirm'))) return;
  const { doc: _doc, deleteDoc: _deleteDoc, collection: _col, getDocs: _getDocs } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const SUBCOLS = ['movimientos_plataformas','movimientos_inversiones','movimientos_gastos','snapshots'];
  for (const subcol of SUBCOLS) {
    try {
      const snap = await _getDocs(_col(db, 'usuarios', uid, subcol));
      await Promise.all(snap.docs.map(d => _deleteDoc(d.ref)));
    } catch(e) { /* ignore */ }
  }

  try {
    await Promise.all([
      _deleteDoc(_doc(db, 'registros', uid)),
      _deleteDoc(_doc(db, 'usuarios', uid, 'datos', 'main')),
      _deleteDoc(_doc(db, 'usuarios', uid, 'meta', 'perfil')),
    ]);
  } catch(e) { /* ignore */ }
  // Quitar usuario del cache y re-renderizar sin recargar Firebase
  if (window._adminUsageData) {
    window._adminUsageData = window._adminUsageData.filter(u => u.uid !== uid);
    window._renderAdminRows();
  } else {
    window.openAdminPanel();
  }
};

onAuthStateChanged(auth,async user=>{
  window._log('onAuthStateChanged: '+(user?user.email:'null')+' pending='+_redirectPending);
  if(user){
    window._currentUser=user;
    const uid = user.uid;

    const { setDoc: _setDoc, getDoc: _getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const metaRef = getMetaRef(uid);
    const metaSnap = await _getDoc(metaRef);
    const isAdmin = uid === ADMIN_UID || user.email === 'ctfnoe@gmail.com';

    const perfilData = {
      uid, email: user.email, displayName: user.displayName,
      photoURL: user.photoURL, aprobado: isAdmin,
      rol: isAdmin ? 'admin' : 'user',
      creadoEn: new Date().toISOString()
    };
    if(!metaSnap.exists()){
      await _setDoc(metaRef, perfilData);
      await _setDoc(doc(db,'registros',uid), {
        uid, email: user.email, displayName: user.displayName,
        photoURL: user.photoURL, aprobado: isAdmin,
        creadoEn: new Date().toISOString()
      });
    } else {
      await _setDoc(metaRef, {email:user.email, displayName:user.displayName, photoURL:user.photoURL}, {merge:true});
      await _setDoc(doc(db,'registros',uid), {email:user.email, displayName:user.displayName}, {merge:true});
    }

    const registroRef = doc(db, 'registros', uid);
    const registroSnap = await _getDoc(registroRef);
    const aprobado = registroSnap.exists() && registroSnap.data()?.aprobado === true;
    // [Auth] log removido de producción;

    // ── Sistema de acceso / prueba ───────────────────────────────────
    if(!aprobado && !isAdmin){
      const TRIAL_MS = 20 * 60 * 1000;
      const trialKey = 'fp_trial_' + uid;
      let trialStart = null;
      try { trialStart = parseInt(localStorage.getItem(trialKey)); } catch(e){}
      const trialYaUsado  = !!trialStart;
      const trialExpirado = trialYaUsado && (Date.now() - trialStart) >= TRIAL_MS;
      const trialActivo   = trialYaUsado && !trialExpirado;
      if(trialActivo){
        // Trial en curso — entrar directo con contador
        window._trialStart = trialStart;
        window._trialMS = TRIAL_MS;
        window._trialUID = uid;
      } else {
        // Mostrar pantalla de bienvenida (con o sin botón de probar)
        document.getElementById('loginOverlay')?.classList.add('hidden');
        hidePending();
        window._showingWelcomeGate = true;
        showWelcomeGate(user, trialExpirado);
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────

    hidePending();
    DOC_REF = getDocRef(uid);
    resetToEmpty();
    if(typeof updateNavUser==='function') updateNavUser(user);
    showApp(); setupFirestore(uid);
    if(window._trialStart) startTrialBanner(); // mostrar contador si está en prueba

    if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
    _unsubRegistro = onSnapshot(registroRef, (snap) => {
      if(!snap.exists()){
        if(!isAdmin){
          if(_unsub){_unsub();_unsub=null;}
          if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
          signOut(auth).then(()=>window.location.reload());
        }
        return;
      }
      const data = snap.data();
      if(data.aprobado === true && window._trialStart){
        window._trialStart = null; window._trialMS = null; window._trialUID = null;
        window._showingWelcomeGate = false;
        const tb = document.getElementById('trialCounterBanner'); if(tb) tb.remove();
      }
      const enTrialOWelcome = window._trialStart || window._showingWelcomeGate;
      if(!isAdmin && data.aprobado === false && !enTrialOWelcome){
        if(_unsub){_unsub();_unsub=null;}
        if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
        signOut(auth).then(()=>window.location.reload());
      }
    }, (err) => { console.error('[registro listener]', err); });
    if(window.renderPage) window.renderPage(window.currentTab||'dashboard');
    setTimeout(()=>{ _runProactiveAiAlert(); }, 4000);
    setTimeout(()=>{
      if(typeof updateFX==='function') updateFX();
      if(typeof flushOfflineQueue==='function') flushOfflineQueue();
    },1200);
    requestAnimationFrame(() => { if(typeof _observeBarCharts==='function') _observeBarCharts(); });
  }else{
    window._currentUser=null;
    if(_unsub){_unsub();_unsub=null;}
    if(_unsubRegistro){_unsubRegistro();_unsubRegistro=null;}
    hidePending();
    // Don't show login if: redirect is still being processed, or welcome gate is showing
    if(_redirectPending) return;
    if(window._showingWelcomeGate) return;
    showLogin();
  }
});
window.addEventListener('online',()=>setFbStatus('ok'));
window.addEventListener('offline',()=>setFbStatus('offline'));

window.toggleDark = toggleDark;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.setChartRange = setChartRange;
window.setChartRange2 = setChartRange2;
window.setChartProj = setChartProj;
window.switchChartTab = switchChartTab;
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
window.openEditRecurrenteModal = openEditRecurrenteModal;
window.saveRecurrente = saveRecurrente;
window.syncRecurrenteName = syncRecurrenteName;
window.addRecurrente = addRecurrente;
window.toggleRecurrente = toggleRecurrente;
window.deleteRecurrente = deleteRecurrente;
window.openGoalModal = openGoalModal;
window.openEditGoalModal = openEditGoalModal;
window.saveGoal = saveGoal;
window.addGoal = addGoal;
window.deleteGoal = deleteGoal;
window.testFinnhub = testFinnhub;
window.testAlphaVantage = testAlphaVantage;
window.testAiKey = testAiKey;
window.settings = settings;
window.LS = LS;
window.exportData = exportData;
window.importData = importData;
window.resetAll = resetAll;
window.confirmResetAll = confirmResetAll;


window.openMovModal = openMovModal;
window.saveMovement = saveMovement;
window.deleteMovement = deleteMovement;
window.openEditMovModal = openEditMovModal;
window.updateMovement = updateMovement;
window.movFilter = movFilter;
window.renderMovimientos = renderMovimientos;
window.updateAllPrices = updateAllPrices;
window.toggleLang = toggleLang;
window._applyLangToNav = _applyLangToNav;
window.renderGastos = renderGastos;

window.gastosNavMonth = function(delta) {
  const now = new Date();
  let base;
  if (_gastosMonth) {
    const p = _gastosMonth.split('-').map(Number);
    base = new Date(p[0], p[1]-1, 1);
  } else {
    base = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  base.setMonth(base.getMonth() + delta);
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  if (base > cur) base = cur;
  const isNow = base.getFullYear()===now.getFullYear() && base.getMonth()===now.getMonth();
  _gastosMonth = isNow ? null : base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0');
  renderGastos();
};
window.gastosNavToday = function() {
  _gastosMonth = null;
  renderGastos();
};
