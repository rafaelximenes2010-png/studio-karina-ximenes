// Componentes de interface compartilhados
import { t } from './lib/i18n.js';
import { esc } from './lib/util.js';
import { db, prefs } from './lib/store.js';
import { renderPage, FORMATS } from './lib/render.js';

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  home: P('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  library: P('<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.6 1 -4 15.5-3.6-1z"/>'),
  calendar: P('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  back: P('<path d="M15 5l-7 7 7 7"/>'),
  close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  text: P('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  image: P('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  shape: P('<rect x="3" y="3" width="9" height="9" rx="1.5"/><circle cx="16" cy="16" r="5"/>'),
  logo: P('<circle cx="12" cy="12" r="9"/><path d="M12 16s-4-2.4-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 11c0 2.6-4 5-4 5z"/>'),
  bg: P('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.6-1-2.6 1-1.4 2-1.4h2a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>'),
  layers: P('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  undo: P('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: P('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  share: P('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  up: P('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: P('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  sparkle: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  book: P('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>'),
  doc: P('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>'),
  grid: P('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  shield: P('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  help: P('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
  palette: P('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M12 21a3 3 0 0 1 0-6h2"/>'),
  dup: P('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeoff: P('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>'),
  lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  more: P('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  pages: P('<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>'),
  wand: P('<path d="m15 4 5 5L9 20l-5-5z"/><path d="M13 6l5 5"/>'),
  refresh: P('<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>'),
  check: P('<path d="m5 12 5 5 9-10"/>'),
  install: P('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>'),
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const h = (html) => { const tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; };

let toastT;
export function toast(msg, ms = 2600) {
  const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}

/** Abre uma folha (bottom sheet) com botão Voltar e arrastar-para-baixo para fechar (como no iPhone). Retorna {el, close} */
export function sheet(inner, { onClose, label = '' } = {}) {
  const prev = document.activeElement;
  const bd = h(`<div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet"><div class="grabzone"><button class="sheet-back" type="button" data-close>${I.back}<span>${t('Voltar')}</span></button><span class="grab" aria-hidden="true"></span><span></span></div>${inner}</div></div>`);
  const sh = bd.querySelector('.sheet');
  let closed = false;
  const close = () => { if (closed) return; closed = true; bd.remove(); document.removeEventListener('keydown', onKey); onClose?.(); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  document.addEventListener('keydown', onKey);
  bd.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  // Arrastar para baixo: pela barrinha a qualquer momento, ou pelo conteúdo quando já está no topo
  let y0 = null; let dy = 0; let fromGrab = false; let t0 = 0;
  const start = (y, grab) => { if (!grab && sh.scrollTop > 0) return; y0 = y; dy = 0; fromGrab = grab; t0 = Date.now(); bd.classList.add('dragging'); };
  const move = (y, ev) => { if (y0 === null) return; dy = Math.max(0, y - y0); if (dy > 0 && (fromGrab || sh.scrollTop <= 0)) { sh.style.transform = `translateY(${dy}px)`; bd.style.background = `rgba(23,26,22,${Math.max(0.05, 0.45 - dy / 900)})`; if (ev.cancelable) ev.preventDefault(); } };
  const end = () => { if (y0 === null) return; y0 = null; bd.classList.remove('dragging'); sh.classList.add('closing');
    const flick = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.5;
    if (dy > 90 || flick) { sh.style.transform = 'translateY(110%)'; setTimeout(close, 200); } else { sh.style.transform = ''; bd.style.background = ''; setTimeout(() => sh.classList.remove('closing'), 230); } };
  sh.addEventListener('touchstart', (e) => start(e.touches[0].clientY, !!e.target.closest('.grabzone')), { passive: true });
  sh.addEventListener('touchmove', (e) => move(e.touches[0].clientY, e), { passive: false });
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
  const gz = sh.querySelector('.grabzone');
  gz.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.target.closest('button')) return; gz.setPointerCapture(e.pointerId); start(e.clientY, true); });
  gz.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e.clientY, e); });
  gz.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(); });
  document.body.appendChild(bd);
  setTimeout(() => (bd.querySelector('[autofocus]') || sh)?.focus?.(), 50);
  return { el: sh, close };
}

export function confirmDialog(msg, { ok = t('Confirmar'), danger = false } = {}) {
  return new Promise((res) => {
    const s = sheet(`<p style="font-size:17px;margin:4px 0 18px">${esc(msg)}</p><div class="row"><button class="btn ghost grow" data-no>${t('Cancelar')}</button><button class="btn grow ${danger ? 'danger' : ''}" data-yes>${esc(ok)}</button></div>`, { onClose: () => res(false) });
    s.el.querySelector('[data-no]').onclick = () => { s.close(); };
    s.el.querySelector('[data-yes]').onclick = () => { res(true); s.close(); };
  });
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a'); const u = URL.createObjectURL(blob);
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

/** Compartilhamento nativo de arquivos quando disponível; senão, baixa */
export async function shareOrDownload(files, { title = 'Studio Karina Ximenes', text = '' } = {}) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title, text }); return 'shared'; }
  } catch (e) { if (e.name === 'AbortError') return 'aborted'; }
  for (const f of files) downloadBlob(f, f.name);
  return 'downloaded';
}

