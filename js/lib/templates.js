// Gerador de artes: frases originais × layouts × paletas da marca.
// Toda arte inclui a logomarca ORIGINAL (camada "logo") e a assinatura institucional.
import { FORMATS, BRAND, layoutText } from './render.js';
import { PHRASES, CATEGORIES, phraseById } from './content.js';

export const PALETTES = {
  verde: { name: 'Verde profundo', bg: { type: 'solid', c1: BRAND.green }, ink: BRAND.cream, label: BRAND.cream, accent: BRAND.gold, soft: '#56705C', card: BRAND.cream, cardInk: BRAND.graphite, ring: BRAND.gold },
  creme: { name: 'Creme', bg: { type: 'solid', c1: BRAND.cream }, ink: BRAND.graphite, label: BRAND.green, accent: BRAND.gold, soft: '#E6DCC9', card: '#FFFFFF', cardInk: BRAND.graphite, ring: BRAND.gold },
  salvia: { name: 'Sálvia', bg: { type: 'solid', c1: BRAND.sage }, ink: '#22281F', label: '#22281F', accent: BRAND.cream, soft: '#A3B4A6', card: BRAND.cream, cardInk: BRAND.graphite, ring: BRAND.cream },
  grafite: { name: 'Grafite', bg: { type: 'solid', c1: BRAND.graphite }, ink: BRAND.cream, label: '#E4D3B4', accent: BRAND.gold, soft: '#454B40', card: BRAND.cream, cardInk: BRAND.graphite, ring: BRAND.gold },
  dourado: { name: 'Linho dourado', bg: { type: 'solid', c1: '#EFE3CF' }, ink: BRAND.graphite, label: '#6E5530', accent: BRAND.gold, soft: '#E3D2B6', card: '#FFFDF8', cardInk: BRAND.graphite, ring: BRAND.gold },
  aurora: { name: 'Aurora sálvia', bg: { type: 'linear', c1: '#B9C7BB', c2: BRAND.cream, angle: 160 }, ink: BRAND.graphite, label: BRAND.green, accent: BRAND.gold, soft: '#D5DDD2', card: '#FFFFFF', cardInk: BRAND.graphite, ring: BRAND.green },
  floresta: { name: 'Floresta', bg: { type: 'linear', c1: BRAND.green, c2: BRAND.graphite, angle: 170 }, ink: BRAND.cream, label: '#E4D3B4', accent: BRAND.gold, soft: '#4C6352', card: BRAND.cream, cardInk: BRAND.graphite, ring: BRAND.gold },
  // Cores alegres (pedido da Karina): amarelo, lilás e bronze — todas com contraste AA conferido em teste
  amarelo: { name: 'Amarelo sol', mood: 'alegre', bg: { type: 'solid', c1: '#F6D365' }, ink: '#2B2A1F', label: '#5A4310', accent: '#435B49', soft: '#FBE7A1', card: '#FFFDF5', cardInk: '#33382F', ring: '#8C5A1E' },
  manha: { name: 'Manhã dourada', mood: 'alegre', bg: { type: 'linear', c1: '#FFE6A3', c2: '#F4B860', angle: 160 }, ink: '#2B2A1F', label: '#5A4310', accent: '#435B49', soft: '#FFF2CC', card: '#FFFFFF', cardInk: '#33382F', ring: '#8C5A1E' },
  lilas: { name: 'Lilás', mood: 'alegre', bg: { type: 'solid', c1: '#D9C8EE' }, ink: '#2E2340', label: '#3F2D5C', accent: '#7A5BA6', soft: '#E9DEF7', card: '#FFFFFF', cardInk: '#2E2340', ring: '#7A5BA6' },
  ametista: { name: 'Ametista', mood: 'alegre', bg: { type: 'linear', c1: '#6A4E98', c2: '#4A3570', angle: 165 }, ink: '#FBF7FF', label: '#EADDFB', accent: '#E8C77A', soft: '#5E4689', card: '#F7F1FF', cardInk: '#2E2340', ring: '#E8C77A' },
  bronze: { name: 'Bronze', mood: 'alegre', bg: { type: 'solid', c1: '#8A5A2B' }, ink: '#FFF8EE', label: '#F6E2C6', accent: '#F1C27D', soft: '#74491F', card: '#FFF8EE', cardInk: '#3A2A1A', ring: '#F1C27D' },
  bronzeclaro: { name: 'Bronze dourado', mood: 'alegre', bg: { type: 'linear', c1: '#F0D6B4', c2: '#C9925A', angle: 170 }, ink: '#2F2418', label: '#4A3315', accent: '#8A5A2B', soft: '#F6E5CE', card: '#FFFDF8', cardInk: '#33382F', ring: '#8A5A2B' },
  linho: { name: 'Linho claro', bg: { type: 'solid', c1: '#FBF8F2' }, ink: BRAND.green, label: BRAND.green, accent: BRAND.gold, soft: '#EEE7DA', card: BRAND.cream, cardInk: BRAND.graphite, ring: BRAND.green },
};

