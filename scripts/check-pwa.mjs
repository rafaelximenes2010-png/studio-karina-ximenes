// Verificações estáticas do PWA: manifesto, ícones (dimensões reais), referências e service worker.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errs = []; const ok = (m) => console.log('✔', m); const fail = (m) => { errs.push(m); console.log('✘', m); };
const strip = (u) => u.replace(/^\.\//, '').split('?')[0];
const pngSize = (f) => { const b = fs.readFileSync(f); if (b.toString('ascii', 1, 4) !== 'PNG') return null; return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'theme_color', 'background_color']) (m[k] ? ok : fail)(`manifesto: ${k}`);
const need = { '192x192:any': 0, '512x512:any': 0, '512x512:maskable': 0 };
for (const ic of m.icons) {
  const f = path.join(root, strip(ic.src));
  if (!fs.existsSync(f)) { fail(`ícone ausente ${ic.src}`); continue; }
  const s = pngSize(f); const [w, h] = ic.sizes.split('x').map(Number);
  if (!s || s[0] !== w || s[1] !== h) fail(`ícone ${ic.src} declarado ${ic.sizes} mas é ${s}`); else ok(`ícone ${ic.src} ${ic.sizes} (${ic.purpose})`);
  need[`${ic.sizes}:${ic.purpose}`] = 1;
}
for (const [k, v] of Object.entries(need)) (v ? ok : fail)(`manifesto contém ${k}`);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const touch = html.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/);
if (!touch) fail('apple-touch-icon ausente'); else { const s = pngSize(path.join(root, strip(touch[1]))); (s && s[0] === 180 && s[1] === 180 ? ok : fail)(`apple-touch-icon 180×180 (${touch[1]})`); }
for (const [, u] of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) { const f = path.join(root, strip(u)); (fs.existsSync(f) ? ok : fail)(`referência ${u}`); }
if (/<script(?![^>]*src=)[^>]*>[^<]+<\/script>/.test(html)) fail('script inline encontrado (CSP bloqueia)'); else ok('sem scripts inline (CSP)');
if (/href="https?:\/\//.test(html.replace(/<meta[^>]+>/g, ''))) fail('recurso externo no index.html'); else ok('sem recursos externos no shell');

// Prévia de link (WhatsApp): og:image absoluta, existente, 1200×630, leve
for (const page of ['index.html', 'instalar.html']) {
  const h = fs.readFileSync(path.join(root, page), 'utf8');
  const og = h.match(/property="og:image" content="([^"]+)"/);
  if (!og) { fail(`${page}: sem og:image`); continue; }
  if (!/^https:\/\//.test(og[1])) fail(`${page}: og:image precisa ser endereço absoluto https`);
  const f = path.join(root, og[1].replace(/^https:\/\/[^/]+\/studio-karina-ximenes\//, '').split('?')[0]);
  if (!fs.existsSync(f)) { fail(`${page}: og:image inexistente`); continue; }
  const b = fs.readFileSync(f); let w = 0, hh = 0;
  for (let i = 2; i < b.length;) { if (b[i] !== 0xff) break; const m = b[i + 1]; const len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) { hh = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; } i += 2 + len; }
  ((w === 1200 && hh === 630 && b.length < 300000) ? ok : fail)(`${page}: og:image ${w}×${hh}, ${(b.length / 1024).toFixed(0)} KB (WhatsApp)`);
  for (const k of ['og:title', 'og:description', 'og:url']) (h.includes(`property="${k}"`) ? ok : fail)(`${page}: ${k}`);
  for (const [, u] of h.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) { if (u === './') continue; (fs.existsSync(path.join(root, strip(u))) ? null : fail(`${page}: referência quebrada ${u}`)); }
}
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const core = JSON.parse(sw.match(/const CORE = (\[[\s\S]*?\]);/)[1]);
for (const u of core) { if (u === './') continue; (fs.existsSync(path.join(root, strip(u))) ? null : fail(`sw: arquivo inexistente no cache ${u}`)); }
ok(`service worker pré-cacheia ${core.length} arquivos`);
const ver = sw.match(/VERSION = '([^']+)'/)[1];
const appVer = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
(ver === appVer ? ok : fail)(`versão do SW (${ver}) = versão do app (${appVer})`);
// todo arquivo JS/CSS/asset do app deve estar no cache offline
for (const d of ['js', 'css', 'assets']) {
  const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(p, e.name)) : [path.join(p, e.name)]));
  for (const f of walk(path.join(root, d))) { if (f.endsWith('.txt')) continue; const rel = './' + path.relative(root, f); if (!core.includes(rel)) fail(`sw: ${rel} fora do cache offline`); }
}
if (errs.length) { console.error(`\n${errs.length} problema(s).`); process.exit(1); }
console.log('\nPWA OK');
