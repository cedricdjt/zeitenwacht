// Baut das Spiel zu EINER HTML-Datei zusammen, die sich per Doppelklick öffnen lässt (auch ohne Webserver und Internet).
// Aufruf: node tools/build-standalone.mjs [eingabe.html] [ausgabe.html]
//   Standard: index.html -> dist/zeitenwacht.html
// Alle <script type="module" src="..."> werden mit esbuild gebündelt und eingebettet,
// alle <link rel="stylesheet" href="..."> werden als <style> eingebettet, die Import-Map entfällt.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, process.argv[2] ?? 'index.html');
const output = resolve(root, process.argv[3] ?? 'dist/zeitenwacht.html');
const inputDir = dirname(input);

let html = readFileSync(input, 'utf8');

/** Löst die Einträge der Import-Map auf die mitgelieferten three.js-Dateien auf. */
const vendorPlugin = {
  name: 'vendor-three',
  /** @param {import('esbuild').PluginBuild} b */
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(root, 'vendor/three/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (args) => ({ path: join(root, 'vendor/three/addons', args.path.slice('three/addons/'.length)) }));
  },
};

// Stylesheets einbetten.
html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (_all, href) => {
  const css = readFileSync(resolve(inputDir, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// Import-Map entfernen (im Bündel ist alles aufgelöst).
html = html.replace(/<script\s+type="importmap">[\s\S]*?<\/script>\s*/g, '');

// Modul-Skripte bündeln und einbetten.
const scriptPattern = /<script\s+type="module"\s+src="([^"]+)"\s*><\/script>/g;
const entries = [...html.matchAll(scriptPattern)].map((m) => m[1]);
if (entries.length === 0) throw new Error(`Kein <script type="module" src="..."> in ${input} gefunden`);
/** @type {Map<string, string>} */
const bundles = new Map();
for (const entry of entries) {
  const result = await build({
    entryPoints: [resolve(inputDir, entry)],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    write: false,
    plugins: [vendorPlugin],
    logLevel: 'warning',
  });
  bundles.set(entry, result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
}
html = html.replace(scriptPattern, (_all, src) => `<script type="module">\n${bundles.get(src)}</script>`);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`gebaut: ${output} (${kb} kB)`);
