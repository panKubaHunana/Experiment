# Experiment — deník denního času

Progresivní webová aplikace (PWA) pro sociologický experiment zaměřený na
využití denního času. Subjekt po dobu **7 dní** každou hodinu zaznamenává,
čemu se právě věnuje. Po skončení týdne se odemkne vyhodnocení s tabulkami,
grafy a přepočtem na rok a deset let.

## Jak to funguje

- **Hodinové zápisy.** Notifikace přichází v čase `HH:01` (00:01, 01:01, …,
  23:01). Subjekt má **15 minut** na zápis; poté se řádek automaticky doplní
  jako *„Bez reakce“*, aby v datech nechyběl.
- **Slepý zápis.** Aplikace nikdy nezobrazuje obsah dřívějších záznamů —
  jen že hodina byla „Zapsána“. Subjekt tak není ovlivněn vlastními
  předchozími odpověďmi. Detail se odemkne až ve vyhodnocení po skončení týdne.
- **Kalendářový vzhled.** Deník je den-po-dni agenda ve stylu kalendáře, s
  týdenním pruhem pro navigaci mezi dny (budoucí hodiny jsou uzamčené,
  minulé skryté, aktuální hodina aktivní k zápisu).
- **Přednastavená nabídka i volný text.** 13 aktivit ve 7 kategoriích
  (Práce, Sport, Relaxace, Volný čas, Jiná činnost, Spánek, Bez reakce) plus
  pole pro vlastní popis.
- **Vyhodnocení.** Po dokončení týdne: souhrnná tabulka (bdělý stav, spánek,
  volný čas, relaxace, sport, práce, bez reakce, jiná činnost), koláčový a
  sloupcový graf a časová mřížka 7×24 h. Extrapolace týdenního průměru na
  **1 rok** a **10 let** v hodinách i dnech.
- **Data zůstávají na zařízení.** Vše se ukládá pouze do `localStorage`
  prohlížeče — žádný účet, žádný upload deníku. Data lze kdykoli exportovat
  jako JSON tlačítkem „Export dat“. Jediná volitelná výjimka je popsaná níže
  v sekci o notifikacích: pokud nasadíte `server/`, appka na něj pošle jen
  technickou push-subscription (ne obsah zápisů), aby vám mohl posílat
  hodinová upozornění.

### Mapování aktivit → kategorie

| Kategorie | Aktivity v nabídce |
|---|---|
| Spánek | Spánek |
| Práce | Práce, Studium, Domácí práce / úklid |
| Sport | Sport / pohyb |
| Relaxace | Relaxace / odpočinek, Meditace |
| Volný čas | Jídlo, Společenský kontakt, Zábava / koníčky, Osobní hygiena, Doprava |
| Jiná činnost | vlastní text |
| Bez reakce | automaticky, když subjekt nezareaguje do 15 minut |

„Bdělý stav“ ve vyhodnocení je odvozená hodnota = celkový čas − spánek.

## Spuštění lokálně

Aplikace je čisté HTML/CSS/JS bez buildu — stačí ji servírovat přes HTTP
(kvůli ES modulům a service workeru nefunguje z `file://`):

```bash
npx http-server -p 8080
# nebo: python3 -m http.server 8080
```

Otevřete `http://localhost:8080`. Pro plnohodnotné testování na telefonu
(notifikace, add-to-homescreen) je potřeba HTTPS — nejsnazší je nasazení na
GitHub Pages (viz níže) nebo tunel typu `ngrok`.

## Nasazení na GitHub Pages

1. V nastavení repozitáře **Settings → Pages** nastavte *Source* na větev
   `main` (nebo aktuální), složku `/ (root)`.
2. Aplikace poběží na `https://<uživatel>.github.io/Experiment/`. Všechny
   cesty v projektu jsou relativní (`./…`), takže funguje i v podsložce.
3. Subjekt si stránku otevře v mobilním prohlížeči a přes nabídku
   „Přidat na plochu“ / „Nainstalovat“ si ji uloží jako PWA.

## Spolehlivost notifikací (a iOS)

Appka funguje ve dvou režimech:

**A) Bez serveru (výchozí, `js/config.js` → `PUSH_SERVER_URL = ''`).**
Notifikace generuje přímo stránka/service worker, dokud je aplikace (nebo
její service worker) aktivní.
- Na **Androidu/desktopu** to při nainstalované PWA a povoleném běhu na
  pozadí funguje spolehlivě celý týden (v nastavení baterie doporučte
  subjektu „Unrestricted battery usage“).
- Na **iOS/iPadOS (Safari)** notifikace fungují *jen* po přidání appky na
  plochu (Sdílet → Přidat na plochu, appka na to sama upozorní) — a i pak
  je spolehlivě dostane, jen dokud appku nezavře/telefon neuspí, protože
  Safari na pozadí JS stránky i service workeru rychle uspává. Appka to
  dožene při každém otevření (dohledá zmeškané hodiny a doplní „Bez
  reakce“ se správným původním časem), takže data nikdy nechybí — ale
  notifikace samotná v tu chvíli už nedorazí.

**B) Se serverem (`server/`, volitelné).** Malý Cloudflare Worker posílá
skutečný Web Push (RFC 8291 `aes128gcm`, jediné kódování, které iOS 16.4+
podporuje) každou hodinu i zavřené appce na ploše — i na iOS. Appka se k
němu automaticky přihlásí, jakmile v `js/config.js` vyplníte
`PUSH_SERVER_URL`. Návod k nasazení: [`server/README.md`](server/README.md).
Bez vyplnění `PUSH_SERVER_URL` appka běží přesně v režimu A, žádné jiné
chování se nezmění.

V obou režimech: při každém otevření appky se stav okamžitě přepočítá, takže
i bez jediné doručené notifikace zůstanou data konzistentní — jen se o
zmeškané hodině subjekt dozví později, ne v reálném čase.

## Struktura projektu

```
index.html              hlavní shell + šablony obrazovek
css/style.css            design systém (světlý/tmavý režim)
js/storage.js            datová vrstva (localStorage), plán hodinových slotů
js/scheduler.js          notifikace, push subscription, auto-doplnění „Bez reakce“
js/config.js             PUSH_SERVER_URL (prázdné = bez serveru, viz výše)
js/activities.js         katalog aktivit a kategorií
js/icons.js              sada vlastních ikon (inline SVG)
js/stats.js              agregace a přepočet na rok/10 let
js/charts.js             vlastní SVG grafy (bez závislosti na knihovně)
js/app.js                UI a routování obrazovek
sw.js                     service worker (offline cache, klik na notifikaci, Web Push)
manifest.webmanifest      PWA manifest
icons/                    zdrojová SVG + vygenerované PNG ikony
tools/gen-icons.mjs       skript pro přegenerování PNG ikon z SVG (Playwright)
server/                   volitelný Cloudflare Worker pro spolehlivé notifikace na iOS
                          (VAPID Web Push) — viz server/README.md
```

### Přegenerování ikon

```bash
npm install playwright   # nebo použijte globální instalaci
node tools/gen-icons.mjs
```

## Licence

Vytvořeno pro potřeby konkrétního sociologického experimentu.
