// Teste das integrações externas reais no navegador: Crossref, PubMed, consulta de DOI e banco de imagens Wikimedia.
// Roda no GitHub Actions (com internet). Gera evidências em evidence/externas/.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080/';
const OUT = path.join(process.env.EVIDENCE_DIR || 'evidence', 'externas');
fs.mkdirSync(OUT, { recursive: true });
const results = []; let failed = 0;
const step = async (name, fn) => {
  try { const info = await fn(); results.push({ name, ok: true, info }); console.log(`✔ ${name} — ${info}`); }
  catch (e) { failed++; results.push({ name, ok: false, info: e.message.split('\n')[0] }); console.log(`✘ ${name} — ${e.message.split('\n')[0]}`); }
};
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, locale: 'pt-BR' });
await ctx.addInitScript(() => { if (!localStorage.getItem('studio-karina:prefs')) localStorage.setItem('studio-karina:prefs', JSON.stringify({ onboarded: true })); });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(500); };
const refs = () => page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('studio-karina'); r.onsuccess = () => { const q = r.result.transaction('refs').objectStore('refs').getAll(); q.onsuccess = () => ok(q.result); }; }));

await page.goto(BASE); await page.waitForSelector('.hero h1'); await page.waitForTimeout(2500);

await step('Crossref: pesquisa real e salvar artigo', async () => {
  await go('#/ciencia'); await page.fill('#q', 'logotherapy meaning in life'); await page.click('#sf button.btn');
  await page.waitForSelector('#results [data-save]', { timeout: 30000 }); await shot('01-crossref');
  const n = await page.locator('#results [data-save]').count();
  await page.locator('#results [data-save]').first().click(); await page.waitForTimeout(500);
  const r = (await refs()).find((x) => x.source === 'crossref'); if (!r?.title) throw new Error('não salvou');
  return `${n} resultados; salvo: "${r.title.slice(0, 60)}" (${r.year || 's.d.'}${r.doi ? ', DOI ' + r.doi : ''})`;
});
await step('PubMed: pesquisa real e salvar artigo', async () => {
  await page.click('#src [data-src=pubmed]'); await page.fill('#q', 'EMDR posttraumatic stress disorder'); await page.click('#sf button.btn');
  await page.waitForSelector('#results [data-save]', { timeout: 30000 }); await shot('02-pubmed');
  const n = await page.locator('#results [data-save]').count();
  await page.locator('#results [data-save]').first().click(); await page.waitForTimeout(500);
  const r = (await refs()).find((x) => x.source === 'pubmed'); if (!r?.pmid) throw new Error('não salvou');
  return `${n} resultados; salvo PMID ${r.pmid}: "${r.title.slice(0, 60)}"`;
});
await step('Consulta de DOI (Crossref) preenche os dados', async () => {
  const doi = (await refs()).find((x) => x.doi)?.doi; if (!doi) throw new Error('nenhum DOI para consultar');
  await go('#/ciencia'); await page.click('#add'); await page.fill('#doi', doi); await page.click('#fetchdoi');
  await page.waitForFunction(() => document.querySelector('#ti')?.value.length > 3, null, { timeout: 30000 });
  const ti = await page.inputValue('#ti'); await shot('03-doi'); await page.keyboard.press('Escape');
  return `${doi} → "${ti.slice(0, 60)}"`;
});
await step('Bibliografia ABNT gerada com as referências reais', async () => {
  await go('#/ciencia'); await page.click('#bib'); await page.waitForSelector('.sheet .result'); const txt = await page.locator('.sheet .result').innerText(); await shot('04-bibliografia');
  await page.keyboard.press('Escape'); if (!/\d{4}/.test(txt)) throw new Error('sem ano'); return txt.split('\n')[0].slice(0, 120);
});
await step('Banco de imagens Wikimedia: buscar, baixar e registrar licença', async () => {
  await go('#/biblioteca?tab=midia'); await page.click('#add'); await page.click('[data-t=bank]');
  await page.fill('#pane #q', 'flowers'); await page.click('#pane #f button');
  await page.waitForSelector('#pane [data-i]', { timeout: 30000 }); await page.waitForTimeout(1500); await shot('05-wikimedia');
  await page.locator('#pane [data-i]').first().click();
  await page.waitForSelector('.sheet-backdrop', { state: 'detached', timeout: 30000 });
  const a = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('studio-karina'); r.onsuccess = () => { const q = r.result.transaction('assets').objectStore('assets').getAll(); q.onsuccess = () => ok(q.result.map((x) => ({ w: x.w, h: x.h, license: x.license, author: x.author, size: x.blob?.size }))); }; }));
  if (!a.length || !a[0].size) throw new Error('imagem não salva');
  return `${a[0].w}×${a[0].h}, ${(a[0].size / 1024).toFixed(0)} KB, licença: ${a[0].license || '—'}, autor: ${(a[0].author || '—').slice(0, 40)}`;
});
await step('Foto do banco livre numa arte e exportação sem bloqueio (CORS)', async () => {
  const r = await page.evaluate(async () => {
    const { buildPages } = await import('./js/lib/templates.js'); const ui = await import('./js/ui.js'); const { db } = await import('./js/lib/store.js');
    await ui.ensureFonts(); const [asset] = await db.all('assets');
    const pg = buildPages({ phraseId: 'reflexoes-001', layout: 'foto', palette: 'verde', format: 'portrait' }, { mctx: ui.measureCtx() })[0];
    pg.layers.find((l) => l.type === 'image').assetId = asset.id;
    const blob = await ui.exportPage(pg, 'portrait'); return blob ? blob.size : 0;
  });
  if (!r) throw new Error('exportação bloqueada'); return `PNG exportado (${(r / 1024).toFixed(0)} KB)`;
});
await step('Fotos do mês: sugestões renovadas e aplicação na arte', async () => {
  await go('#/rapido?f=story&th=reflexoes'); await page.waitForSelector('#month [data-mp]', { timeout: 30000 }); await shot('06-fotos-do-mes');
  const n = await page.locator('#month [data-mp]').count();
  await page.locator('#month [data-mp]').first().click(); await page.waitForFunction(() => !!sessionStorage.getItem('sk-photo'), null, { timeout: 30000 });
  const cached = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sk-fotos-')));
  return `${n} fotos sugeridas (${cached[0]}); foto aplicada nas artes`;
});
await step('Paisagens reais: posts modernos com foto de lugares lindos', async () => {
  await page.evaluate(() => sessionStorage.clear());
  await go('#/rapido?f=story&th=espiritualidade'); await page.waitForSelector('#land [data-lp]', { timeout: 40000 });
  const n = await page.locator('#land [data-lp]').count();
  await page.locator('#land [data-lp]').first().click(); await page.waitForFunction(() => !!sessionStorage.getItem('sk-paisagem'), null, { timeout: 40000 });
  await page.waitForSelector('#g canvas'); await page.waitForTimeout(3000); await shot('07-paisagens-modernas');
  return `${n} paisagens sugeridas; arte moderna com paisagem aplicada`;
});
await step('Sem erros de JavaScript', async () => { if (errors.length) throw new Error(errors[0]); return '0 erros'; });
await browser.close();
fs.writeFileSync(path.join(OUT, 'relatorio-externas.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} integrações externas aprovadas`);
process.exit(failed ? 1 : 0);
