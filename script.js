// Lógica principal - Plotly + cálculos
const ELEC_MOTORS = [5, 6, 11, 12, 17, 18, 19, 20];

// Datas de ativação do aquecimento elétrico
const ELEC_STARTS = {
  5: new Date(2025, 9, 24, 16, 0, 0),   // 24/10/2025 16:00
  6: new Date(2025, 9, 1, 0, 0, 0),     // 01/10/2025 00:00
  11: new Date(2025, 9, 25, 10, 30, 0), // 25/10/2025 10:30
  12: new Date(2025, 9, 1, 0, 0, 0),    // 01/10/2025 00:00
  17: new Date(2025, 9, 23, 13, 0, 0),  // 23/10/2025 13:00
  18: new Date(2025, 9, 1, 0, 0, 0),    // 01/10/2025 00:00
  19: new Date(2025, 9, 1, 0, 0, 0)     // 01/10/2025 00:00
  // Motor 20 não está na lista atualizada
};

// Estado global
let headers = [];
let timestamps = [];
let dataByMotor = {};
let activeMotors = new Set();
let startIdx = 0, endIdx = 0;
let defaultMin, defaultMax;
let pointSeconds = 37;
let loaded = false;

// UI refs
const plotDiv = document.getElementById('plot');
const startInput = document.getElementById('start-dt');
const endInput = document.getElementById('end-dt');
const priceInput = document.getElementById('diesel-price');
const consInput = document.getElementById('diesel-consumption');
const cardsDiv = document.getElementById('cards');
const periodSpan = document.getElementById('period');
const statusMessage = document.getElementById('status-message');

// Utilitários
const pad2 = n => n.toString().padStart(2, '0');
const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const money = n => 'R$ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const toLocalDateTimeValue = (d) => {
  const y = d.getFullYear(), m = pad2(d.getMonth() + 1), da = pad2(d.getDate()), h = pad2(d.getHours()), mi = pad2(d.getMinutes());
  return `${y}-${m}-${da}T${h}:${mi}`;
};

function parseSCAMotor(code) {
  const m3 = code.slice(3, 6);
  const m2 = m3.slice(0, 2);
  const num = parseInt(m2, 10);
  return isNaN(num) ? null : num;
}

function ensureMotor(m) {
  if (!dataByMotor[m]) dataByMotor[m] = [];
}

// Carregamento automático dos CSV
async function tryFetchCSV(name) {
  try {
    const r = await fetch(name, { cache: 'no-cache' });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

// Parser de CSV
function parseCSVText(text, groupIndex) {
  const lines = text.replace(/\r/g, '').split('\n').filter(x => x.trim().length > 0);
  if (lines.length < 2) return;
  const head = lines[0].split(',').map(s => s.trim());
  if (groupIndex === 1) headers = head;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 3) continue;
    if (groupIndex === 1) {
      const [MM, DD, YY] = parts[0].split('/').map(x => parseInt(x, 10));
      const [hh, mm, ss] = parts[1].split(':').map(x => parseInt(x, 10));
      const fullY = YY < 100 ? 2000 + YY : YY;
      timestamps.push(new Date(fullY, MM - 1, DD, hh, mm, ss));
    }
    for (let c = 2; c < head.length; c++) {
      const code = head[c];
      if (!code) continue;
      const m = parseSCAMotor(code);
      if (!m || m < 1 || m > 23) continue;
      ensureMotor(m);
      const v = parseFloat(parts[c]);
      dataByMotor[m].push(isNaN(v) ? null : v);
    }
  }
}

// Agregador
async function loadAllData() {
  try {
    statusMessage.textContent = 'Carregando dados do repositório...';
    const g1 = await tryFetchCSV('grupo_1.CSV');
    const g2 = await tryFetchCSV('grupo_2.CSV');
    const g3 = await tryFetchCSV('grupo_3.CSV');
    const g4 = await tryFetchCSV('grupo_4.CSV');
    
    if (g1 && g2 && g3 && g4) {
      timestamps = [];
      dataByMotor = {};
      parseCSVText(g1, 1);
      parseCSVText(g2, 2);
      parseCSVText(g3, 3);
      parseCSVText(g4, 4);
      postLoad();
      statusMessage.textContent = '✓ Dados carregados com sucesso';
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 3000);
    } else {
      statusMessage.textContent = '⚠ Erro ao carregar CSV. Verifique se os arquivos estão no repositório.';
    }
  } catch (e) {
    statusMessage.textContent = '⚠ Erro ao carregar dados: ' + e.message;
  }
}

