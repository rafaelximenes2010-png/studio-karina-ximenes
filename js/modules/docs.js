// Documentos: artigo, relatório, apostila, material psicoeducativo, apresentação, roteiro de aula, guia, e-book.
// Exporta PDF (impressão com capa institucional, margens ABNT e paginação) e DOCX (Word).
import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, uid, fmtDate, debounce, slug } from '../lib/util.js';
import { formatRef, sortRefs, plain, toHTML, inText } from '../lib/cite.js';
import { buildDocx } from '../lib/docx.js';
import { I, $, $$, sheet, toast, confirmDialog, downloadBlob, assetImage, refresh, logoSrc } from '../ui.js';
import { chooseImage } from './media.js';

const KINDS = {
  artigo: { label: 'Artigo científico', outline: [['h1', 'Introdução'], ['p', ''], ['h1', 'Método'], ['p', ''], ['h1', 'Resultados'], ['p', ''], ['h1', 'Discussão'], ['p', ''], ['h1', 'Considerações finais'], ['p', '']] },
  relatorio: { label: 'Relatório educativo', outline: [['h1', 'Objetivo'], ['p', ''], ['h1', 'Desenvolvimento'], ['p', ''], ['h1', 'Conclusões'], ['p', '']] },
  apostila: { label: 'Apostila', outline: [['h1', 'Apresentação'], ['p', ''], ['h1', 'Módulo 1'], ['h2', 'Conceitos principais'], ['p', ''], ['note', 'Para refletir: '], ['h1', 'Módulo 2'], ['p', '']] },
  psicoeducativo: { label: 'Material psicoeducativo', outline: [['h1', 'O que é'], ['p', ''], ['h1', 'Sinais e sintomas comuns'], ['list', ''], ['h1', 'O que ajuda'], ['list', ''], ['h1', 'Quando procurar ajuda'], ['p', ''], ['note', 'Este material é informativo e não substitui avaliação profissional.']] },
  apresentacao: { label: 'Apresentação', outline: [['h1', 'Tema'], ['p', ''], ['pagebreak', ''], ['h1', 'Pontos principais'], ['list', ''], ['pagebreak', ''], ['h1', 'Encerramento'], ['p', '']] },
  aula: { label: 'Roteiro de aula', outline: [['h1', 'Objetivos de aprendizagem'], ['list', ''], ['h1', 'Conteúdo'], ['p', ''], ['h1', 'Atividade prática'], ['p', ''], ['h1', 'Avaliação'], ['p', '']] },
  guia: { label: 'Guia', outline: [['h1', 'Para quem é este guia'], ['p', ''], ['h1', 'Passo a passo'], ['olist', ''], ['h1', 'Dicas'], ['list', '']] },
  ebook: { label: 'E-book', outline: [['h1', 'Introdução'], ['p', ''], ['pagebreak', ''], ['h1', 'Capítulo 1'], ['p', ''], ['quote', ''], ['pagebreak', ''], ['h1', 'Capítulo 2'], ['p', ''], ['pagebreak', ''], ['h1', 'Conclusão'], ['p', '']] },
};
// Aparência de cada modelo: cor da capa e descrição curta
const LOOK = {
  artigo: ['#435B49', 'Introdução, método, resultados e referências'],
  relatorio: ['#91A595', 'Objetivo, desenvolvimento e conclusão'],
  apostila: ['#A8834F', 'Módulos com conceitos e exercícios'],
  psicoeducativo: ['#8E7CB8', 'O que é, sinais e quando buscar ajuda'],
  apresentacao: ['#33382F', 'Tema e pontos principais, uma ideia por página'],
  aula: ['#C9A227', 'Objetivos, conteúdo e atividades'],
  guia: ['#5F8A72', 'Para quem é, passo a passo e dicas'],
  ebook: ['#8C6239', 'Capa, capítulos e citações'],
};
const cover = (k, label) => `<span class="doc-cover" style="--c:${LOOK[k]?.[0] || '#435B49'}" aria-hidden="true"><i class="band"></i><img src="${logoSrc}" alt=""><b>${esc(label)}</b><i class="ln"></i><i class="ln s"></i><i class="ln"></i><i class="ln s"></i></span>`;
const BLOCKS = { h1: 'Título', h2: 'Subtítulo', h3: 'Tópico', p: 'Parágrafo', list: 'Lista', olist: 'Lista numerada', quote: 'Citação longa', note: 'Nota/destaque', table: 'Tabela', image: 'Imagem', pagebreak: 'Quebra de página' };

