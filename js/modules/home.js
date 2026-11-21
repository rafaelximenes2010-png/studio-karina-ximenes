import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, isoDate, fmtDate } from '../lib/util.js';
import { PHRASES, CATEGORIES } from '../lib/content.js';
import { allArts } from '../lib/templates.js';
import { I, artCard, sheet, $, $$, lazyThumbs, drawSpecThumb, statusLabel } from '../ui.js';
import { openSpec, projectList, projectStrip, docStrip, wireProjectThumbs } from './shared.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t('Bom dia') : h < 18 ? t('Boa tarde') : t('Boa noite');
}

export async function render(view) {
  const p = prefs.get();
  const [projects, posts, docs] = await Promise.all([db.all('projects'), db.all('posts'), db.all('docs')]);
  const today = isoDate();
  const week = isoDate(new Date(Date.now() + 7 * 864e5));
  const upcoming = posts.filter((x) => x.date >= today && x.date <= week && x.status !== 'publicado').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const arts = allArts();
  const dayN = Math.floor(Date.now() / 864e5);
  const daily = [0, 1, 2, 3, 4, 5].map((i) => arts[(dayN * 7 + i * 61) % arts.length]);
  const counts = { total: posts.length, ap: posts.filter((x) => x.status === 'aprovado' || x.status === 'publicado').length };

  view.innerHTML = `
  <section class="hero centered">
    <div class="eyebrow">${t('Estúdio criativo · identidade & conteúdo')}</div>
    <h1 class="h-display">${greeting()}, ${esc(p.name || 'Karina')}.</h1>
    <p class="muted" style="max-width:520px;margin:0 0 18px">${t('Ideias que acolhem. Conteúdos que transformam. Tudo com a sua identidade visual.')}</p>
    <div class="hero-quick">
      <a class="hq" href="#/rapido?f=story"><span>${I.story}</span><b>${t('Story')}</b></a>
      <a class="hq" href="#/rapido?f=feed"><span>${I.feed}</span><b>${t('Feed')}</b></a>
      <label class="hq photo"><input type="file" accept="image/*" id="homeph" hidden><span>${I.camera}</span><b>${t('Da minha foto')}</b></label>
      <a class="hq" href="#/rapido?f=carousel"><span>${I.carousel}</span><b>${t('Carrossel')}</b></a>
    </div>
    <div class="row" style="margin-top:8px"><a class="btn sm ghost" href="#/agenda">${I.calendar}${t('Ver programação')}</a><a class="btn sm ghost" href="#/perfil/criar-tutorial">${I.help}${t('Como criar (vídeo)')}</a></div>
  </section>
  <a class="vg-banner" href="#/rapido?f=story&th=mix&vg=1"><span class="vg-tag">✦ ${t('Novo')}</span><b>${t('Vanguarda')}</b><small>${t('Estilos que param o scroll: revista, aura, conversa, neo-brutal e mais')}</small><i>→</i></a>

  <div class="quick" style="margin-top:16px">
    <a href="#/biblioteca">${I.grid}<span>${t('Artes prontas')}</span></a>
    <a href="#/textos">${I.sparkle}<span>Frankie · IA</span></a>
    <a href="#/ciencia">${I.book}<span>${t('Ciência')}</span></a>
    <a href="#/documentos">${I.doc}<span>${t('Documentos')}</span></a>
  </div>

  <h2 class="h-section">${t('Programado para esta semana')}<a href="#/agenda">${t('Agenda')} →</a></h2>
  ${upcoming.length ? `<div class="hscroll">${upcoming.slice(0, 10).map((x) => artCard({ ...x.art }, { title: fmtDate(x.date, locale(), { weekday: 'short', day: '2-digit', month: 'short' }), sub: ' · ' + statusLabel(x.status), pill: x.category, attrs: `data-post="${x.id}"` })).join('')}</div>`
    : `<div class="empty small">${t('Nada programado para os próximos 7 dias.')} <a href="#/agenda">${t('Abrir agenda')}</a></div>`}

  <div class="kpis" style="margin-top:14px">
    <div class="kpi"><b>${arts.length}</b><span>${t('artes prontas')}</span></div>
    <div class="kpi"><b>${counts.total}</b><span>${t('publicações programadas')}</span></div>
    <div class="kpi"><b>${projects.length}</b><span>${t('projetos seus')}</span></div>
  </div>

  <h2 class="h-section">${t('Sugestões do dia')}<a href="#/biblioteca">${t('Ver todas')} →</a></h2>
  <div class="hscroll">${daily.map((a) => artCard({ phraseId: a.phraseId, layout: a.layout, palette: a.palette, format: 'portrait' }, { title: CATEGORIES.find((c) => c.id === a.cat)?.label })).join('')}</div>

  <h2 class="h-section">${t('Projetos recentes')}<a href="#/criar">${t('Todos')} →</a></h2>
  <div id="recent">${projectStrip(projects.slice(0, 10), { empty: t('Seus projetos aparecerão aqui. Comece por uma arte pronta!') })}</div>

  ${docs.length ? `<h2 class="h-section">${t('Documentos recentes')}<a href="#/documentos">${t('Todos')} →</a></h2>${docStrip(docs.slice(0, 8))}` : ''}
  <p class="xs muted" style="text-align:center;margin-top:32px">Karina Ximenes · Psicóloga — Pessoas • Histórias • Recomeços</p>`;

  wireProjectThumbs(view, projects.slice(0, 10));
  $('#homeph', view).onchange = async (e) => (await import('./quick.js')).startFromPhoto(e.target.files?.[0]);
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-art]'); if (!b) return;
    const spec = JSON.parse(decodeURIComponent(b.dataset.art));
    if (b.dataset.post) {
      const post = await db.get('posts', b.dataset.post);
      if (post?.projectId && await db.get('projects', post.projectId)) location.hash = `#/editor/${post.projectId}`;
      else (await import('./quick.js')).postArt(spec, { postId: b.dataset.post });
    } else (await import('./quick.js')).postArt(spec);
  });
}

