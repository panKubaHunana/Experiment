// Hand-drawn stroke icon set for Experiment. 24x24 viewBox, stroke=currentColor.
// Keeping icons as inline path data (no external icon font/CDN) so the PWA
// stays fully self-contained and offline-capable.

const PATHS = {
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/><path d="M10.5 12.5v1.6h3v-1.6"/>',
  book: '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H12v18H6.2A2.2 2.2 0 0 1 4 18.8Z"/><path d="M20 5.2A2.2 2.2 0 0 0 17.8 3H12v18h5.8A2.2 2.2 0 0 0 20 18.8Z"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v8.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10"/><path d="M10 19.5V14h4v5.5"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M9 21l2.4-5.2-2-1.8.9-4.4 3 2.5 2.4 1.1 2.3 3.3"/><path d="M8 12.5l2.5-2 2.8 1.1"/>',
  leaf: '<path d="M5 19c8.5 0 14-5.5 14-14 0 0-13-1-14 8.5C4.4 17.7 5 19 5 19Z"/><path d="M5 19c0-5 2-8.5 6-11.5"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M4.5 12H3M21 12h-1.5M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>',
  edit: '<path d="M4 20l.9-4L16 4.9a1.6 1.6 0 0 1 2.3 0l.8.8a1.6 1.6 0 0 1 0 2.3L8 19.1Z"/><path d="M13.8 6.9l3.3 3.3"/>',
  clockalert: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4.3l2.6 2"/><path d="M9 3.5h6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  check: '<path d="M4.5 12.5l5 5 10-10.5"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  bell: '<path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.4 2 6H4c.6-.6 2-2 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.3M12 18.7V21M21 12h-2.3M5.3 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"/>',
  download: '<path d="M12 3.5v12M7.5 11l4.5 4.5L16.5 11"/><path d="M4.5 18.5h15"/>',
  chart: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M3 20.5h18"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 8v.1"/>',
};

export function iconMarkup(name, size = 20) {
  const p = PATHS[name] || PATHS.info;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
