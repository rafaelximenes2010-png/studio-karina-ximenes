// Biblioteca científica: busca em fontes autorizadas (Crossref, PubMed), fichamento e bibliografia ABNT/APA.
// Regra ética: nenhuma referência é inventada — tudo vem das bases ou do que a profissional digitar.
import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, uid, fmtDate } from '../lib/util.js';
import { fromCrossref, fromPubmed, formatRef, sortRefs, plain, toHTML, inText, parseAuthor, validDOI } from '../lib/cite.js';
import { I, $, $$, sheet, toast, confirmDialog, copyText, downloadBlob, refresh } from '../ui.js';

export async function searchCrossref(q, rows = 12) {
  const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${rows}&select=DOI,title,author,issued,container-title,volume,issue,page,type,URL,publisher`);
  if (!r.ok) throw new Error('Crossref ' + r.status);
  return (await r.json()).message.items.map(fromCrossref).filter((x) => x.title);
}
export async function searchPubmed(q, rows = 12) {
  const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
  const s = await (await fetch(`${base}esearch.fcgi?db=pubmed&retmode=json&retmax=${rows}&sort=relevance&term=${encodeURIComponent(q)}`)).json();
  const ids = s.esearchresult?.idlist || []; if (!ids.length) return [];
  const j = await (await fetch(`${base}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`)).json();
  return ids.map((id) => j.result?.[id]).filter(Boolean).map(fromPubmed);
}
export async function lookupDOI(doi) {
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi.trim())}`);
  if (!r.ok) throw new Error(t('DOI não encontrado no Crossref'));
  return fromCrossref((await r.json()).message);
}

const authorsLine = (r) => (r.authors || []).slice(0, 3).map((a) => `${a.family}${a.given ? ' ' + a.given[0] + '.' : ''}`).join(', ') + ((r.authors || []).length > 3 ? ' et al.' : '');

