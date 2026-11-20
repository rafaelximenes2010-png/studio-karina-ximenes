// Captura as telas do tutorial (iPhone) e registra a posição de cada seta. Uso: node scripts/capture_tutorial.mjs
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080/';
const OUT = process.env.OUT || '/tmp/vid/shots'; fs.mkdirSync(OUT, { recursive: true });
const PHOTO = process.env.PHOTO || '/tmp/vid/foto-exemplo.jpg';
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'pt-BR' });
await ctx.addInitScript(() => { if (!localStorage.getItem('studio-karina:prefs')) localStorage.setItem('studio-karina:prefs', JSON.stringify({ onboarded: true, autoPlan: false })); sessionStorage.setItem('sk-opened', '1'); });
const p = await ctx.newPage();
const meta = [];
const go = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(900); };
const shot = async (name, sel, caption) => {
  await p.waitForTimeout(500);
  let box = null;
  if (sel) { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); box = await el.boundingBox(); }
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
  meta.push({ name, box, caption });
};
await p.goto(BASE + '#/'); await p.waitForTimeout(2500);
await p.evaluate(() => { sessionStorage.removeItem('sk-photo'); sessionStorage.setItem('sk-colors', 'todas'); });
// 1 · Em 3 passos
await shot('00-inicio', '.hero .btn', 'Na tela inicial, toque em Criar Story ou Criar Feed');
await go('#/rapido'); await shot('11-formato', '#fmts [data-fmt=story]', 'Passo 1 · Escolha onde vai postar');
await go('#/rapido?f=story'); await shot('12-assunto', '[data-th=logoterapia]', 'Passo 2 · Escolha o assunto');
await go('#/rapido?f=story&th=logoterapia'); await p.waitForTimeout(1200); await shot('13-arte', '#g .art', 'Passo 3 · Toque na arte que gostou');
await p.locator('#g .art').first().click(); await p.waitForSelector('#ig:not([disabled])'); await p.waitForTimeout(700); await shot('14-postar', '#ig', 'Postar no Instagram: a legenda já vai copiada');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
// 2 · Com sua frase
await go('#/rapido?f=feed'); await p.fill('#own', 'Recomeçar também é um ato de fé.'); await shot('21-frase', '#gotxt', 'Escreva a sua frase e toque em Criar');
await p.click('#gotxt'); await p.waitForTimeout(1500); await p.evaluate(() => sessionStorage.setItem('sk-colors', 'alegres')); await go('#/rapido?f=feed&txt=' + encodeURIComponent('Recomeçar também é um ato de fé.')); await p.waitForTimeout(1200);
await shot('22-frase-artes', '#g .art', 'Várias artes com a sua frase, em cores alegres');
// 3 · Com sua foto
await p.evaluate(() => sessionStorage.setItem('sk-colors', 'todas'));
await go('#/rapido?f=story&th=reflexoes'); await shot('31-mais-foto', '#ph [data-add]', 'Toque em + para usar uma foto sua');
await p.click('#ph [data-add]'); await p.waitForSelector('#pick');
const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pick')]); await fc.setFiles(PHOTO);
await p.waitForTimeout(2500); await shot('32-com-foto', '#g .art', 'Pronto: a sua foto com frases e a sua logo');
await p.locator('#g .art').first().click(); await p.waitForSelector('#ig:not([disabled])'); await p.waitForTimeout(700); await shot('33-postar-foto', '#ig', 'Toque em Postar e escolha Story');
// 4 · Criação livre (Ajustar) — arte sem foto para a troca de cores aparecer
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(() => sessionStorage.removeItem('sk-photo')); await go('#/rapido?f=story&th=espiritualidade'); await p.waitForTimeout(1200);
await p.locator('#g .art').nth(1).click(); await p.waitForSelector('#ig:not([disabled])'); await p.waitForTimeout(500);
await p.click('#edit'); await p.waitForSelector('#cv'); await p.waitForTimeout(1200);
await p.click('[data-tool=text]'); await p.waitForTimeout(500); await shot('41-texto', '#p-text', 'Ajustar: mude o texto com o dedo');
await p.click('[data-tool=colors]'); await p.waitForTimeout(500); await shot('42-cores', '[data-pal=lilas]', 'Troque as cores com um toque');
await p.click('[data-pal=lilas]'); await p.waitForTimeout(600); await shot('43-cores-aplicada', '#cv', 'Veja na hora como fica');
await p.click('[data-tool=fmtquick]'); await p.waitForTimeout(500); await shot('44-formato', '[data-fmt=portrait]', 'Story ou Feed: mude o formato quando quiser');
await p.click('[data-tool=fmtquick]'); await p.waitForTimeout(300); await shot('45-postar', '#e-export', 'Terminou? Toque em Postar');
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ viewport: p.viewportSize(), dpr: 3, meta }, null, 1));
await b.close(); console.log(meta.length, 'telas');
