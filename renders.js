// ============================================================
// renders.js — Funciones de renderizado de cada pestaña
// ============================================================
// Contiene: renderDashboard, renderMovimientos, renderPlataformas,
//           renderGastos (+ nueva gráfica de dona por categoría),
//           renderMetas, renderAjustes
// Depende de: data.js (constantes/helpers) y app.js (estado global)
// ============================================================

// ── Dashboard ───────────────────────────────────────────────
function renderDashboard(){
  const tc=settings.tipoCambio||20, re=settings.rendimientoEsperado||0.06;
  const eurmxn=getEurMxn();
  const cm=new Date().getMonth()+1, cy=new Date().getFullYear();
  const plats=calcPlatforms();

  const totalMXN=plats.reduce((s,p)=>s+platSaldoToMXN(p),0);
  const totalRend=plats.reduce((s,p)=>s+(p.rendimiento||0),0);
  const totalAport=plats.reduce((s,p)=>s+(p.aportacion||0),0);
  const totalRetiros=plats.reduce((s,p)=>s+(p.retiro||0),0);
  const topPlat=[...plats].sort((a,b)=>platSaldoToMXN(b)-platSaldoToMXN(a))[0];
  const maxConc=topPlat?platSaldoToMXN(topPlat)/totalMXN:0;
  const riskLvl=maxConc>0.4?'🔴 ALTO':maxConc>0.25?'🟡 MEDIO':'🟢 BAJO';
  const platsConTasa=plats.filter(p=>(p.tasaAnual||0)>0).length;
  const tickerList=getTickerPositions();
  const tickerListUSD=tickerList.filter(t=>t.moneda!=='MXN');
  const tickerListMXN=tickerList.filter(t=>t.moneda==='MXN');
  const totalInvertidoUSD=tickerListUSD.reduce((s,t)=>s+t.costoTotal,0);
  const totalMXNCurrent=tickerListMXN.reduce((s,t)=>s+(t.valorActual||t.costoPosicion||0),0);
  const gpNoRealizadaTotal=tickerList.reduce((s,t)=>s+(t.gpNoRealizada||0)*(t.moneda==='MXN'?1:tc),0);
  const gpRealizadaTotal=tickerList.reduce((s,t)=>s+(t.gpRealizada||0)*(t.moneda==='MXN'?1:tc),0);

  const ingresos=settings.ingresos||{};
  const salaryIsEUR=ingresos.monedaSueldo==='EUR';
  const sueldoEUR=salaryIsEUR?(ingresos.sueldoRaw||0):(ingresos.sueldo||0);
  const extrasEUR=ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR=ingresos.otrosEUR||ingresos.otros||0;
  const ingresoMensualEUR=sueldoEUR+extrasEUR+otrosEUR;
  const dashCur=salaryIsEUR?'EUR':'MXN';
  const fmtD=v=>fmt(v,dashCur);

  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesG=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Gasto';});
  const mesI=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy&&m.tipo==='Ingreso';});

  const toDisplayCur=m=>{
    if(salaryIsEUR){
      if(m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
      return Math.round(m.importe/eurmxn*100)/100;
    }
    return m.importe||0;
  };

  const totGastoMes=mesG.reduce((s,m)=>s+toDisplayCur(m),0);
  const totIngMes=mesI.reduce((s,m)=>s+toDisplayCur(m),0);
  const ingRef=totIngMes>0?totIngMes:ingresoMensualEUR;
  const balMes=ingRef-totGastoMes;
  const pctAhorro=ingRef>0?balMes/ingRef:0;
  const salud=pctAhorro>=0.2?'🟢 Óptima':pctAhorro>=0.1?'🟡 Aceptable':pctAhorro>=0?'🟠 Ajustada':'🔴 Déficit';
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
  const todayStr=today();
  const prevSnap=hist.filter(s=>s.date<todayStr).slice(-1)[0];
  const cambioHoy=prevSnap?patrimonio-prevSnap.value:0;

  function getChangeForMonths(months){
    if(hist.length<2)return null;
    const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-months);
    const cutoffStr=cutoff.toISOString().split('T')[0];
    const ref=hist.filter(s=>s.date<=cutoffStr).slice(-1)[0];
    if(!ref)return null;
    return patrimonio-ref.value;
  }

  let histFiltered=hist;
  const selInterval=CHART_INTERVALS.find(i=>i.key===_chartRange);
  if(selInterval){
    const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-selInterval.months);
    const cutoffStr=cutoff.toISOString().split('T')[0];
    histFiltered=hist.filter(s=>s.date>=cutoffStr);
    if(histFiltered.length===0)histFiltered=hist.slice(-2);
  }

  const curLabel=salaryIsEUR?'🇪🇺 EUR':'🇲🇽 MXN';
  const projInterval=CHART_INTERVALS.find(i=>i.key===_projKey)||CHART_INTERVALS[3];
  const projMonths=projInterval.months;
  const patrimonioEsperado=Math.round(patrimonio*Math.pow(1+re/12,projMonths));
  const gananciaProy=patrimonioEsperado-patrimonio;
  const periodOptions=[...CHART_INTERVALS,{key:'all',label:'Todo',months:null}];
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const gridColor=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)';
  const tickColor=isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)';

  const rangeButtonsHTML=periodOptions.map(r=>{
    const change=r.months!==null?getChangeForMonths(r.months):(hist.length>=2?patrimonio-hist[0].value:null);
    const col=change===null?'var(--text3)':pctCol(change);
    const val=change!==null?(change>=0?'+':'')+fmt(change):'—';
    const isActive=_chartRange===r.key;
    return `<button class="chart-ctrl-btn ${isActive?'active':''}" onclick="setChartRange('${r.key}')"><span>${r.label}</span><span class="btn-val" style="color:${isActive?'inherit':col}">${val}</span></button>`;
  }).join('');

  const projButtonsHTML=CHART_INTERVALS.map(r=>{
    const pv=Math.round(patrimonio*Math.pow(1+re/12,r.months));
    const gain=pv-patrimonio;
    const isActive=_projKey===r.key;
    return `<button class="chart-ctrl-btn proj-btn ${isActive?'active':''}" onclick="setChartProj('${r.key}')"><span>${r.label}</span><span class="btn-val" style="color:${isActive?'inherit':'var(--blue)'}">+${fmt(gain)}</span></button>`;
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
        <button class="btn btn-secondary btn-sm" onclick="updateAllPrices(true)" ${priceUpdateState.loading?'disabled':''}>🔃 Forzar</button>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">💰 Patrimonio Total</div><div class="stat-value" style="color:var(--green)">${fmt(patrimonio)}</div><div class="stat-sub"><span style="color:${pctCol(cambioHoy)}">${cambioHoy>=0?'+':''}${fmt(cambioHoy)} hoy</span></div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Plataformas MXN</div><div class="stat-value">${fmt(totalMXN)}</div><div class="stat-sub"><span style="color:${pctCol(totalRend)}">${totalRend>=0?'▲':'▼'} ${fmt(totalRend)}</span></div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">📈 G/P No Realizada</div><div class="stat-value" style="color:${pctCol(gpNoRealizadaTotal)}">${fmt(gpNoRealizadaTotal)}</div><div class="stat-sub">${fmt(totalInvertidoUSD,'USD')} invertido · ${tickerList.length} pos. <span style="color:var(--text3);font-size:10px">${salaryIsEUR?' (est.)':''}</span></div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Gastos Mes ${curLabel}</div><div class="stat-value" style="color:var(--red)">${fmtD(totGastoMes)}</div><div class="stat-sub">${totalPresupuesto>0?(pctPresUsado*100).toFixed(0)+'% presupuesto':''}</div></div>
    </div>

    <div class="grid-6" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Concentración</div><div class="stat-value" style="font-size:14px">${topPlat?.name||'—'}</div><div class="stat-sub"><span style="color:var(--orange);font-weight:700">${(maxConc*100).toFixed(1)}%</span> · ${riskLvl}</div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">🏦 Aportaciones</div><div class="stat-value">${fmt(totalAport)}</div><div class="stat-sub">- ${fmt(totalRetiros)} retiros</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 G/P Realizada</div><div class="stat-value" style="color:${pctCol(gpRealizadaTotal)}">${fmt(gpRealizadaTotal)}</div><div class="stat-sub">ventas cerradas</div></div>
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">📈 Capital Invertido</div><div class="stat-value">${fmt(totalInvertidoUSD,'USD')}</div><div class="stat-sub">${tickerList.length} posiciones</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Balance Mes ${curLabel}</div><div class="stat-value" style="color:${pctCol(balMes)}">${fmtD(balMes)}</div><div class="stat-sub">${(pctAhorro*100).toFixed(0)}% ahorro${totIngMes===0&&ingresoMensualEUR>0?' (est.)':''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--orange)"><div class="stat-label">💳 Salud Financiera</div><div class="stat-value" style="font-size:14px">${salud}</div><div class="stat-sub">${totalPresupuesto>0?fmtD(totalPresupuesto)+' presup.':'→ Config. en Gastos'}</div></div>
    </div>

    ${maxConc>0.25?`<div style="display:flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(255,159,10,0.06);border:1px solid rgba(255,159,10,0.15);border-radius:12px;margin-bottom:16px;font-size:13px"><span style="font-size:18px">⚠️</span><span><strong>${topPlat?.name}</strong> concentra el <strong style="color:var(--orange)">${(maxConc*100).toFixed(1)}%</strong> de tu portafolio.</span></div>`:''}

    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
      <div style="padding:24px 28px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);margin-bottom:4px">📈 Evolución del Patrimonio</div>
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--green);line-height:1">${fmt(patrimonio)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--blue);margin-bottom:4px">Esperado en ${projInterval.label}</div>
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--blue);line-height:1">${fmt(patrimonioEsperado)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px">+${fmt(gananciaProy)} · <span style="font-weight:700;color:var(--blue)">${(re*100).toFixed(0)}%/año</span></div>
          </div>
        </div>
      </div>
      <div style="padding:0 28px">
        <div class="chart-container" style="height:240px"><canvas id="chartEvo"></canvas></div>
      </div>
      <div style="padding:8px 28px 12px;display:flex;justify-content:flex-end">
        <button class="chart-toggle-btn" id="chartToggleBtn" onclick="toggleChartPanel()">▼ Controles</button>
      </div>
      <div class="chart-controls-panel" id="chartControlsPanel">
        <div class="chart-controls-inner">
          <div class="chart-ctrl-row"><span class="chart-ctrl-label">📅 Período</span>${rangeButtonsHTML}</div>
          <div style="height:1px;background:var(--border)"></div>
          <div class="chart-ctrl-row"><span class="chart-ctrl-label">🔵 Proyección</span>${projButtonsHTML}</div>
        </div>
      </div>
    </div>

    <div class="grid-1-1-1" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">📊 Distribución por Tipo</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="chart-container" style="height:140px;width:140px;flex-shrink:0"><canvas id="chartDistro"></canvas></div>
          <div style="flex:1">
            ${(()=>{
              const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});
              tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);at[t.type]=(at[t.type]||0)+v;}});
              const sorted=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
              const total=sorted.reduce((s,[,v])=>s+v,0)||1;
              return sorted.map(([k,v],i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0"><span style="display:flex;align-items:center;gap:5px;font-size:11px"><span style="width:7px;height:7px;border-radius:2px;background:${COLORS[i%COLORS.length]};display:inline-block;flex-shrink:0"></span>${k}</span><span style="font-size:11px;font-weight:700">${((v/total)*100).toFixed(1)}%</span></div>`).join('');
            })()}
          </div>
        </div>
      </div>
      <div class="card"><div class="card-title">💰 Estimación Fiscal</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
          ${[['Rend. Plats',fmt(totalRend)],['Rend. Auto',fmt(plats.reduce((s,p)=>s+(p.rendimientoAuto||0),0))],['G/P Realiz.',fmt(gpRealizadaTotal)],['ISR ~20%',fmt(gpRealizadaTotal>0?gpRealizadaTotal*0.2:0)]].map(([l,v])=>`<div style="padding:8px;background:var(--card2);border-radius:10px"><div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;margin-bottom:2px">${l}</div><div style="font-size:13px;font-weight:800">${v}</div></div>`).join('')}
        </div>
      </div>
      <div class="card"><div class="card-title">📋 Resumen Inversiones</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
          ${tickerList.filter(t=>t.cantActual>0).slice(0,5).map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700;font-size:13px">${t.ticker}</span><span class="${t.priceCssClass}" style="font-size:12px">${t.priceLabel||'—'}</span><span style="font-size:12px;color:${t.gpNoRealizada!==null?pctCol(t.gpNoRealizada):'var(--text3)'};">${t.gpNoRealizada!==null?(t.gpNoRealizada>=0?'+':'')+fmt(t.gpNoRealizada,t.moneda):'—'}</span></div>`).join('')}
          ${tickerList.filter(t=>t.cantActual>0).length===0?'<span style="color:var(--text2);font-size:12px">Sin posiciones abiertas</span>':''}
        </div>
      </div>
    </div>
  `;

  // Dibuja gráfica de evolución
  setTimeout(()=>{
    const projDates=[], projVals=[];
    const startProjDate=new Date();
    for(let i=0;i<=projMonths;i++){
      const d=new Date(startProjDate);d.setMonth(d.getMonth()+i);
      projDates.push(d.toISOString().split('T')[0]);
      projVals.push(Math.round(patrimonio*Math.pow(1+re/12,i)));
    }
    const realDates=histFiltered.map(s=>s.date);
    const realVals=histFiltered.map(s=>s.value);
    const ctxE=document.getElementById('chartEvo');
    if(ctxE&&(realDates.length>0||projDates.length>0)){
      if(chartInstances.chartEvo){chartInstances.chartEvo.destroy();}
      chartInstances.chartEvo=new Chart(ctxE,{
        type:'line',
        data:{datasets:[
          {label:'Real',data:realDates.map((d,i)=>({x:d,y:realVals[i]})),borderColor:'#30D158',backgroundColor:'rgba(48,209,88,0.08)',borderWidth:2.5,fill:true,tension:0.3,pointRadius:realDates.length<30?3:0,pointHoverRadius:5,pointBackgroundColor:'#30D158',pointHoverBackgroundColor:'#30D158',pointHoverBorderColor:isDark?'#1C1C1E':'#fff',pointHoverBorderWidth:2},
          {label:'Proyectado',data:projDates.map((d,i)=>({x:d,y:projVals[i]})),borderColor:'rgba(10,132,255,0.7)',backgroundColor:'transparent',borderWidth:1.5,borderDash:[6,4],fill:false,tension:0.1,pointRadius:0,pointHoverRadius:4}
        ]},
        options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:14,padding:14,bodyFont:{size:13,family:'DM Sans'},callbacks:{label:ctx=>' '+ctx.dataset.label+': '+fmtFull(ctx.parsed.y)}}},scales:{x:{type:'category',grid:{display:false},ticks:{font:{size:10},color:tickColor,maxTicksLimit:10,callback:function(val){const v=this.getLabelForValue(val);if(!v)return'';const p=v.split('-');return p.length===3?p[2]==='01'?MONTHS[parseInt(p[1])-1]:p[1]+'-'+p[2]:v;}},border:{display:false}},y:{grid:{color:gridColor},ticks:{font:{size:11},color:tickColor,callback:v=>fmt(v),maxTicksLimit:5},border:{display:false}}}}
      });
    }

    // Distribución donut
    const at={};plats.forEach(p=>{at[p.type]=(at[p.type]||0)+platSaldoToMXN(p);});
    tickerList.forEach(t=>{if(t.cantActual>0){const v=(t.valorActual||t.costoPosicion)*(t.moneda==='MXN'?1:tc);at[t.type]=(at[t.type]||0)+v;}});
    const de=Object.entries(at).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const ctxD=document.getElementById('chartDistro');
    if(ctxD&&de.length>0){
      if(chartInstances.chartDistro){chartInstances.chartDistro.destroy();}
      chartInstances.chartDistro=new Chart(ctxD,{type:'doughnut',data:{labels:de.map(([k])=>k),datasets:[{data:de.map(([,v])=>v),backgroundColor:de.map((_,i)=>COLORS[i%COLORS.length]),borderWidth:2,borderColor:isDark?'#1C1C1E':'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:12,padding:10,bodyFont:{family:'DM Sans',size:12},callbacks:{label:ctx=>' '+ctx.label+': '+((ctx.parsed/de.reduce((s,[,v])=>s+v,0)*100)).toFixed(1)+'%'}}}}});
    }
  },50);
}

// ── Movimientos ─────────────────────────────────────────────
function renderMovimientos(){
  const transferGroups={};
  movements.forEach(m=>{if(m.transferId)transferGroups[m.transferId]=(transferGroups[m.transferId]||[]).concat(m);});
  const filtered=movements.filter(m=>{
    if(movFilter.seccion!=='todas'&&m.seccion!==movFilter.seccion)return false;
    if(m.tipoPlat==='Transferencia entrada'&&m.transferId&&movFilter.seccion==='todas')return false;
    if(movFilter.search){const s=movFilter.search.toLowerCase();const text=[m.platform,m.ticker,m.broker,m.tipoPlat,m.tipoMov,m.tipo,m.notas,m.desc,m.categoria].filter(Boolean).join(' ').toLowerCase();if(!text.includes(s))return false;}
    return true;
  }).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  document.getElementById('page-movimientos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Movimientos</div><div class="section-sub">Registro unificado · ${movements.length} total</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="exportCSV()" title="Exportar a Excel/Sheets">📊 CSV</button>
        <button class="btn btn-primary" onclick="openMovModal()">+ Nuevo</button>
      </div>
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
            if(m.tipoPlat==='Transferencia salida'&&m.transferId){const grp=transferGroups[m.transferId]||[];const entrada=grp.find(x=>x.tipoPlat==='Transferencia entrada');det=`<strong>${m.platform}</strong> → <strong>${entrada?.platform||'?'}</strong>`;tipo='↔ Transferencia';monto=fmt(m.monto);rowClass='transfer-row';}
            else{det=m.platform;tipo=m.tipoPlat;monto=fmt(m.monto);}
          }else if(m.seccion==='inversiones'){det=`<strong>${m.ticker}</strong> · ${m.broker}`;tipo=m.tipoMov+' · '+m.tipoActivo+' · '+(m.moneda||'USD');monto=fmt(m.montoTotal,m.moneda);extra=m.cantidad+'×'+fmtFull(m.precioUnit);}
          else{det=catName(m.categoria);tipo=m.tipo+(m.esRecurrente?' 🔄':'');monto=fmt(m.importe);}
          return`<tr class="${rowClass}"><td style="color:var(--text2);font-size:12px">${m.fecha}</td><td>${m.tipoPlat==='Transferencia salida'&&m.transferId?`<span class="badge badge-teal">↔ TRANSFER</span>`:secBadge(m.seccion)}</td><td>${det}</td><td style="color:var(--text2);font-size:12px">${tipo}</td><td style="font-weight:700">${monto}</td><td style="color:var(--text2);font-size:11px">${extra}</td><td style="color:var(--text2);font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${notas||'—'}</td><td style="white-space:nowrap"><button class="edit-btn" onclick="openEditMovModal('${m.id}')" title="Editar">✏️</button><button class="del-btn" onclick="deleteMovement('${m.id}')" title="Eliminar">×</button></td></tr>`;
        }).join('')}
        ${filtered.length===0?'<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:32px">Sin movimientos</td></tr>':''}
      </tbody>
    </table></div></div>
  `;
}

// ── Plataformas ─────────────────────────────────────────────
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
    ${platsConTasa.length>0?`<div class="yield-info" style="margin-bottom:16px">⚡ <strong>${platsConTasa.length} plataformas</strong> con tasa automática · Rendimiento auto acumulado: <strong style="color:var(--green)">${fmt(totalRendAuto)}</strong></div>`:''}
    <div class="card-flat">
      <div class="table-wrap"><table>
        <thead><tr><th>Plataforma</th><th>Tipo</th><th>Grupo</th><th>Moneda</th><th>Saldo Ini.</th><th>⚡ Tasa %</th><th>Aportaciones</th><th>Retiros</th><th>Rend. Manual</th><th>Saldo Actual</th><th>% Rend.</th><th>% Port.</th><th></th></tr></thead>
        <tbody>
          ${plats.map(p=>{
            const cur=p.moneda||'MXN';
            const mxnVal=platSaldoToMXN(p);
            const pctPort=total>0?((mxnVal/total)*100).toFixed(1)+'%':'—';
            return`<tr>
              <td style="font-weight:700">${p.name}</td>
              <td style="font-size:11px;color:var(--text2)">${p.type}</td>
              <td style="font-size:11px;color:var(--text2)">${p.group}</td>
              <td><span class="moneda-flag moneda-${cur}" onclick="editPlatField('${p.id}','moneda',this,'moneda')" style="cursor:pointer" title="Clic para cambiar">${cur}</span></td>
              <td>${fmtPlat(p.saldoInicial,cur)}</td>
              <td><span onclick="editPlatField('${p.id}','tasaAnual',this,'percent')" style="cursor:pointer;color:${p.tasaAnual>0?'var(--green)':'var(--text3)'};font-weight:${p.tasaAnual>0?700:400}" title="Clic para editar">${p.tasaAnual>0?p.tasaAnual.toFixed(2)+'%':'—'}</span></td>
              <td>${p.aportacion>0?fmtPlat(p.aportacion,cur):'—'}</td>
              <td>${p.retiro>0?fmtPlat(p.retiro,cur):'—'}</td>
              <td>${p.rendimientoManual!==0?`<span style="color:${pctCol(p.rendimientoManual)}">${p.rendimientoManual>=0?'+':''}${fmtPlat(p.rendimientoManual,cur)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
              <td style="font-weight:800;font-size:14px">${fmtPlat(p.saldo,cur)}</td>
              <td style="font-weight:600;color:${pctCol(p.rendimiento)}">${fmtPct(p.saldoInicial?p.rendimiento/p.saldoInicial:0)}</td>
              <td style="font-size:11px;color:var(--text2)">${pctPort}</td>
              <td><button class="del-btn" onclick="deletePlatform('${p.id}')">×</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  `;
}

