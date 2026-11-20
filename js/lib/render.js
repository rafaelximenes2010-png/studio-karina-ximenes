// Renderizador único do editor: a MESMA função desenha a prévia e o arquivo exportado,
// garantindo correspondência entre o que se vê e o que se exporta.

export const FORMATS = {
  story: { w: 1080, h: 1920, label: 'Story', sub: '1080×1920' },
  portrait: { w: 1080, h: 1350, label: 'Post vertical', sub: '1080×1350' },
  square: { w: 1080, h: 1080, label: 'Post quadrado', sub: '1080×1080' },
};

export const FONTS = {
  serif: { label: 'Cormorant (elegante)', css: '"Cormorant Garamond", Georgia, serif' },
  sans: { label: 'Inter (moderna)', css: 'Inter, "Helvetica Neue", Arial, sans-serif' },
  georgia: { label: 'Georgia (editorial)', css: 'Georgia, "Times New Roman", serif' },
  mono: { label: 'Mono (técnica)', css: '"SFMono-Regular", Menlo, Consolas, monospace' },
};

export const BRAND = { green: '#435B49', sage: '#91A595', cream: '#F5EEE2', gold: '#A8834F', graphite: '#33382F' };

export const fontString = (l, scale = 1) =>
  `${l.italic ? 'italic ' : ''}${l.weight || 400} ${Math.round((l.size || 48) * scale)}px ${(FONTS[l.font] || FONTS.serif).css}`;

function measure(ctx, s, ls) {
  const w = ctx.measureText(s).width;
  return ls ? w + ls * Math.max(0, [...s].length - 1) : w;
}

