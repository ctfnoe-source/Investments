// ui.js - Módulo de interfaz de usuario

import {
  platforms, movements, goals, settings, recurrentes, patrimonioHistory,
  loadInitialData, saveAllToStorage,
  COLORS, MONTHS, EXPENSE_CATS, ASSET_TYPES, BROKERS, PLAT_TYPES, PLAT_GROUPS, PLAT_MONEDAS, FRECUENCIAS,
  calcPlatforms, getTickerPositions, getPriceInfo, getEurMxn,
  fmt, fmtFull, fmtPct, pctCol, fmtPlat,
  fetchFX, _fxCache, isCacheFresh, getCachedPrice, setCachedPrice,
  fetchPrice, updateAllPrices as coreUpdateAllPrices, getPriceSummary,
  uid, today, priceUpdateState,
} from './core.js';

// ==================== VARIABLES GLOBALES DE UI ====================
let currentTab = 'dashboard';
let movFilter = { seccion: 'todas', search: '', limit: 100 };
let chartInstances = {};
let _lastLocalSave = 0;
let _chartRange = 'all';
let _projKey = '1y';

// ==================== TOAST ====================
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toastMessage');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== EXPORTAR FUNCIONES AL GLOBAL ====================
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleDark = toggleDark;
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
window.exportData = exportData;
window.importData = importData;
window.resetAll = resetAll;
window.openMovModal = openMovModal;
window.saveMovement = saveMovement;
window.deleteMovement = deleteMovement;
window.openEditMovModal = openEditMovModal;
window.updateMovement = updateMovement;
window.updateAllPrices = updateAllPrices;
window.showPriceHistory = showPriceHistory; // nueva función

// ==================== FUNCIONES PRINCIPALES ====================
export function renderPage(tab) {
  currentTab = tab;
  window.currentTab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(t => t.classList.remove('active'));
  const pageEl = document.getElementById('page-'+tab);
  if(pageEl) pageEl.classList.add('active');
  const nt = document.querySelector('[data-tab="'+tab+'"]');
  if(nt) nt.classList.add('active');
  document.querySelectorAll('.mobile-nav-item[data-tab="'+tab+'"]').forEach(t => t.classList.add('active'));

  if (tab === 'dashboard') renderDashboard();
  else if (tab === 'movimientos') renderMovimientos();
  else if (tab === 'plataformas') renderPlataformas();
  else if (tab === 'gastos') renderGastos();
  else if (tab === 'metas') renderMetas();
  else if (tab === 'reporte') renderReporte();
  else if (tab === 'ajustes') renderAjustes();
}

