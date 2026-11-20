import { t, locale } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, uid, fmtDate, deepClone } from '../lib/util.js';
import { FORMATS } from '../lib/render.js';
import { OFFICIAL } from '../lib/templates.js';
import { I, artCard, sheet, toast, confirmDialog, refresh, $ } from '../ui.js';
import { newBlank, openSpec, wireProjectThumbs } from './shared.js';

export async function render(view) {
  const projects = await db.all('projects');
  const fmtCard = (k, ic, carousel = false) => {
    const F = FORMATS[k]; const ratio = F.h / F.w;
    return `<button class="card" data-new="${k}" data-carousel="${carousel ? 1 : ''}" style="text-align:left;cursor:pointer;display:flex;gap:12px;align-items:center">
      <span style="flex:none;width:${Math.round(34 / ratio)}px;height:34px;border-radius:6px;border:2px solid var(--primary);display:grid;place-items:center;color:var(--primary)">${carousel ? '<b style="font-size:11px">1·2·3</b>' : ''}</span>
      <span><b style="display:block">${carousel ? t('Carrossel') : t(F.label)}</b><span class="xs muted">${F.sub}${carousel ? ' · ' + t('várias páginas') : ''}</span></span></button>`;
  };
  view.innerHTML = `
    <div class="eyebrow">${t('Criar')}</div>
    <h1 class="h-title" style="margin:4px 0 14px">${t('O que vamos criar hoje?')}</h1>
    <div class="grid c2">${fmtCard('story')}${fmtCard('portrait')}${fmtCard('square')}${fmtCard('portrait', '', true)}</div>

    <button class="card" id="tw" style="width:100%;margin-top:12px;text-align:left;cursor:pointer;display:flex;gap:14px;align-items:center;background:linear-gradient(120deg,var(--surface-3),var(--surface))">
      <span style="flex:none;width:52px;height:52px;border-radius:14px;background:var(--primary);color:var(--on-primary);display:grid;place-items:center">${I.layers}</span>
      <span><b style="display:block;font-size:17px">${t('Semana temática')}</b><span class="small muted">${t('Carrossel + posts da semana inteira no mesmo tema, programados de uma vez.')}</span></span></button>

    <h2 class="h-section">${t('Mais ferramentas')}</h2>
    <div class="quick">
      <a href="#/biblioteca">${I.grid}<span>${t('Artes prontas')}</span></a>
      <a href="#/textos">${I.sparkle}<span>Frankie · IA</span></a>
      <a href="#/documentos">${I.doc}<span>${t('Documento / PDF')}</span></a>
      <a href="#/ciencia">${I.book}<span>${t('Referências')}</span></a>
    </div>

    <h2 class="h-section">${t('Modelos oficiais')}<a href="#/biblioteca?tab=modelos">${t('Ver os 30')} →</a></h2>
    <div class="hscroll">${OFFICIAL.filter((_, i) => i % 3 === 0).map((m) => artCard({ phraseId: m.phraseId, layout: m.layout, palette: m.palette, format: 'portrait' }, { title: m.name })).join('')}</div>

    <h2 class="h-section">${t('Meus projetos')} <span class="badge">${projects.length}</span></h2>
    ${projects.length > 4 ? `<div class="search" style="margin-bottom:10px">${I.search}<input class="input" id="pq" type="search" placeholder="${t('Buscar projeto')}"></div>` : ''}
    <div id="plist"></div>`;

  const list = $('#plist', view);
  const paint = (items) => {
    list.innerHTML = items.length ? items.map((p) => `<div class="list-item" style="padding:8px 8px 8px 12px">
      <a href="#/editor/${p.id}" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0;text-decoration:none;color:inherit">
        <span class="thumb"><canvas data-lazy data-proj="${p.id}" width="54" height="54"></canvas></span>
        <span class="grow"><b>${esc(p.name || t('Sem título'))}</b><span class="xs muted">${esc(t(FORMATS[p.format]?.label || ''))}${p.pages?.length > 1 ? ` · ${p.pages.length} ${t('páginas')}` : ''} · ${fmtDate(p.updatedAt, locale())}</span></span></a>
      <button class="icon-btn" data-more="${p.id}" aria-label="${t('Opções')}">${I.more}</button></div>`).join('')
      : `<div class="empty">${t('Nenhum projeto ainda. Escolha um formato acima ou uma arte pronta.')}</div>`;
    wireProjectThumbs(list, items);
  };
  paint(projects);
  $('#pq', view)?.addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); paint(projects.filter((p) => (p.name || '').toLowerCase().includes(q))); });

  view.addEventListener('click', async (e) => {
    if (e.target.closest('#tw')) return import('./themeweek.js').then((m) => m.openThemeWeek({ onDone: () => { location.hash = '#/agenda'; } }));
    const n = e.target.closest('[data-new]'); if (n) return newBlank(n.dataset.new, !!n.dataset.carousel);
    const a = e.target.closest('[data-art]'); if (a) return openSpec(JSON.parse(decodeURIComponent(a.dataset.art)));
    const m = e.target.closest('[data-more]');
    if (m) {
      const p = projects.find((x) => x.id === m.dataset.more);
      const s = sheet(`<h3 style="margin-bottom:12px">${esc(p.name)}</h3><div class="stack">
        <a class="btn secondary block" href="#/editor/${p.id}" data-close>${t('Abrir')}</a>
        <button class="btn secondary block" data-act="dup">${I.dup}${t('Duplicar')}</button>
        <button class="btn danger block" data-act="del">${I.trash}${t('Excluir')}</button></div>`);
      s.el.onclick = async (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'dup') { const c = deepClone(p); c.id = uid('p'); c.name = p.name + ' (' + t('cópia') + ')'; delete c.createdAt; await db.put('projects', c); s.close(); toast(t('Projeto duplicado')); refresh(); }
        if (act === 'del') { s.close(); if (await confirmDialog(t('Excluir este projeto? Esta ação não pode ser desfeita.'), { ok: t('Excluir'), danger: true })) { await db.del('projects', p.id); toast(t('Projeto excluído')); refresh(); } }
      };
    }
  });
}