export async function render(view, params) {
  if (params.name === 'documento' && params.id) return editor(view, params.id);
  const docs = await db.all('docs');
  view.innerHTML = `<div class="eyebrow">${t('Documentos e PDFs')}</div><h1 class="h-title" style="margin:4px 0 12px">${t('Seus documentos')}</h1>
    <p class="small muted" style="margin:-4px 0 14px">${t('Escolha um modelo: ele já vem com capa, logomarca e a estrutura pronta.')}</p>
    <div class="doc-grid">${Object.entries(KINDS).map(([k, v]) => `<button class="doc-tpl" data-kind="${k}">${cover(k, t(v.label))}<span class="doc-meta"><b>${t(v.label)}</b><small>${t(LOOK[k]?.[1] || 'Modelo com estrutura')}</small></span></button>`).join('')}</div>
    <h2 class="h-section">${t('Recentes')}</h2>
    ${docs.map((d) => `<a class="list-item" href="#/documento/${d.id}"><span class="doc-mini" style="--c:${LOOK[d.kind]?.[0] || '#435B49'}"><i></i></span><span class="grow"><b>${esc(d.title)}</b><span class="xs muted">${t(KINDS[d.kind]?.label || '')} · ${fmtDate(d.updatedAt, locale())}</span></span></a>`).join('') || `<div class="empty small">${t('Nenhum documento ainda.')}</div>`}`;
  view.onclick = async (e) => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    const k = KINDS[b.dataset.kind];
    const doc = { id: uid('d'), kind: b.dataset.kind, title: t(k.label), subtitle: '', author: (() => { const p = prefs.get(); return `${p.fullName || 'Karina Ximenes'} — Psicóloga${p.crp ? ' · CRP ' + p.crp : ''}`; })(), date: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), cover: true, footer: 'Karina Ximenes | Psicóloga', style: prefs.get().refStyle || 'abnt', refIds: [], blocks: k.outline.map(([type, text]) => ({ id: uid('b'), type, text: t(text) })) };
    await db.put('docs', doc); location.hash = `#/documento/${doc.id}`;
  };
}

