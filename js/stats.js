// Aggregation + long-range projection for the evaluation screen.
import { getSlots, getEntry } from './storage.js';
import { BUCKETS, BUCKET_ORDER } from './activities.js';

/**
 * @returns {{
 *   totalHours:number, actualDays:number, filledCount:number, total:number,
 *   perBucket: Record<string,{hours:number, pct:number}>,
 *   awakeHours:number, awakePct:number,
 *   rows: {id:string, label:string, hours:number, pct:number}[],
 *   projections: {id:string, label:string, weekHours:number, yearHours:number, yearDays:number, decadeHours:number, decadeDays:number}[],
 *   timeline: {index:number, time:Date, bucket:string|null}[],
 * }}
 */
export function computeStats(state) {
  const slots = getSlots(state);
  const perBucket = {};
  BUCKET_ORDER.forEach(id => { perBucket[id] = 0; });

  const timeline = slots.map(slot => {
    const entry = getEntry(slot.index, state);
    const bucket = entry ? entry.bucket : null;
    if (bucket && perBucket[bucket] !== undefined) perBucket[bucket] += 1;
    return { index: slot.index, time: slot.time, bucket };
  });

  const filledCount = timeline.filter(t => t.bucket).length;
  const totalHours = filledCount; // 1 slot === 1 hour
  const actualDays = Math.max(slots.length / 24, 1 / 24);
  const awakeHours = totalHours - perBucket.spanek;

  const pct = h => (totalHours > 0 ? (h / totalHours) * 100 : 0);

  const rows = [
    { id: 'bdely', label: 'Bdělý stav', hours: awakeHours, pct: pct(awakeHours), icon: 'sun' },
    { id: 'spanek', label: BUCKETS.spanek.label, hours: perBucket.spanek, pct: pct(perBucket.spanek), icon: BUCKETS.spanek.icon },
    { id: 'volnycas', label: BUCKETS.volnycas.label, hours: perBucket.volnycas, pct: pct(perBucket.volnycas), icon: BUCKETS.volnycas.icon },
    { id: 'relaxace', label: BUCKETS.relaxace.label, hours: perBucket.relaxace, pct: pct(perBucket.relaxace), icon: BUCKETS.relaxace.icon },
    { id: 'sport', label: BUCKETS.sport.label, hours: perBucket.sport, pct: pct(perBucket.sport), icon: BUCKETS.sport.icon },
    { id: 'prace', label: BUCKETS.prace.label, hours: perBucket.prace, pct: pct(perBucket.prace), icon: BUCKETS.prace.icon },
    { id: 'bezreakce', label: BUCKETS.bezreakce.label, hours: perBucket.bezreakce, pct: pct(perBucket.bezreakce), icon: BUCKETS.bezreakce.icon },
    { id: 'jina', label: BUCKETS.jina.label, hours: perBucket.jina, pct: pct(perBucket.jina), icon: BUCKETS.jina.icon },
  ];

  const projectionSource = [
    { id: 'spanek', label: BUCKETS.spanek.label, hours: perBucket.spanek },
    { id: 'volnycas', label: BUCKETS.volnycas.label, hours: perBucket.volnycas },
    { id: 'relaxace', label: BUCKETS.relaxace.label, hours: perBucket.relaxace },
    { id: 'sport', label: BUCKETS.sport.label, hours: perBucket.sport },
    { id: 'prace', label: BUCKETS.prace.label, hours: perBucket.prace },
    { id: 'bezreakce', label: BUCKETS.bezreakce.label, hours: perBucket.bezreakce },
    { id: 'jina', label: BUCKETS.jina.label, hours: perBucket.jina },
  ];

  const projections = projectionSource.map(r => {
    const perDay = r.hours / actualDays;
    const yearHours = perDay * 365;
    const decadeHours = perDay * 3650;
    return {
      id: r.id, label: r.label,
      weekHours: r.hours,
      yearHours, yearDays: yearHours / 24,
      decadeHours, decadeDays: decadeHours / 24,
    };
  });

  const bucketPct = {};
  BUCKET_ORDER.forEach(id => { bucketPct[id] = { hours: perBucket[id], pct: pct(perBucket[id]) }; });

  return {
    totalHours, actualDays, filledCount, total: slots.length,
    perBucket: bucketPct,
    awakeHours, awakePct: pct(awakeHours),
    rows, projections, timeline,
  };
}
