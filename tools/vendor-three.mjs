// Kopiert three.js und die benötigten Addons aus node_modules nach vendor/three,
// damit das Spiel ohne Build-Schritt und ohne Internet im Browser läuft.
// Aufruf: node tools/vendor-three.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/three');
const out = join(root, 'vendor/three');
const jsm = join(src, 'examples/jsm');

/** Einstiegspunkte der Addons, die das Spiel verwendet. */
const ADDONS = [
  'controls/OrbitControls.js',
  'utils/BufferGeometryUtils.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'addons'), { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) copyFileSync(join(src, 'build', f), join(out, f));
copyFileSync(join(src, 'LICENSE'), join(out, 'LICENSE'));

const seen = new Set();
const queue = ADDONS.map((a) => join(jsm, a));
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  const target = join(out, 'addons', relative(jsm, file));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, code);
  for (const m of code.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(resolve(dirname(file), m[1]));
  for (const m of code.matchAll(/import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(resolve(dirname(file), m[1]));
}
const version = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version;
writeFileSync(join(out, 'VERSION'), version + '\n');
console.log(`three ${version}: ${seen.size} Addon-Dateien nach vendor/three kopiert`);
for (const f of [...seen].sort()) console.log('  addons/' + relative(jsm, f));