async function editor(view, id) {
  const doc = await db.get('docs', id);
  if (!doc) { view.innerHTML = `<div class="empty">${t('Documento não encontrado.')}</div>`; return; }
  let refs = await db.all('refs'); let focusIdx = null;
  const save = debounce(async () => { await db.put('docs', doc); const s = $('#dsaved', view); if (s) s.textContent = t('Salvo'); }, 500);
  view.innerHTML = `
    <div class="row between"><span class="eyebrow">${t(KINDS[doc.kind]?.label || 'Documento')}</span><span class="xs muted" id="dsaved"></span></div>
    <p class="notice small" style="margin:8px 0">${t('Não inclua dados clínicos identificáveis de pacientes em documentos. Para prontuários, use sistema específico com proteção adequada.')}</p>
    <details class="fold" open><summary>${t('Capa e configurações')}</summary><div class="stack">
      <label class="field"><span>${t('Título')}</span><input class="input" data-f="title" value="${esc(doc.title)}"></label>
      <label class="field"><span>${t('Subtítulo')}</span><input class="input" data-f="subtitle" value="${esc(doc.subtitle)}"></label>
      <div class="grid c2"><label class="field"><span>${t('Autoria')}</span><input class="input" data-f="author" value="${esc(doc.author)}"></label><label class="field"><span>${t('Data/local')}</span><input class="input" data-f="date" value="${esc(doc.date)}"></label></div>
      <label class="field"><span>${t('Rodapé')}</span><input class="input" data-f="footer" value="${esc(doc.footer)}"></label>
      <div class="row"><label class="toggle" style="flex:1"><span>${t('Capa institucional com logomarca')}</span><input type="checkbox" id="cov" ${doc.cover ? 'checked' : ''}></label>
      <div class="seg" id="sty"><button data-sty="abnt" aria-pressed="${doc.style !== 'apa'}">ABNT</button><button data-sty="apa" aria-pressed="${doc.style === 'apa'}">APA</button></div></div></div></details>
    <div id="blocks" class="card" style="margin-top:12px;padding:8px"></div>
    <div class="chips" style="margin-top:10px" id="addb">${Object.entries(BLOCKS).map(([k, v]) => `<button class="chip" data-add="${k}">+ ${t(v)}</button>`).join('')}</div>
    <h2 class="h-section">${t('Referências do documento')} <span class="badge">${doc.refIds.length}</span></h2>
    <div id="drefs"></div>
    <button class="btn sm secondary" id="addref">${I.book}${t('Inserir referência da biblioteca')}</button>
    <div class="row" style="margin:20px 0 8px;position:sticky;bottom:calc(var(--nav-h) + 10px)"><button class="btn grow" id="pdf">${I.doc}PDF</button><button class="btn secondary grow" id="docx">${I.download}Word (.docx)</button><button class="btn ghost" id="del" aria-label="${t('Excluir')}">${I.trash}</button></div>
    <p class="xs muted">${t('PDF: abre a impressão do sistema — escolha "Salvar como PDF". No iPhone, use Compartilhar → Opções → PDF, se necessário.')}</p>`;

  $$('[data-f]', view).forEach((inp) => (inp.oninput = () => { doc[inp.dataset.f] = inp.value; save(); }));
  $('#cov', view).onchange = (e) => { doc.cover = e.target.checked; save(); };
  $('#sty', view).onclick = (e) => { const b = e.target.closest('[data-sty]'); if (!b) return; doc.style = b.dataset.sty; $$('#sty button', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); paintRefs(); save(); };

  const blocksEl = $('#blocks', view);
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  const placeholder = { list: t('Um item por linha'), olist: t('Um item por linha'), table: t('Colunas separadas por | e linhas por Enter. Ex.: Sintoma | Frequência'), quote: t('Citação com mais de 3 linhas (recuo de 4 cm)'), note: t('Texto em destaque') };
  const paint = () => {
    blocksEl.innerHTML = doc.blocks.map((b, i) => `<div class="dblock" data-type="${b.type}" data-i="${i}"><div><span class="type">${t(BLOCKS[b.type])}</span>
      ${b.type === 'pagebreak' ? '<hr style="border:0;border-top:2px dashed var(--line-2)">' : b.type === 'image' ? `<div class="row" style="margin-top:4px"><img data-asset="${b.assetId || ''}" alt="" style="max-height:120px;border-radius:8px;${b.assetId ? '' : 'display:none'}"><button class="btn sm secondary" data-img="${i}">${b.assetId ? t('Trocar imagem') : t('Escolher imagem')}</button></div><input class="input" data-cap="${i}" placeholder="${t('Legenda (fonte da imagem)')}" value="${esc(b.caption || '')}" style="margin-top:6px">`
      : `<textarea data-t="${i}" rows="1" placeholder="${esc(placeholder[b.type] || t('Escreva aqui...'))}">${esc(b.text)}</textarea>`}</div>
      <div class="tools"><button data-up="${i}" aria-label="${t('Subir')}">↑</button><button data-down="${i}" aria-label="${t('Descer')}">↓</button><button data-type-of="${i}" aria-label="${t('Tipo')}">⇄</button><button data-rm="${i}" aria-label="${t('Remover')}">✕</button></div></div>`).join('') || `<p class="muted small" style="padding:12px">${t('Adicione blocos abaixo.')}</p>`;
    $$('textarea', blocksEl).forEach(grow);
    $$('img[data-asset]', blocksEl).forEach((im) => im.dataset.asset && assetImage(im.dataset.asset).then((x) => { if (x) { im.src = x.src; im.style.display = ''; } }));
  };
  blocksEl.addEventListener('input', (e) => {
    const ta = e.target.closest('[data-t]'); if (ta) { doc.blocks[+ta.dataset.t].text = ta.value; grow(ta); save(); }
    const cp = e.target.closest('[data-cap]'); if (cp) { doc.blocks[+cp.dataset.cap].caption = cp.value; save(); }
  });
  blocksEl.addEventListener('focusin', (e) => { const ta = e.target.closest('[data-t]'); if (ta) focusIdx = +ta.dataset.t; });
  blocksEl.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.up) { const i = +d.up; if (i > 0) [doc.blocks[i - 1], doc.blocks[i]] = [doc.blocks[i], doc.blocks[i - 1]]; }
    if (d.down) { const i = +d.down; if (i < doc.blocks.length - 1) [doc.blocks[i + 1], doc.blocks[i]] = [doc.blocks[i], doc.blocks[i + 1]]; }
    if (d.rm) doc.blocks.splice(+d.rm, 1);
    if (d.typeOf) { const keys = Object.keys(BLOCKS).filter((k) => !['image', 'pagebreak'].includes(k)); const cur = doc.blocks[+d.typeOf]; if (keys.includes(cur.type)) cur.type = keys[(keys.indexOf(cur.type) + 1) % keys.length]; }
    if (d.img) { const a = await chooseImage(); if (a) { doc.blocks[+d.img].assetId = a.id; if (a.license && !doc.blocks[+d.img].caption) doc.blocks[+d.img].caption = `${t('Fonte')}: ${a.author || 'Wikimedia Commons'} (${a.license})`; } }
    paint(); save();
  });
  $('#addb', view).onclick = (e) => { const b = e.target.closest('[data-add]'); if (!b) return; doc.blocks.push({ id: uid('b'), type: b.dataset.add, text: '' }); paint(); save(); setTimeout(() => $$('textarea', blocksEl).pop()?.focus(), 30); };

  const paintRefs = () => {
    const list = sortRefs(refs.filter((r) => doc.refIds.includes(r.id)), doc.style);
    $('#drefs', view).innerHTML = list.map((r) => `<div class="list-item small" style="align-items:flex-start"><span class="grow">${toHTML(formatRef(r, doc.style), esc)}</span><button class="icon-btn" data-unref="${r.id}" aria-label="${t('Remover')}">${I.close}</button></div>`).join('') || `<p class="xs muted">${t('Nenhuma referência. As referências inseridas entram no final, formatadas em ABNT ou APA.')}</p>`;
  };
  $('#drefs', view).onclick = (e) => { const b = e.target.closest('[data-unref]'); if (b) { doc.refIds = doc.refIds.filter((x) => x !== b.dataset.unref); paintRefs(); save(); } };
  $('#addref', view).onclick = () => {
    if (!refs.length) { toast(t('Sua biblioteca está vazia. Pesquise e salve artigos em Ciência.')); location.hash = '#/ciencia'; return; }
    const s = sheet(`<h3>${t('Inserir referência')}</h3><p class="xs muted">${t('A citação curta entra no parágrafo selecionado e a referência completa vai para o final.')}</p>${refs.map((r) => `<button class="list-item small" data-r="${r.id}" style="align-items:flex-start;margin-top:8px"><span class="grow">${toHTML(formatRef(r, doc.style), esc)}</span></button>`).join('')}`);
    s.el.onclick = (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return; const r = refs.find((x) => x.id === b.dataset.r);
      if (!doc.refIds.includes(r.id)) doc.refIds.push(r.id);
      const blk = focusIdx !== null ? doc.blocks[focusIdx] : [...doc.blocks].reverse().find((x) => x.type === 'p');
      if (blk && blk.type !== 'image') blk.text = (blk.text || '').replace(/\s*$/, '') + ' ' + inText(r, doc.style);
      s.close(); paint(); paintRefs(); save(); toast(t('Referência inserida'));
    };
  };

  const refsFormatted = () => sortRefs(refs.filter((r) => doc.refIds.includes(r.id)), doc.style).map((r) => formatRef(r, doc.style));
  $('#docx', view).onclick = async () => {
    const images = {};
    for (const b of doc.blocks) if (b.type === 'image' && b.assetId) { const a = await db.get('assets', b.assetId); if (a?.blob) images[b.assetId] = { bytes: new Uint8Array(await a.blob.arrayBuffer()), ext: a.type === 'image/png' ? 'png' : 'jpeg', w: a.w, h: a.h }; }
    const bytes = buildDocx(doc, { references: refsFormatted(), images, refTitle: doc.style === 'apa' ? 'Referências' : 'REFERÊNCIAS' });
    downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), slug(doc.title) + '.docx'); toast(t('Arquivo Word gerado'));
  };
  $('#pdf', view).onclick = async () => {
    const root = $('#print-root'); const imgs = {};
    for (const b of doc.blocks) if (b.type === 'image' && b.assetId) { const im = await assetImage(b.assetId); if (im) imgs[b.assetId] = im.src; }
    const md = (s) => toHTML(s, esc);
    const body = doc.blocks.map((b) => {
      const tx = b.text || '';
      switch (b.type) {
        case 'h1': return `<h1>${md(tx)}</h1>`; case 'h2': return `<h2>${md(tx)}</h2>`; case 'h3': return `<h3>${md(tx)}</h3>`;
        case 'quote': return `<blockquote>${md(tx)}</blockquote>`; case 'note': return `<div class="note">${md(tx)}</div>`;
        case 'list': return `<ul>${tx.split('\n').filter(Boolean).map((l) => `<li>${md(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`;
        case 'olist': return `<ol>${tx.split('\n').filter(Boolean).map((l) => `<li>${md(l.replace(/^\d+[.)]\s*/, ''))}</li>`).join('')}</ol>`;
        case 'table': { const rows = tx.split('\n').filter((r) => r.trim()).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); return rows.length ? `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${md(c)}</td>` : `<th>${md(c)}</th>`)).join('')}</tr>`).join('')}</table>` : ''; }
        case 'image': return imgs[b.assetId] ? `<figure><img src="${imgs[b.assetId]}" alt=""><figcaption>${esc(b.caption || '')}</figcaption></figure>` : '';
        case 'pagebreak': return '<div class="pb"></div>';
        default: return tx.trim() ? `<p>${md(tx).replace(/\n/g, '<br>')}</p>` : '';
      }
    }).join('');
    const refsHtml = refsFormatted().length ? `<section class="refs"><h1>${doc.style === 'apa' ? 'Referências' : 'REFERÊNCIAS'}</h1>${refsFormatted().map((r) => `<p>${md(r)}</p>`).join('')}</section>` : '';
    root.innerHTML = (doc.cover ? `<section class="cover"><div><img src="${logoSrc}" alt="Logomarca Karina Ximenes"><p style="letter-spacing:3px;font-size:10pt;text-transform:uppercase">${esc(doc.author)}</p></div><div><h1>${esc(doc.title)}</h1>${doc.subtitle ? `<h2>${esc(doc.subtitle)}</h2>` : ''}</div><p>${esc(doc.date)}</p></section>` : `<h1 style="text-transform:none;font-size:20pt">${esc(doc.title)}</h1>${doc.subtitle ? `<h2>${esc(doc.subtitle)}</h2>` : ''}`) + body + refsHtml + `<div class="foot">${esc(doc.footer)}</div>`;
    const imgsEl = $$('img', root); await Promise.all(imgsEl.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    const prevTitle = document.title; document.title = doc.title;
    window.print(); document.title = prevTitle;
  };
  $('#del', view).onclick = async () => { if (await confirmDialog(t('Excluir este documento?'), { ok: t('Excluir'), danger: true })) { await db.del('docs', doc.id); location.hash = '#/documentos'; } };
  paint(); paintRefs();
  return (o = {}) => { if (!o.stale) save.flush(); };
}
