// Experiment push backend — the only piece of server infrastructure this
// project has. Its sole job: every hour at :01, send a Web Push notification
// to every subscribed device, so the reminder reaches an installed iOS/
// Android home-screen app even while it is closed (client-only scheduling,
// see js/scheduler.js, cannot do that on iOS — Safari suspends page/SW JS
// in the background). Subscriptions and their payload/timing logic live
// entirely here; the app's actual slot/entry/auto-fill logic stays
// client-side and untouched.
import { generateRequestDetails, sendNotification } from 'web-push-neo';

const KV_PREFIX = 'sub:';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, env, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env), ...(init.headers || {}) },
  });
}

async function keyFor(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return KV_PREFIX + hex;
}

async function handleSubscribe(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, env, { status: 400 });
  }
  const subscription = payload?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: 'invalid_subscription' }, env, { status: 400 });
  }
  const key = await keyFor(subscription.endpoint);
  await env.SUBS.put(key, JSON.stringify({
    subscription,
    subjectId: payload.subjectId || null,
    subscribedAt: Date.now(),
  }));
  return json({ ok: true }, env, { status: 201 });
}

async function handleUnsubscribe(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, env, { status: 400 });
  }
  if (!payload?.endpoint) return json({ error: 'missing_endpoint' }, env, { status: 400 });
  await env.SUBS.delete(await keyFor(payload.endpoint));
  return json({ ok: true }, env);
}

async function handleVapidPublicKey(env) {
  return json({ publicKey: env.VAPID_PUBLIC_KEY }, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (url.pathname === '/api/vapid-public-key' && request.method === 'GET') {
      return handleVapidPublicKey(env);
    }
    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }
    if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }
    return json({ error: 'not_found' }, env, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendHourlyReminders(env));
  },
};

async function sendHourlyReminders(env) {
  const ttlMs = Number(env.SUBSCRIPTION_TTL_DAYS || 8) * 86400000;
  const now = Date.now();
  const hourTag = `hour-${new Date().toISOString().slice(0, 13)}`;
  const payload = JSON.stringify({
    title: 'Experiment — čas zapsat činnost',
    body: 'Co právě děláte? Máte 15 minut na zápis.',
    tag: hourTag,
  });
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  let cursor;
  let listComplete = false;
  while (!listComplete) {
    const page = await env.SUBS.list({ prefix: KV_PREFIX, cursor });
    listComplete = page.list_complete;
    cursor = page.cursor;
    await Promise.all(page.keys.map(async k => {
      const raw = await env.SUBS.get(k.name);
      if (!raw) return;
      const record = JSON.parse(raw);
      if (now - record.subscribedAt > ttlMs) {
        await env.SUBS.delete(k.name);
        return;
      }
      try {
        await sendNotification(record.subscription, payload, { vapidDetails, TTL: 3600 });
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await env.SUBS.delete(k.name);
        } else {
          console.error('push failed', k.name, err?.statusCode, err?.message);
        }
      }
    }));
  }
}