// ── Gastos — CON NUEVA GRÁFICA DE DONA ──────────────────────
function renderGastos(){
  const cm=new Date().getMonth()+1, cy=new Date().getFullYear();
  const budgets=settings.budgets||{}, ingresos=settings.ingresos||{};
  const expMovs=movements.filter(m=>m.seccion==='gastos');
  const mesMovs=expMovs.filter(m=>{const d=new Date(m.fecha);return d.getMonth()+1===cm&&d.getFullYear()===cy;});
  const sueldoEUR=ingresos.monedaSueldo==='EUR'?(ingresos.sueldoRaw||0):(ingresos.sueldo||0);
  const extrasEUR=ingresos.extrasEUR||ingresos.extras||0;
  const otrosEUR=ingresos.otrosEUR||ingresos.otros||0;
  const fmtEUR=v=>'€'+Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
  const eurmxn=getEurMxn();
  const toEUR=m=>{
    if(m.monedaOrig==='EUR')return m.importeEUR||m.importe;
    if(m.notas&&m.notas.includes('€')&&m.notas.includes('→')){const match=m.notas.match(/€([\d.]+)/);if(match)return Number(match[1]);}
    return Math.round(m.importe/eurmxn*100)/100;
  };
  const totGastoEUR=mesMovs.filter(m=>m.tipo==='Gasto').reduce((s,m)=>s+toEUR(m),0);
  const totIngEUR=mesMovs.filter(m=>m.tipo==='Ingreso').reduce((s,m)=>s+toEUR(m),0);
  const totalIngPlaneadoEUR=sueldoEUR+extrasEUR+otrosEUR;
  const ingRefEUR=totIngEUR>0?totIngEUR:totalIngPlaneadoEUR;
  const totalPresupuestoEUR=EXPENSE_CATS.reduce((s,c)=>s+(budgets[c.id]||0),0);
  const disponibleEUR=ingRefEUR-totGastoEUR;
  const byCat={};mesMovs.filter(m=>m.tipo==='Gasto').forEach(m=>{byCat[m.categoria]=(byCat[m.categoria]||0)+toEUR(m);});
  const barPct=totalIngPlaneadoEUR>0?Math.min((totGastoEUR/totalIngPlaneadoEUR)*100,100).toFixed(1):0;
  const barColor=totGastoEUR>totalIngPlaneadoEUR?'var(--red)':totGastoEUR>totalPresupuestoEUR?'var(--orange)':'var(--green)';
  const barLabel=totGastoEUR>totalIngPlaneadoEUR?'🔴 Déficit':totGastoEUR>totalPresupuestoEUR?'🟡 Sobre presupuesto':'🟢 Dentro del plan';
  const totalRecurrente=recurrentes.filter(r=>r.activo).reduce((s,r)=>s+r.importe,0);

  // Datos para la dona de gastos por categoría (¡NUEVA!)
  const catData=EXPENSE_CATS.map((c,i)=>({id:c.id,name:c.name,icon:c.icon,val:byCat[c.id]||0,color:COLORS[i%COLORS.length]})).filter(c=>c.val>0).sort((a,b)=>b.val-a.val);

  const catRows=EXPENSE_CATS.map(cat=>{
    const pres=budgets[cat.id]||0,real=byCat[cat.id]||0,rest=pres-real;
    const pctUso=pres>0?(real/pres*100):0;
    const pctIng=totalIngPlaneadoEUR>0?(pres/totalIngPlaneadoEUR*100).toFixed(1)+'%':'—';
    const barC=pctUso>100?'var(--red)':pctUso>85?'var(--orange)':'var(--green)';
    const restStr=pres>0?(rest>=0?'+':'')+fmtEUR(rest):'—';
    const restCol=rest>=0?'var(--green)':'var(--red)';
    const barHtml=pres>0?`<div style="display:flex;align-items:center;gap:6px"><div class="progress-bg" style="flex:1;height:6px"><div class="progress-fill" style="background:${barC};width:${Math.min(pctUso,100).toFixed(0)}%"></div></div><span style="font-size:10px;font-weight:700;color:${pctUso>100?'var(--red)':'var(--text2)'}"> ${pctUso.toFixed(0)}%</span></div>`:`<span style="font-size:10px;color:var(--text3)">sin asignar</span>`;
    return`<tr><td style="font-weight:600">${cat.icon} ${cat.name}</td><td><input type="number" class="form-input" style="width:100px;padding:5px 8px;font-size:13px;font-weight:700;text-align:right" value="${pres||''}" placeholder="0" onchange="updateBudget('${cat.id}',this.value)"></td><td style="font-size:12px;color:var(--text2)">${pctIng}</td><td style="font-weight:600;${real>pres&&pres>0?'color:var(--red)':''}">${fmtEUR(real)}</td><td style="font-weight:600;color:${restCol}">${restStr}</td><td style="width:150px">${barHtml}</td></tr>`;
  }).join('');

  const movRows=mesMovs.length>0?mesMovs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(m=>`<tr><td style="color:var(--text2);font-size:12px">${m.fecha}</td><td style="font-weight:500">${m.tipo==='Ingreso'?'💰 Ingreso':catName(m.categoria)} ${m.esRecurrente?'<span class="badge badge-purple">🔄 Auto</span>':''}</td><td><span class="badge ${m.tipo==='Ingreso'?'badge-green':'badge-red'}">${m.tipo}</span></td><td style="font-weight:700">${fmtEUR(toEUR(m))}</td><td style="color:var(--text2);font-size:11px">${m.notas||'—'}</td><td><button class="edit-btn" onclick="openEditMovModal('${m.id}')">✏️</button><button class="del-btn" onclick="deleteMovement('${m.id}')">×</button></td></tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:24px">Sin movimientos este mes</td></tr>`;

  document.getElementById('page-gastos').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div><div class="section-title">Control de Gastos 🇪🇺</div><div class="section-sub">${MONTHS[cm-1]} ${cy} · Todo en Euros</div></div>
      <button class="btn btn-secondary" onclick="switchTab('movimientos');openMovModal('gastos')">+ Gasto</button>
    </div>

    <div class="grid-4" style="margin-bottom:16px">
      <div class="card stat" style="border-top:3px solid var(--green)"><div class="stat-label">💰 Ingreso ref.</div><div class="stat-value" style="color:var(--green)">${fmtEUR(ingRefEUR)}</div><div class="stat-sub">${totIngEUR>0?'real':'planeado'}</div></div>
      <div class="card stat" style="border-top:3px solid var(--red)"><div class="stat-label">💸 Gastado</div><div class="stat-value" style="color:var(--red)">${fmtEUR(totGastoEUR)}</div><div class="stat-sub">${totalPresupuestoEUR>0?(totGastoEUR/totalPresupuestoEUR*100).toFixed(0)+'% presupuesto':''}</div></div>
      <div class="card stat" style="border-top:3px solid var(--blue)"><div class="stat-label">💼 Disponible</div><div class="stat-value" style="color:${disponibleEUR>=0?'var(--green)':'var(--red)'}">${fmtEUR(disponibleEUR)}</div><div class="stat-sub">${barLabel}</div></div>
      <div class="card stat" style="border-top:3px solid var(--purple)"><div class="stat-label">🔄 Recurrentes</div><div class="stat-value">${fmtEUR(totalRecurrente/eurmxn)}</div><div class="stat-sub"><button class="btn btn-sm" style="background:rgba(191,90,242,0.1);color:var(--purple);border:none;font-size:11px;padding:3px 8px;cursor:pointer" onclick="openRecurrentesModal()">⚙️ Gestionar</button></div></div>
    </div>

    ${totalIngPlaneadoEUR>0?`<div class="card" style="margin-bottom:16px;padding:16px 24px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:13px;font-weight:700">Uso del presupuesto global</div><div style="font-size:13px;font-weight:800;color:${barColor}">${barLabel}</div></div><div class="progress-bg" style="height:14px;border-radius:8px"><div class="progress-fill" style="height:14px;border-radius:8px;background:${barColor};width:${barPct}%"></div></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:6px"><span>Gastado: ${fmtEUR(totGastoEUR)}</span><span>Presupuesto: ${fmtEUR(totalPresupuestoEUR)}</span><span>Ingreso: ${fmtEUR(totalIngPlaneadoEUR)}</span></div></div>`:''}

    ${catData.length>0?`
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">🍩 Gastos por Categoría — ${MONTHS[cm-1]}</div>
        <span style="font-size:13px;font-weight:800;color:var(--red)">${fmtEUR(totGastoEUR)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="position:relative;width:180px;height:180px;flex-shrink:0">
          <canvas id="chartGastosCat" width="180" height="180"></canvas>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <div style="font-size:11px;color:var(--text2);font-weight:600">Total</div>
            <div style="font-size:16px;font-weight:800;color:var(--red)">${fmtEUR(totGastoEUR)}</div>
          </div>
        </div>
        <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px">
          ${catData.map(c=>{
            const pct=totGastoEUR>0?(c.val/totGastoEUR*100).toFixed(1):0;
            return`<div style="display:flex;align-items:center;gap:8px">
              <span style="width:10px;height:10px;border-radius:3px;background:${c.color};flex-shrink:0;display:inline-block"></span>
              <span style="font-size:12px;flex:1">${c.icon} ${c.name}</span>
              <span style="font-size:12px;font-weight:700;color:var(--red)">${fmtEUR(c.val)}</span>
              <span style="font-size:11px;color:var(--text3);width:38px;text-align:right">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`:''}

    <div class="card-flat" style="margin-bottom:16px"><div style="padding:16px 20px 0"><div class="card-title">Presupuesto por Categoría (€)</div></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Presupuesto €</th><th>% ingreso</th><th>Real €</th><th>Restante</th><th>Uso</th></tr></thead><tbody>${catRows}<tr style="font-weight:800;background:var(--card2);border-top:2px solid var(--border2)"><td>TOTAL</td><td>${fmtEUR(totalPresupuestoEUR)}</td><td>${totalIngPlaneadoEUR>0?((totalPresupuestoEUR/totalIngPlaneadoEUR)*100).toFixed(1)+'%':'—'}</td><td style="color:${totGastoEUR>totalPresupuestoEUR?'var(--red)':'var(--text)'}">${fmtEUR(totGastoEUR)}</td><td style="color:${totalPresupuestoEUR-totGastoEUR>=0?'var(--green)':'var(--red)'}">${totalPresupuestoEUR>0?(totalPresupuestoEUR-totGastoEUR>=0?'+':'')+fmtEUR(totalPresupuestoEUR-totGastoEUR):'—'}</td><td></td></tr></tbody></table></div></div>
    <div class="card-flat"><div style="padding:16px 20px 0"><div class="card-title">Movimientos — ${MONTHS[cm-1]} ${cy}</div></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Tipo</th><th>Importe €</th><th>Notas</th><th></th></tr></thead><tbody>${movRows}</tbody></table></div></div>
  `;

  // Dibujar gráfica dona de gastos por categoría
  setTimeout(()=>{
    const ctxG=document.getElementById('chartGastosCat');
    if(ctxG&&catData.length>0){
      const isDark=document.documentElement.getAttribute('data-theme')==='dark';
      if(chartInstances.chartGastosCat){chartInstances.chartGastosCat.destroy();}
      chartInstances.chartGastosCat=new Chart(ctxG,{
        type:'doughnut',
        data:{labels:catData.map(c=>`${c.icon} ${c.name}`),datasets:[{data:catData.map(c=>c.val),backgroundColor:catData.map(c=>c.color),borderWidth:2,borderColor:isDark?'#1C1C1E':'#fff',hoverOffset:5}]},
        options:{responsive:false,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{backgroundColor:isDark?'rgba(44,44,46,0.97)':'rgba(29,29,31,0.94)',cornerRadius:10,padding:10,bodyFont:{family:'DM Sans',size:12},callbacks:{label:ctx=>' '+ctx.label+': €'+ctx.parsed.toLocaleString('es-ES',{maximumFractionDigits:0})}}}}
      });
    }
  },50);
}

// ── Metas ───────────────────────────────────────────────────
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
        const restante=g.meta-actual;
        const re=settings.rendimientoEsperado||0.06;
        const mesesEstimados=restante>0&&actual>0?Math.ceil(Math.log(g.meta/actual)/Math.log(1+re/12)):0;
        const isEUR=g.clase==='Ingreso Mensual';
        const fmtVal=v=>isEUR?fmtEUR(v):fmt(v);
        return`<div class="card" style="border-top:4px solid ${sc}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div><div style="font-size:15px;font-weight:800">${g.nombre}</div>${g.descripcion?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${g.descripcion}</div>`:''}</div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:12px;font-weight:800;color:${sc}">${st}</span>
              <button class="del-btn" onclick="deleteGoal('${g.id}')">×</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div><div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;margin-bottom:2px">Actual</div><div style="font-size:18px;font-weight:800;color:${sc}">${fmtVal(actual)}</div></div>
            <div style="text-align:right"><div style="font-size:10px;color:var(--text2);font-weight:700;text-transform:uppercase;margin-bottom:2px">Meta</div><div style="font-size:18px;font-weight:800">${fmtVal(g.meta)}</div></div>
          </div>
          <div class="progress-bg" style="height:10px;border-radius:8px;margin-bottom:10px"><div class="progress-fill" style="background:${sc};width:${Math.min(pct*100,100).toFixed(1)}%;height:10px;border-radius:8px"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);flex-wrap:wrap;gap:6px">
            <span><strong>${(pct*100).toFixed(1)}%</strong> completado</span>
            ${restante>0?`<span>Faltan: <strong>${fmtVal(restante)}</strong></span>`:''}
            ${mesesEstimados>0?`<span>~${mesesEstimados>=12?Math.floor(mesesEstimados/12)+'a '+mesesEstimados%12+'m':mesesEstimados+'m'} al ${(re*100).toFixed(0)}%/año</span>`:''}
            ${g.fechaLimite?`<span>📅 ${g.fechaLimite}</span>`:''}
          </div>
        </div>`;
      }).join('')}
      ${goals.length===0?`<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)"><div style="font-size:32px;margin-bottom:12px">🎯</div><div>Sin metas aún. ¡Crea una para empezar!</div></div>`:''}
    </div>
  `;
}

// ── Ajustes ─────────────────────────────────────────────────
function renderAjustes(){
  const hasFinnhub=!!(settings.finnhubKey);
  const priceSummary=getPriceSummary();
  const cache=getPriceCache();
  const cacheEntries=Object.entries(cache);
  const currentUser=window._currentUser;
  const ingresos=settings.ingresos||{};

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
      <div class="card"><div class="card-title">💱 Tipo de Cambio</div><div style="margin-top:10px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">1 USD =</span><input type="number" step="0.01" id="inputTCUSD" class="form-input" style="width:100px;font-size:18px;font-weight:700;text-align:center" value="${settings.tipoCambio||20}" onchange="settings.tipoCambio=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:12px;color:var(--text2);width:60px">1 EUR =</span><input type="number" step="0.01" id="inputTCEUR" class="form-input" style="width:100px;font-size:18px;font-weight:700;text-align:center" value="${settings.tipoEUR||21.5}" onchange="settings.tipoEUR=Number(this.value);saveAll()"><span style="font-size:12px;color:var(--text2)">MXN</span></div><button class="btn btn-secondary btn-sm" onclick="updateFX().then(()=>renderPage('ajustes'))">🔄 Actualizar automático</button></div></div>
      <div class="card"><div class="card-title">📈 Rendimiento Esperado Anual</div><div style="display:flex;align-items:center;gap:10px;margin-top:8px"><input type="number" step="0.5" class="form-input" style="width:80px;font-size:20px;font-weight:700;text-align:center" value="${((settings.rendimientoEsperado||0.06)*100)}" onchange="settings.rendimientoEsperado=Number(this.value)/100;saveAll()"><span style="font-size:14px;color:var(--text2)">% anual</span></div></div>
    </div>
    <div class="card" style="margin-bottom:16px;border-top:3px solid var(--green)">
      <div class="card-title">💼 Ingresos Mensuales</div>
      <div class="grid-2" style="margin-top:10px">
        <div class="form-group"><label class="form-label">Sueldo base</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="form-select" style="width:80px" onchange="updateIngresoConMoneda('sueldo',document.getElementById('inpSueldo').value,this.value)">
              <option value="MXN" ${ingresos.monedaSueldo!=='EUR'?'selected':''}>🇲🇽 MXN</option>
              <option value="EUR" ${ingresos.monedaSueldo==='EUR'?'selected':''}>🇪🇺 EUR</option>
            </select>
            <input type="number" id="inpSueldo" class="form-input" style="flex:1" value="${ingresos.monedaSueldo==='EUR'?(ingresos.sueldoRaw||0):(ingresos.sueldo||0)}" onchange="updateIngresoConMoneda('sueldo',this.value,document.querySelector('[onchange*=inpSueldo]').value||'MXN')">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Extras / freelance (EUR)</label><input type="number" class="form-input" value="${ingresos.extrasEUR||ingresos.extras||0}" onchange="updateIngreso('extrasEUR',this.value)"></div>
        <div class="form-group"><label class="form-label">Otros ingresos (EUR)</label><input type="number" class="form-input" value="${ingresos.otrosEUR||ingresos.otros||0}" onchange="updateIngreso('otrosEUR',this.value)"></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🔑 API Key — Finnhub</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input type="text" class="form-input" style="flex:1;min-width:200px;font-family:monospace;font-size:13px" id="finnhubKeyInput" placeholder="Pega tu API key" value="${settings.finnhubKey||''}" oninput="settings.finnhubKey=this.value.trim();saveAll()"><button class="btn btn-primary" onclick="testFinnhub()">🧪 Probar</button>${hasFinnhub?`<span style="font-size:12px;color:var(--green)">✅ OK</span>`:''}</div>
      <div id="finnhubTestResult" style="margin-top:8px;font-size:12px"></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="card-title">💾 Exportar / Importar</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          <button class="btn btn-primary" onclick="exportData()">📥 Exportar JSON</button>
          <button class="btn btn-secondary" onclick="exportCSV()">📊 Exportar CSV</button>
          <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">📤 Importar JSON</button>
          <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)">
        </div>
      </div>
      <div class="card"><div class="card-title">⚠️ Zona de Peligro</div><button class="btn btn-danger" style="width:100%;margin-top:8px" onclick="if(confirm('¿Borrar TODOS los datos?'))resetAll()">🗑 Resetear Todo</button></div>
    </div>
    <div class="card" style="margin-top:16px;padding:16px 20px">
      <div class="card-title">🔐 Reglas Firebase</div>
      <div class="uid-box" onclick="navigator.clipboard.writeText(this.textContent.trim()).then(()=>{this.style.borderColor='var(--green)';showToast('✅ Copiado al portapapeles','success')})" title="Clic para copiar" style="margin-top:6px;font-size:11px;white-space:pre">rules_version = '2';
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

// ── Helper tarjeta stat para Metas ──────────────────────────
function statCard(label,value,sub,color,borderColor){
  const accent=borderColor?`border-top:3px solid ${borderColor};`:'';
  const tint=borderColor?`background:linear-gradient(135deg,${borderColor}08 0%,transparent 60%);`:'';
  return`<div class="card stat" style="${accent}${tint}"><div class="stat-label">${label}</div><div class="stat-value" style="${color?'color:'+color:''}">${value}</div>${sub?`<div class="stat-sub">${sub}</div>`:''}</div>`;
}
