import { back } from '../lib/navigation.js';
// Editor visual com camadas — toque e mouse, guias, pinça, reenquadramento, desfazer/refazer, carrossel.
import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { uid, esc, debounce, clamp, deepClone, slug } from '../lib/util.js';
import { FORMATS, FONTS, FILTERS, BRAND, renderPage, layerBox, hasBrand } from '../lib/render.js';
import { PALETTES, LAYOUTS, layoutsFor, buildPages, remake } from '../lib/templates.js';

/** Novo layout: estrutura nova; fotos já escolhidas vão para as molduras novas e camadas da usuária são mantidas */
function remakeLayout(oldPages, newPages) {
  return newPages.map((np, i) => {
    const old = oldPages[i]; if (!old) return np;
    const photos = old.layers.filter((x) => x.type === 'image' && x.assetId);
    np.layers.filter((x) => x.type === 'image').forEach((x, j) => { if (photos[j]) Object.assign(x, { assetId: photos[j].assetId, fx: photos[j].fx, fy: photos[j].fy, zoom: photos[j].zoom, filter: photos[j].filter }); });
    np.layers.push(...old.layers.filter((x) => x.tpl === undefined).map((x) => JSON.parse(JSON.stringify(x))));
    return np;
  });
}
import { phraseById, captionFor, PHRASES as PHR, CATEGORIES as CATS } from '../lib/content.js';
import { jpegsToPdf } from '../lib/pdf.js';
import { I, $, $$, h, toast, sheet, confirmDialog, getLogo, imagesFor, assetImage, ensureFonts, drawThumb, exportPage, shareOrDownload, downloadBlob, copyText, measureCtx, signature } from '../ui.js';
import { chooseImage, saveImageBlob } from './media.js';

const SWATCHES = [BRAND.green, BRAND.sage, BRAND.cream, BRAND.gold, BRAND.graphite, '#FFFFFF', '#000000', '#E9DCC8', '#C7D3C9'];
const MASKS = { rect: 'Retângulo', round: 'Arredondado', circle: 'Círculo', arch: 'Arco', leaf: 'Folha', blob: 'Orgânico' };

