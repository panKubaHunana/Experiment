# Experiment — push server (volitelné)

Malý Cloudflare Worker, který jednou za hodinu (v :01) pošle Web Push
notifikaci každému přihlášenému zařízení — díky tomu upozornění dorazí i do
nainstalované appky na ploše, i když je zrovna zavřená. To je nutné hlavně
na **iOS**: Safari uspí JS stránky/service workeru na pozadí, takže čistě
klientské plánování (`js/scheduler.js`) tam funguje jen dokud má subjekt
appku otevřenou. Na Androidu/desktopu je klientské plánování samo o sobě
už docela spolehlivé, tenhle server ho jen posiluje.

**Appka funguje i bez tohoto serveru** — `js/config.js` má `PUSH_SERVER_URL`
prázdné ve výchozím stavu, takže bez nasazení serveru poběží přesně jako
předtím (jen s iOS omezením popsaným v hlavním README).

## Proč zrovna `aes128gcm`

Web Push vyžaduje šifrování payloadu (RFC 8291/8188). Safari na iOS 16.4+
podporuje **výhradně** moderní kódování `aes128gcm` — starší draft `aesgcm`
(který dodnes používají některé oblíbené knihovny pro edge runtime) na iOS
nefunguje. Server proto používá
[`web-push-neo`](https://www.npmjs.com/package/web-push-neo) — fork
zavedené knihovny `web-push` přepsaný na Web Crypto API, který posílá
výhradně `aes128gcm`.

> Šifrovací i podpisová (VAPID) logika byla lokálně ověřena (viz commit
> historie / `tools`) proti syntetické subscription — hlavičky, JWT a
> `Content-Encoding: aes128gcm` odpovídají specifikaci. Doručení na skutečné
> zařízení ale nebylo možné otestovat v tomto prostředí (žádný živý iPhone /
> Cloudflare účet) — po nasazení proto doporučujeme jeden ruční test podle
> kroku 6 níže.

## Nasazení

Vyžaduje (zdarma) účet na [Cloudflare](https://dash.cloudflare.com/sign-up)
a Node.js.

```bash
cd server
npm install
npm install -g wrangler   # pokud ještě nemáte CLI
wrangler login
```

**1. Vytvořte KV namespace** (úložiště pro subscriptions):

```bash
wrangler kv namespace create SUBS
```

Vrátí `id = "…"` — vložte ho do `wrangler.toml` místo
`REPLACE_WITH_KV_NAMESPACE_ID`.

**2. Vygenerujte VAPID klíče:**

```bash
npm run generate-vapid
```

**3. Uložte klíče jako secrets** (nikdy je nedávejte do `wrangler.toml`):

```bash
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT   # např. mailto:vas@email.cz
```

**4. (Volitelné) omezte CORS** — v `wrangler.toml` nastavte
`ALLOWED_ORIGIN` na doménu appky (např.
`https://pankubahunana.github.io`) místo `"*"`.

**5. Nasaďte:**

```bash
npm run deploy
```

Wrangler vypíše URL Workeru, něco jako
`https://experiment-push.<váš-subdomain>.workers.dev`.

**6. Propojte appku se serverem** — v `js/config.js` nastavte:

```js
export const PUSH_SERVER_URL = 'https://experiment-push.<váš-subdomain>.workers.dev';
```

Commitněte a nasaďte appku znovu (GitHub Pages). Otevřete appku, povolte
oznámení a zahajte experiment — appka se sama přihlásí k odběru. Push
notifikace lze ověřit ručně:

```bash
curl -X POST https://experiment-push.<váš-subdomain>.workers.dev/cdn-cgi/handler/scheduled
```

(Cloudflare tuto testovací cestu pro `scheduled` handler zpřístupňuje jen
lokálně přes `wrangler dev` — pro test na nasazeném Workeru počkejte na
nejbližší reálné spuštění v :01, nebo dočasně přidejte testovací HTTP route.)

## Jak to funguje

- `POST /api/subscribe` — appka sem po startu studie pošle
  `PushSubscription` z prohlížeče; uloží se do KV pod hash endpointu.
- `POST /api/unsubscribe` — zavolá appka při resetu/dokončení studie.
- `GET /api/vapid-public-key` — appka si odsud stáhne veřejný klíč pro
  `pushManager.subscribe()`.
- **Cron `1 * * * *`** (každou hodinu v :01, UTC) — projde všechny uložené
  subscriptions a každé pošle zašifrovanou notifikaci. Subscription starší
  než `SUBSCRIPTION_TTL_DAYS` (výchozí 8, o den víc než studie) nebo
  vrátivší `404`/`410` se smaže.

Server nezná přesný rozvrh slotů konkrétního subjektu (ten je čistě
klientský, viz `js/storage.js`) — jen "budí" appku každou hodinu. Reálná
logika zápisu/auto-doplnění běží beze změny v prohlížeči.

## Lokální vývoj

```bash
npm run dev
```

`wrangler dev` běží lokálně bez nutnosti Cloudflare účtu; vytvořte
`server/.dev.vars` (gitignored) s `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` pro test. Scheduled handler lze ručně spustit přes
`curl http://localhost:8787/cdn-cgi/handler/scheduled`.
