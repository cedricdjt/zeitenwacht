// Rauchtest des ganzen Spiels im Headless-Chrome: lädt die Seite, lässt den Selbstspieler eine Partie spielen,
// rechnet sie im Zeitraffer vor und macht unterwegs Screenshots. Meldet Konsolenfehler und den Spielstand.
// Aufruf: node tools/smoke.mjs [--url http://127.0.0.1:8317/] [--map flusstal] [--difficulty normal] [--out <ordner>]
//                              [--waves 36] [--gpu] [--w 1280] [--h 800] [--quality medium]
// Exit-Code 0 = keine Fehler der Seite, 2 = Fehler der Seite, 1 = Aufruf- oder Ladefehler.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** @type {Record<string, any>} */
const opt = { url: 'http://127.0.0.1:8317/', map: 'flusstal', difficulty: 'normal', out: '', waves: 36, gpu: false, w: 1280, h: 800, quality: 'medium', seed: 7 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--gpu') opt.gpu = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i];
}
const CANDIDATES = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = CANDIDATES.find((p) => p && existsSync(p));
if (!executablePath) {
  console.error('Kein Chrome/Chromium gefunden. CHROME_PATH setzen.');
  process.exit(1);
}
if (opt.out) mkdirSync(opt.out, { recursive: true });

const glArgs = opt.gpu ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--mute-audio', ...glArgs] });
let errors = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(opt.w), height: Number(opt.h), deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    const type = String(msg.type());
    if (type === 'error') {
      errors++;
      console.error(`[seite fehler] ${msg.text()}`);
    } else if (type === 'warning' || type === 'warn') {
      console.error(`[seite warnung] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors++;
    console.error(`[seite ausnahme] ${err instanceof Error && err.stack ? err.stack : err}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      errors++;
      console.error(`[seite http ${res.status()}] ${res.url()}`);
    }
  });
  const url = `${opt.url}?auto=${opt.map}&difficulty=${opt.difficulty}&seed=${opt.seed}&bot=1&unlock=1&quality=${opt.quality}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });

  /** @param {string} name */
  const shot = async (name) => {
    if (!opt.out) return;
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: join(opt.out, `${name}.png`), type: 'png' });
  };
  const summary = () =>
    page.evaluate(() => {
      const g = /** @type {any} */ (window).__game;
      const s = g.sim ? g.sim.state : null;
      return s ? { mode: g.mode, phase: s.phase, wave: s.wave, age: s.age, gold: s.gold, lives: s.lives, towers: s.towers.length, enemies: s.enemies.length, score: s.score, time: Math.round(s.time), info: g.stage.info } : { mode: g.mode };
    });

  await shot('00-start');
  let lastAge = -1;
  const target = Number(opt.waves);
  for (let i = 0; i < 400; i++) {
    // 20 simulierte Sekunden je Runde im Zeitraffer, dazwischen ein paar echte Bilder.
    await page.evaluate(() => /** @type {any} */ (window).__game.skip(20));
    await new Promise((r) => setTimeout(r, 120));
    const s = await summary();
    if (s.age !== undefined && s.age !== lastAge) {
      lastAge = s.age;
      console.log(`Zeitalter ${s.age}: ${JSON.stringify(s)}`);
      await page.evaluate(() => /** @type {any} */ (window).__game.skip(8));
      await shot(`age${s.age}-welle${s.wave}`);
    }
    if (s.mode !== 'playing' || (s.wave ?? 0) >= target) break;
  }
  const end = await summary();
  console.log(`Ende: ${JSON.stringify(end)}`);
  await shot('99-ende');
} finally {
  await browser.close();
}
process.exit(errors ? 2 : 0);
