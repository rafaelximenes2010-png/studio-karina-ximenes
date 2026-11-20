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
const key = (d = new Date()) => `sk-fotos-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Lista do mês: [{title, thumb, full, page, license, author}] */
export async function monthPhotos() {
  const k = key();
  try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c?.length) return c; } catch { /* sem cache */ }
  const themes = MONTH_THEMES[new Date().getMonth() + 1];
  const res = await Promise.allSettled(themes.map((q) => searchCommons(q, 10)));
  const list = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((p) => p.license && !/non-?free|fair use/i.test(p.license))
    .map((p) => ({ ...p, full: p.thumb, thumb: p.thumb.replace(/\/\d+px-/, '/300px-') }));
  const seen = new Set(); const uniq = list.filter((p) => !seen.has(p.title) && seen.add(p.title));
  // mistura os temas para variar a faixa de sugestões
  uniq.sort((a, b) => (a.title.length % 7) - (b.title.length % 7));
  if (uniq.length) {
    for (const old of Object.keys(localStorage)) if (old.startsWith('sk-fotos-') && old !== k) localStorage.removeItem(old);
    try { localStorage.setItem(k, JSON.stringify(uniq.slice(0, 24))); } catch { /* cheio */ }
  }
  return uniq.slice(0, 24);
}
