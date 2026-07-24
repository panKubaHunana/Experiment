// Local data layer for Experiment. Everything lives in localStorage — this is
// a single-subject diary study, no server, no account.

const KEY = 'experiment_state_v1';
export const STUDY_DAYS = 7;
export const REMINDER_WINDOW_MIN = 15; // minutes the participant has to log before auto-fill
export const SLOT_MINUTE = 1;          // notifications land at HH:01

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function defaultState() {
  return {
    version: 1,
    subjectId: null,
    study: null, // { startedAt, days, slots: [ISO,...] }
    entries: {},  // slotIndex -> { activityId, bucket, label, note, filledAt, auto }
    notifiedSlots: [],
    settings: { notificationsEnabled: false },
  };
}

let cache = null;

export function loadState() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch (e) {
    cache = defaultState();
  }
  return cache;
}

export function saveState(state) {
  cache = state;
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function resetState() {
  localStorage.removeItem(KEY);
  cache = null;
  return loadState();
}

/** Build the fixed hourly slot schedule (HH:01, every hour) for `days` days,
 *  starting today, dropping slots already in the past relative to `now`. */
export function generateSlots(now, days) {
  const slots = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      const t = new Date(base);
      t.setDate(t.getDate() + d);
      t.setHours(h, SLOT_MINUTE, 0, 0);
      if (t.getTime() >= now.getTime() - 1000) slots.push(t.toISOString());
    }
  }
  return slots;
}

export function startStudy() {
  const state = loadState();
  const now = new Date();
  state.subjectId = state.subjectId || uid();
  state.study = {
    startedAt: now.toISOString(),
    days: STUDY_DAYS,
    slots: generateSlots(now, STUDY_DAYS),
  };
  state.entries = {};
  state.notifiedSlots = [];
  return saveState(state);
}

export function isStudyStarted(state = loadState()) {
  return !!state.study;
}

export function getSlots(state = loadState()) {
  if (!state.study) return [];
  return state.study.slots.map((iso, index) => ({ index, time: new Date(iso) }));
}

export function isStudyComplete(state = loadState()) {
  if (!state.study) return false;
  const slots = getSlots(state);
  if (!slots.length) return false;
  const last = slots[slots.length - 1].time;
  const filledAll = slots.every(s => !!state.entries[s.index]);
  return filledAll || Date.now() > last.getTime() + REMINDER_WINDOW_MIN * 60000;
}

export function getEntry(index, state = loadState()) {
  return state.entries[index] || null;
}

export function setEntry(index, data, state = loadState()) {
  state.entries[index] = { ...data, filledAt: data.filledAt || new Date().toISOString() };
  return saveState(state);
}

export function markNotified(index, state = loadState()) {
  if (!state.notifiedSlots.includes(index)) {
    state.notifiedSlots.push(index);
    saveState(state);
  }
  return state;
}

export function wasNotified(index, state = loadState()) {
  return state.notifiedSlots.includes(index);
}

/** Slot status relative to now: 'future' | 'active' (can be logged) |
 *  'grace' (past due, still within window, will auto-fill soon) | 'done'. */
export function slotStatus(slot, state = loadState()) {
  const entry = getEntry(slot.index, state);
  if (entry) return 'done';
  const now = Date.now();
  const t = slot.time.getTime();
  if (now < t) return 'future';
  const elapsedMin = (now - t) / 60000;
  if (elapsedMin <= REMINDER_WINDOW_MIN) return 'active';
  return 'expired';
}