export async function render(view, { id }) {
  const proj = await db.get('projects', id);
  if (!proj) { view.innerHTML = `<div class="empty">${t('Projeto não encontrado.')} <a href="#/criar">${t('Voltar')}</a></div>`; return; }
  document.body.classList.add('editor-mode');
  await ensureFonts();
  const logo = await getLogo();
  let images = await imagesFor(proj.pages);
  const F = () => FORMATS[proj.format];
  let pi = 0; let selId = null; let panel = null; let cropMode = false; let guides = [];
  const page = () => proj.pages[pi];
  const sel = () => page().layers.find((l) => l.id === selId) || null;

  view.innerHTML = `<div class="ed">
    <div class="ed-top">
      <button class="icon-btn" id="e-back" aria-label="${t('Voltar')}">${I.back}</button>
      <input class="name" id="e-name" value="${esc(proj.name || '')}" aria-label="${t('Nome do projeto')}">
      <span class="xs muted" id="e-saved" aria-live="polite"></span>
      <button class="icon-btn" id="e-undo" aria-label="${t('Desfazer')}">${I.undo}</button>
      <button class="icon-btn" id="e-redo" aria-label="${t('Refazer')}">${I.redo}</button>
      <button class="btn sm" id="e-export">${I.share}<span>${t('Postar')}</span></button>
    </div>
    <div class="ed-stage" id="stage"><canvas id="cv" aria-label="${t('Área de edição da arte')}" role="img"></canvas></div>
    <div class="ed-props" id="props" hidden></div>
    <div class="ed-pages" id="pages"></div>
    <div class="ed-tools" role="toolbar" aria-label="${t('Ferramentas')}">
      <button data-tool="text">${I.text}${t('Texto')}</button>
      <button data-tool="frankie">${I.sparkle}${t('Frases')}</button>
      <button data-tool="image">${I.image}${t('Foto')}</button>
      <button data-tool="colors">${I.palette}${t('Cores')}</button>
      <button data-tool="fmtquick">${I.pages}Story/Feed</button>
      <button data-tool="more" id="t-more">${I.more}${t('Mais')}</button>
      <button data-tool="style" class="adv" hidden>${I.wand}${t('Estilo')}</button>
      <button data-tool="addtext" class="adv" hidden>${I.plus}${t('Novo texto')}</button>
      <button data-tool="shape" class="adv" hidden>${I.shape}${t('Forma')}</button>
      <button data-tool="logo" class="adv" hidden>${I.logo}${t('Logo')}</button>
      <button data-tool="bg" class="adv" hidden>${I.bg}${t('Fundo')}</button>
      <button data-tool="layers" class="adv" hidden>${I.layers}${t('Camadas')}</button>
      <button data-tool="format" class="adv" hidden>${I.grid}${t('Formatos')}</button>
    </div></div>`;
  
  const cv = $('#cv', view); const ctx = cv.getContext('2d'); const stage = $('#stage', view); const props = $('#props', view);

  // ---------- Histórico e salvamento ----------
  const undo = []; const redo = [];
  const snap = () => JSON.stringify({ f: proj.format, p: proj.pages });
  let last = snap();
  const saveNow = async () => { proj.name = $('#e-name', view).value.trim() || t('Sem título'); await db.put('projects', proj); $('#e-saved', view).textContent = t('Salvo'); };
  const save = debounce(saveNow, 500);
  const commit = () => { const s = snap(); if (s === last) return; undo.push(last); if (undo.length > 80) undo.shift(); redo.length = 0; last = s; $('#e-saved', view).textContent = '…'; save(); thumbs(); updateHist(); };
  const restore = (s) => { const o = JSON.parse(s); proj.format = o.f; proj.pages = o.p; pi = Math.min(pi, proj.pages.length - 1); last = s; selId = null; fit(); draw(); thumbs(); showPanel(null); save(); updateHist(); };
  const updateHist = () => { $('#e-undo', view).disabled = !undo.length; $('#e-redo', view).disabled = !redo.length; };
  $('#e-undo', view).onclick = () => { if (undo.length) { redo.push(snap()); restore(undo.pop()); } };
  $('#e-redo', view).onclick = () => { if (redo.length) { undo.push(snap()); restore(redo.pop()); } };
  $('#e-name', view).oninput = () => save();
  $('#e-back', view).onclick = async () => { save.flush(); back('#/criar'); };
  updateHist();

  // ---------- Desenho ----------
  let scale = 1; let raf = 0;
  function fit() {
    const r = stage.getBoundingClientRect(); const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    const k = Math.min((r.width - pad) / F().w, (r.height - pad) / F().h);
    const dw = Math.max(120, Math.floor(F().w * k)); const dh = Math.floor(F().h * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
    cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); scale = cv.width / F().w;
  }
  function draw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }
  function paint() {
    renderPage(ctx, page(), { W: F().w, H: F().h, scale, logo, images, editing: true, stamp: true });
    ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // margem de segurança do Story
    if (proj.format === 'story') { ctx.fillStyle = 'rgba(67,91,73,.06)'; ctx.fillRect(0, 0, F().w, 250); ctx.fillRect(0, F().h - 280, F().w, 280); }
    for (const g of guides) { ctx.strokeStyle = '#E0457B'; ctx.lineWidth = 2 / scale * 1.5; ctx.setLineDash([]); ctx.beginPath(); if (g.x !== undefined) { ctx.moveTo(g.x, 0); ctx.lineTo(g.x, F().h); } else { ctx.moveTo(0, g.y); ctx.lineTo(F().w, g.y); } ctx.stroke(); }
    const l = sel();
    if (l) {
      const b = layerBox(ctx, l); const lw = 2.5 / scale * 1.4;
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate((l.rot || 0) * Math.PI / 180);
      ctx.strokeStyle = cropMode ? BRAND.gold : '#2F80ED'; ctx.lineWidth = lw; ctx.setLineDash(cropMode ? [14, 8] : []);
      ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.setLineDash([]);
      if (!l.locked && !cropMode) {
        const hs = 11 / scale * Math.min(2, window.devicePixelRatio || 1);
        const handle = (x, y, round) => { ctx.beginPath(); round ? ctx.arc(x, y, hs, 0, Math.PI * 2) : ctx.rect(x - hs, y - hs, hs * 2, hs * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); };
        handle(b.w / 2, b.h / 2, false);
        handle(0, -b.h / 2 - hs * 4, true);
        ctx.beginPath(); ctx.moveTo(0, -b.h / 2); ctx.lineTo(0, -b.h / 2 - hs * 3); ctx.stroke();
        if (l.type === 'text') handle(b.w / 2, 0, true);
      }
    }
    ctx.restore();
  }

  // ---------- Interação (Pointer Events: toque, caneta e mouse) ----------
  const pts = new Map(); let drag = null; let lastTap = 0;
  const toDesign = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * F().w / r.width, y: (e.clientY - r.top) * F().h / r.height }; };
  const local = (l, p) => { const b = layerBox(ctx, l); const cx = b.x + b.w / 2; const cy = b.y + b.h / 2; const a = -(l.rot || 0) * Math.PI / 180; const dx = p.x - cx; const dy = p.y - cy; return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a), b }; };
  const hit = (p) => { const ls = page().layers; for (let i = ls.length - 1; i >= 0; i--) { const l = ls[i]; if (l.hidden) continue; const q = local(l, p); if (Math.abs(q.x) <= q.b.w / 2 && Math.abs(q.y) <= q.b.h / 2) return l; } return null; };
  const handleAt = (l, p) => {
    if (!l || l.locked || cropMode) return null;
    const q = local(l, p); const k = 11 / scale * Math.min(2, window.devicePixelRatio || 1); const hs = k * 2.4; const { b } = q;
    if (Math.hypot(q.x - b.w / 2, q.y - b.h / 2) < hs) return 'resize';
    if (Math.hypot(q.x, q.y - (-b.h / 2 - k * 4)) < hs) return 'rotate';
    if (l.type === 'text' && Math.hypot(q.x - b.w / 2, q.y) < hs) return 'width';
    return null;
  };

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, toDesign(e));
    if (pts.size === 2 && sel()) { const [a, b] = [...pts.values()]; const l = sel(); drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), l0: deepClone(l) }; return; }
    const p = toDesign(e); const cur = sel();
    const hd = handleAt(cur, p);
    if (hd) { drag = { mode: hd, p0: p, l0: deepClone(cur), b0: layerBox(ctx, cur) }; return; }
    if (cropMode && cur) { drag = { mode: 'crop', p0: p, l0: deepClone(cur) }; return; }
    const l = hit(p);
    const now = Date.now(); const dbl = l && l.id === selId && now - lastTap < 350; lastTap = now;
    selId = l ? l.id : null; cropMode = false;
    if (dbl) { onDouble(l); drag = null; draw(); return; }
    drag = l && !l.locked ? { mode: 'move', p0: p, l0: deepClone(l) } : null;
    showPanel(l ? 'layer' : null); draw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, toDesign(e));
    const l = sel(); if (!drag || !l) return;
    const p = toDesign(e); const o = drag.l0;
    if (drag.mode === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()]; const k = clamp(Math.hypot(a.x - b.x, a.y - b.y) / drag.d0, 0.2, 6);
      if (cropMode && l.type === 'image') l.zoom = clamp((o.zoom || 1) * k, 1, 5);
      else scaleLayer(l, o, k);
    } else if (drag.mode === 'move') {
      l.x = Math.round(o.x + p.x - drag.p0.x); l.y = Math.round(o.y + p.y - drag.p0.y); snapGuides(l);
    } else if (drag.mode === 'crop') {
      const b = layerBox(ctx, l); l.fx = clamp((o.fx ?? 0.5) - (p.x - drag.p0.x) / b.w, 0, 1); l.fy = clamp((o.fy ?? 0.5) - (p.y - drag.p0.y) / b.h, 0, 1);
    } else if (drag.mode === 'resize') {
      const b0 = drag.b0; const cx = b0.x + b0.w / 2; const cy = b0.y + b0.h / 2;
      const d0 = Math.hypot(drag.p0.x - cx, drag.p0.y - cy); const d1 = Math.hypot(p.x - cx, p.y - cy);
      scaleLayer(l, o, clamp(d1 / Math.max(1, d0), 0.1, 8));
    } else if (drag.mode === 'width') {
      const q = local({ ...o }, p); l.w = Math.max(80, Math.round(q.b.w / 2 + q.x)); l.x = o.x;
    } else if (drag.mode === 'rotate') {
      const b = layerBox(ctx, l); let a = Math.atan2(p.y - (b.y + b.h / 2), p.x - (b.x + b.w / 2)) * 180 / Math.PI + 90;
      for (const s of [0, 90, 180, 270, 360, -90]) if (Math.abs(a - s) < 4) a = s;
      l.rot = Math.round(((a % 360) + 360) % 360);
    }
    draw();
  });
  const end = (e) => { pts.delete(e.pointerId); if (pts.size === 0) { if (drag) { drag = null; guides = []; commit(); draw(); if (panel === 'layer') showPanel('layer'); } } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  function scaleLayer(l, o, k) {
    const b0 = layerBox(ctx, o); const cx = b0.x + b0.w / 2; const cy = b0.y + b0.h / 2;
    if (l.type === 'text') { l.size = clamp(Math.round(o.size * k), 12, 400); l.w = Math.max(60, Math.round(o.w * k)); }
    else { l.w = Math.max(30, Math.round(o.w * k)); l.h = Math.max(l.shape === 'line' ? 4 : 30, Math.round(o.h * k)); }
    const b = layerBox(ctx, l); l.x = Math.round(cx - b.w / 2); l.y = Math.round(cy - b.h / 2);
  }
  function snapGuides(l) {
    guides = []; const b = layerBox(ctx, l); const tol = 10;
    const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
    if (Math.abs(cx - F().w / 2) < tol) { l.x = Math.round(F().w / 2 - b.w / 2); guides.push({ x: F().w / 2 }); }
    if (Math.abs(cy - F().h / 2) < tol) { l.y = Math.round(F().h / 2 - b.h / 2); guides.push({ y: F().h / 2 }); }
    const m = F().w * 0.085;
    if (Math.abs(b.x - m) < tol) { l.x = Math.round(m); guides.push({ x: m }); }
    if (Math.abs(b.x + b.w - (F().w - m)) < tol) { l.x = Math.round(F().w - m - b.w); guides.push({ x: F().w - m }); }
  }
  function onDouble(l) {
    if (l.type === 'text') { showPanel('layer'); setTimeout(() => $('#p-text', props)?.focus(), 60); }
    else if (l.type === 'image') replaceImage(l);
  }

  // Teclado (computador)
  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const l = sel();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('#e-redo', view) : $('#e-undo', view)).click(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); $('#e-redo', view).click(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && l) { e.preventDefault(); dup(l); return; }
    if (!l) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(l); }
    const step = e.shiftKey ? 10 : 1; const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv && !l.locked) { e.preventDefault(); l.x += mv[0]; l.y += mv[1]; draw(); commit(); }
    if (e.key === 'Escape') { selId = null; cropMode = false; showPanel(null); draw(); }
  };
  document.addEventListener('keydown', onKey);

  // Colar e arrastar imagens
  const onPaste = async (e) => {
    if (e.target.matches?.('input, textarea')) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImageAsset(await saveImageBlob(f, { name: 'colada' })); }
  };
  document.addEventListener('paste', onPaste);
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.style.outline = `3px dashed ${BRAND.sage}`; });
  stage.addEventListener('dragleave', () => { stage.style.outline = ''; });
  stage.addEventListener('drop', async (e) => {
    e.preventDefault(); stage.style.outline = '';
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { toast(t('Otimizando imagem...')); addImageAsset(await saveImageBlob(f, { name: f.name })); }
  });

  // ---------- Operações ----------
  const addLayer = (l) => { page().layers.push(l); selId = l.id; showPanel('layer'); draw(); commit(); };
  const del = (l) => { page().layers = page().layers.filter((x) => x.id !== l.id); selId = null; showPanel(null); draw(); commit(); if (l.type === 'logo' && !hasBrand(page())) toast(t('A assinatura com a logomarca continuará sendo aplicada automaticamente.'), 4000); };
  const dup = (l) => { const c = deepClone(l); c.id = uid('l'); c.x += 30; c.y += 30; addLayer(c); };
  const move = (l, dir) => { const ls = page().layers; const i = ls.indexOf(l); const j = clamp(i + dir, 0, ls.length - 1); ls.splice(i, 1); ls.splice(j, 0, l); draw(); commit(); };

  async function addImageAsset(asset) {
    if (!asset) return;
    images.set(asset.id, await assetImage(asset.id));
    const cur = sel();
    if (cur?.type === 'image') { cur.assetId = asset.id; cur.fx = 0.5; cur.fy = 0.5; cur.zoom = 1; draw(); commit(); showPanel('layer'); return; }
    const placeholder = page().layers.find((l) => l.type === 'image' && !l.assetId);
    if (placeholder) { placeholder.assetId = asset.id; selId = placeholder.id; draw(); commit(); showPanel('layer'); toast(t('Foto aplicada na moldura da arte')); return; }
    const w = Math.round(F().w * 0.72); const hh = Math.round(w * asset.h / asset.w);
    addLayer({ id: uid('l'), type: 'image', assetId: asset.id, x: Math.round((F().w - w) / 2), y: Math.round((F().h - hh) / 2), w, h: hh, mask: 'round', radius: 28 });
  }
  async function replaceImage(l) { if (l) selId = l.id; addImageAsset(await chooseImage({ title: t('Trocar foto') })); }

  // ---------- Ferramentas ----------
  $('.ed-tools', view).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    const tool = b.dataset.tool; cropMode = false;
    if (tool === 'more') { const on = b.getAttribute('aria-pressed') !== 'true'; $$('.ed-tools .adv', view).forEach((x) => (x.hidden = !on)); b.setAttribute('aria-pressed', on); return; }
    if (tool === 'text') {
      // modo simples: edita o texto principal da arte (o maior); sem texto, cria um
      const main = [...page().layers].filter((x) => x.type === 'text' && !x.hidden).sort((a, c) => c.size * c.text.length - a.size * a.text.length)[0];
      if (main) { selId = main.id; showPanel('layer'); draw(); setTimeout(() => $('#p-text', props)?.focus(), 60); return; }
    }
    if (tool === 'colors' || tool === 'fmtquick') { selId = null; showPanel(panel === tool ? null : tool); draw(); return; }
    if (tool === 'text' || tool === 'addtext') addLayer({ id: uid('l'), type: 'text', text: t('Seu texto aqui'), x: 120, y: Math.round(F().h * 0.42), w: F().w - 240, size: 72, font: 'serif', weight: 400, color: isDark(page().bg) ? BRAND.cream : BRAND.graphite, align: 'center', lh: 1.2 });
    if (tool === 'image') { selId = null; addImageAsset(await chooseImage()); }
    if (tool === 'shape') showPanel('shapes');
    if (tool === 'logo') { const s = Math.round(F().w * 0.16); addLayer({ id: uid('l'), type: 'logo', x: Math.round((F().w - s) / 2), y: Math.round((F().h - s) / 2), w: s, h: s, mask: 'circle', ring: BRAND.gold }); }
    if (tool === 'frankie') return frankie();
    if (['bg', 'layers', 'style', 'format'].includes(tool)) { selId = null; showPanel(panel === tool ? null : tool); draw(); }
  });
  const isDark = (bg) => { const c = (bg?.c1 || '#fff').replace('#', ''); const n = parseInt(c, 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 140; };

  // ---------- Frankie no editor: sugestões de frases do mesmo tema ----------
  function frankie() {
    const target = sel()?.type === 'text' ? sel() : [...page().layers].filter((x) => x.type === 'text').sort((a, b) => (b.size * b.text.length) - (a.size * a.text.length))[0];
    const cur = proj.spec ? (proj.spec.phrase || phraseById(proj.spec.phraseId)) : null;
    let cat = cur?.cat || 'reflexoes';
    const s = sheet(`<div class="frank-head"><span class="av">${I.sparkle}</span><div><b style="font-size:18px">Frankie</b><p class="small muted" style="margin:0">${target ? t('Toque numa frase para colocá-la na arte.') : t('Adicione um texto à arte para usar as sugestões.')}</p></div></div>
      <div class="chips" id="fc" style="margin-top:12px">${CATS.map((c) => `<button class="chip" data-c="${c.id}" aria-pressed="${c.id === cat}">${t(c.label)}</button>`).join('')}</div><div id="fl"></div>`);
    const paintList = () => { $('#fl', s.el).innerHTML = PHR.filter((p) => p.cat === cat && !p.items).map((p) => `<button class="list-item small" data-p="${p.id}" style="margin-top:8px;text-align:left">${esc(p.text)}</button>`).join(''); };
    s.el.onclick = (e) => {
      const c = e.target.closest('[data-c]'); if (c) { cat = c.dataset.c; $$('#fc .chip', s.el).forEach((x) => x.setAttribute('aria-pressed', x === c)); paintList(); }
      const b = e.target.closest('[data-p]'); if (b && target) { target.text = PHR.find((x) => x.id === b.dataset.p).text; selId = target.id; s.close(); draw(); commit(); showPanel('layer'); toast(t('Frase aplicada. Ajuste o tamanho se precisar.')); }
    };
    paintList();
  }

  // ---------- Painéis de propriedades ----------
  const sw = (key, cur, extra = '') => `<div class="swatches" data-sw="${key}">${extra}${SWATCHES.map((c) => `<button style="background:${c}" data-c="${c}" aria-label="${c}" aria-pressed="${String(cur).toUpperCase() === c.toUpperCase()}"></button>`).join('')}<input type="color" data-color="${key}" value="${/^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#435B49'}" aria-label="${t('Outra cor')}"></div>`;
  const range = (key, label, val, min, max, step = 1) => `<label class="field"><span>${label} <output>${val}</output></span><input type="range" data-r="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const actions = (l) => `<details class="fold" style="margin-top:10px"><summary>${t('Organizar')}</summary><div><div class="row">
      <button class="btn sm secondary" data-a="dup">${I.dup}${t('Duplicar')}</button>
      <button class="btn sm secondary" data-a="up" aria-label="${t('Trazer para frente')}">${I.up}</button>
      <button class="btn sm secondary" data-a="down" aria-label="${t('Enviar para trás')}">${I.down}</button>
      <button class="btn sm secondary" data-a="lock" aria-pressed="${!!l.locked}">${I.lock}${l.locked ? t('Destravar') : t('Travar')}</button>
      </div></div></details><button class="btn sm danger" data-a="del" style="margin-top:10px">${I.trash}${t('Remover')}</button>`;

  function showPanel(kind) {
    panel = kind; props.hidden = !kind;
    $$('.ed-tools button', view).forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === kind));
    if (!kind) { props.innerHTML = ''; requestAnimationFrame(() => { fit(); draw(); }); return; }
    const l = sel();
    let html = '';
    if (kind === 'layer' && l) {
      if (l.type === 'text') html = `<textarea class="input" id="p-text" rows="3" style="min-height:76px">${esc(l.text)}</textarea>
        <div style="margin-top:8px">${range('size', t('Tamanho da letra'), l.size, 14, 260)}</div>
        <label class="field"><span>${t('Cor do texto')}</span>${sw('color', l.color)}</label>
        <details class="fold" style="margin-top:10px"><summary>${t('Mais ajustes')}</summary><div>
        <label class="field"><span>${t('Fonte')}</span><select class="input" data-s="font">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${l.font === k ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
        <div class="row" style="margin:6px 0"><div class="seg">${['left', 'center', 'right'].map((a) => `<button data-set="align" data-v="${a}" aria-pressed="${l.align === a}">${{ left: '⇤', center: '↔', right: '⇥' }[a]}</button>`).join('')}</div>
          <div class="seg"><button data-tog="weight" aria-pressed="${(l.weight || 400) >= 600}"><b>B</b></button><button data-tog="italic" aria-pressed="${!!l.italic}"><i>I</i></button><button data-tog="upper" aria-pressed="${!!l.upper}">Aa</button><button data-tog="shadow" aria-pressed="${!!l.shadow}">${t('Sombra')}</button></div></div>
        <label class="field" style="margin-top:8px"><span>${t('Caixa de fundo')}</span>${sw('bg', l.bg, `<button data-c="" aria-pressed="${!l.bg}" style="background:linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)" aria-label="${t('Sem caixa')}"></button>`)}</label>
        <div class="grid c2" style="margin-top:8px">${range('lh', t('Entrelinhas'), l.lh || 1.22, 0.9, 2, 0.02)}${range('ls', t('Espaçamento'), l.ls || 0, -4, 20)}${range('opacity', t('Opacidade'), l.opacity ?? 1, 0.1, 1, 0.05)}${range('rot', t('Rotação'), l.rot || 0, 0, 359)}</div></div></details>`;
      if (l.type === 'image') html = `<div class="row"><button class="btn sm" data-a="replace">${I.image}${t('Trocar foto')}</button><button class="btn sm ${cropMode ? 'gold' : 'secondary'}" data-a="crop">${cropMode ? t('Concluir enquadramento') : t('Ajustar enquadramento')}</button></div>
        ${cropMode ? `<p class="xs muted">${t('Arraste a foto dentro da moldura. Use dois dedos (ou o controle) para aproximar.')}</p>${range('zoom', t('Zoom'), l.zoom || 1, 1, 5, 0.05)}` : ''}
        <label class="field" style="margin-top:8px"><span>${t('Moldura')}</span><div class="chips">${Object.entries(MASKS).map(([k, v]) => `<button class="chip" data-mask="${k}" aria-pressed="${(l.mask === 'rect' && l.radius && k === 'round') || l.mask === k}">${t(v)}</button>`).join('')}</div></label>
        <label class="field"><span>${t('Filtro')}</span><div class="chips">${Object.entries(FILTERS).map(([k, f]) => `<button class="chip" data-filter="${k}" aria-pressed="${(l.filter || 'none') === k}">${t(f.label)}</button>`).join('')}</div></label>
        <details class="fold" style="margin-top:10px"><summary>${t('Mais ajustes')}</summary><div>
        <label class="field"><span>${t('Contorno')}</span>${sw('frame', l.frame, `<button data-c="" aria-pressed="${!l.frame}" style="background:linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)" aria-label="${t('Sem contorno')}"></button>`)}</label>
        <div class="grid c2" style="margin-top:8px">${range('frameW', t('Espessura do contorno'), l.frameW || 10, 2, 40)}${range('overlay', t('Escurecer (legibilidade)'), l.overlay || 0, 0, 0.9, 0.05)}${range('opacity', t('Opacidade'), l.opacity ?? 1, 0.1, 1, 0.05)}${range('rot', t('Rotação'), l.rot || 0, 0, 359)}</div></div></details>
        ${l.assetId ? '<p class="xs muted" id="lic"></p>' : ''}`;
      if (l.type === 'shape') html = `<label class="field"><span>${t('Preenchimento')}</span>${sw('fill', l.fill, `<button data-c="" aria-pressed="${!l.fill}" style="background:linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)" aria-label="${t('Nenhum')}"></button>`)}</label>
        <label class="field" style="margin-top:8px"><span>${t('Contorno')}</span>${sw('stroke', l.stroke, `<button data-c="" aria-pressed="${!l.stroke}" style="background:linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)" aria-label="${t('Nenhum')}"></button>`)}</label>
        <div class="grid c2" style="margin-top:8px">${range('sw', t('Espessura'), l.sw || 3, 1, 30)}${range('radius', t('Cantos'), l.radius || 0, 0, 300)}${range('opacity', t('Opacidade'), l.opacity ?? 1, 0.05, 1, 0.05)}${range('rot', t('Rotação'), l.rot || 0, 0, 359)}</div>`;
      if (l.type === 'logo') html = `<p class="notice small" style="margin:0 0 10px">${t('Logomarca oficial (arquivo original). Pode ser movida e redimensionada, nunca redesenhada.')}</p>
        <label class="field"><span>${t('Formato do selo')}</span><div class="seg"><button data-set="mask" data-v="circle" aria-pressed="${l.mask !== 'rect'}">${t('Círculo')}</button><button data-set="mask" data-v="rect" aria-pressed="${l.mask === 'rect'}">${t('Arredondado')}</button></div></label>
        <label class="field" style="margin-top:8px"><span>${t('Anel')}</span>${sw('ring', l.ring, `<button data-c="" aria-pressed="${!l.ring}" style="background:linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)" aria-label="${t('Sem anel')}"></button>`)}</label>
        <div class="grid c2" style="margin-top:8px">${range('opacity', t('Opacidade'), l.opacity ?? 1, 0.3, 1, 0.05)}</div>`;
      html += actions(l);
    }
    if (kind === 'colors') html = `<h3 class="small" style="margin-bottom:10px">${t('Escolha as cores')}</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px">${Object.entries(PALETTES).map(([k, p]) => `<button data-pal="${k}" aria-label="${t(p.name)}" style="border:2px solid ${proj.spec?.palette === k ? 'var(--primary)' : 'var(--line)'};border-radius:14px;padding:0;overflow:hidden;cursor:pointer;background:none"><span style="display:block;height:44px;background:${p.bg.type === 'solid' ? p.bg.c1 : `linear-gradient(${p.bg.c1},${p.bg.c2})`};position:relative"><b style="position:absolute;inset:0;display:grid;place-items:center;color:${p.ink};font-family:var(--serif);font-size:20px">Aa</b></span><span class="xs" style="display:block;padding:4px;color:var(--text-2)">${t(p.name)}</span></button>`).join('')}</div>`;
    if (kind === 'fmtquick') html = `<h3 class="small" style="margin-bottom:10px">${t('Onde vai postar?')}</h3><div class="grid c2">${[['story', 'Story', '9:16'], ['portrait', 'Feed', '4:5']].map(([k, l2, r]) => `<button class="btn ${proj.format === k ? '' : 'secondary'}" data-fmt="${k}" style="min-height:58px;flex-direction:column;gap:0">${l2}<span class="xs" style="opacity:.8">${r}</span></button>`).join('')}</div>`;
    if (kind === 'shapes') html = `<h3 class="small" style="margin-bottom:8px">${t('Adicionar forma')}</h3><div class="chips">${[['rect', t('Retângulo')], ['round', t('Cartão')], ['ellipse', t('Círculo')], ['arch', t('Arco')], ['leaf', t('Folha')], ['line', t('Linha')], ['frame', t('Moldura')]].map(([k, v]) => `<button class="chip" data-add-shape="${k}">${v}</button>`).join('')}</div>`;
    if (kind === 'bg') {
      const bg = page().bg || {};
      html = `<h3 class="small" style="margin-bottom:8px">${t('Paletas da marca')}</h3><div class="chips">${Object.entries(PALETTES).map(([k, p]) => `<button class="chip" data-pal="${k}"><i style="width:16px;height:16px;border-radius:50%;background:${p.bg.type === 'solid' ? p.bg.c1 : `linear-gradient(${p.bg.c1},${p.bg.c2})`};border:1px solid #0002"></i>${t(p.name)}</button>`).join('')}</div>
        <label class="field" style="margin-top:8px"><span>${t('Cor de fundo')}</span>${sw('bgc1', bg.c1)}</label>
        <div class="row" style="margin:8px 0"><div class="seg">${[['solid', t('Sólido')], ['linear', t('Degradê')], ['radial', t('Radial')]].map(([k, v]) => `<button data-bgtype="${k}" aria-pressed="${(bg.type || 'solid') === k}">${v}</button>`).join('')}</div></div>
        ${bg.type && bg.type !== 'solid' ? `<label class="field"><span>${t('Segunda cor')}</span>${sw('bgc2', bg.c2)}</label>${bg.type === 'linear' ? range('angle', t('Ângulo'), bg.angle ?? 180, 0, 360) : ''}` : ''}
        <button class="btn sm ghost" data-a="bg-all" style="margin-top:8px">${t('Aplicar fundo a todas as páginas')}</button>`;
    }
    if (kind === 'layers') html = `<h3 class="small" style="margin-bottom:8px">${t('Camadas')} <span class="xs muted">(${t('topo primeiro')})</span></h3>${[...page().layers].reverse().map((x) => `<div class="list-item" style="padding:6px 8px" data-pick="${x.id}"><span class="thumb" >${{ text: I.text, image: I.image, shape: I.shape, logo: I.logo }[x.type]}</span><span class="grow small"><b>${esc(x.type === 'text' ? x.text.slice(0, 40) : x.type === 'logo' ? t('Logomarca') : x.type === 'image' ? t('Foto') : t('Forma'))}</b></span><button class="icon-btn" data-vis="${x.id}" aria-label="${t('Mostrar/ocultar')}">${x.hidden ? I.eyeoff : I.eye}</button><button class="icon-btn" data-lk="${x.id}" aria-label="${t('Travar')}" style="opacity:${x.locked ? 1 : 0.35}">${I.lock}</button></div>`).join('') || `<p class="muted small">${t('Página vazia.')}</p>`}`;
    if (kind === 'style') {
      const ph = proj.spec ? (proj.spec.phrase || phraseById(proj.spec.phraseId)) : null;
      if (proj.spec?.layout === 'carrossel-tema') html = `<p class="xs muted" style="margin:0 0 8px">${t('Carrossel temático: troque a paleta de todas as páginas de uma vez (é possível desfazer).')}</p><label class="field"><span>${t('Paleta')}</span><div class="chips">${Object.entries(PALETTES).map(([k, p]) => `<button class="chip" data-spal="${k}" aria-pressed="${proj.spec.palette === k}">${t(p.name)}</button>`).join('')}</div></label>`;
      else html = ph ? `<p class="xs muted" style="margin:0 0 8px">${t('Gera novamente a arte com a frase original. Edições manuais desta página serão substituídas (é possível desfazer).')}</p>
        <label class="field"><span>${t('Layout')}</span><div class="chips">${(ph.items ? ['lista', 'cartaolista', 'carrossel'] : layoutsFor(ph)).map((k) => `<button class="chip" data-lay="${k}" aria-pressed="${proj.spec.layout === k}">${t(LAYOUTS[k] || 'Carrossel')}</button>`).join('')}</div></label>
        <label class="field"><span>${t('Paleta')}</span><div class="chips">${Object.entries(PALETTES).map(([k, p]) => `<button class="chip" data-spal="${k}" aria-pressed="${proj.spec.palette === k}">${t(p.name)}</button>`).join('')}</div></label>`
        : `<p class="muted small">${t('Este projeto foi criado do zero. Use Fundo, Texto e Foto para ajustar o estilo, ou comece por uma arte pronta na Biblioteca.')}</p><a class="btn sm secondary" href="#/biblioteca">${t('Abrir artes prontas')}</a>`;
    }
    if (kind === 'format') html = `<h3 class="small" style="margin-bottom:8px">${t('Formato')}</h3><div class="chips">${Object.entries(FORMATS).map(([k, f]) => `<button class="chip" data-fmt="${k}" aria-pressed="${proj.format === k}">${t(f.label)} · ${f.sub}</button>`).join('')}</div>
      <h3 class="small" style="margin:12px 0 8px">${t('Páginas (carrossel)')}</h3><div class="row"><button class="btn sm secondary" data-a="pg-add">${I.plus}${t('Nova página')}</button><button class="btn sm secondary" data-a="pg-dup">${I.dup}${t('Duplicar página')}</button><button class="btn sm secondary" data-a="pg-left">←</button><button class="btn sm secondary" data-a="pg-right">→</button><button class="btn sm danger" data-a="pg-del" ${proj.pages.length < 2 ? 'disabled' : ''}>${I.trash}</button></div>`;
    props.innerHTML = `<div class="row between" style="margin-bottom:6px"><span class="eyebrow">${kind === 'layer' && l ? t({ text: 'Texto', image: 'Foto', shape: 'Forma', logo: 'Logomarca' }[l.type]) : ''}</span><button class="icon-btn" data-a="close" aria-label="${t('Fechar painel')}" >${I.close}</button></div>${html}`;
    if (l?.type === 'image' && l.assetId) db.get('assets', l.assetId).then((a) => { const el = $('#lic', props); if (el && a?.license) el.textContent = `${t('Imagem')}: ${a.author || '?'} · ${a.license} · Wikimedia Commons`; });
    requestAnimationFrame(() => { fit(); draw(); });
  }

  props.addEventListener('input', (e) => {
    const l = sel(); const tg = e.target;
    if (tg.id === 'p-text' && l) { l.text = tg.value; draw(); return; }
    if (tg.dataset.r) {
      const v = parseFloat(tg.value); tg.closest('label').querySelector('output').textContent = v;
      if (tg.dataset.r === 'angle') { page().bg.angle = v; } else if (l) l[tg.dataset.r] = v;
      draw();
    }
    if (tg.dataset.color) applyColor(tg.dataset.color, tg.value, false);
    if (tg.dataset.s && l) { l[tg.dataset.s] = tg.value; draw(); commit(); }
  });
  props.addEventListener('change', (e) => { if (e.target.matches('textarea, input[type=range], input[type=color]')) commit(); });

  function applyColor(key, c, doCommit = true) {
    const l = sel();
    if (key === 'bgc1') page().bg = { ...page().bg, c1: c || BRAND.cream };
    else if (key === 'bgc2') page().bg = { ...page().bg, c2: c };
    else if (l) l[key] = c || '';
    draw(); if (doCommit) { commit(); showPanel(panel); }
  }

  props.addEventListener('click', async (e) => {
    const l = sel(); const tg = e.target.closest('button'); if (!tg) return;
    if (tg.closest('[data-sw]') && tg.dataset.c !== undefined) return applyColor(tg.closest('[data-sw]').dataset.sw, tg.dataset.c);
    if (tg.dataset.set && l) { l[tg.dataset.set] = tg.dataset.v; draw(); commit(); return showPanel('layer'); }
    if (tg.dataset.tog && l) { const k = tg.dataset.tog; if (k === 'weight') l.weight = (l.weight || 400) >= 600 ? 400 : 700; else l[k] = !l[k]; draw(); commit(); return showPanel('layer'); }
    if (tg.dataset.mask && l) { if (tg.dataset.mask === 'round') { l.mask = 'rect'; l.radius = Math.round(Math.min(l.w, l.h) * 0.08); } else { l.mask = tg.dataset.mask; if (tg.dataset.mask === 'rect') l.radius = 0; } draw(); commit(); return showPanel('layer'); }
    if (tg.dataset.filter && l) { l.filter = tg.dataset.filter; draw(); commit(); return showPanel('layer'); }
    if (tg.dataset.addShape) {
      const k = tg.dataset.addShape; const s = Math.round(F().w * 0.4); const base = { id: uid('l'), type: 'shape', x: Math.round((F().w - s) / 2), y: Math.round((F().h - s) / 2), w: s, h: s };
      const map = { rect: { shape: 'rect', fill: BRAND.sage }, round: { shape: 'rect', fill: BRAND.cream, radius: 40, w: F().w * 0.8, h: s }, ellipse: { shape: 'ellipse', fill: BRAND.gold, opacity: 0.85 }, arch: { shape: 'arch', fill: BRAND.sage, h: s * 1.3 }, leaf: { shape: 'leaf', fill: BRAND.sage, h: s * 0.6 }, line: { shape: 'line', stroke: BRAND.gold, sw: 4, h: 10 }, frame: { shape: 'rect', stroke: BRAND.gold, sw: 4, x: 50, y: 50, w: F().w - 100, h: F().h - 100 } };
      const o = { ...base, ...map[k] }; o.w = Math.round(o.w); o.h = Math.round(o.h); if (k === 'round') o.x = Math.round((F().w - o.w) / 2);
      if (k === 'frame' || k === 'round') page().layers.splice(0, 0, o), selId = o.id, draw(), commit(), showPanel('layer'); else addLayer(o);
      return;
    }
    if (tg.dataset.pal) {
      const key = tg.dataset.pal; const p = PALETTES[key];
      if (proj.spec) { proj.spec = { ...proj.spec, palette: key }; proj.pages = remake(proj.pages, proj.format, { ...proj.spec, format: proj.format }, { sig: signature(), mctx: measureCtx(), keepColors: false }); }
      else {
        const from = Object.values(PALETTES).find((x) => x.bg.c1 === page().bg?.c1);
        const map = {}; if (from) for (const r of ['ink', 'label', 'accent', 'soft', 'card', 'cardInk', 'ring']) map[String(from[r]).toUpperCase()] = p[r];
        page().bg = { ...p.bg }; page().stampRing = p.ring;
        for (const x of page().layers) for (const k of ['color', 'fill', 'stroke', 'ring', 'bg']) { const v = String(x[k] || '').toUpperCase(); if (map[v]) x[k] = map[v]; else if (k === 'color' && x.type === 'text' && !x.bg && !from) x.color = p.ink; }
      }
      draw(); commit(); return showPanel(panel === 'colors' ? 'colors' : 'bg');
    }
    if (tg.dataset.bgtype) { const bg = page().bg || {}; page().bg = { ...bg, type: tg.dataset.bgtype, c2: bg.c2 || BRAND.sage, angle: bg.angle ?? 180 }; draw(); commit(); return showPanel('bg'); }
    if (tg.dataset.lay || tg.dataset.spal) {
      const spec = { ...proj.spec, ...(tg.dataset.lay ? { layout: tg.dataset.lay } : {}), ...(tg.dataset.spal ? { palette: tg.dataset.spal } : {}), format: proj.format };
      const layoutChanged = tg.dataset.lay && tg.dataset.lay !== proj.spec.layout;
      const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
      // troca de layout muda a estrutura (gera de novo, mantendo fotos e camadas adicionadas); troca de paleta preserva tudo
      proj.pages = layoutChanged ? remakeLayout(proj.pages, pages) : remake(proj.pages, proj.format, spec, { sig: signature(), mctx: measureCtx(), keepColors: false });
      proj.spec = spec; pi = Math.min(pi, proj.pages.length - 1);
      images = await imagesFor(proj.pages); selId = null; draw(); commit(); return showPanel('style');
    }
    if (tg.dataset.fmt) {
      const to = tg.dataset.fmt; if (to === proj.format) return;
      // Artes do Studio: refaz o layout ideal no novo formato preservando textos, fotos e camadas adicionadas.
      if (proj.spec) proj.pages = remake(proj.pages, proj.format, { ...proj.spec, format: to }, { sig: signature(), mctx: measureCtx(), keepColors: true });
      else {
        const H0 = F().h; const sy = FORMATS[to].h / H0; const k = Math.min(1, sy);
        for (const p of proj.pages) for (const x of p.layers) {
          const b = layerBox(ctx, x); const cy = b.y + b.h / 2;
          if (x.type !== 'text' && x.h >= H0 * 0.75) { x.y = Math.round(x.y * sy); x.h = Math.round(x.h * sy); continue; }
          if (k < 1) { const cx = b.x + b.w / 2; if (x.type === 'text') x.size = Math.max(14, Math.round(x.size * (0.4 + 0.6 * k))); else { x.w = Math.round(x.w * k); x.h = Math.round(x.h * k); } x.x = Math.round(cx - layerBox(ctx, x).w / 2); }
          x.y = Math.round(cy * sy - layerBox(ctx, x).h / 2);
        }
      }
      proj.format = to; images = await imagesFor(proj.pages); fit(); draw(); commit(); thumbs(); return showPanel(panel === 'fmtquick' ? 'fmtquick' : 'format');
    }
    const a = tg.dataset.a;
    if (a === 'close') { selId = null; cropMode = false; showPanel(null); draw(); }
    if (a === 'dup' && l) dup(l);
    if (a === 'del' && l) del(l);
    if (a === 'up' && l) move(l, 1);
    if (a === 'down' && l) move(l, -1);
    if (a === 'lock' && l) { l.locked = !l.locked; commit(); showPanel('layer'); draw(); }
    if (a === 'replace' && l) replaceImage(l);
    if (a === 'crop' && l) { cropMode = !cropMode; if (!l.assetId && cropMode) { cropMode = false; return replaceImage(l); } showPanel('layer'); draw(); }
    if (a === 'bg-all') { for (const p of proj.pages) { p.bg = deepClone(page().bg); p.stampRing = page().stampRing; } commit(); toast(t('Fundo aplicado a todas as páginas')); }
    if (a === 'pg-add') { const s = Math.round(F().w * 0.12); proj.pages.splice(pi + 1, 0, { bg: deepClone(page().bg), stampRing: page().stampRing, layers: [{ id: uid('l'), type: 'text', text: t('Seu texto aqui'), x: 120, y: Math.round(F().h * 0.4), w: F().w - 240, size: 68, font: 'serif', color: isDark(page().bg) ? BRAND.cream : BRAND.graphite, align: 'center', lh: 1.2 }, { id: uid('l'), type: 'logo', x: (F().w - s) / 2, y: F().h - s - (proj.format === 'story' ? 300 : 90), w: s, h: s, mask: 'circle', ring: page().stampRing || BRAND.gold }] }); pi++; selId = null; commit(); draw(); showPanel('format'); }
    if (a === 'pg-dup') { const c = deepClone(page()); c.layers.forEach((x) => (x.id = uid('l'))); proj.pages.splice(pi + 1, 0, c); pi++; commit(); draw(); }
    if (a === 'pg-del' && proj.pages.length > 1) { if (await confirmDialog(t('Excluir esta página?'), { ok: t('Excluir'), danger: true })) { proj.pages.splice(pi, 1); pi = Math.max(0, pi - 1); selId = null; commit(); draw(); showPanel('format'); } }
    if (a === 'pg-left' && pi > 0) { [proj.pages[pi - 1], proj.pages[pi]] = [proj.pages[pi], proj.pages[pi - 1]]; pi--; commit(); draw(); }
    if (a === 'pg-right' && pi < proj.pages.length - 1) { [proj.pages[pi + 1], proj.pages[pi]] = [proj.pages[pi], proj.pages[pi + 1]]; pi++; commit(); draw(); }
    const pk = tg.closest('[data-vis]') || tg.closest('[data-lk]');
    if (pk) { const x = page().layers.find((y) => y.id === (pk.dataset.vis || pk.dataset.lk)); if (pk.dataset.vis) x.hidden = !x.hidden; else x.locked = !x.locked; commit(); draw(); showPanel('layers'); }
  });
  props.addEventListener('click', (e) => { const r = e.target.closest('[data-pick]'); if (r && !e.target.closest('button')) { selId = r.dataset.pick; showPanel('layer'); draw(); } });

  // ---------- Páginas ----------
  const pagesEl = $('#pages', view);
  const thumbs = debounce(async () => {
    pagesEl.innerHTML = proj.pages.map((_, i) => `<button class="pg" data-pg="${i}" aria-current="${i === pi}" aria-label="${t('Página')} ${i + 1}"><canvas></canvas></button>`).join('') +
      `<button class="btn sm ghost" data-newpg aria-label="${t('Nova página')}">${I.plus}</button><span class="xs muted" style="margin-left:auto">${proj.pages.length > 1 ? t('Carrossel') + ' · ' : ''}${t(F().label)} ${F().sub}</span>`;
    const cs = $$('canvas', pagesEl);
    for (let i = 0; i < cs.length; i++) await drawThumb(cs[i], proj.pages[i], proj.format, 92);
  }, 250);
  pagesEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]'); if (b) { pi = +b.dataset.pg; selId = null; showPanel(panel === 'layer' ? null : panel); draw(); $$('[data-pg]', pagesEl).forEach((x) => x.setAttribute('aria-current', +x.dataset.pg === pi)); }
    if (e.target.closest('[data-newpg]')) { showPanel('format'); props.querySelector('[data-a="pg-add"]').click(); }
  });

  // ---------- Exportação ----------
  $('#e-export', view).onclick = async () => {
    save.flush();
    const post = proj.postId ? await db.get('posts', proj.postId) : null;
    const ph = proj.spec ? (proj.spec.phrase || phraseById(proj.spec.phraseId)) : null;
    const caption = post?.caption || (ph ? captionFor(ph, { signature: signature() }) : '');
    const multi = proj.pages.length > 1;
    const s = sheet(`<h3>${t('Postar')}</h3>
      <p class="xs muted" style="margin:4px 0 14px">${t('A arte é exportada em alta resolução ({w}×{h}), idêntica à prévia, sempre com a logomarca oficial.', { w: F().w, h: F().h })}</p>
      <div class="stack">
        <button class="btn block" data-x="share" style="min-height:54px;font-size:17px">${I.share}${t('Postar no Instagram')}</button>
        <div class="grid c2"><button class="btn secondary" data-x="png">PNG${multi ? ' · ' + t('todas') : ''}</button><button class="btn secondary" data-x="jpg">JPG${multi ? ' · ' + t('todas') : ''}</button></div>
        <button class="btn secondary block" data-x="pdf">${I.doc}PDF${multi ? ' (' + t('carrossel') + ')' : ''}</button>
        ${multi ? `<button class="btn ghost block" data-x="cur">${t('Somente a página atual (PNG)')}</button>` : ''}
      </div>
      ${caption ? `<h3 style="margin:18px 0 6px" class="small">${t('Legenda sugerida')}</h3><div class="result small" style="max-height:180px;overflow:auto">${esc(caption)}</div><button class="btn sm secondary" data-x="cap" style="margin-top:8px">${I.copy}${t('Copiar legenda')}</button>` : ''}
      ${post ? `<h3 style="margin:18px 0 6px" class="small">${t('Agenda')}: ${esc(post.date)}</h3><div class="row"><button class="btn sm secondary" data-st="revisao">${t('Enviar para revisão')}</button><button class="btn sm secondary" data-st="aprovado">${t('Aprovar')}</button><button class="btn sm" data-st="publicado">${t('Marcar como publicado')}</button></div>` : ''}
      <p class="xs muted" style="margin-top:14px">${t('Revise o conteúdo antes de publicar. Evite promessas de cura e respeite o Código de Ética Profissional do Psicólogo.')}</p>`);
    const base = slug(proj.name);
    const render = async (type) => { toast(t('Gerando arquivos...')); const out = []; for (let i = 0; i < proj.pages.length; i++) { const b = await exportPage(proj.pages[i], proj.format, type); out.push(new File([b], `${base}${multi ? '-' + (i + 1) : ''}.${type === 'image/png' ? 'png' : 'jpg'}`, { type })); } return out; };
    s.el.addEventListener('click', async (e) => {
      const x = e.target.closest('[data-x]')?.dataset.x; const st = e.target.closest('[data-st]')?.dataset.st;
      try {
        if (x === 'share') { if (caption) navigator.clipboard?.writeText(caption).catch(() => {}); const files = await render('image/png'); const r = await shareOrDownload(files, { text: caption }); if (r === 'downloaded') toast(t('Arquivos baixados. Compartilhamento direto não disponível neste navegador.')); if (caption && r === 'shared') copyText(caption); }
        if (x === 'png' || x === 'jpg') { for (const f of await render(x === 'png' ? 'image/png' : 'image/jpeg')) downloadBlob(f, f.name); toast(t('Download iniciado')); }
        if (x === 'cur') { const b = await exportPage(page(), proj.format); downloadBlob(b, `${base}-${pi + 1}.png`); }
        if (x === 'pdf') { toast(t('Gerando PDF...')); const pages = []; for (const p of proj.pages) { const b = await exportPage(p, proj.format, 'image/jpeg', 0.92); pages.push({ jpeg: new Uint8Array(await b.arrayBuffer()), w: F().w, h: F().h }); } downloadBlob(new Blob([jpegsToPdf(pages, { title: proj.name })], { type: 'application/pdf' }), `${base}.pdf`); }
        if (x === 'cap') copyText(caption);
        if (st && post) { post.status = st; post.projectId = proj.id; post.history = [...(post.history || []), { at: Date.now(), status: st }]; await db.put('posts', post); toast(t('Status atualizado na agenda')); s.close(); }
      } catch (err) { console.error(err); toast(t('Não foi possível exportar: {e}', { e: err.message })); }
    });
  };

  // ---------- Início ----------
  const ro = new ResizeObserver(() => { fit(); draw(); }); ro.observe(stage);
  fit(); draw(); thumbs();
  if (proj.pages[0].layers.some((l) => l.type === 'image' && !l.assetId)) toast(t('Dica: toque duas vezes na moldura para colocar sua foto.'), 4000);
  return (o = {}) => { if (!o.stale) save.flush(); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); document.body.classList.remove('editor-mode'); };
}
