// Programação editorial automática (mesmo raciocínio do SOLA): para cada mês, distribui artes
// novas nos dias de publicação, priorizando campanhas e datas do mês, sem repetir frases
// até esgotar o banco de cada tema.
import { PHRASES, CATEGORIES, captionFor } from './content.js';
import { PALETTES, layoutsFor } from './templates.js';
import { isoDate } from './util.js';

const PAL_KEYS = Object.keys(PALETTES);
// Rotação de temas (equilíbrio entre reflexão, educação e divulgação)
// Base da Karina: Logoterapia + fé cristã reformada + EMDR + cuidado com pessoas (maior peso)
export const ROTATION = ['logoterapia', 'espiritualidade', 'reflexoes', 'emdr', 'psicoeducacao', 'logoterapia', 'emocional', 'espiritualidade', 'relacoes', 'neuro', 'logoterapia', 'divulgacao', 'espiritualidade', 'emdr'];

/** n-ésimo dia da semana do mês (weekday 0=domingo) */
export function nthWeekday(year, month, weekday, n) {
  const d = new Date(year, month - 1, 1);
  const shift = (weekday - d.getDay() + 7) % 7;
  return 1 + shift + (n - 1) * 7;
}

/** Datas comemorativas do mês: [{day, phrase}] */
export function monthEvents(year, month) {
  const out = [];
  for (const p of PHRASES) {
    if (p.cat !== 'datas' || p.month !== month) continue;
    if (p.day) out.push({ day: p.day, phrase: p });
    else if (p.weekday) out.push({ day: nthWeekday(year, month, p.weekday[0], p.weekday[1]), phrase: p });
  }
  return out.sort((a, b) => a.day - b.day);
}
export const monthCampaigns = (month) => PHRASES.filter((p) => p.cat === 'datas' && p.month === month && !p.day && !p.weekday);

const monthIndex = (y, m) => y * 12 + (m - 1);

/**
 * Gera as publicações sugeridas de um mês.
 * cfg: { days: [1,3,5] (dias da semana), storyDay: 3, signature }
 * Determinístico: o mesmo mês gera sempre a mesma programação (permite regenerar com segurança).
 */