function postLoad() {
  if (timestamps.length === 0) return;
  loaded = true;
  defaultMin = timestamps[0];
  defaultMax = timestamps[timestamps.length - 1];
  startIdx = 0;
  endIdx = timestamps.length - 1;

  // Habilitar inputs
  startInput.disabled = false;
  endInput.disabled = false;
  startInput.min = toLocalDateTimeValue(defaultMin);
  startInput.max = toLocalDateTimeValue(defaultMax);
  endInput.min = toLocalDateTimeValue(defaultMin);
  endInput.max = toLocalDateTimeValue(defaultMax);
  startInput.value = toLocalDateTimeValue(defaultMin);
  endInput.value = toLocalDateTimeValue(defaultMax);

  // Montar lista de motores (todos deselecionados inicialmente)
  buildMotorPills();
  
  // Render
  renderAll();
}

function buildMotorPills() {
  const list = document.getElementById('motor-list');
  list.innerHTML = '';
  activeMotors.clear();
  
  for (let m = 1; m <= 23; m++) {
    const pill = document.createElement('label');
    pill.className = 'motor-pill';
    if (ELEC_MOTORS.includes(m)) {
      pill.classList.add('elec');
    }
    pill.dataset.motor = String(m);
    
    const dot = document.createElement('span');
    dot.className = 'motor-dot';
    dot.style.backgroundColor = colorForMotor(m);
    
    const name = document.createElement('span');
    const emoji = ELEC_MOTORS.includes(m) ? '⚡ ' : '';
    name.textContent = `${emoji}UG#${String(m).padStart(2, '0')}`;
    
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = false;
    chk.addEventListener('change', () => toggleMotor(m, chk.checked, pill));
    
    pill.appendChild(dot);
    pill.appendChild(name);
    pill.appendChild(chk);
    list.appendChild(pill);
  }
}

function toggleMotor(m, on, pillEl) {
  if (on) {
    activeMotors.add(m);
    pillEl.classList.add('active');
  } else {
    activeMotors.delete(m);
    pillEl.classList.remove('active');
  }
  renderAll();
}

function clampRangeByInputs() {
  const s = new Date(startInput.value);
  const e = new Date(endInput.value);
  if (isNaN(s) || isNaN(e)) return;
  const t0 = timestamps[0].getTime();
  let a = Math.max(0, Math.floor((s.getTime() - t0) / (pointSeconds * 1000)));
  let b = Math.min(timestamps.length - 1, Math.ceil((e.getTime() - t0) / (pointSeconds * 1000)));
  if (b < a) b = a;
  startIdx = a;
  endIdx = b;
  periodSpan.textContent = `${timestamps[startIdx].toLocaleString('pt-BR')} – ${timestamps[endIdx].toLocaleString('pt-BR')}`;
}

