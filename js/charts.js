// Self-contained SVG chart rendering — no external chart library, so the PWA
// stays offline-capable. Colors are the dataviz-skill validated categorical
// palette (7 slots, adjacent-pair CVD + contrast checked, light & mode).
import { BUCKET_ORDER, BUCKETS } from './activities.js';

export const PALETTE = {
  prace:     { light: '#2a78d6', dark: '#3987e5' },
  sport:     { light: '#eb6834', dark: '#d95926' },
  relaxace:  { light: '#1baf7a', dark: '#199e70' },
  volnycas:  { light: '#eda100', dark: '#c98500' },
  jina:      { light: '#e87ba4', dark: '#d55181' },
  spanek:    { light: '#4a3aa7', dark: '#9085e9' },
  bezreakce: { light: '#e34948', dark: '#e66767' },
};

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  children.forEach(c => n.appendChild(c));
  return n;
}
function colorVar(id) { return `var(--series-${id})`; }
function fmtH(h) { return (Math.round(h * 10) / 10).toLocaleString('cs-CZ'); }

function legend(container, rows) {
  const wrap = document.createElement('div');
  wrap.className = 'viz-legend';
  rows.forEach(r => {
    const item = document.createElement('span');
    item.className = 'viz-legend-item';
    item.innerHTML = `<i style="background:${colorVar(r.id)}"></i>${r.label}`;
    wrap.appendChild(item);
  });
  container.appendChild(wrap);
}

/** Horizontal bar chart: rows = [{id,label,hours,pct}], excludes derived rows. */
export function renderBarChart(container, rows, { unit = 'h' } = {}) {
  container.innerHTML = '';
  container.classList.add('viz-root');
  const width = 560, rowH = 34, gap = 10, padL = 132, padR = 56, top = 8;
  const max = Math.max(...rows.map(r => r.hours), 1);
  const height = rows.length * (rowH + gap) - gap + top * 2;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz-svg', role: 'img', 'aria-label': 'Graf hodin podle kategorie' });

  rows.forEach((r, i) => {
    const y = top + i * (rowH + gap);
    const barMaxW = width - padL - padR;
    const w = Math.max((r.hours / max) * barMaxW, r.hours > 0 ? 4 : 0);
    const g = el('g', { class: 'viz-bar-group', tabindex: '0' });
    g.appendChild(el('title', {}, [document.createTextNode(`${r.label}: ${fmtH(r.hours)} ${unit} (${Math.round(r.pct)} %)`)]));
    g.appendChild(el('text', { x: padL - 10, y: y + rowH / 2 + 4, class: 'viz-row-label', 'text-anchor': 'end' }, [document.createTextNode(r.label)]));
    g.appendChild(el('rect', { x: padL, y, width: barMaxW, height: rowH, rx: 4, class: 'viz-track' }));
    g.appendChild(el('rect', {
      x: padL, y, width: w, height: rowH, rx: 4, class: 'viz-bar',
      style: `fill:${colorVar(r.id)}`,
    }));
    g.appendChild(el('text', {
      x: padL + w + 8, y: y + rowH / 2 + 4, class: 'viz-value-label',
    }, [document.createTextNode(`${fmtH(r.hours)} ${unit}`)]));
    svg.appendChild(g);
  });

  container.appendChild(svg);
}

/** Donut chart of share-of-week per bucket. */
export function renderDonutChart(container, rows) {
  container.innerHTML = '';
  container.classList.add('viz-root');
  const size = 260, cx = size / 2, cy = size / 2, rOuter = 108, rInner = 66;
  const total = rows.reduce((s, r) => s + r.hours, 0) || 1;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, class: 'viz-svg', role: 'img', 'aria-label': 'Podíl kategorií za týden' });

  let angle = -Math.PI / 2;
  const gapRad = 0.015;
  rows.forEach(r => {
    const frac = r.hours / total;
    if (frac <= 0) return;
    const a0 = angle + gapRad / 2;
    const a1 = angle + frac * Math.PI * 2 - gapRad / 2;
    angle += frac * Math.PI * 2;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const p = (r_, a) => [cx + r_ * Math.cos(a), cy + r_ * Math.sin(a)];
    const [x0, y0] = p(rOuter, a0), [x1, y1] = p(rOuter, a1);
    const [x2, y2] = p(rInner, a1), [x3, y3] = p(rInner, a0);
    const d = `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
    const path = el('path', { d, class: 'viz-slice', style: `fill:${colorVar(r.id)}` });
    path.appendChild(el('title', {}, [document.createTextNode(`${r.label}: ${fmtH(r.hours)} h (${Math.round(r.pct)} %)`)]));
    svg.appendChild(path);
  });

  svg.appendChild(el('text', { x: cx, y: cy - 4, class: 'viz-donut-center-value', 'text-anchor': 'middle' }, [document.createTextNode(fmtH(total))]));
  svg.appendChild(el('text', { x: cx, y: cy + 16, class: 'viz-donut-center-label', 'text-anchor': 'middle' }, [document.createTextNode('hodin / týden')]));

  container.appendChild(svg);
  legend(container, rows.filter(r => r.hours > 0));
}

/** 7x24 heatmap of the whole tracked week, calendar-style. */
export function renderHeatmap(container, timeline) {
  container.innerHTML = '';
  container.classList.add('viz-root');
  const byDay = [];
  timeline.forEach(cell => {
    const dayKey = cell.time.toDateString();
    let day = byDay.find(d => d.key === dayKey);
    if (!day) { day = { key: dayKey, date: cell.time, cells: [] }; byDay.push(day); }
    day.cells.push(cell);
  });

  const cellSize = 20, gap = 3, padL = 46, padT = 22;
  const width = padL + 24 * (cellSize + gap);
  const height = padT + byDay.length * (cellSize + gap);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz-svg', role: 'img', 'aria-label': 'Časová mřížka celého týdne' });

  [0, 6, 12, 18].forEach(h => {
    svg.appendChild(el('text', {
      x: padL + h * (cellSize + gap), y: 14, class: 'viz-axis-label',
    }, [document.createTextNode(String(h).padStart(2, '0'))]));
  });

  byDay.forEach((day, di) => {
    const y = padT + di * (cellSize + gap);
    svg.appendChild(el('text', {
      x: padL - 8, y: y + cellSize / 2 + 4, class: 'viz-row-label', 'text-anchor': 'end',
    }, [document.createTextNode(day.date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric' }))]));
    day.cells.forEach(cell => {
      const x = padL + cell.time.getHours() * (cellSize + gap);
      const fill = cell.bucket ? colorVar(cell.bucket) : 'var(--viz-empty)';
      const label = cell.bucket ? (BUCKETS[cell.bucket] ? BUCKETS[cell.bucket].label : cell.bucket) : 'bez záznamu';
      const rect = el('rect', {
        x, y, width: cellSize, height: cellSize, rx: 4, class: 'viz-cell', style: `fill:${fill}`,
      });
      rect.appendChild(el('title', {}, [document.createTextNode(`${cell.time.toLocaleString('cs-CZ')} — ${label}`)]));
      svg.appendChild(rect);
    });
  });

  container.appendChild(svg);
  legend(container, BUCKET_ORDER.map(id => ({ id, label: BUCKETS[id].label })));
}
