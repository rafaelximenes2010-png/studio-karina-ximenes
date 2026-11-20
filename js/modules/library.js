import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, uid, isoDate, slug } from '../lib/util.js';
import { CATEGORIES, PHRASES, phraseById, captionFor } from '../lib/content.js';
import { allArts, OFFICIAL, PALETTES, LAYOUTS, layoutsFor, buildPages, combinationsCount } from '../lib/templates.js';
import { FORMATS } from '../lib/render.js';
import { I, $, $$, artCard, sheet, toast, lazyThumbs, drawSpecThumb, drawThumb, ensureFonts, measureCtx, signature, exportPage, shareOrDownload, copyText, assetImage, confirmDialog, refresh } from '../ui.js';
import { openSpec } from './shared.js';
import { chooseImage } from './media.js';

const PAGE = 48;

export async function render(view, { query }) {
  const tab = query.get('tab') || 'artes';
  view.innerHTML = `
    <div class="eyebrow">${t('Biblioteca')}</div>
    <h1 class="h-title" style="margin:4px 0 4px">${t('Artes, modelos e mídia')}</h1>
    <p class="muted small" style="margin:0 0 14px">${t('{a} artes prontas · {c} combinações possíveis · todas com a sua logomarca', { a: allArts().length, c: combinationsCount().toLocaleString('pt-BR') })}</p>
    <div class="tabs" role="tablist">${[['artes', t('Artes prontas')], ['modelos', t('30 modelos')], ['midia', t('Mídia')], ['ciencia', t('Ciência')]].map(([k, v]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${v}</button>`).join('')}</div>
    <div id="pane"></div>`;
  $('.tabs', view).onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === 'ciencia') { location.hash = '#/ciencia'; return; } history.replaceState(null, '', `#/biblioteca?tab=${b.dataset.tab}`); refresh(); };
  const pane = $('#pane', view);
  if (tab === 'artes') artsTab(pane, query);
  if (tab === 'modelos') officialTab(pane);
  if (tab === 'midia') mediaTab(pane);
  view.addEventListener('click', (e) => { const a = e.target.closest('[data-art]'); if (a) preview(JSON.parse(decodeURIComponent(a.dataset.art))); });
  if (query.get('frase')) { const p = phraseById(query.get('frase')); if (p) preview({ phraseId: p.id, layout: layoutsFor(p)[0], palette: 'creme', format: 'portrait' }); }
}

function artsTab(pane, query) {
  let cat = query.get('cat') || 'todas'; let pal = 'todas'; let fmt = 'portrait'; let q = ''; let shown = PAGE;
  pane.innerHTML = `
    <div class="search">${I.search}<input class="input" id="aq" type="search" placeholder="${t('Buscar por tema, palavra ou campanha')}"></div>
    <div class="chips" id="cats" style="margin-top:10px"><button class="chip" data-cat="todas" aria-pressed="true">${t('Todas')}</button>${CATEGORIES.map((c) => `<button class="chip" data-cat="${c.id}">${t(c.label)}</button>`).join('')}</div>
    <div class="chips" id="pals"><button class="chip" data-pal="todas" aria-pressed="true">${t('Todas as paletas')}</button>${Object.entries(PALETTES).map(([k, p]) => `<button class="chip" data-pal="${k}"><i style="width:14px;height:14px;border-radius:50%;background:${p.bg.type === 'solid' ? p.bg.c1 : `linear-gradient(${p.bg.c1},${p.bg.c2})`};border:1px solid #0002"></i>${t(p.name)}</button>`).join('')}</div>
    <div class="row between" style="margin:4px 0 12px"><span class="small muted" id="count"></span><div class="seg" id="fmts">${[['story', 'Story'], ['portrait', 'Feed'], ['square', t('Quadrado')]].map(([k, l]) => `<button data-fmt="${k}" aria-pressed="${k === fmt}">${l}</button>`).join('')}</div></div>
    <div class="grid arts" id="grid"></div>
    <div style="text-align:center;margin:18px 0"><button class="btn ghost" id="more">${t('Carregar mais')}</button></div>`;
  if (cat !== 'todas') $$('#cats .chip', pane).forEach((c) => c.setAttribute('aria-pressed', c.dataset.cat === cat));
  const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const paint = () => {
    let list = allArts().filter((a) => (cat === 'todas' || a.cat === cat) && (pal === 'todas' || a.palette === pal));
    if (q) list = list.filter((a) => { const p = phraseById(a.phraseId); return norm(p.text + ' ' + (p.title || '') + ' ' + (p.campaign || '') + ' ' + (p.items || []).join(' ')).includes(q); });
    $('#count', pane).textContent = t('{n} artes', { n: list.length });
    $('#grid', pane).innerHTML = list.slice(0, shown).map((a) => artCard({ phraseId: a.phraseId, layout: a.layout, palette: a.palette, format: fmt }, { title: t(CATEGORIES.find((c) => c.id === a.cat)?.label), sub: ' · ' + t(LAYOUTS[a.layout] || 'Carrossel'), pill: a.layout === 'carrossel' ? t('Carrossel') : '' })).join('') || `<div class="empty">${t('Nada encontrado.')}</div>`;
    $('#more', pane).hidden = list.length <= shown;
    lazyThumbs(pane, drawSpecThumb);
  };
  $('#cats', pane).onclick = (e) => { const c = e.target.closest('[data-cat]'); if (!c) return; cat = c.dataset.cat; shown = PAGE; $$('#cats .chip', pane).forEach((x) => x.setAttribute('aria-pressed', x === c)); paint(); };
  $('#pals', pane).onclick = (e) => { const c = e.target.closest('[data-pal]'); if (!c) return; pal = c.dataset.pal; shown = PAGE; $$('#pals .chip', pane).forEach((x) => x.setAttribute('aria-pressed', x === c)); paint(); };
  $('#fmts', pane).onclick = (e) => { const c = e.target.closest('[data-fmt]'); if (!c) return; fmt = c.dataset.fmt; $$('#fmts button', pane).forEach((x) => x.setAttribute('aria-pressed', x === c)); paint(); };
  $('#aq', pane).oninput = (e) => { q = norm(e.target.value.trim()); shown = PAGE; paint(); };
  $('#more', pane).onclick = () => { shown += PAGE; paint(); };
  paint();
}

