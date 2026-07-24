import {
  loadState, isStudyStarted, isStudyComplete, startStudy, resetState,
  getSlots, getEntry, setEntry, slotStatus, REMINDER_WINDOW_MIN,
} from './storage.js';
import { ACTIVITIES, findActivity, BUCKETS, BUCKET_ORDER } from './activities.js';
import { iconMarkup } from './icons.js';
import * as scheduler from './scheduler.js';
import { computeStats } from './stats.js';
import { renderBarChart, renderDonutChart, renderHeatmap } from './charts.js';

const $ = sel => document.querySelector(sel);
const main = $('#main');
const tabbar = $('#tabbar');
const toastEl = $('#toast');
const sheetBackdrop = $('#sheet-backdrop');
const entrySheet = $('#entry-sheet');
const settingsSheet = $('#settings-sheet');

let currentView = null;
let selectedDayKey = null;
let toastTimer = null;

/* ---------------- theme ---------------- */
(function initTheme() {
  const saved = localStorage.getItem('experiment_theme');
  if (saved && saved !== 'system') document.documentElement.setAttribute('data-theme', saved);
})();

/* ---------------- utils ---------------- */
function fmtTime(d) { return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); }
function fmtDateLong(d) { return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }); }
function fmtDateShort(d) { return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }); }
function dayKeyOf(d) { return d.toDateString(); }

function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

function closeSheets() {
  sheetBackdrop.hidden = true;
  entrySheet.hidden = true;
  settingsSheet.hidden = true;
  entrySheet.innerHTML = '';
  settingsSheet.innerHTML = '';
}
sheetBackdrop.addEventListener('click', closeSheets);

/* ---------------- routing ---------------- */
function route() {
  const state = loadState();
  if (!isStudyStarted(state)) {
    tabbar.hidden = true;
    renderOnboarding();
    return;
  }
  tabbar.hidden = false;
  if (!currentView || currentView === 'onboarding') {
    currentView = isStudyComplete(state) ? 'results' : 'log';
  }
  renderTabbar();
  if (currentView === 'results') renderResultsRoute();
  else renderLog();
}

function renderTabbar() {
  tabbar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}
tabbar.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  currentView = btn.dataset.view;
  route();
});

/* ---------------- onboarding ---------------- */
function renderOnboarding() {
  main.innerHTML = '';
  const tpl = $('#tpl-onboarding').content.cloneNode(true);
  const ticks = tpl.querySelector('.hero-ticks');
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const r1 = 44, r2 = i % 6 === 0 ? 36 : 40;
    const x1 = 60 + r1 * Math.cos(a), y1 = 60 + r1 * Math.sin(a);
    const x2 = 60 + r2 * Math.cos(a), y2 = 60 + r2 * Math.sin(a);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', i % 6 === 0 ? 2.4 : 1.2);
    line.setAttribute('opacity', i % 6 === 0 ? 0.9 : 0.4);
    ticks.appendChild(line);
  }
  main.appendChild(tpl);

  const btnEnable = $('#btn-enable-notif');
  const btnStart = $('#btn-start');
  const syncNotifBtn = () => {
    if (typeof Notification === 'undefined') { btnEnable.hidden = true; return; }
    if (Notification.permission === 'granted') {
      btnEnable.textContent = 'Oznámení povolena ✓';
      btnEnable.disabled = true;
    }
  };
  syncNotifBtn();
  btnEnable.addEventListener('click', async () => {
    await scheduler.requestNotificationPermission();
    syncNotifBtn();
  });
  btnStart.addEventListener('click', () => {
    startStudy();
    scheduler.restartScheduling();
    currentView = 'log';
    selectedDayKey = null;
    route();
  });
}

/* ---------------- log (calendar) view ---------------- */
function getDays(state) {
  const slots = getSlots(state);
  const days = [];
  slots.forEach(slot => {
    const key = dayKeyOf(slot.time);
    let day = days.find(d => d.key === key);
    if (!day) { day = { key, date: slot.time, slots: [] }; days.push(day); }
    day.slots.push(slot);
  });
  return days;
}