export const LAYOUTS = {
  minimal: 'Minimalista', editorial: 'Editorial', aspas: 'Citação', moldura: 'Moldura', dividido: 'Dividido',
  arco: 'Arco', foto: 'Fotográfico', fotoarco: 'Foto em arco', fotocirculo: 'Retrato circular', fotofaixa: 'Foto panorâmica', fotolista: 'Lista com foto', comparativo: 'Lado a lado', paisagem: 'Paisagem moderna', paisagemcentro: 'Paisagem com cartão', tipografico: 'Tipográfico', cartao: 'Cartão',
  circulo: 'Círculo', folhas: 'Botânico', campanha: 'Campanha', institucional: 'Institucional', lista: 'Lista', cartaolista: 'Lista em cartão',
};
const TEXT_LAYOUTS = ['minimal', 'editorial', 'aspas', 'moldura', 'dividido', 'arco', 'foto', 'fotoarco', 'tipografico', 'cartao', 'circulo', 'folhas', 'campanha', 'institucional'];
const LIST_LAYOUTS = ['lista', 'cartaolista'];
export const layoutsFor = (p) => (p.items ? LIST_LAYOUTS : TEXT_LAYOUTS);

let lid = 0;
const id = () => 'l' + (++lid).toString(36) + Math.random().toString(36).slice(2, 6);
const T = (text, x, y, w, size, o = {}) => ({ id: id(), type: 'text', text, x, y, w, size, font: 'serif', weight: 400, color: '#33382F', align: 'center', lh: 1.22, ...o });
const S = (shape, x, y, w, h, o = {}) => ({ id: id(), type: 'shape', shape, x, y, w, h, ...o });
const LOGO = (x, y, s, o = {}) => ({ id: id(), type: 'logo', x, y, w: s, h: s, mask: 'circle', ...o });
const IMG = (x, y, w, h, o = {}) => ({ id: id(), type: 'image', x, y, w, h, assetId: null, ...o });

const K = { serif: 0.43, sans: 0.53, georgia: 0.5, mono: 0.6 };
function textH(l, mctx) {
  if (mctx) return layoutText(mctx, l).h;
  const pad = l.bg ? (l.pad ?? 28) : 0; const cw = l.size * (K[l.font] || 0.5) * (l.upper ? 1.15 : 1) + (l.ls || 0);
  const per = Math.max(1, Math.floor((l.w - pad * 2) / cw));
  const lines = String(l.text).split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / per)), 0);
  return lines * l.size * (l.lh || 1.22) + pad * 2;
}
/** Reduz a fonte até caber na altura e centraliza verticalmente em [top, top+maxH] */
function fit(l, top, maxH, mctx, valign = 'center') {
  let h = textH(l, mctx);
  while (h > maxH && l.size > 22) { l.size = Math.round(l.size * 0.93); h = textH(l, mctx); }
  l.y = Math.round(valign === 'top' ? top : valign === 'bottom' ? top + maxH - h : top + (maxH - h) / 2);
  return l;
}

function frame(fmt) {
  const { w: W, h: H } = FORMATS[fmt];
  const m = Math.round(W * 0.085);
  const top = fmt === 'story' ? 250 : m;
  const bot = fmt === 'story' ? H - 280 : H - m;
  return { W, H, m, top, bot };
}

/** Rodapé com logo + assinatura */
function footer(F, pal, sig, mode = 'center', onDark = null) {
  const s = Math.round(F.W * (mode === 'center' ? 0.13 : 0.11));
  const ink = onDark || pal.ink;
  if (mode === 'center') {
    const y = F.bot - s - 64;
    return [LOGO((F.W - s) / 2, y, s, { ring: pal.ring }), T(sig, F.m, y + s + 16, F.W - F.m * 2, 30, { font: 'sans', weight: 500, color: ink, ls: 1.5 })];
  }
  const y = F.bot - s;
  return [
    LOGO(F.m, y, s, { ring: pal.ring }),
    T(sig.split('|')[0].trim(), F.m + s + 26, y + s * 0.12, F.W - F.m * 2 - s - 26, 40, { align: 'left', color: ink, weight: 600 }),
    T((sig.split('|')[1] || 'Psicóloga').trim(), F.m + s + 26, y + s * 0.56, F.W - F.m * 2 - s - 26, 22, { align: 'left', font: 'sans', weight: 600, upper: true, ls: 6, color: ink }),
  ];
}
// O selo do tema aparece na arte, exceto para as frases da própria Karina (categoria interna)
const labelOf = (p) => (p.campaign || (p.cat === 'minhas' ? '' : CATEGORIES.find((c) => c.id === p.cat)?.label) || '').toUpperCase();