function colorForMotor(m) {
  const hue = ((m - 1) * 360 / 23) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function buildTraces() {
  const traces = [];
  
  // Linha vermelha em 50°C
  const xspan = [timestamps[startIdx], timestamps[endIdx]];
  traces.push({
    x: xspan,
    y: [50, 50],
    mode: 'lines',
    line: { color: 'red', dash: 'dot', width: 2 },
    hoverinfo: 'text',
    text: xspan.map(() => 'Temp. mínima para partida'),
    name: 'Limite 50°C',
    showlegend: true
  });

  // Mostrar todos os motores ativos
  for (let m = 1; m <= 23; m++) {
    if (!activeMotors.has(m)) continue;
    const series = (dataByMotor[m] || []).slice(startIdx, endIdx + 1);
    const xs = timestamps.slice(startIdx, endIdx + 1);
    traces.push({
      x: xs,
      y: series,
      mode: 'lines',
      type: 'scattergl',
      name: `UG#${String(m).padStart(2, '0')}`,
      line: { color: colorForMotor(m), width: 2 },
      hovertemplate: `UG#${String(m).padStart(2, '0')}: %{y:.1f} °C<br>%{x|%d/%m %H:%M}<extra></extra>`
    });
  }

  return traces;
}

function computeStats() {
  const price = parseFloat((priceInput.value || '0').toString().replace(',', '.')) || 0;
  const cons = parseFloat((consInput.value || '0').toString().replace(',', '.')) || 0;

  let totalLiters = 0, totalMoney = 0;
  const stats = {};
  
  for (let m = 1; m <= 23; m++) {
    const arr = dataByMotor[m] || [];
    let availCount = 0, above50 = 0;
    let last = null;
    
    // Índice de início para aquecimento elétrico
    let elecStartIdx = 0;
    if (ELEC_MOTORS.includes(m) && ELEC_STARTS[m]) {
      const t0 = timestamps[0].getTime();
      elecStartIdx = Math.max(0, Math.ceil((ELEC_STARTS[m].getTime() - t0) / (pointSeconds * 1000)));
    }
    
    for (let i = startIdx; i <= endIdx; i++) {
      const v = arr[i];
      if (v == null || isNaN(v)) continue;
      
      if (v > 50) {
        availCount++;
        // Para motores elétricos, contar economia apenas após data de início
        if (ELEC_MOTORS.includes(m) && i >= Math.max(startIdx, elecStartIdx)) {
          above50++;
        }
      }
      last = v;
    }
    
    const availSec = availCount * pointSeconds;
    const lastTemp = last;
    const st = { availSec, lastTemp };
    
    if (ELEC_MOTORS.includes(m)) {
      const hours50 = (above50 * pointSeconds) / 3600;
      const liters = hours50 * cons;
      const moneyV = liters * price;
      st.liters = liters;
      st.money = moneyV;
      st.elecStart = ELEC_STARTS[m];
      totalLiters += liters;
      totalMoney += moneyV;
    }
    
    stats[m] = st;
  }
  
  return { stats, totalLiters, totalMoney };
}

function renderCards(stats) {
  cardsDiv.innerHTML = '';
  for (let m = 1; m <= 23; m++) {
    if (!activeMotors.has(m)) continue;
    const s = stats[m];
    if (!s) continue;
    
    const availH = Math.floor(s.availSec / 3600);
    const availM = Math.floor((s.availSec % 3600) / 60);
    const last = s.lastTemp;
    const ok = (last != null && last > 50);
    const img = ok ? 'Genset_Verde.png' : 'Genset_Vermelho.png';
    
    const card = document.createElement('div');
    card.className = 'mcard';
    if (ELEC_MOTORS.includes(m)) {
      card.classList.add('elec');
    }
    
    const emoji = ELEC_MOTORS.includes(m) ? '⚡ ' : '';
    let metricsHTML = `<div>Tempo de disponibilidade: ${String(availH).padStart(2, '0')}:${String(availM).padStart(2, '0')} h</div>`;
    
    if (ELEC_MOTORS.includes(m)) {
      metricsHTML += `
        <div>Economia diesel: ${fmt1(s.liters || 0)} L</div>
        <div>Economia diesel R$: ${money(s.money || 0)}</div>
      `;
    }
    
    card.innerHTML = `
      <div class="mhead">
        <span class="motor-dot" style="background:${colorForMotor(m)}"></span>
        <span class="mname">${emoji}UG#${String(m).padStart(2, '0')}</span>
      </div>
      <img src="${img}" alt="${ok ? 'Disponível' : 'Indisponível'}" />
      <div class="mmetrics">
        ${metricsHTML}
      </div>
    `;
    cardsDiv.appendChild(card);
  }
}

function renderPlot() {
  const traces = buildTraces();
  const layout = {
    margin: { l: 60, r: 20, t: 30, b: 50 },
    xaxis: { title: 'Data/Hora', tickformat: '%d/%m %H:%M' },
    yaxis: { title: 'Temperatura (°C)', range: [20, 80] },
    legend: { orientation: 'h', x: 0, y: 1.1 },
    hovermode: 'x unified',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f9fafb'
  };
  const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d', 'lasso2d'] };
  Plotly.react(plotDiv, traces, layout, config);
}

function renderSummary(totalLiters, totalMoney) {
  document.getElementById('total-litros').textContent = fmt1(totalLiters);
  document.getElementById('total-reais').textContent = money(totalMoney);
}

function renderAll() {
  if (!loaded) return;
  clampRangeByInputs();
  renderPlot();
  const { stats, totalLiters, totalMoney } = computeStats();
  renderCards(stats);
  renderSummary(totalLiters, totalMoney);
}

// Eventos
[startInput, endInput, priceInput, consInput].forEach(el => el.addEventListener('input', renderAll));

// Inicialização
loadAllData();