export async function copyText(s) {
  try { await navigator.clipboard.writeText(s); toast(t('Copiado')); }
  catch { const ta = h('<textarea style="position:fixed;opacity:0"></textarea>'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('Copiado')); }
}

// ---------- Imagens e renderização ----------
const imgCache = new Map();
export function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = no; im.src = src; });
  imgCache.set(src, p); p.catch(() => imgCache.delete(src));
  return p;
}
export const logoSrc = './assets/brand/logo-original.jpg';
export const getLogo = () => loadImage(logoSrc);
const assetUrls = new Map();
export async function assetImage(id) {
  if (!id) return null;
  if (!assetUrls.has(id)) {
    const a = await db.get('assets', id);
    if (!a?.blob) return null;
    assetUrls.set(id, URL.createObjectURL(a.blob));
  }
  try { return await loadImage(assetUrls.get(id)); } catch { return null; }
}
export async function imagesFor(pages) {
  const ids = new Set(); for (const p of pages) for (const l of p.layers || []) if (l.type === 'image' && l.assetId) ids.add(l.assetId);
  const map = new Map(); await Promise.all([...ids].map(async (i) => map.set(i, await assetImage(i)))); return map;
}

let fontsReady;
export function ensureFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all(['400 40px "Cormorant Garamond"', 'italic 400 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter']
      .map((f) => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready);
  }
  return fontsReady;
}

/** Miniatura de uma página em canvas */
export async function drawThumb(canvas, page, format, width = 300) {
  await ensureFonts();
  const F = FORMATS[format] || FORMATS.portrait; const scale = width / F.w;
  canvas.width = Math.round(F.w * scale); canvas.height = Math.round(F.h * scale);
  const [logo, images] = await Promise.all([getLogo().catch(() => null), imagesFor([page])]);
  renderPage(canvas.getContext('2d'), page, { W: F.w, H: F.h, scale, logo, images, stamp: true });
}

/** Renderiza página em tamanho real e retorna Blob */
export async function exportPage(page, format, type = 'image/png', quality = 0.94) {
  await ensureFonts();
  const F = FORMATS[format]; const c = document.createElement('canvas'); c.width = F.w; c.height = F.h;
  const [logo, images] = await Promise.all([getLogo(), imagesFor([page])]);
  const ctx = c.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, F.w, F.h); }
  renderPage(ctx, page, { W: F.w, H: F.h, scale: 1, logo, images, stamp: true });
  return new Promise((ok) => c.toBlob(ok, type, quality));
}

// Observador para desenhar miniaturas só quando visíveis (performance com centenas de artes)
const observers = new WeakMap();
export function lazyThumbs(root, draw) {
  observers.get(root)?.disconnect();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); delete e.target.dataset.lazy; draw(e.target); }
  }, { rootMargin: '300px' });
  observers.set(root, io);
  $$('canvas[data-lazy]', root).forEach((c) => io.observe(c));
}