/** Quebra texto em linhas respeitando \n e largura máxima */
export function wrapText(ctx, text, maxW, ls = 0) {
  const out = [];
  for (const para of String(text ?? '').normalize('NFC').split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (measure(ctx, test, ls) > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

/** Calcula linhas e altura de uma camada de texto (em px de design) */
export function layoutText(ctx, l) {
  ctx.save();
  ctx.font = fontString(l);
  const pad = l.bg ? (l.pad ?? 28) : 0;
  const text = l.upper ? String(l.text || '').toUpperCase() : l.text;
  const lines = wrapText(ctx, text, Math.max(10, l.w - pad * 2), l.ls || 0);
  ctx.restore();
  const lineH = (l.size || 48) * (l.lh || 1.25);
  return { lines, lineH, pad, h: lines.length * lineH + pad * 2 };
}

export function layerBox(ctx, l) {
  if (l.type === 'text') return { x: l.x, y: l.y, w: l.w, h: layoutText(ctx, l).h };
  return { x: l.x, y: l.y, w: l.w, h: l.h };
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath();
}
function maskPath(ctx, mask, x, y, w, h, radius) {
  if (mask === 'circle') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
  else if (mask === 'arch') archPath(ctx, x, y, w, h);
  else if (mask === 'leaf') { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.bezierCurveTo(x, y + h * 0.2, x + w * 0.2, y, x + w, y); ctx.bezierCurveTo(x + w, y + h * 0.8, x + w * 0.8, y + h, x, y + h); ctx.closePath(); }
  else if (mask === 'blob') { ctx.beginPath(); ctx.moveTo(x + w * 0.5, y); ctx.bezierCurveTo(x + w * 0.92, y, x + w, y + h * 0.3, x + w, y + h * 0.52); ctx.bezierCurveTo(x + w, y + h * 0.85, x + w * 0.7, y + h, x + w * 0.45, y + h); ctx.bezierCurveTo(x + w * 0.12, y + h, x, y + h * 0.75, x, y + h * 0.48); ctx.bezierCurveTo(x, y + h * 0.15, x + w * 0.2, y, x + w * 0.5, y); ctx.closePath(); }
  else roundRect(ctx, x, y, w, h, radius || 0);
}

function fillBg(ctx, bg, W, H) {
  if (!bg || bg.type === 'solid') { ctx.fillStyle = bg?.c1 || BRAND.cream; ctx.fillRect(0, 0, W, H); return; }
  let g;
  if (bg.type === 'radial') g = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, Math.max(W, H) * 0.8);
  else {
    const a = ((bg.angle ?? 180) - 90) * Math.PI / 180; const r = Math.hypot(W, H) / 2;
    g = ctx.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
  }
  g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2 || bg.c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** Preenche a moldura (cover) com zoom e ponto focal (fx, fy de 0 a 1) */
function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih) * Math.max(1, zoom); const dw = iw * s; const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}

function drawText(ctx, l) {
  const { lines, lineH, pad, h } = layoutText(ctx, l);
  if (l.bg) { ctx.fillStyle = l.bg; roundRect(ctx, l.x, l.y, l.w, h, l.radius ?? 18); ctx.fill(); }
  ctx.font = fontString(l);
  ctx.fillStyle = l.color || BRAND.graphite;
  ctx.textBaseline = 'middle';
  if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3; }
  const ls = l.ls || 0; const inner = l.w - pad * 2;
  lines.forEach((ln, i) => {
    const y = l.y + pad + lineH * i + lineH / 2;
    const width = measure(ctx, ln, ls);
    let x = l.x + pad;
    if (l.align === 'center') x = l.x + pad + (inner - width) / 2;
    else if (l.align === 'right') x = l.x + pad + inner - width;
    if (!ls) { ctx.textAlign = 'left'; ctx.fillText(ln, x, y); }
    else { ctx.textAlign = 'left'; for (const ch of ln) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + ls; } }
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

function drawShape(ctx, l) {
  const { x, y, w, h } = l;
  if (l.shape === 'line') {
    ctx.strokeStyle = l.stroke || l.fill || BRAND.gold; ctx.lineWidth = l.sw || 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); return;
  }
  if (l.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
  else if (l.shape === 'arch') archPath(ctx, x, y, w, h);
  else if (l.shape === 'leaf') {
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.quadraticCurveTo(x, y, x + w, y); ctx.quadraticCurveTo(x + w, y + h, x, y + h); ctx.closePath();
  } else roundRect(ctx, x, y, w, h, l.radius || 0);
  if (l.fill) { ctx.fillStyle = l.fill; ctx.fill(); }
  if (l.stroke) { ctx.strokeStyle = l.stroke; ctx.lineWidth = l.sw || 3; ctx.stroke(); }
}

/** Selo da marca: usa SEMPRE a logomarca original (com seu fundo creme), recortada em círculo/arredondado */
function drawLogo(ctx, l, logo) {
  const { x, y, w, h } = l;
  ctx.save();
  maskPath(ctx, l.mask || 'circle', x, y, w, h, l.radius ?? w * 0.22);
  ctx.fillStyle = '#F3EDE2'; ctx.fill();
  ctx.clip();
  if (logo) {
    // a logo original tem proporção ~1,08:1; enquadra inteira, centralizada, sem cortes
    const iw = logo.naturalWidth || logo.width; const ih = logo.naturalHeight || logo.height;
    const s = Math.min(w / iw, h / ih) * (l.mask === 'rect' ? 0.98 : 1.04);
    ctx.drawImage(logo, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  }
  ctx.restore();
  if (l.ring) { ctx.save(); maskPath(ctx, l.mask || 'circle', x, y, w, h, l.radius ?? w * 0.22); ctx.strokeStyle = l.ring; ctx.lineWidth = Math.max(2, w * 0.025); ctx.stroke(); ctx.restore(); }
}


// Filtros de foto aplicados pixel a pixel (funciona igual no iPhone, Android e computador)
export const FILTERS = {
  none: { label: 'Original' },
  soft: { label: 'Suave', sat: 0.8, bright: 1.05 },
  warm: { label: 'Quente', sepia: 0.25, sat: 1.1 },
  sage: { label: 'Sálvia', sat: 0.75, tint: [145, 165, 149], tintA: 0.16, bright: 1.03 },
  bright: { label: 'Luminoso', bright: 1.12, contrast: 1.05 },
  film: { label: 'Filme', contrast: 1.1, sat: 0.85, sepia: 0.12 },
  mono: { label: 'P&B', sat: 0, contrast: 1.05 },
};
const filterCache = new WeakMap();
function filtered(img, name) {
  const f = FILTERS[name];
  if (!f || name === 'none' || typeof document === 'undefined') return img;
  let m = filterCache.get(img); if (!m) { m = {}; filterCache.set(img, m); }
  if (m[name]) return m[name];
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  const k = Math.min(1, 2200 / Math.max(iw, ih));
  const c = document.createElement('canvas'); c.width = Math.round(iw * k); c.height = Math.round(ih * k);
  const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, c.width, c.height);
  const d = cx.getImageData(0, 0, c.width, c.height); const a = d.data;
  const sat = f.sat ?? 1, br = f.bright ?? 1, ct = f.contrast ?? 1, sp = f.sepia ?? 0, ta = f.tintA ?? 0, tn = f.tint || [0, 0, 0];
  for (let i = 0; i < a.length; i += 4) {
    let r = a[i], g = a[i + 1], b = a[i + 2];
    if (sp) { const sr = r * .393 + g * .769 + b * .189, sg = r * .349 + g * .686 + b * .168, sb = r * .272 + g * .534 + b * .131; r += (sr - r) * sp; g += (sg - g) * sp; b += (sb - b) * sp; }
    const L = .2126 * r + .7152 * g + .0722 * b; r = L + (r - L) * sat; g = L + (g - L) * sat; b = L + (b - L) * sat;
    if (ta) { r += (tn[0] - r) * ta; g += (tn[1] - g) * ta; b += (tn[2] - b) * ta; }
    r = ((r * br - 128) * ct) + 128; g = ((g * br - 128) * ct) + 128; b = ((b * br - 128) * ct) + 128;
    a[i] = r < 0 ? 0 : r > 255 ? 255 : r; a[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; a[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  cx.putImageData(d, 0, 0); m[name] = c; return c;
}

function drawImage(ctx, l, img, editing) {
  const { x, y, w, h } = l;
  ctx.save();
  maskPath(ctx, l.mask || 'rect', x, y, w, h, l.radius || 0);
  ctx.clip();
  if (img) {
    drawCover(ctx, filtered(img, l.filter), x, y, w, h, l.fx ?? 0.5, l.fy ?? l.focus ?? 0.5, l.zoom ?? 1);
  } else {
    // Sem foto: preenchimento elegante (também na exportação), com dica apenas no modo de edição
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, l.ph1 || BRAND.sage); g.addColorStop(1, l.ph2 || BRAND.green);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (editing) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `600 ${Math.max(22, w * 0.045)}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Toque para adicionar foto', x + w / 2, y + h / 2);
    }
  }
  if (l.overlay) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(20,28,22,0)'); g.addColorStop(0.45, 'rgba(20,28,22,.12)'); g.addColorStop(1, `rgba(20,28,22,${l.overlay})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  if (l.frame) { ctx.save(); maskPath(ctx, l.mask || 'rect', x, y, w, h, l.radius || 0); ctx.strokeStyle = l.frame; ctx.lineWidth = l.frameW || 10; ctx.stroke(); ctx.restore(); }
}

/** Assinatura automática com a logomarca — garante a marca em toda arte exportada */
export function hasBrand(page) { return (page.layers || []).some((l) => l.type === 'logo' && !l.hidden && (l.opacity ?? 1) > 0.2 && l.w >= 60); }
export function brandStampLayer(W, H, page) {
  const s = Math.round(Math.min(W, H) * 0.085);
  return { type: 'logo', x: W - s - Math.round(W * 0.05), y: H - s - Math.round(W * 0.05), w: s, h: s, mask: 'circle', ring: page?.stampRing || 'rgba(168,131,79,.9)' };
}

/**
 * Desenha uma página.
 * opts: { W, H, scale, images: Map|obj assetId→img, logo: img, editing: bool, stamp: bool }
 */
export function renderPage(ctx, page, opts) {
  const { W, H, scale = 1, logo = null, editing = false, stamp = true } = opts;
  const getImg = (id) => (opts.images?.get ? opts.images.get(id) : opts.images?.[id]);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  fillBg(ctx, page.bg, W, H);
  const layers = [...(page.layers || [])];
  if (stamp && !hasBrand(page)) layers.push(brandStampLayer(W, H, page));
  for (const l of layers) {
    if (l.hidden) continue;
    ctx.save();
    ctx.globalAlpha = l.opacity ?? 1;
    if (l.rot) {
      const b = l.type === 'text' ? { ...l, h: layoutText(ctx, l).h } : l;
      const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
      ctx.translate(cx, cy); ctx.rotate(l.rot * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    if (l.type === 'text') drawText(ctx, l);
    else if (l.type === 'shape') drawShape(ctx, l);
    else if (l.type === 'logo') drawLogo(ctx, l, logo);
    else if (l.type === 'image') drawImage(ctx, l, getImg(l.assetId), editing);
    ctx.restore();
  }
  ctx.restore();
}

/** Contraste WCAG entre duas cores hex */
export function contrast(a, b) {
  const lum = (hex) => {
    const h = hex.replace('#', ''); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
