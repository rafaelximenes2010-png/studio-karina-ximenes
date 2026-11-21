// Novas desta semana: um lote novo de artes toda segunda-feira, para sempre.
// Determinístico por semana (mesmo lote no dia todo, outro na semana seguinte), sem depender de internet.
import { PHRASES } from './content.js';
import { VANGUARDA, STYLES, PALETTES } from './templates.js';

/** Semana ISO no formato 2026-W47 */
export function weekKey(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return `${x.getUTCFullYear()}-W${String(Math.ceil(((x - y0) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

// Gerador pseudoaleatório com semente (mulberry32)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const CLASSIC = ['minimal', 'aspas', 'cartao', 'moldura', 'editorial', 'arco', 'circulo', 'folhas', 'tipografico', 'dividido'];

/** Lote da semana: mistura frases que não saíram nas 4 semanas anteriores, modelos ousados e clássicos e estilos */
export function weeklyArts(n = 12, { date = new Date(), extra = [] } = {}) {
  const wk = weekKey(date);
  const pool = PHRASES.filter((p) => !p.items && p.cat !== 'datas' && p.cat !== 'divulgacao');
  // Janela deslizante sobre uma ordem embaralhada: ~11 semanas seguidas sem repetir frase; depois embaralha de novo
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()); const w = Math.floor((day - Date.UTC(1970, 0, 5)) / (7 * 864e5)); // semanas começando na segunda
  const per = Math.max(1, Math.floor(pool.length / n));
  const cycle = Math.floor(w / per); const slot = w % per;
  const ids = pickIds('ciclo-' + cycle, pool, pool.length).slice(slot * n, slot * n + n);
  const r = rng(hash(wk + ':look'));
  const pals = Object.keys(PALETTES);
  const phrases = [...extra.slice(0, Math.ceil(n / 3)), ...ids.map((id) => pool.find((p) => p.id === id))].slice(0, n);
  return phrases.map((p, i) => {
    const bold = i % 2 === 0;
    const layout = bold ? VANGUARDA[Math.floor(r() * VANGUARDA.length)] : CLASSIC[Math.floor(r() * CLASSIC.length)];
    const style = !bold && r() > 0.4 ? STYLES[Math.floor(r() * STYLES.length)].id : undefined;
    return { ...(p.generated ? { phrase: p } : { phraseId: p.id }), layout, palette: pals[Math.floor(r() * pals.length)], style, format: 'portrait', week: wk };
  });
}

function pickIds(wk, pool, n) {
  const r = rng(hash(wk)); const arr = pool.map((p) => p.id);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n);
}

/** Frases novas do Frankie (IA) para a semana, guardadas no aparelho */
export async function frankieWeekly(callAI, endpointOk) {
  const k = 'sk-frankie-semana-' + weekKey();
  try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c) return c; } catch { /* sem cache */ }
  if (!endpointOk) return [];
  try {
    const txt = await callAI({ task: 'livre', tone: 'acolhedor', network: 'Instagram', text: 'Crie 6 frases curtas e originais (até 150 caracteres cada) para posts desta semana, sobre logoterapia, fé cristã reformada, cuidado emocional e recomeços. Responda SOMENTE com um JSON: ["frase 1", "frase 2", ...]' });
    const arr = JSON.parse(String(txt).match(/\[[\s\S]*\]/)?.[0] || '[]').filter((x) => typeof x === 'string' && x.length > 15 && x.length < 220).slice(0, 6);
    const list = arr.map((text, i) => ({ id: `fk-${weekKey()}-${i}`, cat: 'reflexoes', text, generated: true, frankie: true }));
    for (const old of Object.keys(localStorage)) if (old.startsWith('sk-frankie-semana-') && old !== k) localStorage.removeItem(old);
    localStorage.setItem(k, JSON.stringify(list));
    return list;
  } catch { return []; }
}
