// Fotos do mês: sugestões de fotos de licença livre (Wikimedia Commons), renovadas a cada mês
// com temas da estação e das campanhas. Fica em cache no aparelho até o mês virar.
import { searchCommons } from './media.js';

export const MONTH_THEMES = {
  1: ['white flowers', 'calm sea horizon', 'morning light nature'], // Janeiro Branco
  2: ['sunflower field', 'tropical beach morning', 'green leaves sunlight'],
  3: ['orchid flower', 'tulips', 'spring blossom'],
  4: ['rainbow sky', 'forest path light', 'dew drops leaves'],
  5: ['garden roses', 'chamomile flowers', 'mountain sunrise'],
  6: ['candle warm light', 'autumn leaves', 'cozy tea cup'],
  7: ['misty forest', 'winter sunrise', 'lake reflection'],
  8: ['lavender field', 'purple flowers', 'violet sunset'], // Agosto Lilás
  9: ['sunflower', 'yellow flowers field', 'golden hour meadow'], // Setembro Amarelo
  10: ['pink roses', 'pink sky sunset', 'cherry blossom'], // Outubro Rosa
  11: ['blue sky clouds', 'blue sea waves', 'blue hydrangea'], // Novembro Azul
  12: ['starry night sky', 'warm christmas lights', 'pine forest snow'],
};
const key = (d = new Date()) => `sk-fotos3-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Lista do mês: [{title, thumb, full, page, license, author}] */
export async function monthPhotos() {
  const k = key();
  try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c?.length) return c; } catch { /* sem cache */ }
  const themes = MONTH_THEMES[new Date().getMonth() + 1];
  const res = await Promise.allSettled(themes.map((q) => searchCommons(q, 14, { curated: true })));
  const list = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((p) => p.license && !/non-?free|fair use/i.test(p.license))
    .map((p) => ({ ...p, full: p.thumb, thumb: p.thumb.replace(/\/\d+px-/, '/330px-') }));
  const seen = new Set(); const uniq = list.filter((p) => !seen.has(p.title) && seen.add(p.title));
  // mistura os temas para variar a faixa de sugestões
  uniq.sort((a, b) => (a.title.length % 7) - (b.title.length % 7));
  if (uniq.length) {
    for (const old of Object.keys(localStorage)) if (old.startsWith('sk-fotos') && old !== k) localStorage.removeItem(old);
    try { localStorage.setItem(k, JSON.stringify(uniq.slice(0, 24))); } catch { /* cheio */ }
  }
  return uniq.slice(0, 24);
}

// Paisagens reais de lugares lindos (Wikimedia Commons, licença livre), renovadas todo mês
const PLACES = [
  'Lençóis Maranhenses', 'Fernando de Noronha beach', 'Chapada Diamantina', 'Serra da Mantiqueira', 'Jericoacoara', 'Bonito Mato Grosso do Sul',
  'Dolomites landscape', 'Swiss Alps lake', 'Patagonia mountains', 'Norway fjord', 'Iguazu Falls', 'Santorini', 'Tuscany hills', 'Lake Bled',
  'Banff lake', 'Scottish Highlands', 'Cappadocia balloons', 'Sahara dunes', 'Maldives beach', 'Plitvice lakes', 'Halong Bay', 'Mount Fuji',
];
export async function landscapePhotos() {
  const d = new Date(); const k = `sk-paisagens3-${d.getFullYear()}-${d.getMonth() + 1}`;
  try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c?.length) return c; } catch { /* sem cache */ }
  const start = (d.getMonth() * 5) % PLACES.length;
  const picks = Array.from({ length: 6 }, (_, i) => PLACES[(start + i) % PLACES.length]);
  const res = await Promise.allSettled(picks.map((q) => searchCommons(q, 10, { curated: true })));
  const list = res.flatMap((r) => (r.status === 'fulfilled' ? r.value.slice(0, 3) : []))
    .filter((p) => p.license && !/non-?free|fair use/i.test(p.license) && (!p.w || !p.h || p.w >= p.h * 0.9))
    .map((p) => ({ ...p, full: p.thumb, thumb: p.thumb.replace(/\/\d+px-/, '/330px-') }));
  const seen = new Set(); const uniq = list.filter((p) => !seen.has(p.title) && seen.add(p.title)).slice(0, 16);
  if (uniq.length) {
    for (const old of Object.keys(localStorage)) if (old.startsWith('sk-paisagens') && old !== k) localStorage.removeItem(old);
    try { localStorage.setItem(k, JSON.stringify(uniq)); } catch { /* cheio */ }
  }
  return uniq;
}