function officialTab(pane) {
  pane.innerHTML = `<p class="muted small" style="margin-top:0">${t('Modelos editáveis criados para a marca, em 10 categorias. Cada um funciona em Story, post vertical e quadrado.')}</p>` +
    CATEGORIES.map((c) => `<h2 class="h-section" style="margin-top:18px">${t(c.label)}</h2><div class="grid arts">${OFFICIAL.filter((m) => m.cat === c.id).map((m) => artCard({ phraseId: m.phraseId, layout: m.layout, palette: m.palette, format: 'portrait' }, { title: m.name.split('·')[1]?.trim() || m.name, sub: ' · ' + t(PALETTES[m.palette].name) })).join('')}</div>`).join('');
  lazyThumbs(pane, drawSpecThumb);
}

async function mediaTab(pane) {
  const list = await db.all('assets');
  pane.innerHTML = `<div class="row between"><p class="muted small" style="margin:0">${t('Fotos salvas no seu aparelho para reutilizar nas artes e documentos.')}</p><button class="btn sm" id="add">${I.plus}${t('Adicionar')}</button></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));margin-top:12px">${list.map((a) => `<div class="art" style="aspect-ratio:1;position:relative"><img data-src="${a.id}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover">${a.license ? `<span class="pill" title="${esc(a.author)}">${esc(a.license)}</span>` : ''}<button class="icon-btn" data-del="${a.id}" aria-label="${t('Excluir')}" style="position:absolute;right:4px;bottom:4px;background:#fffd;width:36px;height:36px">${I.trash}</button></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${t('Nenhuma foto ainda.')}</div>`}</div>`;
  for (const im of $$('img[data-src]', pane)) assetImage(im.dataset.src).then((x) => { if (x) im.src = x.src; });
  $('#add', pane).onclick = async () => { if (await chooseImage()) refresh(); };
  pane.onclick = async (e) => { const d = e.target.closest('[data-del]'); if (d && await confirmDialog(t('Excluir esta foto da sua mídia? Artes que a usam ficarão com a moldura vazia.'), { ok: t('Excluir'), danger: true })) { await db.del('assets', d.dataset.del); refresh(); } };
}