export async function render(view, { query }) {
  const style = prefs.get().refStyle || 'abnt';
  let refs = await db.all('refs');
  view.innerHTML = `
    <div class="eyebrow">${t('Biblioteca científica')}</div><h1 class="h-title" style="margin:4px 0 6px">${t('Referências e fichamentos')}</h1>
    <p class="notice small">${t('As referências vêm do Crossref e do PubMed, ou são digitadas por você. O Studio nunca inventa autores, artigos ou DOI. Separe sempre: fonte, síntese, interpretação profissional e reflexão pessoal.')}</p>
    <form class="card" id="sf" style="margin-top:14px"><div class="row nowrap"><input class="input grow" id="q" type="search" placeholder="${t('Ex.: EMDR PTSD, logotherapy meaning, burnout')}" enterkeyhint="search" aria-label="${t('Pesquisar artigos')}"><button class="btn">${I.search}</button></div>
      <div class="row" style="margin-top:8px"><div class="seg" id="src"><button type="button" data-src="crossref" aria-pressed="true">Crossref</button><button type="button" data-src="pubmed" aria-pressed="false">PubMed</button></div><span class="xs muted">${t('Dica: termos em inglês retornam mais estudos.')}</span></div></form>
    <div id="results"></div>
    <h2 class="h-section">${t('Minha biblioteca')} <span class="badge">${refs.length}</span></h2>
    <div class="row" style="margin-bottom:10px"><div class="seg" id="sty"><button data-sty="abnt" aria-pressed="${style === 'abnt'}">ABNT</button><button data-sty="apa" aria-pressed="${style === 'apa'}">APA</button></div>
      <button class="btn sm secondary" id="add">${I.plus}${t('Manual / DOI')}</button><button class="btn sm ghost" id="bib">${I.download}${t('Bibliografia')}</button></div>
    <input class="input" id="flt" type="search" placeholder="${t('Filtrar por título, autor ou tema')}" style="margin-bottom:10px">
    <div id="mine"></div>`;
  let src = 'crossref';
  $('#src', view).onclick = (e) => { const b = e.target.closest('[data-src]'); if (!b) return; src = b.dataset.src; $$('#src button', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  $('#sty', view).onclick = (e) => { const b = e.target.closest('[data-sty]'); if (b) { prefs.set({ refStyle: b.dataset.sty }); refresh(); } };
  const out = $('#results', view);
  $('#sf', view).onsubmit = async (e) => {
    e.preventDefault(); const q = $('#q', view).value.trim(); if (!q) return;
    out.innerHTML = `<div class="card"><span class="spinner"></span> ${t('Pesquisando em {s}...', { s: src === 'pubmed' ? 'PubMed' : 'Crossref' })}</div>`;
    try {
      const list = src === 'pubmed' ? await searchPubmed(q) : await searchCrossref(q);
      out.innerHTML = list.length ? `<h2 class="h-section">${t('Resultados')} <span class="badge">${list.length}</span></h2>` + list.map((r, i) => `<div class="card ref-card"><div class="src">${r.source}${r.year ? ' · ' + esc(r.year) : ''}</div><b style="display:block;margin:4px 0">${esc(r.title)}</b><div class="small muted">${esc(authorsLine(r))}${r.container ? ' — <i>' + esc(r.container) + '</i>' : ''}</div>
        <div class="row" style="margin-top:8px"><button class="btn sm" data-save="${i}">${I.plus}${t('Salvar')}</button>${r.url ? `<a class="btn sm ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${t('Abrir fonte')}</a>` : ''}</div></div>`).join('')
        : `<div class="empty">${t('Nenhum resultado. Tente outros termos.')}</div>`;
      out.onclick = async (ev) => { const b = ev.target.closest('[data-save]'); if (!b) return; const r = { ...list[+b.dataset.save], id: uid('r'), notes: {}, tags: '' }; await db.put('refs', r); refs.unshift(r); b.disabled = true; b.textContent = t('Salvo'); paintMine(); };
    } catch (err) { out.innerHTML = `<div class="card">${t('Não foi possível pesquisar agora ({e}). Verifique a conexão ou tente a outra base.', { e: esc(err.message) })}</div>`; }
  };

  const mine = $('#mine', view);
  const paintMine = (f = '') => {
    const q = f.toLowerCase();
    const list = sortRefs(refs, style).filter((r) => !q || (r.title + ' ' + (r.authors || []).map((a) => a.family).join(' ') + ' ' + (r.tags || '')).toLowerCase().includes(q));
    mine.innerHTML = list.length ? list.map((r) => `<button class="list-item" data-ref="${r.id}" style="align-items:flex-start"><span class="thumb">${I.book}</span><span class="grow"><span class="small" style="display:block;line-height:1.45">${toHTML(formatRef(r, style), esc)}</span><span class="xs muted">${r.tags ? '#' + esc(r.tags).replace(/,\s*/g, ' #') + ' · ' : ''}${Object.values(r.notes || {}).some(Boolean) ? t('com fichamento') : t('sem fichamento')}</span></span></button>`).join('') : `<div class="empty small">${t('Salve artigos da pesquisa ou adicione manualmente.')}</div>`;
  };
  paintMine();
  $('#flt', view).oninput = (e) => paintMine(e.target.value);
  mine.onclick = (e) => { const b = e.target.closest('[data-ref]'); if (b) editRef(refs.find((r) => r.id === b.dataset.ref)); };
  $('#add', view).onclick = () => editRef({ id: uid('r'), type: 'article', authors: [], title: '', container: '', year: '', volume: '', issue: '', pages: '', doi: '', url: '', publisher: '', place: '', source: 'manual', notes: {}, tags: '' }, true);
  $('#bib', view).onclick = () => {
    if (!refs.length) return toast(t('Biblioteca vazia.'));
    const txt = sortRefs(refs, style).map((r) => plain(formatRef(r, style))).join('\n\n');
    const s = sheet(`<h3>${t('Bibliografia')} (${style.toUpperCase()})</h3><div class="result small" style="max-height:50vh;overflow:auto;margin:10px 0">${sortRefs(refs, style).map((r) => toHTML(formatRef(r, style), esc)).join('<br><br>')}</div><div class="row"><button class="btn" id="c">${I.copy}${t('Copiar')}</button><button class="btn secondary" id="d">${I.download}.txt</button></div>`);
    $('#c', s.el).onclick = () => copyText(txt);
    $('#d', s.el).onclick = () => downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `bibliografia-${style}.txt`);
  };

  async function editRef(r, isNew = false) {
    const n = r.notes || {};
    const s = sheet(`<div class="row between"><h3>${isNew ? t('Nova referência') : t('Referência')}</h3><button class="icon-btn" data-close aria-label="${t('Fechar')}">${I.close}</button></div>
      ${isNew ? `<div class="row nowrap" style="margin:10px 0"><input class="input grow" id="doi" placeholder="${t('Colar DOI (ex.: 10.1891/...)')}"><button class="btn secondary" id="fetchdoi">${t('Buscar')}</button></div>` : `<div class="result small" style="margin:10px 0">${toHTML(formatRef(r, style), esc)}</div><div class="row"><button class="btn sm secondary" id="cpref">${I.copy}${t('Copiar referência')}</button><button class="btn sm secondary" id="cpcit">${t('Citação')} ${esc(inText(r, style))}</button>${r.url ? `<a class="btn sm ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${t('Fonte')}</a>` : ''}</div>`}
      <details class="fold" ${isNew ? 'open' : ''} style="margin-top:12px"><summary>${t('Dados bibliográficos')}</summary><div class="stack">
        <label class="field"><span>${t('Tipo')}</span><select class="input" id="ty">${[['article', t('Artigo')], ['book', t('Livro')], ['chapter', t('Capítulo')], ['web', t('Página web')], ['other', t('Outro')]].map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Autores (um por linha: Sobrenome, Nome)')}</span><textarea class="input" id="au" rows="3">${esc((r.authors || []).map((a) => `${a.family}, ${a.given}`).join('\n'))}</textarea></label>
        <label class="field"><span>${t('Título')}</span><input class="input" id="ti" value="${esc(r.title)}"></label>
        <label class="field"><span>${t('Periódico / obra')}</span><input class="input" id="co" value="${esc(r.container)}"></label>
        <div class="grid c2"><label class="field"><span>${t('Ano')}</span><input class="input" id="ye" inputmode="numeric" value="${esc(r.year)}"></label><label class="field"><span>${t('Páginas')}</span><input class="input" id="pg" value="${esc(r.pages)}"></label>
        <label class="field"><span>${t('Volume')}</span><input class="input" id="vo" value="${esc(r.volume)}"></label><label class="field"><span>${t('Número')}</span><input class="input" id="nu" value="${esc(r.issue)}"></label>
        <label class="field"><span>${t('Editora')}</span><input class="input" id="pu" value="${esc(r.publisher)}"></label><label class="field"><span>${t('Local')}</span><input class="input" id="pl" value="${esc(r.place || '')}"></label></div>
        <label class="field"><span>DOI</span><input class="input" id="do" value="${esc(r.doi)}"></label>
        <label class="field"><span>URL</span><input class="input" id="ur" value="${esc(r.url)}"></label>
        <label class="field"><span>${t('Temas (separados por vírgula)')}</span><input class="input" id="tg" value="${esc(r.tags || '')}" placeholder="emdr, trauma"></label></div></details>
      <h3 class="small" style="margin:14px 0 6px">${t('Fichamento')}</h3>
      <div class="stack">
        <label class="field"><span>📄 ${t('Informação da fonte (o que o estudo afirma)')}</span><textarea class="input" id="n1" rows="3">${esc(n.source || '')}</textarea></label>
        <label class="field"><span>🤖 ${t('Síntese (pode ter apoio de IA — sinalizado)')}</span><textarea class="input" id="n2" rows="3">${esc(n.synthesis || '')}</textarea></label>
        <label class="field"><span>🩺 ${t('Interpretação profissional')}</span><textarea class="input" id="n3" rows="3">${esc(n.professional || '')}</textarea></label>
        <label class="field"><span>🕊️ ${t('Reflexão pessoal / espiritual')}</span><textarea class="input" id="n4" rows="3">${esc(n.personal || '')}</textarea></label>
        <label class="field"><span>${t('Resumo crítico')}</span><textarea class="input" id="n5" rows="3">${esc(n.critical || '')}</textarea></label>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn grow" id="sv">${t('Salvar')}</button>${isNew ? '' : `<button class="btn danger" id="dl" aria-label="${t('Excluir')}">${I.trash}</button>`}</div>
      ${r.updatedAt ? `<p class="xs muted">${t('Atualizado em')} ${fmtDate(r.updatedAt, locale())} · ${t('Origem')}: ${esc(r.source)}</p>` : ''}`);
    const fill = (x) => { $('#ty', s.el).value = x.type; $('#au', s.el).value = (x.authors || []).map((a) => `${a.family}, ${a.given}`).join('\n'); for (const [k, f] of [['ti', 'title'], ['co', 'container'], ['ye', 'year'], ['pg', 'pages'], ['vo', 'volume'], ['nu', 'issue'], ['pu', 'publisher'], ['do', 'doi'], ['ur', 'url']]) $('#' + k, s.el).value = x[f] || ''; r.source = 'crossref'; };
    $('#fetchdoi', s.el)?.addEventListener('click', async () => { const d = $('#doi', s.el).value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, ''); if (!validDOI(d)) return toast(t('DOI inválido')); try { fill(await lookupDOI(d)); toast(t('Dados preenchidos pelo Crossref')); } catch (e) { toast(e.message); } });
    $('#cpref', s.el)?.addEventListener('click', () => copyText(plain(formatRef(r, style))));
    $('#cpcit', s.el)?.addEventListener('click', () => copyText(inText(r, style)));
    $('#sv', s.el).onclick = async () => {
      Object.assign(r, { type: $('#ty', s.el).value, authors: $('#au', s.el).value.split('\n').map(parseAuthor).filter(Boolean), title: $('#ti', s.el).value.trim(), container: $('#co', s.el).value.trim(), year: $('#ye', s.el).value.trim(), pages: $('#pg', s.el).value.trim(), volume: $('#vo', s.el).value.trim(), issue: $('#nu', s.el).value.trim(), publisher: $('#pu', s.el).value.trim(), place: $('#pl', s.el).value.trim(), doi: $('#do', s.el).value.trim(), url: $('#ur', s.el).value.trim(), tags: $('#tg', s.el).value.trim(),
        notes: { source: $('#n1', s.el).value, synthesis: $('#n2', s.el).value, professional: $('#n3', s.el).value, personal: $('#n4', s.el).value, critical: $('#n5', s.el).value } });
      if (!r.title) return toast(t('Informe ao menos o título.'));
      if (r.doi && !validDOI(r.doi)) return toast(t('DOI inválido'));
      await db.put('refs', r); s.close(); toast(t('Referência salva')); refresh();
    };
    $('#dl', s.el)?.addEventListener('click', async () => { if (await confirmDialog(t('Excluir esta referência?'), { ok: t('Excluir'), danger: true })) { await db.del('refs', r.id); s.close(); refresh(); } });
  }
  if (query.get('ref')) { const r = refs.find((x) => x.id === query.get('ref')); if (r) editRef(r); }
}