/** Assinatura das artes/legendas; inclui o CRP quando informado (exigência da publicidade profissional) */
export const signature = () => { const p = prefs.get(); const sig = p.signature || 'Karina Ximenes | Psicóloga'; return p.crp && !sig.includes(p.crp) ? `${sig} · CRP ${p.crp}` : sig; };
export const statusLabel = (s) => ({ ideia: t('Ideia'), rascunho: t('Rascunho'), revisao: t('Revisão'), aprovado: t('Aprovado'), publicado: t('Publicado') }[s] || s);
export const STATUSES = ['ideia', 'rascunho', 'revisao', 'aprovado', 'publicado'];

// Medição de texto real (fontes carregadas) para enquadrar as artes com precisão
let _m;
export function measureCtx() { if (!_m) _m = document.createElement('canvas').getContext('2d'); return _m; }

/** Cartão de arte (miniatura preguiçosa). spec: {phraseId, layout, palette, format} */
export function artCard(spec, { title = '', sub = '', pill = '', attrs = '' } = {}) {
  const enc = encodeURIComponent(JSON.stringify(spec));
  return `<button class="art" data-art="${enc}" ${attrs}>${pill ? `<span class="pill">${esc(pill)}</span>` : ''}<canvas data-lazy data-spec="${enc}" width="300" height="375" aria-hidden="true"></canvas>${title ? `<div class="meta"><b>${esc(title)}</b>${esc(sub)}</div>` : ''}</button>`;
}
export async function drawSpecThumb(canvas) {
  const { buildPages } = await import('./lib/templates.js');
  await ensureFonts();
  const spec = JSON.parse(decodeURIComponent(canvas.dataset.spec));
  const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
  await drawThumb(canvas, pages[0], spec.format || 'portrait', 300);
}

/** Redesenha a tela atual */
export const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

/** Tela cheia para ver a arte de perto: arraste para o lado nas páginas, para baixo para fechar, toque duplo para ampliar. */
export async function zoomPages(pages, format) {
  const bd = h(`<div class="zoom" role="dialog" aria-modal="true" aria-label="${t('Ver arte')}">
    <div class="zoom-top"><button class="zoom-x" data-zx aria-label="${t('Fechar')}">${I.close}</button><span class="zoom-n">${pages.length > 1 ? `1 / ${pages.length}` : ''}</span></div>
    <div class="zoom-track">${pages.map(() => '<div class="zoom-page"><canvas></canvas></div>').join('')}</div>
    <p class="zoom-hint">${pages.length > 1 ? t('Arraste para o lado · para baixo para fechar') : t('Toque duas vezes para ampliar · arraste para baixo para fechar')}</p></div>`);
  document.body.appendChild(bd);
  requestAnimationFrame(() => bd.classList.add('in'));
  const close = () => { bd.classList.remove('in'); setTimeout(() => bd.remove(), 220); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bd.querySelector('[data-zx]').onclick = close;
  const track = bd.querySelector('.zoom-track');
  const cs = [...bd.querySelectorAll('canvas')];
  pages.forEach((pg, i) => drawThumb(cs[i], pg, format, 1080));
  track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); const n = bd.querySelector('.zoom-n'); if (pages.length > 1) n.textContent = `${i + 1} / ${pages.length}`; }, { passive: true });
  // toque duplo amplia
  let last = 0;
  track.addEventListener('click', (e) => { const now = Date.now(); const pg = e.target.closest('.zoom-page'); if (pg && now - last < 320) pg.classList.toggle('big'); last = now; });
  // arrastar para baixo fecha
  let y0 = null; let x0 = 0; let dy = 0;
  bd.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || e.target.closest('.zoom-page.big')) { y0 = null; return; } y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; }, { passive: true });
  bd.addEventListener('touchmove', (e) => { if (y0 === null) return; dy = e.touches[0].clientY - y0; const dx = Math.abs(e.touches[0].clientX - x0); if (dx > Math.abs(dy)) { y0 = null; track.style.transform = ''; return; } if (dy > 0) { track.style.transform = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dy / 1500)})`; bd.style.background = `rgba(10,12,10,${Math.max(0.3, 0.94 - dy / 500)})`; if (e.cancelable) e.preventDefault(); } }, { passive: false });
  bd.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; if (dy > 100) close(); else { track.style.transform = ''; bd.style.background = ''; } });
  return { close };
}
