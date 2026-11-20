import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, uid, isoDate, fmtDate, pad, deepClone } from '../lib/util.js';
import { CATEGORIES, phraseById } from '../lib/content.js';
import { generateMonth, monthEvents } from '../lib/plan.js';
import { buildICS } from '../lib/ics.js';
import { I, $, $$, sheet, toast, confirmDialog, artCard, lazyThumbs, drawSpecThumb, copyText, downloadBlob, statusLabel, STATUSES, refresh, signature } from '../ui.js';
import { openSpec } from './shared.js';
import { ensurePlan } from '../app.js';

const NETWORKS = ['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'TikTok', 'YouTube', 'Site/Blog'];
const FORMAT_LABEL = { story: 'Story', portrait: 'Post vertical', square: 'Post quadrado', carousel: 'Carrossel', reels: 'Reels/vídeo', text: 'Texto' };

export async function render(view, { query }) {
  const st = JSON.parse(sessionStorage.getItem('sk-agenda') || '{}');
  let mode = st.mode || 'mes'; let cursor = st.cursor ? new Date(st.cursor) : new Date(); cursor.setDate(1);
  let fStatus = st.fStatus || 'todos'; let fNet = st.fNet || 'todas';
  const persist = () => sessionStorage.setItem('sk-agenda', JSON.stringify({ mode, cursor: cursor.toISOString(), fStatus, fNet }));
  let posts = await db.all('posts');
  const filtered = () => posts.filter((p) => (fStatus === 'todos' || p.status === fStatus) && (fNet === 'todas' || p.network === fNet));

  view.innerHTML = `
    <div class="row between"><div><div class="eyebrow">${t('Agenda editorial')}</div><h1 class="h-title" style="margin-top:4px">${t('Calendário de publicações')}</h1></div>
      <div class="row"><button class="btn sm secondary" id="week">${I.layers}${t('Semana temática')}</button><button class="btn sm" id="new">${I.plus}${t('Nova')}</button></div></div>
    <div class="notice ai small" style="margin:12px 0">${I.sparkle.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} ${t('Programação automática ativa: os próximos meses já recebem artes novas, sem repetir, seguindo as campanhas de cada mês. Revise e aprove.')} <button class="btn sm ghost" id="auto" style="margin-top:8px">${t('Configurar')}</button></div>
    <div class="tabs" role="tablist">${[['mes', t('Mês')], ['semana', t('Semana')], ['lista', t('Lista')]].map(([k, v]) => `<button role="tab" data-mode="${k}" aria-selected="${k === mode}">${v}</button>`).join('')}</div>
    <div class="row between" style="margin-bottom:10px"><button class="icon-btn" id="prev" aria-label="${t('Anterior')}">${I.back}</button><b id="label" style="font-family:var(--serif);font-size:22px"></b><button class="icon-btn" id="next" aria-label="${t('Próximo')}" style="transform:scaleX(-1)">${I.back}</button></div>
    <div class="chips"><select class="input" id="fs" style="min-height:38px;width:auto"><option value="todos">${t('Todos os status')}</option>${STATUSES.map((s) => `<option value="${s}" ${fStatus === s ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}</select>
      <select class="input" id="fn" style="min-height:38px;width:auto"><option value="todas">${t('Todas as redes')}</option>${NETWORKS.map((s) => `<option ${fNet === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="chip" id="ics">${I.calendar}${t('Lembretes (.ics)')}</button></div>
    <div id="cal"></div><div id="events" style="margin-top:14px"></div>`;

  const cal = $('#cal', view);
  const paint = () => {
    persist();
    const list = filtered();
    const byDate = {}; for (const p of list) (byDate[p.date] ||= []).push(p);
    const today = isoDate();
    if (mode === 'mes') {
      { const m = cursor.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }); $('#label', view).textContent = m.charAt(0).toUpperCase() + m.slice(1); }
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = new Date(first); start.setDate(1 - first.getDay());
      const dows = [...Array(7)].map((_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''));
      let html = dows.map((d) => `<div class="dow">${d}</div>`).join('');
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i); const k = isoDate(d); const items = byDate[k] || [];
        html += `<button class="day ${d.getMonth() !== cursor.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''}" data-day="${k}" aria-label="${fmtDate(k, locale())}: ${items.length}"><span class="n">${d.getDate()}</span>${items.slice(0, 3).map((p) => `<span class="dot ${p.status}" title="${esc(p.title)}"></span><span class="t">${esc(p.title)}</span>`).join('')}</button>`;
      }
      cal.innerHTML = `<div class="cal">${html}</div>`;
      const ev = monthEvents(cursor.getFullYear(), cursor.getMonth() + 1);
      const camp = [...new Set(posts.filter((p) => p.planMonth === `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}` && p.origin === 'campanha do mês').map((p) => phraseById(p.art?.phraseId)?.campaign).filter(Boolean))];
      const monthPosts = list.filter((p) => p.date.startsWith(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`)).sort((a, b) => a.date.localeCompare(b.date));
      $('#events', view).innerHTML = `${camp.length || ev.length ? `<div class="card small"><b>${t('Neste mês')}:</b> ${[...camp, ...ev.map((e) => `${e.day}/${cursor.getMonth() + 1} ${e.phrase.campaign}`)].map(esc).join(' · ')}</div>` : ''}
        <h2 class="h-section">${t('Publicações do mês')} <span class="badge">${monthPosts.length}</span></h2>${listHTML(monthPosts)}`;
    } else if (mode === 'semana') {
      const ws = new Date(cursor.getTime ? st.week || Date.now() : Date.now()); ws.setDate(ws.getDate() - ws.getDay());
      const days = [...Array(7)].map((_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
      $('#label', view).textContent = `${fmtDate(isoDate(days[0]), locale(), { day: '2-digit', month: 'short' })} – ${fmtDate(isoDate(days[6]), locale(), { day: '2-digit', month: 'short' })}`;
      cal.innerHTML = days.map((d) => { const k = isoDate(d); const items = byDate[k] || []; return `<div style="margin-bottom:12px"><div class="eyebrow" style="${k === today ? 'color:var(--primary)' : ''}">${fmtDate(k, locale(), { weekday: 'long', day: '2-digit', month: 'long' })}</div>${items.length ? `<div class="hscroll" style="margin-top:6px">${items.map((p) => postCard(p)).join('')}</div>` : `<p class="xs muted" style="margin:4px 0">${t('Sem publicações')}</p>`}</div>`; }).join('');
      $('#events', view).innerHTML = '';
      lazyThumbs(cal, drawSpecThumb);
    } else {
      $('#label', view).textContent = t('Próximas publicações');
      const up = list.filter((p) => p.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const past = list.filter((p) => p.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
      cal.innerHTML = listHTML(up) + (past.length ? `<h2 class="h-section">${t('Histórico')}</h2>${listHTML(past)}` : '');
      $('#events', view).innerHTML = '';
    }
    lazyThumbs(view, drawSpecThumb);
  };
  const postCard = (p) => artCard({ ...p.art }, { title: p.title, sub: ' · ' + statusLabel(p.status), pill: p.network, attrs: `data-open="${p.id}"` });
  const listHTML = (arr) => arr.length ? arr.map((p) => `<button class="list-item" data-open="${p.id}"><span class="thumb">${p.art ? `<canvas data-lazy data-spec="${encodeURIComponent(JSON.stringify({ ...p.art, format: p.art.format || 'portrait' }))}"></canvas>` : I.calendar}</span><span class="grow"><b>${esc(p.title)}</b><span class="xs muted">${fmtDate(p.date, locale(), { weekday: 'short', day: '2-digit', month: 'short' })} · ${p.time || ''} · ${esc(p.network)} · ${t(FORMAT_LABEL[p.format] || p.format)}</span></span><span class="badge ${p.status}">${statusLabel(p.status)}</span></button>`).join('') : `<div class="empty small">${t('Nenhuma publicação.')}</div>`;

  const move = (dir) => { if (mode === 'semana') { const w = new Date(st.week || Date.now()); w.setDate(w.getDate() + 7 * dir); st.week = w.getTime(); } else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1); paint(); };
  $('#prev', view).onclick = () => move(-1); $('#next', view).onclick = () => move(1);
  $('.tabs', view).onclick = (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode; $$('.tabs button', view).forEach((x) => x.setAttribute('aria-selected', x === b)); paint(); };
  $('#fs', view).onchange = (e) => { fStatus = e.target.value; paint(); };
  $('#fn', view).onchange = (e) => { fNet = e.target.value; paint(); };
  $('#new', view).onclick = () => editPost({ id: uid('post'), title: '', date: isoDate(), time: '19:00', network: 'Instagram', format: 'portrait', status: 'ideia', category: '', caption: '', refs: [], history: [] }, true);
  $('#ics', view).onclick = () => { const up = filtered().filter((p) => p.date >= isoDate() && p.status !== 'publicado'); if (!up.length) return toast(t('Nenhuma publicação futura para exportar.')); downloadBlob(new Blob([buildICS(up)], { type: 'text/calendar' }), 'agenda-studio-karina.ics'); toast(t('Abra o arquivo para adicionar os lembretes ao seu calendário.'), 4000); };
  $('#auto', view).onclick = autoSettings;
  $('#week', view).onclick = () => import('./themeweek.js').then((m) => m.openThemeWeek({ onDone: refresh }));
  view.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) { const p = posts.find((x) => x.id === o.dataset.open); if (p) editPost(p); return; }
    const d = e.target.closest('[data-day]'); if (d) dayView(d.dataset.day);
  });

  function dayView(day) {
    const items = filtered().filter((p) => p.date === day);
    const s = sheet(`<h3 style="text-transform:capitalize">${fmtDate(day, locale(), { weekday: 'long', day: '2-digit', month: 'long' })}</h3><div style="margin:12px 0">${listHTML(items)}</div><button class="btn block" id="add">${I.plus}${t('Nova publicação neste dia')}</button>`);
    lazyThumbs(s.el, drawSpecThumb);
    s.el.onclick = (e) => { const o = e.target.closest('[data-open]'); if (o) { s.close(); editPost(posts.find((x) => x.id === o.dataset.open)); } };
    $('#add', s.el).onclick = () => { s.close(); editPost({ id: uid('post'), title: '', date: day, time: '19:00', network: 'Instagram', format: 'portrait', status: 'ideia', caption: '', refs: [], history: [] }, true); };
  }

  async function editPost(p0, isNew = false) {
    const p = deepClone(p0); const refs = await db.all('refs');
    const s = sheet(`<div class="row between"><h3>${isNew ? t('Nova publicação') : t('Publicação')}</h3><button class="icon-btn" data-close aria-label="${t('Fechar')}">${I.close}</button></div>
      ${p.art ? `<div style="display:grid;grid-template-columns:110px 1fr;gap:12px;margin:10px 0">${artCard({ ...p.art }, { attrs: 'id="artbtn"' })}<div class="stack">${p.projectId ? '' : `<button class="btn sm block" id="postnow">${I.share}${t('Postar agora')}</button>`}<button class="btn sm secondary block" id="mk">${I.wand}${p.projectId ? t('Abrir arte') : t('Ajustar arte')}</button><span class="xs muted">${esc(p.origin ? t('Origem') + ': ' + p.origin : '')}</span></div></div>` : `<button class="btn sm secondary" id="pickart" style="margin:10px 0">${I.grid}${t('Escolher arte')}</button>`}
      <div class="stack">
        <label class="field"><span>${t('Título')}</span><input class="input" id="ti" value="${esc(p.title)}"></label>
        <div class="grid c2"><label class="field"><span>${t('Data')}</span><input class="input" type="date" id="da" value="${p.date}"></label><label class="field"><span>${t('Horário')}</span><input class="input" type="time" id="ho" value="${p.time || '19:00'}"></label></div>
        <div class="grid c2"><label class="field"><span>${t('Rede')}</span><select class="input" id="ne">${NETWORKS.map((n) => `<option ${p.network === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Formato')}</span><select class="input" id="fo">${Object.entries(FORMAT_LABEL).map(([k, v]) => `<option value="${k}" ${p.format === k ? 'selected' : ''}>${t(v)}</option>`).join('')}</select></label></div>
        <label class="field"><span>${t('Categoria')}</span><select class="input" id="ca"><option value="">—</option>${CATEGORIES.map((c) => `<option ${p.category === c.label ? 'selected' : ''} value="${esc(c.label)}">${t(c.label)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Status')}</span><div class="chips" id="sts">${STATUSES.map((x) => `<button class="chip" data-s="${x}" aria-pressed="${p.status === x}">${statusLabel(x)}</button>`).join('')}</div></label>
        <label class="field"><span>${t('Legenda')}</span><textarea class="input" id="cp" rows="7">${esc(p.caption)}</textarea></label>
        <div class="row"><button class="btn sm secondary" id="cc">${I.copy}${t('Copiar legenda')}</button><button class="btn sm secondary" id="share">${I.share}${t('Compartilhar texto')}</button><a class="btn sm ghost" href="${p.network === 'Instagram' ? 'https://www.instagram.com/' : p.network === 'LinkedIn' ? 'https://www.linkedin.com/feed/' : p.network === 'Facebook' ? 'https://www.facebook.com/' : '#'}" target="_blank" rel="noopener">${t('Abrir {n}', { n: p.network })}</a></div>
        <p class="xs muted">${t('A publicação automática nas redes depende das APIs oficiais e de contas comerciais conectadas. Aqui você exporta a arte e a legenda e abre o app de destino.')}</p>
        <label class="field"><span>${t('Referências')}</span><select class="input" id="rf" multiple size="${Math.min(4, Math.max(2, refs.length))}">${refs.map((r) => `<option value="${r.id}" ${p.refs?.includes(r.id) ? 'selected' : ''}>${esc((r.authors?.[0]?.family || '') + ' ' + (r.year || '') + ' — ' + r.title.slice(0, 60))}</option>`).join('')}</select></label>
        ${(p.history || []).length ? `<details class="fold"><summary>${t('Histórico')}</summary><div class="small muted">${p.history.map((h) => `${new Date(h.at).toLocaleString(locale())} — ${statusLabel(h.status)}${h.note ? ' · ' + esc(h.note) : ''}`).join('<br>')}</div></details>` : ''}
        <div class="row"><button class="btn grow" id="sv">${t('Salvar')}</button>${isNew ? '' : `<button class="btn ghost" id="dp" aria-label="${t('Duplicar')}">${I.dup}</button><button class="btn danger" id="dl" aria-label="${t('Excluir')}">${I.trash}</button>`}</div>
      </div>`);
    lazyThumbs(s.el, drawSpecThumb);
    const collect = () => { const ns = $('#sts [aria-pressed=true]', s.el)?.dataset.s || p.status; if (ns !== p.status) p.history = [...(p.history || []), { at: Date.now(), status: ns }]; Object.assign(p, { title: $('#ti', s.el).value.trim() || t('Sem título'), date: $('#da', s.el).value, time: $('#ho', s.el).value, network: $('#ne', s.el).value, format: $('#fo', s.el).value, category: $('#ca', s.el).value, status: ns, caption: $('#cp', s.el).value, refs: [...$('#rf', s.el).selectedOptions].map((o) => o.value) }); return p; };
    $('#sts', s.el).onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) $$('#sts .chip', s.el).forEach((x) => x.setAttribute('aria-pressed', x === b)); };
    $('#cc', s.el).onclick = () => copyText($('#cp', s.el).value);
    $('#share', s.el).onclick = async () => { try { await navigator.share({ text: $('#cp', s.el).value }); } catch { copyText($('#cp', s.el).value); } };
    $('#sv', s.el).onclick = async () => { await db.put('posts', collect()); s.close(); toast(t('Publicação salva')); refresh(); };
    $('#dl', s.el)?.addEventListener('click', async () => { if (await confirmDialog(t('Excluir esta publicação?'), { ok: t('Excluir'), danger: true })) { await db.del('posts', p.id); s.close(); refresh(); } });
    $('#dp', s.el)?.addEventListener('click', async () => { const c = { ...collect(), id: uid('post'), status: 'ideia', projectId: null, auto: false, history: [{ at: Date.now(), status: 'ideia', note: 'Duplicada' }] }; await db.put('posts', c); s.close(); toast(t('Publicação duplicada')); refresh(); });
    $('#mk', s.el)?.addEventListener('click', async () => { await db.put('posts', collect()); s.close(); if (p.projectId && await db.get('projects', p.projectId)) location.hash = `#/editor/${p.projectId}`; else openSpec({ ...p.art }, { postId: p.id }); });
    $('#postnow', s.el)?.addEventListener('click', async () => { await db.put('posts', collect()); s.close(); (await import('./quick.js')).postArt({ ...p.art }, { postId: p.id }); });
    $('#pickart', s.el)?.addEventListener('click', async () => { await db.put('posts', collect()); s.close(); location.hash = '#/biblioteca'; toast(t('Escolha uma arte e toque em "Programar".')); });
  }

  function autoSettings() {
    const pr = prefs.get(); const days = pr.planDays || [1, 3, 5];
    const s = sheet(`<h3>${t('Programação automática')}</h3><p class="small muted">${t('Funciona como no SOLA: o Studio mantém os próximos meses preenchidos com artes novas, alternando temas, layouts e paletas, sem repetir frases, e prioriza campanhas e datas comemorativas.')}</p>
      <div class="stack"><label class="toggle"><span>${t('Ativada')}</span><input type="checkbox" id="on" ${pr.autoPlan !== false ? 'checked' : ''}></label>
      <label class="field"><span>${t('Meses programados à frente')}</span><select class="input" id="mo">${[1, 2, 3, 4, 6].map((n) => `<option ${n === (pr.planMonths || 3) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>${t('Dias de publicação')}</span><div class="chips" id="dw">${[...Array(7)].map((_, i) => `<button class="chip" data-d="${i}" aria-pressed="${days.includes(i)}">${new Date(2024, 0, 7 + i).toLocaleDateString(locale(), { weekday: 'short' })}</button>`).join('')}</div></label>
      <button class="btn block" id="go">${t('Salvar e programar')}</button>
      <button class="btn ghost block" id="regen">${I.refresh}${t('Refazer sugestões não editadas deste mês')}</button></div>`);
    $('#dw', s.el).onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); };
    $('#go', s.el).onclick = async () => {
      const sel = $$('#dw [aria-pressed=true]', s.el).map((b) => +b.dataset.d);
      prefs.set({ autoPlan: $('#on', s.el).checked, planMonths: +$('#mo', s.el).value, planDays: sel.length ? sel : [1, 3, 5] });
      const n = await ensurePlan({ force: true }); s.close(); toast(t('{n} novas publicações programadas', { n })); refresh();
    };
    $('#regen', s.el).onclick = async () => {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
      if (!await confirmDialog(t('Substituir as sugestões automáticas ainda em "Ideia" deste mês? Publicações editadas ou aprovadas são mantidas.'))) return;
      for (const p of posts.filter((x) => x.auto && x.planMonth === key && x.status === 'ideia' && !x.projectId)) await db.del('posts', p.id);
      const keep = new Set((await db.all('posts')).map((x) => x.id));
      for (const p of generateMonth(cursor.getFullYear(), cursor.getMonth() + 1, { days: prefs.get().planDays || [1, 3, 5], signature: signature() })) if (!keep.has(p.id)) await db.put('posts', p);
      s.close(); toast(t('Mês reprogramado')); refresh();
    };
  }

  if (query.get('post')) { const p = posts.find((x) => x.id === query.get('post')); if (p) editPost(p); }
  paint();
}