// ==================== DASHBOARD (con reutilización de gráficos) ====================
function renderDashboard() {
  // ... (mismo código que antes, pero al final en setTimeout actualizamos gráficos)
  // Por brevedad, aquí solo indico la parte de los gráficos; el HTML se mantiene igual
  // ...
  setTimeout(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    const tickColor = isDark ? '#636366' : '#C7C7CC';

    // Obtener datos reales (de patrimonioHistory)
    const hist = [...patrimonioHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
    let histFiltered = hist;
    const selInterval = CHART_INTERVALS.find(i => i.key === _chartRange);
    if (selInterval) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - selInterval.months);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      histFiltered = hist.filter(s => s.date >= cutoffStr);
      if (histFiltered.length === 0) histFiltered = hist.slice(-2);
    }
    const realDates = histFiltered.map(s => s.date);
    const realVals = histFiltered.map(s => s.value);

    // Datos proyectados
    const patrimonio = realVals.length ? realVals[realVals.length-1] : 0;
    const re = settings.rendimientoEsperado || 0.06;
    const projInterval = CHART_INTERVALS.find(i => i.key === _projKey) || CHART_INTERVALS[3];
    const projMonths = projInterval.months;
    const projDates = [];
    const projVals = [];
    const now = new Date();
    for(let i=0; i<=projMonths; i++){
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      projDates.push(d.toISOString().split('T')[0]);
      projVals.push(Math.round(patrimonio * Math.pow(1+re/12, i)));
    }

    const ctxE = document.getElementById('chartEvo');
    if (ctxE) {
      if (chartInstances.chartEvo) {
        chartInstances.chartEvo.data.datasets[0].data = realDates.map((d,i) => ({x:d, y:realVals[i]}));
        chartInstances.chartEvo.data.datasets[1].data = projDates.map((d,i) => ({x:d, y:projVals[i]}));
        chartInstances.chartEvo.update();
      } else {
        chartInstances.chartEvo = new Chart(ctxE, {
          type:'line',
          data: {
            datasets: [
              { label:'Patrimonio Real', data: realDates.map((d,i)=>({x:d, y:realVals[i]})), borderColor:'#30D158', backgroundColor:'transparent', borderWidth:2.5, fill:false, tension:0.4, pointRadius:0, pointHoverRadius:5 },
              { label:'Proyectado', data: projDates.map((d,i)=>({x:d, y:projVals[i]})), borderColor:'rgba(10,132,255,0.7)', backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,4], fill:false, tension:0.1, pointRadius:0 }
            ]
          },
          options: { /* ... opciones ... */ }
        });
      }
    }

    const ctxD = document.getElementById('chartDistro');
    if (ctxD) {
      // Calcular distribución
      const at = {};
      const plats = calcPlatforms();
      const tc = settings.tipoCambio||20;
      plats.forEach(p => { at[p.type] = (at[p.type]||0) + platSaldoToMXN(p); });
      const tickers = getTickerPositions();
      tickers.forEach(t => { if(t.cantActual>0) { const v = (t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc); at[t.type] = (at[t.type]||0) + v; } });
      const de = Object.entries(at).filter(([,v]) => v>0).sort((a,b) => b[1]-a[1]);
      if (chartInstances.chartDistro) {
        chartInstances.chartDistro.data.labels = de.map(([k]) => k);
        chartInstances.chartDistro.data.datasets[0].data = de.map(([,v]) => v);
        chartInstances.chartDistro.update();
      } else if (de.length > 0) {
        chartInstances.chartDistro = new Chart(ctxD, {
          type:'doughnut',
          data: { labels: de.map(([k])=>k), datasets: [{ data: de.map(([,v])=>v), backgroundColor: de.map((_,i)=>COLORS[i%COLORS.length]), borderWidth:2, borderColor: isDark?'#1C1C1E':'#fff' }] },
          options: { /* ... */ }
        });
      }
    }
  }, 50);
}

