// Utilitários puros (sem DOM no momento da importação)
export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Debounce com flush seguro: flush() só executa se houver chamada pendente (nunca regrava dados antigos) */
export function debounce(fn, ms = 400) {
  let t; let pending = null;
  const d = (...a) => { pending = a; clearTimeout(t); t = setTimeout(() => { const args = pending; pending = null; fn(...args); }, ms); };
  d.flush = () => { if (!pending) return; clearTimeout(t); const args = pending; pending = null; return fn(...args); };
  d.pending = () => !!pending;
  return d;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fmtDate(iso, lang = 'pt-BR', opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? '' : d.toLocaleDateString(lang, opts);
}

export const deepClone = (o) => JSON.parse(JSON.stringify(o));

export function slug(s) {
  return String(s || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'arquivo';
}

export function textToBytes(s) { return new TextEncoder().encode(s); }
