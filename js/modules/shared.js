// Ações compartilhadas entre módulos
import { db } from '../lib/store.js';
import { newProjectFromSpec, PALETTES } from '../lib/templates.js';
import { FORMATS, BRAND } from '../lib/render.js';
import { uid, esc, fmtDate } from '../lib/util.js';
import { t, locale } from '../lib/i18n.js';
import { ensureFonts, measureCtx, signature, drawThumb, lazyThumbs, I, logoSrc } from '../ui.js';

/** Cria projeto editável a partir de uma arte e abre no editor */
export async function openSpec(spec, { postId = null, go = true } = {}) {
  await ensureFonts();
  const proj = newProjectFromSpec(spec, { sig: signature(), mctx: measureCtx() });
  if (postId) proj.postId = postId;
  await db.put('projects', proj);
  if (postId) { const post = await db.get('posts', postId); if (post) { post.projectId = proj.id; if (post.status === 'ideia') { post.status = 'rascunho'; post.history = [...(post.history || []), { at: Date.now(), status: 'rascunho', note: 'Arte criada' }]; } await db.put('posts', post); } }
  if (go) location.hash = `#/editor/${proj.id}`;
  return proj;
}

export async function newBlank(format = 'portrait', carousel = false) {
  const F = FORMATS[format];
  const s = Math.round(F.w * 0.12);
  const page = () => ({ bg: { type: 'solid', c1: BRAND.cream }, layers: [
    { id: uid('l'), type: 'text', text: t('Toque duas vezes para editar o texto'), x: 100, y: F.h * 0.38, w: F.w - 200, size: 72, font: 'serif', weight: 400, color: BRAND.graphite, align: 'center', lh: 1.2 },
    { id: uid('l'), type: 'logo', x: (F.w - s) / 2, y: F.h - s - (format === 'story' ? 300 : 90), w: s, h: s, mask: 'circle', ring: BRAND.gold },
  ] });
  const proj = { id: uid('p'), name: t('Novo projeto'), format, pages: carousel ? [page(), page(), page()] : [page()] };
  await db.put('projects', proj);
  location.hash = `#/editor/${proj.id}`;
}

export function projectList(list, { empty = t('Nenhum projeto ainda.') } = {}) {
  if (!list.length) return `<div class="empty">${esc(empty)}</div>`;
  return list.map((p) => `<a class="list-item" href="#/editor/${p.id}"><span class="thumb"><canvas data-lazy data-proj="${p.id}" width="54" height="54"></canvas></span><span class="grow"><b>${esc(projectName(p))}</b><span class="xs muted">${esc(FORMATS[p.format]?.label || '')}${p.pages?.length > 1 ? ` · ${p.pages.length} ${t('páginas')}` : ''} · ${fmtDate(p.updatedAt, locale())}</span></span></a>`).join('');
}

export function wireProjectThumbs(root, list) {
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));
  lazyThumbs(root, (c) => {
    if (c.dataset.proj) { const p = byId[c.dataset.proj]; if (p) drawThumb(c, p.pages[0], p.format, c.closest('.proj-card') ? 360 : 120); }
    else if (c.dataset.spec) import('../ui.js').then((m) => m.drawSpecThumb(c));
  });
}

export const paletteKeys = Object.keys(PALETTES);
export const icon = I;

// Nome bonito: se o projeto ainda se chama "Novo projeto", usa a primeira frase da arte
export function projectName(p) {
  const n = (p.name || '').trim();
  if (n && !/^(novo projeto|new project|nuevo proyecto|sem título)$/i.test(n)) return n;
  const tx = (p.pages?.[0]?.layers || []).filter((l) => l.type === 'text' && l.text && l.text.length > 12).sort((a, b) => (b.size || 0) - (a.size || 0))[0]?.text;
  return tx ? tx.replace(/\s+/g, ' ').slice(0, 60) + (tx.length > 60 ? '…' : '') : t('Sem título');
}

/** Projetos como cartões com a arte de verdade (rolagem lateral) */
export function projectStrip(list, { empty = t('Nenhum projeto ainda.') } = {}) {
  if (!list.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="hscroll proj-strip">${list.map((p) => `<a class="proj-card" href="#/editor/${p.id}"><span class="proj-art f-${p.format}"><canvas data-lazy data-proj="${p.id}"></canvas>${p.pages?.length > 1 ? `<i class="pill">${p.pages.length} ${t('páginas')}</i>` : ''}</span><b>${esc(projectName(p))}</b><small>${esc(FORMATS[p.format]?.label || '')} · ${fmtDate(p.updatedAt, locale(), { day: '2-digit', month: 'short' })}</small></a>`).join('')}</div>`;
}

// Documentos: mini capas com cor por modelo
export const DOC_LOOK = {
  artigo: '#435B49', relatorio: '#91A595', apostila: '#A8834F', psicoeducativo: '#8E7CB8',
  apresentacao: '#33382F', aula: '#C9A227', guia: '#5F8A72', ebook: '#8C6239',
};
export const docCover = (kind, label) => `<span class="doc-cover" style="--c:${DOC_LOOK[kind] || '#435B49'}" aria-hidden="true"><i class="band"></i><img src="${logoSrc}" alt=""><b>${esc(label)}</b><i class="ln"></i><i class="ln s"></i><i class="ln"></i><i class="ln s"></i></span>`;
export function docStrip(docs) {
  return `<div class="hscroll doc-strip">${docs.map((d) => `<a class="doc-card" href="#/documento/${d.id}">${docCover(d.kind, d.title || t('Sem título'))}<b>${esc(d.title || t('Sem título'))}</b><small>${fmtDate(d.updatedAt, locale(), { day: '2-digit', month: 'short' })}</small></a>`).join('')}</div>`;
}