// ==================== MOVIMIENTOS CON PAGINACIÓN ====================
function renderMovimientos() {
  const transferGroups = {};
  movements.forEach(m => { if(m.transferId) transferGroups[m.transferId] = (transferGroups[m.transferId]||[]).concat(m); });
  
  const filtered = movements.filter(m => {
    if(movFilter.seccion !== 'todas' && m.seccion !== movFilter.seccion) return false;
    if(m.tipoPlat === 'Transferencia entrada' && m.transferId && movFilter.seccion === 'todas') return false;
    if(movFilter.search) {
      const s = movFilter.search.toLowerCase();
      const text = [m.platform, m.ticker, m.broker, m.tipoPlat, m.tipoMov, m.tipo, m.notas, m.desc, m.categoria].filter(Boolean).join(' ').toLowerCase();
      if(!text.includes(s)) return false;
    }
    return true;
  }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  const visible = filtered.slice(0, movFilter.limit);
  const hasMore = filtered.length > movFilter.limit;

  document.getElementById('page-movimientos').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Movimientos</div><div class="section-sub">Registro unificado · ${movements.length} total</div></div>
      <button class="btn btn-primary" onclick="openMovModal()">+ Nuevo</button>
    </div>
    <div class="filter-pills">
      ${['todas','plataformas','inversiones','gastos'].map(s => `<button class="pill ${movFilter.seccion===s?'active':''}" onclick="movFilter.seccion='${s}'; renderMovimientos()">${s==='todas'?'Todas':s==='plataformas'?'🏦 Plataformas':s==='inversiones'?'📈 Inversiones':'💳 Gastos'}</button>`).join('')}
      <input class="pill-search" placeholder="Buscar..." value="${movFilter.search}" oninput="movFilter.search=this.value; renderMovimientos()">
      <span style="font-size:12px;color:var(--text2);margin-left:4px">${filtered.length} movimientos</span>
    </div>
    <div class="card-flat"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Sección</th><th>Detalle</th><th>Tipo</th><th>Monto</th><th>Extra</th><th>Notas</th><th style="width:70px"></th></tr></thead>
      <tbody>
        ${visible.map(m => {
          // ... (mismo código de generación de filas) ...
        }).join('')}
        ${visible.length===0 ? '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:32px">Sin movimientos</td></tr>' : ''}
      </tbody>
    </table></div></div>
    ${hasMore ? `<div style="text-align:center; margin-top:16px"><button class="btn btn-secondary btn-sm" onclick="movFilter.limit += 50; renderMovimientos()">Cargar más (${filtered.length - movFilter.limit} restantes)</button></div>` : ''}
  `;
}

// ==================== NUEVA VISTA: REPORTE MENSUAL ====================
function renderReporte() {
  const cm = new Date().getMonth() + 1;
  const cy = new Date().getFullYear();
  const eurmxn = getEurMxn();
  const ingresos = settings.ingresos || {};
  const sueldoEUR = ingresos.monedaSueldo === 'EUR' ? (ingresos.sueldoRaw||0) : (ingresos.sueldo||0);
  const extrasEUR = ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR = ingresos.otrosEUR||ingresos.otros||0;
  const ingresoPlaneadoEUR = sueldoEUR + extrasEUR + otrosEUR;

  const gastosMes = movements.filter(m => m.seccion === 'gastos' && m.tipo === 'Gasto' && m.fecha && m.fecha.startsWith(`${cy}-${String(cm).padStart(2,'0')}`));
  const ingresosMes = movements.filter(m => m.seccion === 'gastos' && m.tipo === 'Ingreso' && m.fecha && m.fecha.startsWith(`${cy}-${String(cm).padStart(2,'0')}`));

  const toEUR = m => {
    if (m.notas && m.notas.includes('€') && m.notas.includes('→')) {
      const match = m.notas.match(/€([\d.]+)/);
      if (match) return Number(match[1]);
    }
    return Math.round(m.importe / eurmxn * 100) / 100;
  };

  const totalGastoEUR = gastosMes.reduce((s,m) => s + toEUR(m), 0);
  const totalIngresoEUR = ingresosMes.reduce((s,m) => s + toEUR(m), 0);
  const ingRef = totalIngresoEUR > 0 ? totalIngresoEUR : ingresoPlaneadoEUR;
  const balance = ingRef - totalGastoEUR;

  // Agrupar por categoría
  const porCategoria = {};
  gastosMes.forEach(m => {
    const cat = m.categoria;
    porCategoria[cat] = (porCategoria[cat] || 0) + toEUR(m);
  });

  const catRows = EXPENSE_CATS.map(cat => {
    const gasto = porCategoria[cat.id] || 0;
    const presupuesto = (settings.budgets && settings.budgets[cat.id]) || 0;
    const pct = presupuesto > 0 ? (gasto / presupuesto * 100).toFixed(1) : '—';
    return `<tr><td>${cat.icon} ${cat.name}</td><td>${fmt(gasto, 'EUR')}</td><td>${presupuesto ? fmt(presupuesto, 'EUR') : '—'}</td><td>${pct}%</td></tr>`;
  }).join('');

  document.getElementById('page-reporte').innerHTML = `
    <div class="section-title" style="margin-bottom:24px">📅 Reporte Mensual · ${MONTHS[cm-1]} ${cy}</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">Ingresos</div><div class="stat-value">${fmt(ingRef, 'EUR')}</div><div class="stat-sub">${totalIngresoEUR>0?'real':'planeado'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--red)"><div class="stat-label">Gastos</div><div class="stat-value">${fmt(totalGastoEUR, 'EUR')}</div><div class="stat-sub">${gastosMes.length} movimientos</div></div>
      <div class="card stat" style="border-top:3px solid ${balance>=0?'var(--green)':'var(--red)'}"><div class="stat-label">Balance</div><div class="stat-value">${fmt(balance, 'EUR')}</div><div class="stat-sub">${balance>=0?'superávit':'déficit'}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">💶 Gastos por Categoría</div>
      <div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Gasto (€)</th><th>Presupuesto (€)</th><th>% usado</th></tr></thead><tbody>${catRows}</tbody></table></div>
    </div>
    <div class="card">
      <div class="card-title">📊 Evolución Mensual (últimos 12 meses)</div>
      <div style="height:200px"><canvas id="chartEvolMensual"></canvas></div>
    </div>
  `;

  // Gráfico de evolución mensual de gastos/ingresos
  setTimeout(() => {
    const meses = [];
    const gastosData = [];
    const ingresosData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(cy, cm-1 - i, 1);
      const mesKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      meses.push(MONTHS[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));
      const g = movements.filter(m => m.seccion==='gastos' && m.tipo==='Gasto' && m.fecha?.startsWith(mesKey)).reduce((s,m)=>s+toEUR(m),0);
      const ing = movements.filter(m => m.seccion==='gastos' && m.tipo==='Ingreso' && m.fecha?.startsWith(mesKey)).reduce((s,m)=>s+toEUR(m),0);
      gastosData.push(g);
      ingresosData.push(ing);
    }
    const ctx = document.getElementById('chartEvolMensual');
    if (ctx) {
      if (chartInstances.chartEvolMensual) chartInstances.chartEvolMensual.destroy();
      chartInstances.chartEvolMensual = new Chart(ctx, {
        type: 'line',
        data: {
          labels: meses,
          datasets: [
            { label: 'Gastos (€)', data: gastosData, borderColor: 'var(--red)', backgroundColor: 'transparent', tension: 0.3 },
            { label: 'Ingresos (€)', data: ingresosData, borderColor: 'var(--green)', backgroundColor: 'transparent', tension: 0.3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }, 50);
}

// ==================== NUEVA FUNCIÓN: HISTORIAL DE PRECIOS POR TICKER ====================
function showPriceHistory(ticker, type, moneda) {
  // Simulación de datos históricos (variación aleatoria alrededor del precio actual)
  const precioActual = getPriceInfo(ticker, type, moneda).price || 100;
  const fechas = [];
  const valores = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    fechas.push(d.toLocaleDateString('es-MX', {day:'2-digit', month:'2-digit'}));
    // Variación aleatoria ±10%
    const variacion = 1 + (Math.random() * 0.2 - 0.1);
    valores.push(precioActual * variacion);
  }

  let html = `
    <div class="modal-header">
      <div class="modal-title">📈 Historial de precio · ${ticker} (${moneda})</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="height:250px"><canvas id="priceHistoryChart"></canvas></div>
  `;
  openModal(html);
  setTimeout(() => {
    const ctx = document.getElementById('priceHistoryChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: fechas,
          datasets: [{
            label: 'Precio simulado',
            data: valores,
            borderColor: 'var(--blue)',
            backgroundColor: 'rgba(10,132,255,0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }, 100);
}

// ==================== RESTO DE FUNCIONES (plataformas, gastos, metas, ajustes, modales) ====================
// ... (se mantienen igual que en el código original, pero con las mejoras de confirmación y toast) ...

// Ejemplo de mejora en deletePlatform:
export function deletePlatform(id) {
  if (confirm('¿Estás seguro de que quieres eliminar esta plataforma? Esta acción no se puede deshacer.')) {
    platforms = platforms.filter(p => p.id !== id);
    saveAll();
    showToast('Plataforma eliminada');
  }
}

// Mejora en editPlatField: cancelar con Escape
export function editPlatField(id, field, el, inputType) {
  const p = platforms.find(x => x.id === id);
  if (!p) return;
  let input;
  if (inputType === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.value = p[field] || today();
    input.className = 'form-input';
    input.style.cssText = 'width:130px;padding:4px 8px;font-size:12px';
  } else if (inputType === 'percent') {
    input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.max = '100';
    input.value = p[field] || 0;
    input.className = 'form-input';
    input.style.cssText = 'width:90px;padding:4px 8px;font-size:12px';
  } else if (inputType === 'moneda') {
    input = document.createElement('select');
    input.className = 'form-select';
    input.style.cssText = 'width:100px;padding:4px 8px;font-size:12px';
    PLAT_MONEDAS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'MXN' ? '🇲🇽 MXN' : m === 'USD' ? '🇺🇸 USD' : '🇪🇺 EUR';
      if (p[field] === m) opt.selected = true;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = p[field] || 0;
    input.className = 'form-input';
    input.style.cssText = 'width:110px;padding:4px 8px;font-size:12px';
  }

  const finish = (save) => {
    if (save) {
      const raw = input.value;
      let val = (inputType === 'date' || inputType === 'moneda') ? raw : (Number(raw) || 0);
      platforms = platforms.map(x => x.id !== id ? x : { ...x, [field]: val });
      saveAll();
      showToast('Actualizado');
    }
    renderPage('plataformas');
  };

  input.onblur = () => finish(true);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { finish(false); }
  };
  if (inputType === 'moneda') input.onchange = () => finish(true);

  el.replaceWith(input);
  input.focus();
}

// ==================== GUARDAR Y SINCRONIZAR ====================
export function saveAll() {
  window.currentTab = currentTab;
  _lastLocalSave = Date.now();
  saveAllToStorage();
  _recalcAndSaveSnapshot();
  renderPage(currentTab);
  showToast('Datos guardados');
  if (!navigator.onLine) {
    // offline queue
    window.dispatchEvent(new CustomEvent('offline-save'));
  }
}

// ==================== EXPORTAR FUNCIONES ADICIONALES ====================
window.saveAll = saveAll;
window.renderPage = renderPage;
