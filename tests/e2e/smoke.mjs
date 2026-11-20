// Teste de ponta a ponta (navegador real). Uso: servir o app em BASE_URL e rodar `node tests/e2e/smoke.mjs`.
// Gera evidências (screenshots) em evidence/ e falha se qualquer fluxo principal quebrar.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080/';
const OUT = process.env.EVIDENCE_DIR || 'evidence';
fs.mkdirSync(OUT, { recursive: true });
const results = []; let failed = 0;
const step = async (name, fn) => {
  const t0 = Date.now();
  try { const info = await fn(); results.push({ name, ok: true, ms: Date.now() - t0, info: info || '' }); console.log(`✔ ${name}${info ? ' — ' + info : ''}`); }
  catch (e) { failed++; results.push({ name, ok: false, ms: Date.now() - t0, info: e.message.split('\n')[0] }); console.log(`✘ ${name} — ${e.message.split('\n')[0]}`); }
};
const pngDims = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Recife' });
// tutorial de primeiro acesso: verificado à parte; aqui marcamos como visto para não cobrir a tela
await ctx.addInitScript(() => { const k = 'studio-karina:prefs'; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ onboarded: true })); });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
const closeSheets = async () => { for (let i = 0; i < 5 && await page.locator('.sheet-backdrop').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } };
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(400); await closeSheets(); };

