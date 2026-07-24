// Rasterizes icons/*.svg -> icons/*.png using headless Chromium (no ImageMagick/PIL available).
// Run: node tools/gen-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'icons');

const jobs = [
  { src: 'icon-source.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon-source.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-source-maskable.svg', out: 'icon-maskable-192.png', size: 192 },
  { src: 'icon-source-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
  { src: 'icon-source.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'icon-source.svg', out: 'favicon-32.png', size: 32 },
  { src: 'badge-source.svg', out: 'badge-72.png', size: 72, transparent: true },
];

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const job of jobs) {
    const svg = readFileSync(path.join(ICONS_DIR, job.src), 'utf8');
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:${job.transparent ? 'transparent' : 'none'};}
      svg{display:block;width:${job.size}px;height:${job.size}px;}
    </style></head><body>${svg}</body></html>`;
    await page.setViewportSize({ width: job.size, height: job.size });
    await page.setContent(html);
    const el = await page.$('svg');
    await el.screenshot({ path: path.join(ICONS_DIR, job.out), omitBackground: !!job.transparent });
    console.log('wrote', job.out);
  }
  await browser.close();
};

run();
