// Activity catalog for the Experiment PWA.
// Each bucket is one of the eight aggregation categories used in the final
// evaluation. Buckets carry the validated chart palette (see js/charts.js);
// icons are small hand-drawn stroke glyphs (see ICONS in js/icons.js).

export const BUCKETS = {
  prace:     { id: 'prace',     label: 'Práce',         icon: 'briefcase', series: 1 },
  sport:     { id: 'sport',     label: 'Sport',         icon: 'run',       series: 2 },
  relaxace:  { id: 'relaxace',  label: 'Relaxace',      icon: 'leaf',      series: 3 },
  volnycas:  { id: 'volnycas',  label: 'Volný čas',     icon: 'sun',       series: 4 },
  jina:      { id: 'jina',      label: 'Jiná činnost',  icon: 'edit',      series: 5 },
  spanek:    { id: 'spanek',    label: 'Spánek',        icon: 'moon',      series: 6 },
  bezreakce: { id: 'bezreakce', label: 'Bez reakce',    icon: 'clockalert',series: 7 },
};

// Ordered list matching the validated adjacent-pair order (js/charts.js PALETTE).
export const BUCKET_ORDER = ['prace', 'sport', 'relaxace', 'volnycas', 'jina', 'spanek', 'bezreakce'];

// Preset activities shown to the participant. Each maps to exactly one bucket.
// `custom:true` items require the participant to type a short free-text label.
export const ACTIVITIES = [
  { id: 'spanek',     bucket: 'spanek',    label: 'Spánek',                icon: 'moon' },
  { id: 'prace',      bucket: 'prace',     label: 'Práce',                 icon: 'briefcase' },
  { id: 'studium',    bucket: 'prace',     label: 'Studium',               icon: 'book' },
  { id: 'domacnost',  bucket: 'prace',     label: 'Domácí práce / úklid',  icon: 'home' },
  { id: 'sport',      bucket: 'sport',     label: 'Sport / pohyb',         icon: 'run' },
  { id: 'relaxace',   bucket: 'relaxace',  label: 'Relaxace / odpočinek',  icon: 'leaf' },
  { id: 'meditace',   bucket: 'relaxace',  label: 'Meditace',              icon: 'leaf' },
  { id: 'jidlo',      bucket: 'volnycas',  label: 'Jídlo',                 icon: 'sun' },
  { id: 'spolecnost', bucket: 'volnycas',  label: 'Společenský kontakt',   icon: 'sun' },
  { id: 'zabava',     bucket: 'volnycas',  label: 'Zábava / koníčky',      icon: 'sun' },
  { id: 'hygiena',    bucket: 'volnycas',  label: 'Osobní hygiena',        icon: 'sun' },
  { id: 'doprava',    bucket: 'volnycas',  label: 'Doprava',               icon: 'sun' },
  { id: 'jina',       bucket: 'jina',      label: 'Jiná činnost',          icon: 'edit', custom: true },
];

export function findActivity(id) {
  return ACTIVITIES.find(a => a.id === id) || null;
}
