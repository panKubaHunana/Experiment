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
  prohlížeče — žádný server, žádný účet, žádný upload. Data lze kdykoli
  exportovat jako JSON tlačítkem „Export dat“.

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

## Spolehlivost notifikací — důležité omezení

Aplikace **nemá backend ani push server** — notifikace generuje přímo
stránka/service worker přes `Notification.showNotification()`, dokud je
aplikace (nebo její service worker) aktivní. To znamená:

- Pokud je PWA nainstalovaná a telefon ji nedostane agresivně uspat na
  pozadí, hodinové notifikace i automatické doplnění „Bez reakce“ fungují
  spolehlivě po celý týden.
- Na Androidu doporučte subjektu v nastavení baterie povolit aplikaci
  neomezený běh na pozadí („Unrestricted battery usage“), jinak může OS
  service worker mezi hodinami ukončit.
- Při každém otevření aplikace se stav okamžitě přepočítá (dohledají se
  zmeškané hodiny a doplní se „Bez reakce“ se správným původním časem), takže
  data nikdy nejsou nekonzistentní — i kdyby notifikace nedorazila.
- Pro produkční nasazení na více subjektů s garantovaným doručením i při
  zavřené aplikaci by bylo potřeba doplnit Web Push server (VAPID) — mimo
  rozsah této čistě klientské aplikace.

## Struktura projektu

```
index.html              hlavní shell + šablony obrazovek
css/style.css            design systém (světlý/tmavý režim)
js/storage.js            datová vrstva (localStorage), plán hodinových slotů
js/scheduler.js          notifikace, auto-doplnění „Bez reakce“
js/activities.js         katalog aktivit a kategorií
js/icons.js              sada vlastních ikon (inline SVG)
js/stats.js              agregace a přepočet na rok/10 let
js/charts.js             vlastní SVG grafy (bez závislosti na knihovně)
js/app.js                UI a routování obrazovek
sw.js                     service worker (offline cache + klik na notifikaci)
manifest.webmanifest      PWA manifest
icons/                    zdrojová SVG + vygenerované PNG ikony
tools/gen-icons.mjs       skript pro přegenerování PNG ikon z SVG (Playwright)
```

### Přegenerování ikon

```bash
npm install playwright   # nebo použijte globální instalaci
node tools/gen-icons.mjs
```

## Licence

Vytvořeno pro potřeby konkrétního sociologického experimentu.