function renderLog() {
  main.innerHTML = '';
  const tpl = $('#tpl-log').content.cloneNode(true);
  main.appendChild(tpl);
  paintLog();
}

function paintLog() {
  if (currentView !== 'log') return;
  const state = loadState();
  const slots = getSlots(state);
  const days = getDays(state);
  if (!days.length) return;

  const todayKey = dayKeyOf(new Date());
  if (!selectedDayKey || !days.some(d => d.key === selectedDayKey)) {
    selectedDayKey = days.some(d => d.key === todayKey) ? todayKey : days[days.length - 1].key;
  }

  const filledCount = slots.filter(s => getEntry(s.index, state)).length;
  const total = slots.length;
  const dayNum = Math.min(
    Math.max(Math.floor((Date.now() - new Date(state.study.startedAt).getTime()) / 86400000) + 1, 1),
    state.study.days,
  );

  // progress ring
  const ring = $('#ring-value');
  const C = 2 * Math.PI * 27;
  const pct = total ? filledCount / total : 0;
  ring.setAttribute('stroke-dasharray', `${C}`);
  ring.setAttribute('stroke-dashoffset', `${C * (1 - pct)}`);
  $('#progress-count').textContent = filledCount;
  $('#progress-title').textContent = `Den ${dayNum} / ${state.study.days}`;

  const nextFuture = slots.find(s => slotStatus(s, state) === 'future');
  const active = slots.find(s => slotStatus(s, state) === 'active');
  const sub = $('#progress-sub');
  if (active) {
    const deadline = new Date(active.time.getTime() + REMINDER_WINDOW_MIN * 60000);
    sub.textContent = `Čeká na zápis — stihněte do ${fmtTime(deadline)}`;
  } else if (nextFuture) {
    sub.textContent = `Další připomenutí v ${fmtTime(nextFuture.time)}`;
  } else {
    sub.textContent = 'Vše zapsáno';
  }

  // day strip
  const strip = $('#day-strip');
  strip.innerHTML = '';
  days.forEach(day => {
    const dayFilled = day.slots.filter(s => getEntry(s.index, state)).length;
    const chip = document.createElement('button');
    chip.className = 'day-chip' + (day.key === selectedDayKey ? ' active' : '') + (day.key === todayKey ? ' is-today' : '');
    chip.innerHTML = `<span class="dow">${day.date.toLocaleDateString('cs-CZ', { weekday: 'short' })}</span>
      <span class="dom">${day.date.getDate()}.</span>
      <span class="dots">${dayFilled}/${day.slots.length}</span>`;
    chip.addEventListener('click', () => { selectedDayKey = day.key; paintLog(); });
    strip.appendChild(chip);
  });

  // agenda for selected day only (keeps the log skimmable + blind)
  const agenda = $('#agenda');
  agenda.innerHTML = '';
  const day = days.find(d => d.key === selectedDayKey);
  const heading = document.createElement('div');
  heading.className = 'agenda-day-heading';
  heading.textContent = fmtDateLong(day.date);
  agenda.appendChild(heading);

  day.slots.forEach(slot => {
    const status = slotStatus(slot, state);
    const row = document.createElement('div');
    row.className = `slot-row ${status}`;
    let icon = 'lock', text = 'Uzamčeno', cta = '';
    if (status === 'done') { icon = 'check'; text = 'Zapsáno'; }
    else if (status === 'active') { icon = 'bell'; text = 'Co právě děláte?'; cta = '<span class="slot-cta">Zapsat →</span>'; }
    else if (status === 'expired') { icon = 'clockalert'; text = 'Doplňuje se automaticky…'; }
    row.innerHTML = `<span class="slot-time">${fmtTime(slot.time)}</span>
      <span class="slot-body">
        <span class="slot-status-icon">${iconMarkup(icon, 16)}</span>
        <span class="slot-text">${text}</span>
        ${cta}
      </span>`;
    if (status === 'active') row.addEventListener('click', () => openEntrySheet(slot));
    agenda.appendChild(row);
  });
}

