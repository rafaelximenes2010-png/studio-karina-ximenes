// Semana temática: carrossel + posts da semana inteira no mesmo tema, programados de uma vez
import { t, locale } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, isoDate, fmtDate } from '../lib/util.js';
import { CATEGORIES } from '../lib/content.js';
import { PALETTES } from '../lib/templates.js';
import { generateThemeWeek } from '../lib/plan.js';
import { I, $, $$, sheet, toast, artCard, lazyThumbs, drawSpecThumb, signature, confirmDialog } from '../ui.js';

function nextMonday() { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; }

export function openThemeWeek({ onDone } = {}) {
  let cat = 'logoterapia'; let palette = 'verde'; let start = nextMonday(); let days = [1, 2, 3, 4, 5]; let carousel = true; let stories = false;
  const s = sheet(`<div class="row between"><h3>${t('Semana temática')}</h3><button class="icon-btn" data-close aria-label="${t('Fechar')}">${I.close}</button></div>
    <p class="small muted" style="margin:4px 0 12px">${t('Um tema para a semana inteira: carrossel de abertura + um post por dia, mesma paleta e identidade. Tudo entra na agenda como "Ideia" para você revisar.')}</p>
    <label class="field"><span>${t('Tema')}</span><div class="chips" id="cats">${CATEGORIES.filter((c) => c.id !== 'datas').map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === cat}">${t(c.label)}</button>`).join('')}</div></label>
    <label class="field"><span>${t('Paleta da semana')}</span><div class="chips" id="pals">${Object.entries(PALETTES).map(([k, p]) => `<button class="chip" data-pal="${k}" aria-pressed="${k === palette}"><i style="width:14px;height:14px;border-radius:50%;background:${p.bg.type === 'solid' ? p.bg.c1 : `linear-gradient(${p.bg.c1},${p.bg.c2})`};border:1px solid #0002"></i>${t(p.name)}</button>`).join('')}</div></label>
    <div class="grid c2"><label class="field"><span>${t('Início da semana')}</span><input class="input" type="date" id="st" value="${isoDate(start)}"></label>
      <label class="field"><span>${t('Dias')}</span><div class="chips" id="dw">${[...Array(7)].map((_, i) => `<button class="chip" data-d="${i}" aria-pressed="${days.includes(i)}" style="padding:0 10px">${new Date(2024, 0, 7 + i).toLocaleDateString(locale(), { weekday: 'narrow' })}</button>`).join('')}</div></label></div>
    <label class="toggle"><span>${t('Carrossel de abertura (capa + 5 reflexões + encerramento)')}</span><input type="checkbox" id="car" checked></label>
    <label class="toggle"><span>${t('Story diário com a mesma frase')}</span><input type="checkbox" id="sto"></label>
    <h3 class="small" style="margin:12px 0 8px">${t('Prévia da semana')}</h3><div class="hscroll" id="pv" style="grid-auto-columns:120px"></div>
    <button class="btn block" id="go" style="margin-top:14px">${I.calendar}${t('Programar semana')}</button>`, { label: t('Semana temática') });

  let posts = [];
  const paint = () => {
    posts = generateThemeWeek(cat, { start, days, palette, carousel, stories, signature: signature() });
    $('#pv', s.el).innerHTML = posts.map((p) => artCard({ ...p.art }, { title: fmtDate(p.date, locale(), { weekday: 'short', day: '2-digit' }), sub: ' · ' + (p.format === 'carousel' ? t('Carrossel') : p.format === 'story' ? 'Story' : 'Post'), attrs: 'tabindex="-1"' })).join('') || `<p class="muted small">${t('Escolha ao menos um dia.')}</p>`;
    lazyThumbs(s.el, drawSpecThumb);
    $('#go', s.el).textContent = t('Programar {n} publicações', { n: posts.length });
  };
  s.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]'); const p = e.target.closest('[data-pal]'); const d = e.target.closest('[data-d]');
    if (c) { cat = c.dataset.cat; $$('#cats .chip', s.el).forEach((x) => x.setAttribute('aria-pressed', x === c)); paint(); }
    if (p) { palette = p.dataset.pal; $$('#pals .chip', s.el).forEach((x) => x.setAttribute('aria-pressed', x === p)); paint(); }
    if (d) { const v = +d.dataset.d; days = days.includes(v) ? days.filter((x) => x !== v) : [...days, v]; d.setAttribute('aria-pressed', days.includes(v)); paint(); }
  });
  $('#st', s.el).onchange = (e) => { start = new Date(e.target.value + 'T12:00:00'); paint(); };
  $('#car', s.el).onchange = (e) => { carousel = e.target.checked; paint(); };
  $('#sto', s.el).onchange = (e) => { stories = e.target.checked; paint(); };
  $('#go', s.el).onclick = async () => {
    if (!posts.length) return;
    const exist = await db.all('posts');
    const conflict = exist.filter((x) => posts.some((p) => p.date === x.date && x.format !== 'story' && x.status === 'ideia' && x.auto));
    if (conflict.length && await confirmDialog(t('Existem {n} sugestões automáticas nesses dias. Substituir pelas da semana temática?', { n: conflict.length }), { ok: t('Substituir') })) for (const c of conflict) await db.del('posts', c.id);
    for (const p of posts) await db.put('posts', p);
    s.close(); toast(t('Semana temática programada: {n} publicações', { n: posts.length }), 4000); onDone?.();
  };
  paint();
}