/** Prévia profissional de uma arte: variações, formatos, programar, editar, baixar */
export function preview(spec0) {
  let spec = { format: 'portrait', ...spec0 };
  const p = phraseById(spec.phraseId);
  const s = sheet(`<div class="row between"><span class="eyebrow">${esc(t(CATEGORIES.find((c) => c.id === p.cat)?.label))}</span><button class="icon-btn" data-close aria-label="${t('Fechar')}">${I.close}</button></div>
    <div style="display:grid;place-items:center;margin:8px 0"><canvas id="big" style="max-height:46vh;width:auto;border-radius:12px;box-shadow:0 10px 30px #0002"></canvas></div>
    <div class="seg" id="fm" style="display:flex;margin:0 auto 10px;width:max-content">${[['story', 'Story'], ['portrait', 'Feed'], ['square', t('Quadrado')]].map(([k, l]) => `<button data-f="${k}">${l}</button>`).join('')}</div>
    <button class="btn block" id="postnow" style="min-height:52px">${I.share}${t('Postar no Instagram')}</button>
    <div class="grid c2" style="margin-top:8px"><button class="btn secondary" id="edit">${I.wand}${t('Ajustar')}</button><button class="btn secondary" id="sched">${I.calendar}${t('Programar')}</button></div>
    <div class="grid c2" style="margin-top:8px"><button class="btn ghost" id="dl">${I.download}${t('Baixar')}</button><button class="btn ghost" id="cap">${I.copy}${t('Copiar legenda')}</button></div>
    <h3 class="small" style="margin:16px 0 8px">${t('Layouts')}</h3><div class="hscroll" id="lays" style="grid-auto-columns:96px"></div>
    <h3 class="small" style="margin:12px 0 8px">${t('Paletas')}</h3><div class="hscroll" id="pals" style="grid-auto-columns:96px"></div>`, { label: t('Prévia da arte') });
  const big = $('#big', s.el);
  const paint = async () => {
    await ensureFonts();
    const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
    await drawThumb(big, pages[0], spec.format, 720);
    big.style.aspectRatio = `${FORMATS[spec.format].w}/${FORMATS[spec.format].h}`;
    $$('#fm button', s.el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === spec.format));
    const lays = p.items ? ['lista', 'cartaolista', 'carrossel'] : layoutsFor(p);
    $('#lays', s.el).innerHTML = lays.map((l) => `<button class="art" data-l="${l}" style="${l === spec.layout ? 'outline:3px solid var(--primary)' : ''}"><canvas data-lazy data-spec="${encodeURIComponent(JSON.stringify({ ...spec, layout: l, format: 'portrait' }))}"></canvas><div class="meta">${t(LAYOUTS[l] || 'Carrossel')}</div></button>`).join('');
    $('#pals', s.el).innerHTML = Object.entries(PALETTES).map(([k, pl]) => `<button class="art" data-p="${k}" style="${k === spec.palette ? 'outline:3px solid var(--primary)' : ''}"><canvas data-lazy data-spec="${encodeURIComponent(JSON.stringify({ ...spec, palette: k, format: 'portrait' }))}"></canvas><div class="meta">${t(pl.name)}</div></button>`).join('');
    lazyThumbs(s.el, drawSpecThumb);
  };
  s.el.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]'); const l = e.target.closest('[data-l]'); const pl = e.target.closest('[data-p]');
    if (f) { spec.format = f.dataset.f; paint(); }
    if (l) { spec.layout = l.dataset.l; paint(); }
    if (pl) { spec.palette = pl.dataset.p; paint(); }
  });
  $('#edit', s.el).onclick = () => { s.close(); openSpec(spec); };
  $('#postnow', s.el).onclick = async () => { s.close(); (await import('./quick.js')).postArt({ ...spec }); };
  $('#cap', s.el).onclick = () => copyText(captionFor(p, { signature: signature() }));
  $('#dl', s.el).onclick = async () => {
    toast(t('Gerando arquivos...'));
    const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
    const files = []; for (let i = 0; i < pages.length; i++) files.push(new File([await exportPage(pages[i], spec.format)], `${slug(p.title || p.text).slice(0, 40)}${pages.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
    await shareOrDownload(files, { text: captionFor(p, { signature: signature() }) });
  };
  $('#sched', s.el).onclick = () => {
    const s2 = sheet(`<h3>${t('Programar publicação')}</h3><div class="stack" style="margin-top:12px">
      <label class="field"><span>${t('Data')}</span><input class="input" type="date" id="d" value="${isoDate(new Date(Date.now() + 864e5))}"></label>
      <label class="field"><span>${t('Horário')}</span><input class="input" type="time" id="h" value="19:00"></label>
      <label class="field"><span>${t('Rede')}</span><select class="input" id="n">${['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'TikTok', 'Site/Blog'].map((x) => `<option>${x}</option>`).join('')}</select></label>
      <button class="btn block" id="ok">${t('Adicionar à agenda')}</button></div>`);
    $('#ok', s2.el).onclick = async () => {
      const post = { id: uid('post'), title: (p.campaign ? p.campaign + ': ' : '') + (p.title || p.text).slice(0, 70), category: CATEGORIES.find((c) => c.id === p.cat)?.label, network: $('#n', s2.el).value, format: spec.layout === 'carrossel' ? 'carousel' : spec.format, date: $('#d', s2.el).value, time: $('#h', s2.el).value, status: 'ideia', caption: captionFor(p, { signature: signature() }), art: { phraseId: p.id, layout: spec.layout, palette: spec.palette, format: spec.format }, refs: [], history: [{ at: Date.now(), status: 'ideia', note: 'Programado pela Biblioteca' }] };
      await db.put('posts', post); s2.close(); s.close(); toast(t('Programado para {d}', { d: new Date(post.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' }) }));
    };
  };
  paint();
}
