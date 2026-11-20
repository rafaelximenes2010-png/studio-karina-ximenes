// Semana a partir da escrita livre da Karina: o texto dela vira carrossel + posts da semana.
// Com o Frankie (IA) conectado, ele interpreta e cria; sem IA, as frases dela são usadas e completadas.
import { CATEGORIES } from './content.js';
import { PALETTES, layoutsFor } from './templates.js';
import { isoDate } from './util.js';
import { composeFromTheme, guessCategory } from './compose.js';


const clean = (s) => s.replace(/\s+/g, ' ').replace(/^[-–•*\d.)\s]+/, '').trim();

/** Sem IA: separa o texto em frases boas para arte e completa com frases do tema */
export function offlineWeek(raw) {
  const text = raw.trim();
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map(clean).filter((s) => s.length >= 18 && s.length <= 200)
    .filter((s) => !/^(esta semana|nesta semana|essa semana|hoje|quero|queria|gostaria|vou|pensei em|tema)\b/i.test(s));
  const firstLine = clean(text.split('\n')[0]).replace(/[.!?…]+$/, '');
  const themeGuess = firstLine.length <= 40 ? firstLine : (text.match(/\b(ansiedade|luto|fé|esperança|perdão|recomeço|família|casamento|maternidade|autoestima|trauma|sentido|gratidão|solidão|medo|culpa|descanso|limites)\b/i)?.[0] || 'reflexão da semana');
  const proper = /^(Natal|Páscoa|Deus|Jesus|Cristo|Bíblia)$/.test(themeGuess) || /^[A-Z]{2,}/.test(themeGuess);
  const comp = composeFromTheme(proper ? themeGuess : themeGuess.charAt(0).toLowerCase() + themeGuess.slice(1), { cat: guessCategory(text), context: text });
  const own = sentences.map((s) => ({ text: s.endsWith('.') || /[!?…]$/.test(s) ? s : s + '.' }));
  const phrases = [...own, ...comp.phrases].filter((p, i, a) => a.findIndex((x) => x.text === p.text) === i);
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    tema: comp.theme, titulo: themeGuess.length <= 40 ? comp.theme : 'Para a sua semana',
    frases: phrases.slice(0, 5).map((p) => p.text),
    posts: phrases.slice(0, 6).map((p, i) => ({ frase: p.text, legenda: paragraphs[i % Math.max(1, paragraphs.length)] || comp.text })),
    lista: { titulo: comp.list.title, itens: comp.list.items }, hashtags: (CATEGORIES.find((c) => c.id === comp.cat)?.tags || '') ,
    cat: comp.cat, ai: false,
  };
}

/** Lê a resposta do Frankie (JSON, mesmo cercado de texto) */
export function parseWeek(txt, raw) {
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : txt);
    if (!Array.isArray(j.posts) || !j.posts.length) throw new Error('vazio');
    return { ...j, frases: (j.frases || []).slice(0, 6), cat: guessCategory(raw + ' ' + (j.tema || '')), ai: true };
  } catch { return null; }
}

/** Transforma o conteúdo em publicações da agenda */
export function buildFreeWeek(week, { photo = null, start, days = [1, 2, 3, 4, 5], palette, carousel = true, stories = false, signature = 'Karina Ximenes | Psicóloga' } = {}) {
  const st = new Date(start || Date.now()); st.setHours(12, 0, 0, 0);
  const cat = week.cat || 'reflexoes'; const catObj = CATEGORIES.find((c) => c.id === cat);
  const pal = palette || Object.keys(PALETTES)[0];
  const weekId = `livre-${isoDate(st)}-${Date.now().toString(36)}`;
  const tags = week.hashtags || catObj?.tags || '#psicologia';
  const slots = [];
  for (let i = 0; i < 7; i++) { const d = new Date(st); d.setDate(st.getDate() + i); if (days.includes(d.getDay())) slots.push(d); }
  const mk = (d, extra) => ({ auto: false, theme: weekId, category: week.tema || catObj?.label, network: 'Instagram', date: isoDate(d), time: '19:00', status: 'ideia', refs: [], history: [{ at: Date.now(), status: 'ideia', note: week.ai ? 'Semana criada pelo Frankie a partir da escrita livre' : 'Semana criada a partir da escrita livre' }], origin: 'semana temática', ...extra });
  const posts = []; let k = 0;
  const ph = (text, i) => ({ id: `${weekId}-f${i}`, cat, text, generated: true });
  slots.forEach((d, i) => {
    if (i === 0 && carousel && week.frases?.length >= 3) {
      const phrases = week.frases.map(ph);
      posts.push(mk(d, { id: `${weekId}-carrossel`, title: `Carrossel: ${week.titulo || week.tema}`, format: 'carousel',
        caption: `${week.titulo || week.tema}\n\n${phrases.map((p, j) => `${j + 1}. ${p.text}`).join('\n')}\n\n💬 Salve e acompanhe a semana.\n\n${signature}\n\n${tags}`,
        art: { layout: 'carrossel-tema', cat, phrases, inner: 'minimal', palette: pal, format: 'portrait', title: week.titulo || week.tema, credit: 'reflexões para a sua semana' } }));
      return;
    }
    const middle = i === Math.floor(slots.length / 2) && week.lista?.itens?.length;
    const post = week.posts[k % week.posts.length];
    const phrase = middle ? { id: `${weekId}-lista`, cat: 'psicoeducacao', generated: true, title: week.lista.titulo, text: week.lista.titulo, items: week.lista.itens.slice(0, 6) } : ph(post.frase, 100 + k++);
    const lays = phrase.items ? (photo ? ['fotolista'] : ['lista', 'cartaolista']) : photo ? ['paisagem', 'paisagemcentro', 'foto', 'fotofaixa'] : layoutsFor({ ...phrase, cat });
    const format = phrase.items ? 'portrait' : i % 2 ? 'portrait' : 'square';
    const caption = phrase.items ? `${phrase.title}\n\n${phrase.items.map((x, j) => `${j + 1}. ${x}`).join('\n')}\n\n${signature}\n\n${tags}` : `${post.legenda || phrase.text}\n\n${signature}\n\n${tags}`;
    posts.push(mk(d, { id: `${weekId}-${i}`, title: (phrase.title || phrase.text).slice(0, 70), format, caption, art: { phrase, layout: lays[i % lays.length], palette: pal, format, photo: photo || undefined } }));
    if (stories && !phrase.items) posts.push(mk(d, { id: `${weekId}-${i}-story`, time: '09:00', title: 'Story: ' + phrase.text.slice(0, 60), format: 'story', caption, art: { phrase, layout: photo ? 'paisagem' : 'aspas', palette: pal, format: 'story', photo: photo || undefined } }));
  });
  return posts;
}