await step('Abertura com logomarca e tela inicial', async () => {
  await page.goto(BASE);
  await page.waitForSelector('#opening img'); await page.waitForTimeout(400); await shot('01-abertura');
  await page.waitForSelector('#opening', { state: 'detached', timeout: 6000 });
  await closeSheets(); // tutorial do primeiro acesso
  await page.waitForSelector('.hero h1'); await page.waitForTimeout(800); await shot('02-inicio');
  return await page.locator('.hero h1').innerText();
});
await step('Ícones e manifesto publicados', async () => {
  const r = await page.evaluate(async () => {
    const m = await (await fetch('./manifest.webmanifest')).json();
    const touch = document.querySelector('link[rel=apple-touch-icon]').href;
    const sz = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('erro'); i.src = u; });
    return { touch: await sz(touch), icons: await Promise.all(m.icons.map((i) => sz(new URL(i.src, location.href).href))) };
  });
  if (r.touch !== '180x180') throw new Error('apple-touch-icon ' + r.touch);
  if (r.icons.some((x) => x === 'erro')) throw new Error('ícone quebrado');
  return `apple-touch ${r.touch}; manifest ${r.icons.join(', ')}`;
});
await step('Programação automática criou publicações', async () => {
  await page.waitForTimeout(1500);
  const n = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('studio-karina'); r.onsuccess = () => { const q = r.result.transaction('posts').objectStore('posts').count(); q.onsuccess = () => ok(q.result); }; }));
  if (n < 20) throw new Error('apenas ' + n);
  return `${n} publicações programadas`;
});
await step('Navegação inferior (5 abas)', async () => {
  for (const k of ['criar', 'biblioteca', 'agenda', 'perfil', 'inicio']) { await page.click(`.bottomnav a[data-nav=${k}]`); await page.waitForTimeout(350); if ((await page.getAttribute(`.bottomnav a[data-nav=${k}]`, 'aria-current')) !== 'page') throw new Error(k); }
  return 'ok';
});
await step('Biblioteca de artes prontas', async () => {
  await go('#/biblioteca'); await page.waitForTimeout(1500); await shot('03-biblioteca');
  const c = await page.locator('#count').innerText(); return c;
});
await step('Filtro por tema (Fé cristã)', async () => {
  await page.click('#cats [data-cat=espiritualidade]'); await page.waitForTimeout(1200); await shot('04-biblioteca-fe');
  return await page.locator('#count').innerText();
});
await step('Prévia com variações e abrir no editor', async () => {
  await page.locator('#grid .art').first().click(); await page.waitForSelector('#big'); await page.waitForTimeout(1200); await shot('05-previa');
  await page.click('#fm [data-f=story]'); await page.waitForTimeout(800); await shot('06-previa-story');
  await page.click('#edit'); await page.waitForSelector('.ed canvas#cv'); await page.waitForTimeout(1200); await shot('07-editor');
  return page.url().split('#')[1];
});
let projectId;
await step('Editor: adicionar texto, editar, desfazer/refazer', async () => {
  projectId = page.url().split('/editor/')[1];
  const before = await page.evaluate(() => document.querySelectorAll('.ed-pages .pg').length);
  await page.click('[data-tool=text]'); await page.waitForSelector('#p-text');
  await page.fill('#p-text', 'Teste automatizado do Studio'); await page.locator('#p-text').dispatchEvent('change'); await page.waitForTimeout(300);
  await shot('08-editor-texto');
  await page.click('#e-undo'); await page.waitForTimeout(200); await page.click('#e-redo'); await page.waitForTimeout(200);
  return `páginas: ${before}`;
});
await step('Editor: fundo, camadas e formato', async () => {
  if (await page.locator('[data-a=close]').count()) await page.click('[data-a=close]');
  await page.click('[data-tool=bg]'); await page.click('[data-pal=verde]'); await page.waitForTimeout(400); await shot('09-editor-fundo');
  await page.click('[data-tool=layers]'); await page.waitForTimeout(300);
  const layers = await page.locator('#props [data-pick]').count();
  await page.click('[data-tool=format]'); await page.click('[data-fmt=square]'); await page.waitForTimeout(600); await shot('10-editor-quadrado');
  return `${layers} camadas`;
});
await step('Editor: arrastar camada (toque/mouse)', async () => {
  const box = await page.locator('#cv').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  return 'ok';
});
await step('Exportar PNG em alta resolução', async () => {
  await page.click('#e-export'); await page.waitForSelector('[data-x=png]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-x=png]')]);
  const f = path.join(OUT, 'export-quadrado.png'); await dl.saveAs(f);
  const [w, h] = pngDims(fs.readFileSync(f)); if (w !== 1080 || h !== 1080) throw new Error(`${w}x${h}`);
  return `${w}×${h}, ${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
});
await step('Exportar PDF', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-x=pdf]')]);
  const f = path.join(OUT, 'export.pdf'); await dl.saveAs(f);
  const s = fs.readFileSync(f).toString('latin1', 0, 8); if (!s.startsWith('%PDF')) throw new Error('não é PDF');
  await closeSheets(); return `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
});
await step('Persistência: recarregar e reabrir projeto', async () => {
  await page.click('#e-back'); await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(1500); await closeSheets();
  await go('#/criar'); await page.waitForTimeout(800);
  const has = await page.locator(`a[href="#/editor/${projectId}"]`).count(); if (!has) throw new Error('projeto sumiu');
  await page.locator(`a[href="#/editor/${projectId}"]`).first().click(); await page.waitForSelector('#cv'); await page.waitForTimeout(800);
  const fmt = await page.evaluate(() => document.querySelector('.ed-pages').innerText); await shot('11-reaberto');
  if (!/1080×1080/.test(fmt)) {
    const all = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('studio-karina'); r.onsuccess = () => { const q = r.result.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => ok(q.result.map((x) => `${x.id}:${x.format}:${x.pages[0].layers.length}:${new Date(x.updatedAt).toISOString().slice(11, 23)}`)); }; }));
    throw new Error('formato não persistiu: ' + fmt + ' | esperado ' + projectId + ' | banco: ' + all.join(', '));
  }
  await page.click('#e-back'); return 'formato quadrado e edições mantidos';
});
await step('Exportação idêntica à prévia (comparação de pixels)', async () => {
  const r = await page.evaluate(async () => {
    const { buildPages } = await import('./js/lib/templates.js'); const { renderPage, FORMATS } = await import('./js/lib/render.js');
    const ui = await import('./js/ui.js'); await ui.ensureFonts();
    const spec = { phraseId: 'logoterapia-020', layout: 'editorial', palette: 'verde', format: 'portrait' };
    const pg = buildPages(spec, { mctx: ui.measureCtx() })[0];
    const blob = await ui.exportPage(pg, 'portrait');
    const bmp = await createImageBitmap(blob);
    const a = document.createElement('canvas'); a.width = 270; a.height = 337; a.getContext('2d').drawImage(bmp, 0, 0, 270, 337);
    const b = document.createElement('canvas'); b.width = 270; b.height = 337;
    renderPage(b.getContext('2d'), pg, { W: 1080, H: 1350, scale: 0.25, logo: await ui.getLogo(), images: new Map(), stamp: true });
    const da = a.getContext('2d').getImageData(0, 0, 270, 337).data, db2 = b.getContext('2d').getImageData(0, 0, 270, 337).data;
    let s = 0; for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db2[i]) + Math.abs(da[i + 1] - db2[i + 1]) + Math.abs(da[i + 2] - db2[i + 2]);
    return { diff: s / (da.length / 4) / 3, w: bmp.width, h: bmp.height };
  });
  if (r.diff > 6) throw new Error('diferença média ' + r.diff.toFixed(2));
  return `export ${r.w}×${r.h}; diferença média prévia×exportação ${r.diff.toFixed(2)}/255`;
});
await step('Agenda: mês, lista e semana temática', async () => {
  await go('#/agenda'); await page.waitForTimeout(1200); await shot('12-agenda-mes');
  await page.click('[data-mode=lista]'); await page.waitForTimeout(800); await shot('13-agenda-lista');
  await page.click('#week'); await page.waitForSelector('#pv'); await page.click('#cats [data-cat=espiritualidade]'); await page.waitForTimeout(1200); await shot('14-semana-tematica');
  const label = await page.locator('#go').innerText(); await page.click('#go'); await page.waitForTimeout(500);
  if (await page.locator('[data-yes]').count()) { await page.click('[data-yes]'); await page.waitForTimeout(800); }
  const n = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('studio-karina'); r.onsuccess = () => { const q = r.result.transaction('posts').objectStore('posts').getAll(); q.onsuccess = () => ok(q.result.filter((p) => p.theme).length); }; }));
  if (n < 5) throw new Error('semana não programada: ' + n);
  return label;
});
await step('Frankie: modo assistido e minhas reflexões', async () => {
  await page.click('#frank-fab'); await page.waitForSelector('.frank-head'); await shot('15-frankie');
  await page.click('[data-task=titulos]'); await page.fill('#in', 'sentido da vida'); await page.click('#go'); await page.waitForSelector('#res');
  const txt = await page.inputValue('#res'); if (!/sentido da vida/.test(txt)) throw new Error('sem resultado');
  await page.fill('#mytx', 'Mesmo nos dias nublados, a graça sustenta o próximo passo.'); await page.selectOption('#mycat', 'espiritualidade'); await page.click('#mysave'); await page.waitForTimeout(900);
  await shot('16-minhas-reflexoes');
  const n = await page.locator('#mylist [data-my]').count(); if (n < 1) throw new Error('reflexão não salva');
  return 'títulos gerados; reflexão salva e programada';
});
await step('Documento: artigo → Word (.docx) válido', async () => {
  await go('#/documentos'); await page.click('[data-kind=artigo]'); await page.waitForSelector('#blocks'); await page.waitForTimeout(400);
  await page.locator('#blocks textarea').nth(1).fill('Texto de teste com **destaque** e referência.'); await page.waitForTimeout(700); await shot('17-documento');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#docx')]);
  const f = path.join(OUT, 'documento.docx'); await dl.saveAs(f);
  const out = execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(len(z.namelist()))`, f]).toString().trim();
  return `${out} partes no .docx`;
});
await step('Ciência: tela e cadastro manual de referência', async () => {
  await go('#/ciencia'); await page.waitForTimeout(500);
  await page.click('#add'); await page.fill('#au', 'Frankl, Viktor E.'); await page.fill('#ti', "Man's search for meaning"); await page.fill('#ye', '1959'); await page.selectOption('#ty', 'book'); await page.fill('#pu', 'Beacon Press');
  await page.click('#sv'); await page.waitForTimeout(700); await shot('18-ciencia');
  return await page.locator('#mine').innerText();
});
await step('Perfil: identidade, privacidade e diagnóstico', async () => {
  await go('#/perfil/marca'); await page.waitForTimeout(600); await shot('19-identidade');
  await go('#/perfil/privacidade'); await page.waitForTimeout(400); await shot('20-privacidade');
  await go('#/perfil/admin'); await page.waitForSelector('#diag .row', { timeout: 8000 }); await page.waitForTimeout(400); await shot('21-diagnostico');
  return (await page.locator('#diag').innerText()).replace(/\n/g, ' | ');
});
await step('Idioma inglês e tema escuro', async () => {
  await go('#/perfil/ajustes'); await page.selectOption('#lg', 'en'); await page.click('#th [data-th=dark]'); await page.click('#sv'); await page.waitForTimeout(600);
  await go('#/'); await page.waitForTimeout(900); await shot('22-ingles-escuro');
  const nav = await page.locator('.bottomnav').innerText(); if (!/Home/.test(nav)) throw new Error(nav);
  await go('#/perfil/ajustes'); await page.selectOption('#lg', 'pt'); await page.click('#th [data-th=light]'); await page.click('#sv'); await page.waitForTimeout(400);
  return nav.replace(/\n/g, ' ');
});
await step('Acesso por PIN', async () => {
  await page.evaluate(async () => { const m = await import('./js/modules/lock.js'); await m.setPin('2468'); });
  const p2 = await ctx.newPage(); await p2.goto(BASE); await p2.waitForSelector('#lock #pin');
  await p2.fill('#pin', '1111'); await p2.click('#lock .btn.block'); await p2.waitForTimeout(500);
  const err = await p2.locator('#err').innerText();
  await p2.screenshot({ path: path.join(OUT, '23-pin.png') });
  await p2.fill('#pin', '2468'); await p2.click('#lock .btn.block'); await p2.waitForSelector('#lock', { state: 'detached' });
  await p2.evaluate(async () => (await import('./js/modules/lock.js')).clearPin()); await p2.close();
  return `PIN errado: "${err}"; PIN certo: desbloqueado`;
});
await step('Offline: service worker serve o app sem rede', async () => {
  if (!BASE.startsWith('http://127.0.0.1') && !BASE.startsWith('http://localhost') && !BASE.startsWith('https')) return 'pulado';
  await page.goto(BASE); await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 });
  await page.waitForTimeout(1500); await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.hero h1', { timeout: 8000 }); await ctx.setOffline(false);
  return 'app abriu offline';
});
await step('Tutorial de primeiro acesso', async () => {
  const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } }); await p3.goto(BASE);
  await p3.waitForSelector('#tut h2', { timeout: 8000 }); const ti = await p3.locator('#tut h2').innerText();
  await p3.screenshot({ path: path.join(OUT, '24-tutorial.png') }); await p3.close(); return ti;
});
await step('Link do WhatsApp: prévia com a logomarca e instalação no iPhone', async () => {
  const p4 = await ctx.newPage(); await p4.goto(BASE + 'instalar.html'); await p4.waitForSelector('#ios:not([hidden])');
  const r = await p4.evaluate(async () => {
    const og = document.querySelector('meta[property="og:image"]').content;
    const local = new URL(og.replace(/^https:\/\/[^/]+\/studio-karina-ximenes\//, './'), location.href).href;
    const sz = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth + '×' + i.naturalHeight); i.onerror = () => ok('erro'); i.src = local; });
    return { og: sz, title: document.querySelector('meta[property="og:title"]').content, wa: document.getElementById('share').href.startsWith('https://wa.me/'), logo: document.querySelector('.logo').naturalWidth };
  });
  await p4.screenshot({ path: path.join(OUT, '25-instalar-iphone.png') }); await p4.close();
  if (r.og !== '1200×630' || !r.wa || r.logo < 180) throw new Error(JSON.stringify(r));
  return `prévia ${r.og} "${r.title}"; passo a passo iPhone; botão WhatsApp`;
});
await step('Sem erros de JavaScript', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' || ')); return '0 erros'; });

await browser.close();
fs.writeFileSync(path.join(OUT, 'relatorio-e2e.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} etapas aprovadas`);
process.exit(failed ? 1 : 0);