/** Busca global: artes, projetos, documentos, referências e publicações */
export function openSearch() {
  const s = sheet(`<div class="search"><span>${I.search}</span><input class="input" type="search" id="q" placeholder="${t('Buscar artes, projetos, documentos, referências...')}" autofocus aria-label="${t('Buscar')}"></div><div id="res" style="margin-top:12px"></div>`, { label: t('Buscar') });
  const res = $('#res', s.el);
  let data;
  const load = async () => (data ||= { projects: await db.all('projects'), docs: await db.all('docs'), refs: await db.all('refs'), posts: await db.all('posts') });
  const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  $('#q', s.el).addEventListener('input', async (e) => {
    const q = norm(e.target.value.trim()); if (q.length < 2) { res.innerHTML = ''; return; }
    const d = await load();
    const arts = PHRASES.filter((p) => norm(p.text + ' ' + (p.title || '') + ' ' + (p.campaign || '') + ' ' + p.cat).includes(q)).slice(0, 8);
    const pr = d.projects.filter((p) => norm(p.name).includes(q)).slice(0, 5);
    const dc = d.docs.filter((p) => norm(p.title + ' ' + (p.blocks || []).map((b) => b.text).join(' ')).includes(q)).slice(0, 5);
    const rf = d.refs.filter((r) => norm(r.title + ' ' + (r.authors || []).map((a) => a.family).join(' ') + ' ' + (r.tags || '')).includes(q)).slice(0, 5);
    const ps = d.posts.filter((r) => norm(r.title + ' ' + r.caption).includes(q)).slice(0, 5);
    const sec = (title, items) => (items ? `<h3 class="eyebrow" style="margin:14px 0 6px">${title}</h3>${items}` : '');
    res.innerHTML = (sec(t('Artes'), arts.map((p) => `<button class="list-item" data-phrase="${p.id}"><span class="thumb">${I.grid}</span><span class="grow"><b>${esc(p.title || p.text)}</b><span class="xs muted">${esc(CATEGORIES.find((c) => c.id === p.cat)?.label)}</span></span></button>`).join(''))
      + sec(t('Projetos'), pr.map((p) => `<a class="list-item" href="#/editor/${p.id}" data-close><span class="thumb">${I.image}</span><span class="grow"><b>${esc(p.name)}</b></span></a>`).join(''))
      + sec(t('Documentos'), dc.map((p) => `<a class="list-item" href="#/documento/${p.id}" data-close><span class="thumb">${I.doc}</span><span class="grow"><b>${esc(p.title)}</b></span></a>`).join(''))
      + sec(t('Referências'), rf.map((r) => `<a class="list-item" href="#/ciencia?ref=${r.id}" data-close><span class="thumb">${I.book}</span><span class="grow"><b>${esc(r.title)}</b><span class="xs muted">${esc(r.year || '')}</span></span></a>`).join(''))
      + sec(t('Agenda'), ps.map((r) => `<a class="list-item" href="#/agenda?post=${r.id}" data-close><span class="thumb">${I.calendar}</span><span class="grow"><b>${esc(r.title)}</b><span class="xs muted">${esc(r.date)}</span></span></a>`).join(''))) || `<p class="muted">${t('Nada encontrado.')}</p>`;
    $$('[data-phrase]', res).forEach((b) => (b.onclick = () => { s.close(); location.hash = `#/biblioteca?frase=${b.dataset.phrase}`; }));
  });
}
