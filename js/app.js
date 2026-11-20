// Studio Karina Ximenes — inicialização e roteamento
import { t, setLang } from './lib/i18n.js';
import { prefs, db } from './lib/store.js';
import { generateMonth, monthsAhead } from './lib/plan.js';
import { I, $, $$, toast } from './ui.js';

export const VERSION = '2.0.4';

const ROUTES = {
  '': () => import('./modules/home.js'),
  criar: () => import('./modules/create.js'),
  rapido: () => import('./modules/quick.js'),
  editor: () => import('./modules/editor.js'),
  biblioteca: () => import('./modules/library.js'),
  ciencia: () => import('./modules/science.js'),
  textos: () => import('./modules/ai.js'),
  documentos: () => import('./modules/docs.js'),
  documento: () => import('./modules/docs.js'),
  agenda: () => import('./modules/agenda.js'),
  perfil: () => import('./modules/profile.js'),
};
const NAV_OF = { '': 'inicio', rapido: 'criar', criar: 'criar', editor: 'criar', textos: 'criar', documentos: 'criar', documento: 'criar', biblioteca: 'biblioteca', ciencia: 'biblioteca', agenda: 'agenda', perfil: 'perfil' };
const TOP_LEVEL = new Set(['', 'rapido', 'criar', 'biblioteca', 'agenda', 'perfil']);

export function applyTheme(theme = prefs.get().theme) {
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function paintChrome() {
  const labels = { inicio: [t('Início'), I.home], criar: [t('Criar'), I.plus], biblioteca: [t('Biblioteca'), I.library], agenda: [t('Agenda'), I.calendar], perfil: [t('Perfil'), I.user] };
  for (const a of $$('.bottomnav a')) { const [l, ic] = labels[a.dataset.nav]; a.innerHTML = `${ic}<span>${l}</span>`; }
  $('#btn-back').innerHTML = I.back; $('#btn-back').setAttribute('aria-label', t('Voltar'));
  $('#btn-search').innerHTML = I.search; $('#btn-search').setAttribute('aria-label', t('Buscar'));
  $('.bottomnav').setAttribute('aria-label', t('Navegação principal'));
  $('#frank-fab').innerHTML = `<span class="av">${I.sparkle}</span><span>Frankie<small>${t('assistente')}</small></span>`;
  $('#frank-fab').setAttribute('aria-label', t('Frankie, assistente de conteúdo'));
}

let cleanup = null; let renderToken = 0;
async function route() {
  const token = ++renderToken;
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = hash.split('?');
  const [name, ...rest] = path.split('/');
  const key = ROUTES[name] !== undefined ? name : '';
  const params = { id: rest.join('/') || null, query: new URLSearchParams(query), name: key };
  try { cleanup?.(); } catch { /* noop */ }
  cleanup = null;
  document.body.classList.toggle('sub', !TOP_LEVEL.has(key) || params.id !== null);
  document.body.classList.remove('editor-mode');
  document.body.classList.toggle('on-frank', key === 'textos' || key === 'rapido');
  $$('.bottomnav a').forEach((a) => (a.dataset.nav === NAV_OF[key] ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  try {
    const mod = await ROUTES[key]();
    if (token !== renderToken) return;
    // elemento novo a cada rota: evita acúmulo de listeners entre telas
    const old = $('#view'); const view = old.cloneNode(false); old.replaceWith(view);
    window.scrollTo(0, 0);
    const done = (await mod.render(view, params)) || null;
    // tela montada fora de hora (outra navegação começou): descarta sem efeitos colaterais
    if (token !== renderToken) { try { done?.({ stale: true }); } catch { /* noop */ } return; }
    cleanup = done;
    view.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="empty"><p><b>${t('Algo não saiu como esperado.')}</b></p><p class="small">${String(e.message || e).replace(/[<>&]/g, '')}</p><button class="btn" onclick="location.reload()">${t('Recarregar')}</button></div>`;
  }
}

/** Programação automática (estilo SOLA): mantém os próximos meses com artes programadas */
export async function ensurePlan({ force = false, months = prefs.get().planMonths || 3 } = {}) {
  const p = prefs.get(); if (p.autoPlan === false && !force) return 0;
  const done = new Set(p.plannedMonths || []); let added = 0;
  const all = await db.all('posts');
  const existing = new Set(all.map((x) => x.id));
  const used = new Set(all.map((x) => x.art?.phraseId).filter(Boolean));
  for (const [y, m] of monthsAhead(new Date(), months)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (done.has(key) && !force) continue;
    for (const post of generateMonth(y, m, { days: p.planDays || [1, 3, 5], signature: (await import('./ui.js')).signature(), used })) {
      if (existing.has(post.id)) continue; // nunca sobrescreve edições da Karina
      await db.put('posts', post); added++;
    }
    done.add(key);
  }
  prefs.set({ plannedMonths: [...done] });
  return added;
}

function opening() {
  const el = $('#opening'); if (!el) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = sessionStorage.getItem('sk-opened');
  if (seen || reduced) { el.classList.add('done'); setTimeout(() => el.remove(), 700); return; }
  sessionStorage.setItem('sk-opened', '1');
  setTimeout(() => el.classList.add('done'), 1900);
  setTimeout(() => el.remove(), 2600);
}

export async function loadCustomPhrases() {
  const { registerCustomPhrases } = await import('./lib/content.js');
  registerCustomPhrases(await db.all('phrases'));
}

async function boot() {
  const p = prefs.get();
  setLang(p.lang); applyTheme(p.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  paintChrome(); opening();
  const lock = await import('./modules/lock.js');
  if (lock.isLocked()) await lock.lockScreen();
  $('#btn-back').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
  $('#btn-search').onclick = () => import('./modules/home.js').then((m) => m.openSearch());
  await loadCustomPhrases().catch(console.error);
  window.addEventListener('hashchange', route);
  await route();
  ensurePlan().then((n) => { if (n && !location.hash.includes('editor')) toast(t('{n} artes programadas para os próximos meses', { n })); }).catch(console.error);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast(t('Nova versão disponível. Feche e abra o app para atualizar.'), 6000); });
      });
    }).catch(() => {});
  }
  if (!p.onboarded) setTimeout(() => import('./modules/profile.js').then((m) => m.showTutorial(true)), 2300);
}
boot();