export function generateMonth(year, month, cfg = {}) {
  const days = cfg.days || [1, 3, 5];
  const last = new Date(year, month, 0).getDate();
  const events = monthEvents(year, month);
  const campaigns = monthCampaigns(month);
  const used = new Set();
  const posts = [];
  // contador global de slots para variar entre meses (não repetir frases mês a mês)
  const base = monthIndex(year, month) * 13;
  const catCounters = {};
  const prior = cfg.used || new Set(); // frases já programadas em outros meses
  const mine = PHRASES.filter((p) => p.custom && !prior.has(p.id));
  const pick = (cat, salt) => {
    // reflexões da Karina ainda não usadas têm prioridade (uma a cada dois slots)
    if (mine.length && salt % 2 === 0) { const m = mine.find((p) => !used.has(p.id)); if (m) { used.add(m.id); return m; } }
    const all = PHRASES.filter((p) => p.cat === cat && !p.custom);
    const fresh = all.filter((p) => !prior.has(p.id));
    const list = fresh.length >= 3 ? fresh : all;
    if (!list.length) return null;
    catCounters[cat] = (catCounters[cat] || 0) + 1;
    // passo coprimo com o tamanho da lista → percorre todas antes de repetir
    const step = list.length % 7 === 0 ? 5 : 7;
    for (let k = 0; k < list.length; k++) {
      const idx = (monthIndex(year, month) * 3 + catCounters[cat] * step + salt + k) % list.length;
      if (!used.has(list[idx].id)) { used.add(list[idx].id); return list[idx]; }
    }
    return list[0];
  };
  const eventDays = new Set(events.map((e) => e.day));
  let slot = 0; let weekCount = 0;
  for (let d = 1; d <= last; d++) {
    const date = new Date(year, month - 1, d);
    const wd = date.getDay();
    let phrase = null; let origin = 'rotação';
    const ev = events.find((e) => e.day === d);
    if (ev) { phrase = ev.phrase; used.add(phrase.id); origin = 'data comemorativa'; }
    else if (days.includes(wd) && !eventDays.has(d) && !eventDays.has(d - 1) && !eventDays.has(d + 1)) {
      // 1ª publicação de cada semana em mês de campanha → conteúdo da campanha
      if (weekCount < campaigns.length && wd === days[0]) { phrase = campaigns[weekCount % campaigns.length]; origin = 'campanha do mês'; weekCount++; }
      else { const cat = ROTATION[(base + slot) % ROTATION.length]; phrase = pick(cat, slot); }
    }
    if (!phrase) continue;
    slot++;
    const lays = phrase.items ? ['carrossel', 'lista', 'cartaolista'] : layoutsFor(phrase);
    const layout = lays[(base + slot * 5) % lays.length];
    const palette = PAL_KEYS[(base + slot * 3) % PAL_KEYS.length];
    const format = phrase.items ? 'portrait' : (wd === (cfg.storyDay ?? 3) ? 'story' : slot % 3 === 0 ? 'square' : 'portrait');
    const cat = CATEGORIES.find((c) => c.id === phrase.cat);
    posts.push({
      id: `auto-${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      auto: true, planMonth: `${year}-${String(month).padStart(2, '0')}`, origin,
      title: (phrase.campaign ? phrase.campaign + ': ' : '') + (phrase.title || phrase.text).slice(0, 70),
      category: cat?.label || phrase.cat, network: 'Instagram', format: layout === 'carrossel' ? 'carousel' : format,
      date: isoDate(date), time: '19:00', status: 'ideia',
      caption: captionFor(phrase, { signature: cfg.signature }),
      art: { phraseId: phrase.id, layout, palette, format: layout === 'carrossel' ? 'portrait' : format },
      refs: [], history: [{ at: Date.now(), status: 'ideia', note: `Programado automaticamente (${origin})` }],
    });
  }
  return posts;
}

/** Meses (ano, mês) a partir de uma data, para manter N meses programados à frente */
export function monthsAhead(from = new Date(), n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) { const d = new Date(from.getFullYear(), from.getMonth() + i, 1); out.push([d.getFullYear(), d.getMonth() + 1]); }
  return out;
}

/**
 * Semana temática: carrossel de abertura + posts/stories diários do MESMO tema e paleta.
 * opts: { start: Date (início), days: [0..6], palette, carousel: bool, stories: bool, signature, used: Set de frases a evitar }
 */
export function generateThemeWeek(cat, opts = {}) {
  const start = new Date(opts.start || Date.now()); start.setHours(12, 0, 0, 0);
  const days = opts.days || [1, 2, 3, 4, 5];
  const palette = opts.palette || PAL_KEYS[(start.getDate() + cat.length) % PAL_KEYS.length];
  const catObj = CATEGORIES.find((c) => c.id === cat);
  const pool = PHRASES.filter((p) => p.cat === cat && !p.items);
  const lists = PHRASES.filter((p) => p.cat === cat && p.items);
  const avoid = opts.used || new Set();
  const offset = Math.floor(start.getTime() / 864e5 / 7);
  const ordered = [...pool.slice(offset % Math.max(1, pool.length)), ...pool.slice(0, offset % Math.max(1, pool.length))];
  const fresh = [...ordered.filter((p) => !avoid.has(p.id)), ...ordered.filter((p) => avoid.has(p.id))];
  const weekId = `tema-${cat}-${isoDate(start)}`;
  const posts = []; let k = 0;
  const slots = [];
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (days.includes(d.getDay())) slots.push(d); }
  const carouselPhrases = fresh.slice(0, 5);
  const mk = (d, extra) => ({ auto: false, theme: weekId, category: catObj?.label || cat, network: 'Instagram', date: isoDate(d), time: '19:00', status: 'ideia', refs: [], history: [{ at: Date.now(), status: 'ideia', note: `Semana temática: ${catObj?.label}` }], ...extra });
  slots.forEach((d, i) => {
    if (i === 0 && opts.carousel !== false && carouselPhrases.length >= 3) {
      posts.push(mk(d, { id: `${weekId}-carrossel`, title: `Carrossel: Semana de ${catObj?.label}`, format: 'carousel', origin: 'semana temática',
        caption: `Semana de ${catObj?.label}\n\n${carouselPhrases.map((p, j) => `${j + 1}. ${p.text}`).join('\n')}\n\n💬 Salve e acompanhe a semana.\n\n${opts.signature || 'Karina Ximenes | Psicóloga'}\n\n${catObj?.tags || ''}`,
        art: { layout: 'carrossel-tema', cat, phraseIds: carouselPhrases.map((p) => p.id), palette, format: 'portrait', title: `Semana de ${catObj?.label}` } }));
      return;
    }
    const phrase = (i === Math.floor(slots.length / 2) && lists.length) ? lists[offset % lists.length] : fresh[(carouselPhrases.length + k++) % Math.max(1, fresh.length)];
    if (!phrase) return;
    const lays = phrase.items ? ['lista', 'cartaolista'] : layoutsFor(phrase);
    const layout = lays[(i * 3 + offset) % lays.length];
    const format = phrase.items ? 'portrait' : i % 2 ? 'portrait' : 'square';
    posts.push(mk(d, { id: `${weekId}-${i}`, title: (phrase.title || phrase.text).slice(0, 70), format, origin: 'semana temática', caption: captionFor(phrase, { signature: opts.signature }), art: { phraseId: phrase.id, layout, palette, format } }));
    if (opts.stories) {
      posts.push(mk(d, { id: `${weekId}-${i}-story`, time: '09:00', title: 'Story: ' + (phrase.title || phrase.text).slice(0, 60), format: 'story', origin: 'semana temática', caption: captionFor(phrase, { signature: opts.signature }), art: { phraseId: phrase.id, layout: phrase.items ? 'cartaolista' : 'aspas', palette, format: 'story' } }));
    }
  });
  return posts;
}