/* ---------------- entry sheet ---------------- */
function openEntrySheet(slot) {
  entrySheet.innerHTML = `
    <div class="sheet-grabber"></div>
    <h3>Zápis — ${fmtTime(slot.time)}</h3>
    <p class="sheet-sub">Co jste v tuto hodinu dělal/a? Vyberte jednu možnost.</p>
    <div class="activity-grid" id="activity-grid"></div>
    <div class="custom-field" id="custom-field">
      <input type="text" id="custom-input" placeholder="Napište vlastní činnost…" maxlength="60">
      <button class="btn btn-primary" id="custom-confirm">Uložit zápis</button>
    </div>
  `;
  const grid = entrySheet.querySelector('#activity-grid');
  ACTIVITIES.forEach(act => {
    const tile = document.createElement('button');
    tile.className = 'activity-tile';
    tile.innerHTML = `<span class="tile-icon">${iconMarkup(act.icon, 18)}</span>${act.label}`;
    tile.addEventListener('click', () => {
      if (act.custom) {
        entrySheet.querySelector('#custom-field').classList.add('show');
        entrySheet.querySelector('#custom-input').focus();
      } else {
        submitEntry(slot, act, '');
      }
    });
    grid.appendChild(tile);
  });
  entrySheet.querySelector('#custom-confirm').addEventListener('click', () => {
    const val = entrySheet.querySelector('#custom-input').value.trim();
    submitEntry(slot, findActivity('jina'), val || 'Jiná činnost');
  });
  sheetBackdrop.hidden = false;
  entrySheet.hidden = false;
}

function submitEntry(slot, activity, note) {
  setEntry(slot.index, {
    activityId: activity.id,
    bucket: activity.bucket,
    label: note || activity.label,
    note,
    auto: false,
  });
  closeSheets();
  showToast('Zapsáno, děkujeme');
  scheduler.restartScheduling();
  if (currentView === 'log') paintLog();
}

