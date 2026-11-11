// Screenshot-Werkzeug für die Entwicklung: rendert eine Seite im Headless-Chrome und speichert ein PNG.
// Aufruf: node tools/shot.mjs <url> <ausgabe.png> [--w 1280] [--h 800] [--wait 1500] [--ready] [--eval "js"] [--gpu] [--scale 1]
//   --ready   wartet, bis window.__ready === true ist (max. 30 s), danach zusätzlich --wait Millisekunden
//   --eval    JavaScript, das vor dem Screenshot in der Seite ausgeführt wird (darf ein Promise liefern); Ergebnis wird ausgegeben
//   --gpu     echte GPU statt Software-Rendering (SwiftShader) versuchen
// Konsolenfehler der Seite werden auf stderr ausgegeben; Exit-Code 2, wenn es welche gab.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const positional = [];
/** @type {Record<string, any>} */
const opt = { w: 1280, h: 800, wait: 1500, ready: false, eval: '', gpu: false, scale: 1 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--ready') opt.ready = true;
  else if (a === '--gpu') opt.gpu = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i];
  else positional.push(a);
}
const [url, outFile] = positional;
if (!url || !outFile) {
  console.error('Aufruf: node tools/shot.mjs <url> <ausgabe.png> [--w 1280] [--h 800] [--wait 1500] [--ready] [--eval "js"] [--gpu]');
  process.exit(1);
}

const CANDIDATES = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = CANDIDATES.find((p) => p && existsSync(p));
if (!executablePath) {
  console.error('Kein Chrome/Chromium gefunden. CHROME_PATH setzen.');
  process.exit(1);
}

const glArgs = opt.gpu
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', ...glArgs],
});
let errors = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(opt.w), height: Number(opt.h), deviceScaleFactor: Number(opt.scale) });
  page.on('console', (msg) => {
    const type = String(msg.type());
    if (type === 'error' || type === 'warning' || type === 'warn') {
      if (type === 'error') errors++;
      console.error(`[seite ${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => { errors++; console.error(`[seite ausnahme] ${err instanceof Error && err.stack ? err.stack : err}`); });
  page.on('requestfailed', (req) => { errors++; console.error(`[seite ladefehler] ${req.url()} ${req.failure()?.errorText ?? ''}`); });
  page.on('response', (res) => { if (res.status() >= 400) { errors++; console.error(`[seite http ${res.status()}] ${res.url()}`); } });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  if (opt.ready) await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  if (opt.eval) {
    const result = await page.evaluate(`(async () => { ${opt.eval} })()`);
    if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result));
  }
  await new Promise((r) => setTimeout(r, Number(opt.wait)));
  await page.screenshot({ path: outFile, type: 'png' });
  console.log(`gespeichert: ${outFile}`);
} finally {
  await browser.close();
}
process.exit(errors ? 2 : 0);