// -------------------- LAYOUTS --------------------
const L = {
  minimal(p, pal, F, o) {
    const ls = [];
    ls.push(T(labelOf(p), F.m, F.top + 10, F.W - F.m * 2, 24, { font: 'sans', weight: 600, ls: 6, color: pal.label }));
    ls.push(S('line', F.W / 2 - 50, F.top + 70, 100, 6, { stroke: pal.accent, sw: 3 }));
    const ft = footer(F, pal, o.sig, 'center');
    const t = T(p.text, F.m + 20, 0, F.W - F.m * 2 - 40, 76, { color: pal.ink });
    fit(t, F.top + 120, ft[0].y - F.top - 180, o.mctx);
    ls.push(t);
    if (p.credit) ls.push(T(p.credit, F.m, t.y + textH(t, o.mctx) + 30, F.W - F.m * 2, 26, { font: 'sans', italic: false, color: pal.label, weight: 500 }));
    return [...ls, ...ft];
  },
  editorial(p, pal, F, o) {
    const ls = [S('rect', F.m, F.top, 10, 120, { fill: pal.accent, radius: 5 }),
      T(labelOf(p), F.m + 34, F.top + 4, F.W - F.m * 2, 24, { font: 'sans', weight: 700, ls: 5, color: pal.label, align: 'left' }),
      T(String(new Date().getFullYear()), F.m + 34, F.top + 50, 400, 34, { font: 'serif', italic: true, color: pal.label, align: 'left' })];
    const ft = footer(F, pal, o.sig, 'left');
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 84, { align: 'left', color: pal.ink, weight: 600, lh: 1.15 });
    fit(t, F.top + 190, ft[0].y - F.top - 290, o.mctx);
    ls.push(t, S('line', F.m, t.y + textH(t, o.mctx) + 40, 220, 6, { stroke: pal.accent, sw: 3 }));
    if (p.credit) ls.push(T(p.credit, F.m, t.y + textH(t, o.mctx) + 70, F.W - F.m * 2, 26, { font: 'sans', color: pal.label, align: 'left' }));
    return [...ls, ...ft];
  },
  aspas(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'center');
    const ls = [T('“', F.W / 2 - 150, F.top - 30, 300, 330, { color: pal.accent, lh: 1, font: 'serif' })];
    const t = T(p.text, F.m + 30, 0, F.W - F.m * 2 - 60, 70, { italic: true, color: pal.ink });
    fit(t, F.top + 280, ft[0].y - F.top - 340, o.mctx);
    ls.push(t);
    ls.push(T(p.credit || labelOf(p), F.m, t.y + textH(t, o.mctx) + 36, F.W - F.m * 2, 24, { font: 'sans', weight: 600, ls: 3, upper: !p.credit, color: pal.label }));
    return [...ls, ...ft];
  },
  moldura(p, pal, F, o) {
    const inset = Math.round(F.W * 0.05);
    const ls = [S('rect', inset, inset, F.W - inset * 2, F.H - inset * 2, { stroke: pal.accent, sw: 4, radius: 0 }),
      S('rect', inset + 16, inset + 16, F.W - inset * 2 - 32, F.H - inset * 2 - 32, { stroke: pal.accent, sw: 1.5, radius: 0 })];
    const ft = footer(F, pal, o.sig, 'center');
    ls.push(T(labelOf(p), F.m, F.top + 40, F.W - F.m * 2, 24, { font: 'sans', weight: 600, ls: 6, color: pal.label }));
    const t = T(p.text, F.m + 40, 0, F.W - F.m * 2 - 80, 74, { color: pal.ink });
    fit(t, F.top + 120, ft[0].y - F.top - 170, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  dividido(p, pal, F, o) {
    const split = Math.round(F.H * 0.42);
    const ls = [S('rect', 0, 0, F.W, split, { fill: pal.soft }),
      T(labelOf(p), F.m, F.top + 10, F.W - F.m * 2, 26, { font: 'sans', weight: 700, ls: 6, color: pal.label, align: 'left' }),
      T(p.cat === 'datas' ? (p.campaign || '') : 'Para refletir', F.m, F.top + 60, F.W - F.m * 2, 86, { italic: true, color: pal.ink, align: 'left', lh: 1.05 }),
      S('ellipse', F.W - F.m - 150, split - 75, 150, 150, { fill: pal.accent }),
      T('“', F.W - F.m - 150, split - 82, 150, 150, { color: pal.bg.c1 === BRAND.cream ? '#FFFFFF' : BRAND.cream, lh: 1.05, size: 170 })];
    const ft = footer(F, pal, o.sig, 'left');
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 72, { align: 'left', color: pal.ink });
    fit(t, split + 110, ft[0].y - split - 170, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  arco(p, pal, F, o) {
    const aw = F.W - F.m * 2.2; const ax = (F.W - aw) / 2;
    const ft = footer(F, pal, o.sig, 'center');
    const ah = ft[0].y - F.top - 60;
    const ls = [S('arch', ax, F.top, aw, ah, { fill: pal.soft }),
      T(labelOf(p), ax + 40, F.top + aw * 0.28, aw - 80, 22, { font: 'sans', weight: 700, ls: 5, color: pal.label })];
    const t = T(p.text, ax + 60, 0, aw - 120, 70, { color: pal.ink });
    fit(t, F.top + aw * 0.28 + 70, ah - aw * 0.28 - 120, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  foto(p, pal, F, o) {
    const ls = [IMG(0, 0, F.W, F.H, { overlay: 0.78, ph1: pal.soft, ph2: BRAND.graphite })];
    const ft = footer(F, pal, o.sig, 'left', BRAND.cream);
    ls.push(T(labelOf(p), F.m, F.top + 10, F.W - F.m * 2, 24, { font: 'sans', weight: 700, ls: 6, color: BRAND.cream, align: 'left', shadow: true }));
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 74, { align: 'left', color: '#FFFFFF', shadow: true, weight: 600 });
    fit(t, F.H * 0.38, ft[0].y - F.H * 0.38 - 60, o.mctx, 'bottom');
    ls.push(t);
    return [...ls, ...ft];
  },
  fotoarco(p, pal, F, o) {
    const aw = F.W * 0.66; const ah = (F.H - F.top) * (F.H > 1400 ? 0.42 : 0.4);
    const ls = [IMG((F.W - aw) / 2, F.top, aw, ah, { mask: 'arch', ph1: pal.soft, ph2: pal.accent })];
    const ft = footer(F, pal, o.sig, 'center');
    const t = T(p.text, F.m + 20, 0, F.W - F.m * 2 - 40, 64, { color: pal.ink });
    fit(t, F.top + ah + 40, ft[0].y - F.top - ah - 80, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  // Modernos: paisagem real em tela cheia, texto limpo e logomarca
  // Lado a lado: título, duas colunas (faz bem × faz mal), frase final e logomarca
  comparativo(p, pal, F, o) {
    const c = p.compare || { title: p.text, sub: '', left: { title: 'Faz bem', items: [] }, right: { title: 'Evite', items: [] }, close: '' };
    const W = F.W, m = F.m, story = F.H / F.W > 1.5;
    const ink = pal.ink, gold = pal.accent || BRAND.gold;
    const out = [];
    const title = T(c.title, m, F.top, W - m * 2, story ? 64 : 56, { weight: 600, color: ink, lh: 1.12 });
    fit(title, F.top, story ? 190 : 150, o.mctx, 'top'); out.push(title);
    let y = title.y + textH(title, o.mctx) + 14;
    out.push(S('line', W / 2 - 70, y, 140, 6, { stroke: gold, sw: 3 })); y += 20;
    if (c.sub) { const sub = T(c.sub, m, y, W - m * 2, story ? 40 : 34, { italic: true, color: ink, lh: 1.15 }); out.push(sub); y += textH(sub, o.mctx) + 26; }
    const ft = footer(F, pal, o.sig, 'left', null);
    const closeT = c.close ? T(c.close, m, 0, W - m * 2, story ? 34 : 28, { italic: true, color: ink, lh: 1.2 }) : null;
    const closeH = closeT ? textH(closeT, o.mctx) : 0;
    const bottom = ft[0].y - (closeT ? closeH + 46 : 30);
    const gap = Math.round(W * 0.03), colW = (W - m * 2 - gap) / 2, badge = Math.round(W * 0.075);
    const panelTop = y + badge / 2, panelH = bottom - panelTop;
    const cols = [[c.left, '#E8F0E1', '#4E7A45', '✓'], [c.right, '#FBE9DA', '#C0682E', '✕']];
    cols.forEach(([col, bg, tone, mark], i) => {
      const x = m + i * (colW + gap);
      out.push(S('rect', x, panelTop, colW, panelH, { fill: bg, radius: 34 }));
      out.push(S('ellipse', x + colW / 2 - badge / 2, panelTop - badge / 2, badge, badge, { fill: tone }));
      out.push(T(mark, x + colW / 2 - badge / 2, panelTop - badge / 2 + badge * 0.16, badge, Math.round(badge * 0.58), { font: 'sans', weight: 700, color: '#FFFFFF' }));
      const head = T(col.title, x + 18, panelTop + badge / 2 + 14, colW - 36, story ? 44 : 38, { weight: 600, color: tone, lh: 1.05 });
      fit(head, panelTop + badge / 2 + 14, 110, o.mctx, 'top'); out.push(head);
      let iy = head.y + textH(head, o.mctx) + 10;
      out.push(S('line', x + colW / 2 - 50, iy, 100, 4, { stroke: gold, sw: 2 })); iy += 22;
      const items = col.items.slice(0, story ? 8 : 7);
      const avail = panelTop + panelH - 24 - iy;
      let size = story ? 42 : 36; const est = (sz) => items.reduce((h, it) => h + textH(T(it, 0, 0, colW - 84, sz, { font: 'sans', weight: 500, lh: 1.15 }), o.mctx) + sz * 0.45, 0);
      while (size > 16 && est(size) > avail) size -= 1;
      const spare = Math.max(0, avail - est(size)); const extra = Math.min(size * 0.9, spare / Math.max(1, items.length));
      for (const it of items) {
        const li = T(it, x + 52, iy, colW - 70, size, { font: 'sans', weight: 500, color: '#33382F', align: 'left', lh: 1.15 });
        out.push(S('ellipse', x + 26, iy + size * 0.38, size * 0.42, size * 0.42, { fill: tone }));
        out.push(li); iy += textH({ ...li, w: colW - 84 }, o.mctx) + size * 0.45 + extra;
      }
    });
    if (closeT) { closeT.y = bottom + 18; out.push(S('line', m, bottom + 2, W - m * 2, 2, { stroke: gold, sw: 1.5 })); out.push(closeT); }
    return [...out, ...ft];
  },
  paisagem(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'left', BRAND.cream);
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 62, { font: 'sans', weight: 600, align: 'left', color: '#FFFFFF', shadow: true, lh: 1.18 });
    fit(t, F.H * 0.42, ft[0].y - F.H * 0.42 - 70, o.mctx, 'bottom');
    return [IMG(0, 0, F.W, F.H, { overlay: 0.85, ph1: pal.soft, ph2: BRAND.graphite }),
      T('Para hoje', F.m, F.top + 10, F.W - F.m * 2, 24, { font: 'sans', weight: 700, ls: 6, color: '#FFFFFF', align: 'left', shadow: true }),
      S('rect', F.m, F.H * 0.42 - 40, 90, 6, { fill: BRAND.gold, radius: 3 }), t, ...ft];
  },
  paisagemcentro(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'center', BRAND.cream);
    const w = F.W - F.m * 2 - 40;
    const t = T(p.text, (F.W - w) / 2, 0, w, 58, { color: BRAND.graphite, bg: 'rgba(245,238,226,0.9)', radius: 34, pad: 56, lh: 1.25 });
    fit(t, F.H * 0.3, F.H * 0.36, o.mctx);
    return [IMG(0, 0, F.W, F.H, { overlay: 0.45, ph1: pal.soft, ph2: BRAND.graphite }), t, ...ft];
  },
  fotocirculo(p, pal, F, o) {
    const layers = L.fotoarco(p, pal, F, o);
    const photo = layers[0];
    photo.w = photo.h = Math.min(photo.w, photo.h);
    photo.x = (F.W - photo.w) / 2;
    photo.mask = 'circle';
    return layers;
  },
  fotofaixa(p, pal, F, o) {
    const height = Math.round(F.H * 0.42);
    const foot = footer(F, pal, o.sig, 'left');
    const text = T(p.text, F.m, 0, F.W - 2 * F.m, 72, { align: 'left', color: pal.ink });
    fit(text, height + 50, foot[0].y - height - 110, o.mctx);
    return [IMG(0, 0, F.W, height), S('rect', F.m, height + 20, 110, 6, { fill: pal.accent }), text, ...foot];
  },
  fotolista(p, pal, F, o) {
    const photoHeight = Math.round(F.H * 0.2);
    return [IMG(0, 0, F.W, photoHeight), ...L.lista(p, pal, { ...F, top: photoHeight + 36 }, o)];
  },
  tipografico(p, pal, F, o) {
    const words = p.text.split(' ');
    const head = words.slice(0, 2).join(' ').replace(/[,.:;]$/, '');
    const rest = words.slice(2).join(' ');
    const ft = footer(F, pal, o.sig, 'left');
    const h = T(head, F.m, F.top + 20, F.W - F.m * 2, 150, { font: 'sans', weight: 700, upper: true, align: 'left', color: pal.ink, lh: 1.02, ls: -2 });
    fit(h, F.top + 20, 420, o.mctx, 'top');
    const t = T(rest, F.m, 0, F.W - F.m * 2, 68, { align: 'left', italic: true, color: pal.ink });
    const top = h.y + textH(h, o.mctx) + 60;
    fit(t, top, ft[0].y - top - 70, o.mctx, 'top');
    return [S('rect', F.m, top - 30, 140, 8, { fill: pal.accent, radius: 4 }), h, t, ...ft];
  },
  cartao(p, pal, F, o) {
    const cx = F.m * 0.8; const cw = F.W - cx * 2;
    const ft = footer(F, pal, o.sig, 'center');
    const ch = ft[0].y - F.top - 60;
    const ls = [S('rect', cx, F.top, cw, ch, { fill: pal.card, radius: 44 }),
      T('“', cx, F.top + 20, cw, 200, { color: BRAND.gold, lh: 1 }),
      T(labelOf(p), cx + 60, F.top + ch - 90, cw - 120, 22, { font: 'sans', weight: 700, ls: 5, color: BRAND.green })];
    const t = T(p.text, cx + 70, 0, cw - 140, 66, { color: pal.cardInk });
    fit(t, F.top + 200, ch - 330, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  circulo(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'center');
    const space = ft[0].y - F.top - 40;
    const d = Math.min(F.W - F.m * 1.4, space); const cx = (F.W - d) / 2; const cy = F.top + (space - d) / 2;
    const ls = [S('ellipse', cx, cy, d, d, { stroke: pal.accent, sw: 4 }), S('ellipse', cx + 22, cy + 22, d - 44, d - 44, { fill: pal.soft })];
    const t = T(p.text, cx + d * 0.17, 0, d * 0.66, 58, { color: pal.ink });
    fit(t, cy + d * 0.18, d * 0.64, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  folhas(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'center');
    const ls = [
      S('leaf', F.W - 300, F.top - 40, 260, 180, { fill: pal.soft, rot: -18 }), S('leaf', F.W - 240, F.top + 110, 200, 140, { fill: pal.accent, opacity: 0.55, rot: 12 }),
      S('leaf', 40, F.H * 0.6, 220, 150, { fill: pal.soft, rot: 200 }),
      T(labelOf(p), F.m, F.top + 40, F.W * 0.6, 24, { font: 'sans', weight: 700, ls: 5, color: pal.label, align: 'left' })];
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 72, { align: 'left', color: pal.ink });
    fit(t, F.top + 200, ft[0].y - F.top - 260, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  campanha(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'left');
    const title = p.campaign || CATEGORIES.find((c) => c.id === p.cat)?.label || '';
    const ls = [S('rect', 0, 0, F.W, F.top + 300, { fill: pal.soft }),
      T('CAMPANHA', F.m, F.top + 20, F.W - F.m * 2, 24, { font: 'sans', weight: 700, ls: 7, color: pal.label, align: 'left' })];
    const h = T(title, F.m, F.top + 70, F.W - F.m * 2, 96, { align: 'left', color: pal.ink, weight: 600, lh: 1.02 });
    fit(h, F.top + 70, 220, o.mctx, 'top');
    ls.push(h, S('rect', F.m, F.top + 330, 160, 10, { fill: pal.accent, radius: 5 }));
    const t = T(p.text, F.m, 0, F.W - F.m * 2, 62, { align: 'left', color: pal.ink, font: 'georgia', lh: 1.3 });
    fit(t, F.top + 400, ft[0].y - F.top - 460, o.mctx);
    ls.push(t);
    return [...ls, ...ft];
  },
  institucional(p, pal, F, o) {
    const s = Math.round(F.W * 0.3);
    const ls = [LOGO((F.W - s) / 2, F.top + 10, s, { ring: pal.ring }),
      T(o.sig.split('|')[0].trim(), F.m, F.top + s + 40, F.W - F.m * 2, 64, { color: pal.ink, weight: 600 }),
      T((o.sig.split('|')[1] || 'Psicóloga').trim(), F.m, F.top + s + 125, F.W - F.m * 2, 24, { font: 'sans', weight: 600, upper: true, ls: 8, color: pal.label }),
      S('line', F.W / 2 - 60, F.top + s + 190, 120, 6, { stroke: pal.accent, sw: 3 })];
    const t = T(p.text, F.m + 30, 0, F.W - F.m * 2 - 60, 56, { color: pal.ink, font: 'georgia', lh: 1.35 });
    fit(t, F.top + s + 240, F.bot - F.top - s - 300, o.mctx);
    ls.push(t, T('Pessoas • Histórias • Recomeços', F.m, F.bot - 40, F.W - F.m * 2, 26, { font: 'sans', weight: 500, ls: 2, color: pal.label }));
    return ls;
  },
  lista(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'left');
    const ls = [T(labelOf(p), F.m, F.top, F.W - F.m * 2, 24, { font: 'sans', weight: 700, ls: 6, color: pal.label, align: 'left' })];
    const h = T(p.title || p.text, F.m, F.top + 50, F.W - F.m * 2, 74, { align: 'left', color: pal.ink, weight: 600, lh: 1.08 });
    fit(h, F.top + 50, 260, o.mctx, 'top');
    ls.push(h);
    let y = h.y + textH(h, o.mctx) + 50;
    const avail = ft[0].y - y - 50; const n = (p.items || []).length || 1;
    const rowH = Math.min(avail / n, 200);
    (p.items || []).forEach((it, i) => {
      ls.push(S('ellipse', F.m, y + 6, 64, 64, { fill: pal.accent }));
      ls.push(T(String(i + 1), F.m, y + 14, 64, 34, { font: 'sans', weight: 700, color: '#FFFFFF' }));
      const t = T(it, F.m + 92, 0, F.W - F.m * 2 - 92, 40, { align: 'left', font: 'sans', color: pal.ink, lh: 1.25 });
      fit(t, y, rowH - 20, o.mctx, 'top'); t.y = y + 6;
      ls.push(t); y += rowH;
    });
    return [...ls, ...ft];
  },
  cartaolista(p, pal, F, o) {
    const ft = footer(F, pal, o.sig, 'center');
    const cx = F.m * 0.7; const cw = F.W - cx * 2; const ch = ft[0].y - F.top - 50;
    const ls = [S('rect', cx, F.top, cw, ch, { fill: pal.card, radius: 40 })];
    const h = T(p.title || p.text, cx + 60, F.top + 60, cw - 120, 66, { color: BRAND.green, weight: 600, lh: 1.1 });
    fit(h, F.top + 60, 240, o.mctx, 'top');
    ls.push(h, S('line', F.W / 2 - 60, h.y + textH(h, o.mctx) + 26, 120, 6, { stroke: BRAND.gold, sw: 3 }));
    let y = h.y + textH(h, o.mctx) + 80;
    const n = (p.items || []).length || 1; const rowH = Math.min((F.top + ch - y - 50) / n, 190);
    (p.items || []).forEach((it) => {
      const t = T('✓  ' + it, cx + 70, y, cw - 140, 40, { align: 'left', font: 'sans', color: BRAND.graphite, lh: 1.25 });
      fit(t, y, rowH - 16, o.mctx, 'top'); ls.push(t); y += rowH;
    });
    return [...ls, ...ft];
  },
};

/** Cria as páginas de uma arte. spec: {phraseId|phrase, layout, palette, format}; o: {sig, mctx} */
export function buildPages(spec, o = {}) {
  if (spec.layout === 'carrossel-tema') return buildThemeCarousel(spec, o);
  const p = spec.phrase || phraseById(spec.phraseId);
  if (!p) throw new Error('Frase não encontrada: ' + spec.phraseId);
  const pal = PALETTES[spec.palette] || PALETTES.creme;
  const fmt = FORMATS[spec.format] ? spec.format : 'portrait';
  const F = frame(fmt);
  const opts = { sig: o.sig || 'Karina Ximenes | Psicóloga', mctx: o.mctx };
  let layout = spec.layout;
  if (!L[layout] || (p.items && !LIST_LAYOUTS.includes(layout) && layout !== 'fotolista' && layout !== 'carrossel')) layout = p.items ? 'lista' : 'minimal';
  const page = (layers) => ({ bg: { ...pal.bg }, layers: layers.map((l, i) => ({ ...l, tpl: i })), stampRing: pal.ring });
  if (spec.layout === 'carrossel' && p.items) {
    // Carrossel: capa + 1 página por item + encerramento
    const pages = [page(L.minimal({ ...p, text: p.title || p.text, credit: 'Arraste para o lado →' }, pal, F, opts))];
    p.items.forEach((it, i) => pages.push(page(L.minimal({ ...p, text: it, credit: `${i + 1} de ${p.items.length}`, campaign: p.title }, pal, F, opts))));
    pages.push(page(L.institucional({ ...p, text: 'Salve este conteúdo e compartilhe com quem precisa. Cuidar da saúde emocional é um caminho possível.' }, pal, F, opts)));
    return pages;
  }
  const pg = page(L[layout](p, pal, F, opts));
  // Foto escolhida para a semana (ou pelo Frankie) já entra na arte
  if (spec.photo) for (const l of pg.layers) if (l.type === 'image' && !l.assetId) l.assetId = spec.photo;
  return [pg];
}

/** Carrossel temático: capa + uma página por frase do tema + encerramento, mesma paleta */
export function buildThemeCarousel(spec, o = {}) {
  const pal = PALETTES[spec.palette] || PALETTES.creme;
  const fmt = FORMATS[spec.format] ? spec.format : 'portrait';
  const F = frame(fmt); const opts = { sig: o.sig || 'Karina Ximenes | Psicóloga', mctx: o.mctx };
  const cat = CATEGORIES.find((c) => c.id === spec.cat);
  const ph = spec.phrases?.length ? spec.phrases : (spec.phraseIds || []).map(phraseById).filter(Boolean);
  const page = (layers) => ({ bg: { ...pal.bg }, layers: layers.map((l, i) => ({ ...l, tpl: i })), stampRing: pal.ring });
  const title = spec.title || `Semana de ${cat?.label || 'reflexão'}`;
  const inner = L[spec.inner] && !LIST_LAYOUTS.includes(spec.inner) ? spec.inner : 'minimal';
  const pages = [page(L.editorial({ cat: spec.cat, text: title, credit: `${ph.length} ${spec.credit || 'reflexões para a sua semana'} · arraste →` }, pal, F, opts))];
  ph.forEach((p, i) => pages.push(page(L[inner]({ ...p, text: p.items ? p.title : p.text, campaign: `${i + 1} / ${ph.length} · ${cat?.label || ''}` }, pal, F, opts))));
  pages.push(page(L.institucional({ cat: spec.cat, text: 'Salve este carrossel e volte a ele ao longo da semana. Compartilhe com quem precisa ler isso hoje.' }, pal, F, opts)));
  return pages;
}

export function newProjectFromSpec(spec, o = {}) {
  if (spec.layout === 'carrossel-tema') {
    return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: spec.title || 'Carrossel temático', format: spec.format || 'portrait', spec: { ...spec }, pages: buildPages(spec, o) };
  }
  const p = spec.phrase || phraseById(spec.phraseId);
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: (p.title || p.text).slice(0, 48),
    format: spec.format || 'portrait',
    spec: spec.phraseId ? { ...spec, phrase: undefined } : { ...spec },
    pages: buildPages(spec, o),
  };
}

// ------- Catálogo -------
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const PAL_KEYS = Object.keys(PALETTES);

/** Artes prontas: cada frase em 3 combinações distintas (layout + paleta) */
export function allArts() {
  const arts = [];
  for (const p of PHRASES) {
    const lays = layoutsFor(p); const h = hash(p.id);
    const variants = p.items ? [['lista', 0], ['cartaolista', 3], ['carrossel', 5]] : [[lays[h % lays.length], 0], [lays[(h + 5) % lays.length], 3], [lays[(h + 9) % lays.length], 5]];
    variants.forEach(([layout, off]) => {
      const palette = PAL_KEYS[(h + off) % PAL_KEYS.length];
      arts.push({ id: `${p.id}|${layout}|${palette}`, phraseId: p.id, cat: p.cat, layout, palette });
    });
  }
  return arts;
}

/** Os 30 modelos oficiais (3 por categoria, layouts e paletas diversificados) */
export const OFFICIAL = (() => {
  const plan = {
    reflexoes: [['minimal', 'creme'], ['editorial', 'verde'], ['fotoarco', 'linho']],
    logoterapia: [['aspas', 'grafite'], ['arco', 'aurora'], ['moldura', 'dourado']],
    emocional: [['cartao', 'salvia'], ['folhas', 'creme'], ['tipografico', 'floresta']],
    relacoes: [['circulo', 'dourado'], ['dividido', 'linho'], ['foto', 'verde']],
    neuro: [['editorial', 'linho'], ['tipografico', 'creme'], ['dividido', 'grafite']],
    psicoeducacao: [['lista', 'creme'], ['cartaolista', 'verde'], ['carrossel', 'aurora']],
    emdr: [['minimal', 'floresta'], ['cartao', 'aurora'], ['moldura', 'linho']],
    espiritualidade: [['arco', 'dourado'], ['aspas', 'creme'], ['fotoarco', 'salvia']],
    datas: [['campanha', 'creme'], ['campanha', 'verde'], ['circulo', 'linho']],
    divulgacao: [['institucional', 'creme'], ['institucional', 'verde'], ['foto', 'floresta']],
  };
  const out = [];
  for (const [cat, list] of Object.entries(plan)) {
    const ph = PHRASES.filter((p) => p.cat === cat);
    list.forEach(([layout, palette], i) => {
      const cand = ph.filter((p) => (layout === 'lista' || layout === 'cartaolista' || layout === 'carrossel' ? p.items : !p.items));
      const p = cand[i % cand.length];
      out.push({ id: `oficial-${cat}-${i + 1}`, name: `${CATEGORIES.find((c) => c.id === cat).label} · ${LAYOUTS[layout] || 'Carrossel'}`, phraseId: p.id, cat, layout, palette });
    });
  }
  return out;
})();

export const combinationsCount = () => PHRASES.reduce((s, p) => s + layoutsFor(p).length * PAL_KEYS.length, 0) * Object.keys(FORMATS).length;

/**
 * Refaz uma arte (novo formato e/ou paleta) PRESERVANDO as edições: textos alterados, fotos colocadas,
 * enquadramentos, camadas ocultas e camadas adicionadas pela usuária (reposicionadas proporcionalmente).
 * keepColors: mantém cores editadas (troca de formato) ou adota a nova paleta (troca de paleta).
 */
const KEEP = ['text', 'font', 'weight', 'italic', 'upper', 'hidden', 'assetId', 'fx', 'fy', 'zoom', 'filter', 'overlay', 'frame', 'frameW', 'mask', 'locked', 'shadow', 'lh', 'ls', 'align'];
const COLORS = ['color', 'fill', 'stroke', 'ring', 'bg'];
export function remake(oldPages, oldFormat, spec, o = {}) {
  const fresh = buildPages(spec, o);
  const H0 = FORMATS[oldFormat].h; const H1 = FORMATS[spec.format].h; const sy = H1 / H0;
  return oldPages.map((old, i) => {
    const np = fresh[i] ? JSON.parse(JSON.stringify(fresh[i])) : { bg: { ...old.bg }, stampRing: old.stampRing, layers: [] };
    const hasTpl = old.layers.some((x) => x.tpl !== undefined);
    for (const nl of np.layers) {
      const ol = old.layers.find((x) => x.tpl === nl.tpl && x.type === nl.type);
      if (!ol) { if (hasTpl && fresh[i]) nl.hidden = true; continue; } // camada removida pela usuária continua fora
      for (const k of KEEP) if (ol[k] !== undefined) nl[k] = ol[k];
      if (o.keepColors) for (const k of COLORS) if (ol[k] !== undefined) nl[k] = ol[k];
    }
    if (o.keepColors && fresh[i]) { np.bg = { ...old.bg }; np.stampRing = old.stampRing; }
    for (const ul of old.layers.filter((x) => x.tpl === undefined)) {
      const c = JSON.parse(JSON.stringify(ul));
      if (c.type !== 'text' && c.h >= H0 * 0.75) { c.y = Math.round(c.y * sy); c.h = Math.round(c.h * sy); }
      else c.y = Math.round((c.y + (c.h || 0) / 2) * sy - (c.h || 0) / 2);
      np.layers.push(c);
    }
    return np;
  });
}

/** Grupos de cores para filtros simples */
export const COLOR_GROUPS = {
  todas: { label: 'Todas as cores', keys: Object.keys(PALETTES) },
  alegres: { label: 'Alegres', keys: Object.keys(PALETTES).filter((k) => PALETTES[k].mood === 'alegre') },
  classicas: { label: 'Clássicas da marca', keys: Object.keys(PALETTES).filter((k) => PALETTES[k].mood !== 'alegre') },
  amarelo: { label: 'Amarelo', keys: ['amarelo', 'manha'] },
  lilas: { label: 'Lilás', keys: ['lilas', 'ametista'] },
  bronze: { label: 'Bronze', keys: ['bronze', 'bronzeclaro'] },
  verde: { label: 'Verde', keys: ['verde', 'floresta', 'salvia', 'aurora'] },
};