/* ---------------- results ---------------- */
function renderResultsRoute() {
  const state = loadState();
  main.innerHTML = '';
  if (!isStudyComplete(state)) {
    const tpl = $('#tpl-locked-results').content.cloneNode(true);
    main.appendChild(tpl);
    const slots = getSlots(state);
    const filled = slots.filter(s => getEntry(s.index, state)).length;
    $('#locked-progress').textContent = `${Math.round((filled / Math.max(slots.length, 1)) * 100)} %`;
    return;
  }
  const tpl = $('#tpl-results').content.cloneNode(true);
  main.appendChild(tpl);
  const stats = computeStats(state);
  const slots = getSlots(state);
  const start = slots[0]?.time, end = slots[slots.length - 1]?.time;
  $('#results-range').textContent = start && end
    ? `${fmtDateShort(start)} – ${fmtDateShort(end)} · ${Math.round(stats.actualDays * 10) / 10} dní pozorování`
    : '';

  // stat tiles
  const tiles = $('#stat-tiles');
  const tileHtml = (label, value) => `<div class="stat-tile"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  tiles.innerHTML =
    tileHtml('Bdělý stav', `${fmt1(stats.awakeHours)} h`) +
    tileHtml('Spánek', `${fmt1(stats.perBucket.spanek.hours)} h`) +
    tileHtml('Zapsaných hodin', `${stats.filledCount} / ${stats.total}`) +
    tileHtml('Bez reakce', `${fmt1(stats.perBucket.bezreakce.hours)} h`);

  // summary table
  const tbody = $('#summary-table tbody');
  tbody.innerHTML = stats.rows.map(r => `
    <tr><td><span class="table-swatch" style="background:${swatchColor(r.id)}"></span>${r.label}</td>
    <td>${fmt1(r.hours)} h</td><td>${Math.round(r.pct)} %</td></tr>
  `).join('');

  // charts
  const donutRows = BUCKET_ORDER.map(id => ({ id, label: BUCKETS[id].label, hours: stats.perBucket[id].hours, pct: stats.perBucket[id].pct }));
  renderDonutChart($('#chart-donut'), donutRows);
  renderBarChart($('#chart-bar'), donutRows);
  renderHeatmap($('#chart-heatmap'), stats.timeline);

  // projections
  const ptbody = $('#projection-table tbody');
  ptbody.innerHTML = stats.projections.map(p => `
    <tr><td><span class="table-swatch" style="background:${swatchColor(p.id)}"></span>${p.label}</td>
    <td>${fmt1(p.weekHours)} h</td>
    <td>${fmt1(p.yearHours)} h <small>(${fmt1(p.yearDays)} dní)</small></td>
    <td>${fmt1(p.decadeHours)} h <small>(${fmt1(p.decadeDays)} dní)</small></td></tr>
  `).join('');

  $('#btn-export').addEventListener('click', () => exportData(state));
  $('#btn-restart').addEventListener('click', () => {
    if (confirm('Smazat aktuální data a zahájit novou sedmidenní studii?')) {
      resetState();
      currentView = null;
      selectedDayKey = null;
      route();
    }
  });
}
function fmt1(n) { return (Math.round(n * 10) / 10).toLocaleString('cs-CZ'); }
function swatchColor(id) {
  const map = {
    prace: 'var(--series-prace, #2a78d6)', sport: 'var(--series-sport, #eb6834)',
    relaxace: 'var(--series-relaxace, #1baf7a)', volnycas: 'var(--series-volnycas, #eda100)',
    jina: 'var(--series-jina, #e87ba4)', spanek: 'var(--series-spanek, #4a3aa7)',
    bezreakce: 'var(--series-bezreakce, #e34948)', bdely: 'var(--text-3, #8b87a0)',
  };
  return map[id] || '#999';
}

function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `experiment-${state.subjectId?.slice(0, 8) || 'data'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- settings ---------------- */
$('#btn-settings').addEventListener('click', () => {
  const state = loadState();
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const theme = localStorage.getItem('experiment_theme') || 'system';
  settingsSheet.innerHTML = `
    <div class="sheet-grabber"></div>
    <h3>Nastavení</h3>
    <p class="sheet-sub">ID subjektu: ${state.subjectId ? state.subjectId.slice(0, 8) : '—'}</p>
    <p class="sheet-sub">Oznámení: ${permission === 'granted' ? 'povolena' : permission === 'denied' ? 'zamítnuta' : 'nenastavena'}</p>
    <div class="activity-grid" style="grid-template-columns:repeat(3,1fr)">
      ${['system', 'light', 'dark'].map(t => `<button class="activity-tile theme-opt" data-theme="${t}" style="${theme === t ? 'border-color:var(--brand-2)' : ''}">${t === 'system' ? 'Systém' : t === 'light' ? 'Světlý' : 'Tmavý'}</button>`).join('')}
    </div>
    ${state.study ? '<button class="btn btn-secondary" id="btn-export-2">Export dat (JSON)</button>' : ''}
    <button class="btn btn-ghost" id="btn-reset-2">Smazat data a začít znovu</button>
  `;
  settingsSheet.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.theme;
      localStorage.setItem('experiment_theme', t);
      if (t === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      closeSheets();
    });
  });
  const exp2 = settingsSheet.querySelector('#btn-export-2');
  if (exp2) exp2.addEventListener('click', () => exportData(state));
  settingsSheet.querySelector('#btn-reset-2').addEventListener('click', () => {
    if (confirm('Opravdu smazat všechna data experimentu z tohoto zařízení?')) {
      resetState();
      closeSheets();
      currentView = null;
      selectedDayKey = null;
      route();
    }
  });
  sheetBackdrop.hidden = false;
  settingsSheet.hidden = false;
});

/* ---------------- boot ---------------- */
scheduler.onChange(() => {
  if (currentView === 'log') paintLog();
  if (currentView === 'results') {
    const state = loadState();
    if (isStudyComplete(state)) renderResultsRoute();
  }
});
scheduler.init().then(route);
route();
