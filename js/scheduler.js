// Notification + auto-fill scheduler.
//
// There is no push server behind this PWA, so reliability is best-effort by
// design: while the app (or its installed PWA/service worker) is alive, this
// module (a) fires a local notification the moment each hourly slot opens,
// and (b) auto-fills any slot that goes unanswered for more than
// REMINDER_WINDOW_MIN minutes with a "Bez reakce" entry. On every foreground
// resume it reconciles state from scratch, so nothing is lost even if the
// timers were paused while the device was asleep — the fill-in still lands
// with the correct original slot time, just detected late.
import {
  loadState, getSlots, slotStatus, getEntry, setEntry,
  markNotified, wasNotified, REMINDER_WINDOW_MIN,
} from './storage.js';
import { BUCKETS } from './activities.js';

let swRegistration = null;
let tickTimer = null;
let listeners = [];

export function onChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function emit() {
  const summary = reconcile();
  listeners.forEach(fn => fn(summary));
  return summary;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    return swRegistration;
  } catch (e) {
    console.warn('SW registration failed', e);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

async function fireNotification(slot) {
  const title = 'Experiment — čas zapsat činnost';
  const body = `Co právě děláte? (${fmtTime(slot.time)}) Máte ${REMINDER_WINDOW_MIN} minut na zápis.`;
  const opts = {
    body,
    tag: `slot-${slot.index}`,
    icon: './icons/icon-192.png',
    badge: './icons/badge-72.png',
    requireInteraction: false,
    data: { slotIndex: slot.index },
  };
  try {
    if (swRegistration) {
      await swRegistration.showNotification(title, opts);
    } else if (Notification.permission === 'granted') {
      new Notification(title, opts);
    }
  } catch (e) {
    console.warn('notify failed', e);
  }
}

function fmtTime(d) {
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

/** Core reconciliation: notify newly-due slots, auto-fill expired ones.
 *  Safe to call as often as needed (idempotent). */
export function reconcile() {
  const state = loadState();
  if (!state.study) return { started: false };

  const now = Date.now();
  const slots = getSlots(state);
  let activeSlot = null;
  let autoFilledCount = 0;

  for (const slot of slots) {
    if (slot.time.getTime() > now) break; // chronological, nothing more is due
    const status = slotStatus(slot, state);
    if (status === 'active') {
      if (!wasNotified(slot.index, state)) {
        fireNotification(slot);
        markNotified(slot.index, state);
      }
      activeSlot = slot;
    } else if (status === 'expired' && !getEntry(slot.index, state)) {
      setEntry(slot.index, {
        activityId: null,
        bucket: BUCKETS.bezreakce.id,
        label: BUCKETS.bezreakce.label,
        note: '',
        auto: true,
        filledAt: new Date(slot.time.getTime() + REMINDER_WINDOW_MIN * 60000).toISOString(),
      }, state);
      autoFilledCount += 1;
    }
  }

  const filledCount = slots.filter(s => !!getEntry(s.index, state)).length;
  return {
    started: true,
    total: slots.length,
    filledCount,
    autoFilledJustNow: autoFilledCount,
    activeSlot,
    complete: slots.length > 0 && filledCount >= slots.length,
  };
}

function msUntilNextBoundary(state) {
  const slots = getSlots(state);
  const now = Date.now();
  let soonest = Infinity;
  for (const slot of slots) {
    const t = slot.time.getTime();
    if (t > now) soonest = Math.min(soonest, t - now); // next slot opens
    const expiry = t + REMINDER_WINDOW_MIN * 60000;
    if (expiry > now) soonest = Math.min(soonest, expiry - now); // next auto-fill
  }
  return Number.isFinite(soonest) ? soonest : null;
}

function scheduleNextTick() {
  clearTimeout(tickTimer);
  const state = loadState();
  const wait = msUntilNextBoundary(state);
  const delay = Math.min(Math.max(wait ?? 60000, 5000), 60000); // 5s..60s, poll fallback
  tickTimer = setTimeout(() => {
    emit();
    scheduleNextTick();
  }, delay);
}

/** Best-effort progressive enhancement: pre-schedule notifications for the
 *  next ~24h using the experimental Notification Triggers API, so they can
 *  still fire if the tab/PWA isn't in the foreground at the exact minute.
 *  No-op on browsers without support (most of them, today). */
async function scheduleTriggers(state) {
  if (!swRegistration || typeof Notification === 'undefined') return;
  const supportsTrigger = ('showTrigger' in Notification.prototype) && !!window.TimestampTrigger;
  if (!supportsTrigger) return;
  const slots = getSlots(state);
  const now = Date.now();
  const horizon = now + 24 * 3600 * 1000;
  for (const slot of slots) {
    const t = slot.time.getTime();
    if (t < now || t > horizon) continue;
    if (getEntry(slot.index, state)) continue;
    try {
      await swRegistration.showNotification('Experiment — čas zapsat činnost', {
        body: `Co právě děláte? (${fmtTime(slot.time)})`,
        tag: `slot-${slot.index}`,
        icon: './icons/icon-192.png',
        // eslint-disable-next-line no-undef
        showTrigger: new TimestampTrigger(t),
        data: { slotIndex: slot.index },
      });
    } catch (e) { /* unsupported, ignore */ }
  }
}

export async function init() {
  await registerServiceWorker();
  const state = loadState();
  if (state.study) {
    scheduleTriggers(state);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') emit();
  });
  window.addEventListener('focus', () => emit());
  window.addEventListener('online', () => emit());
  scheduleNextTick();
  return emit();
}

export function restartScheduling() {
  const state = loadState();
  if (state.study) scheduleTriggers(state);
  scheduleNextTick();
  return emit();
}
