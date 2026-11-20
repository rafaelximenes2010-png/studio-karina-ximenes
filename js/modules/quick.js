// Criar rápido: Story ou Feed do Instagram em 3 toques — formato → tema (ou frase/foto própria) → escolher e postar.
import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, slug } from '../lib/util.js';
import { PHRASES, captionFor, phraseById } from '../lib/content.js';
import { PALETTES, COLOR_GROUPS, buildPages, newProjectFromSpec } from '../lib/templates.js';
import { visitStep } from '../lib/navigation.js';
import { I, $, $$, sheet, toast, drawThumb, exportPage, ensureFonts, measureCtx, signature, downloadBlob, copyText } from '../ui.js';
import { chooseImage } from './media.js';

// Temas mais usados pela Karina, em linguagem simples
const GROUPS = [
  ['Vida e propósito', [['logoterapia', 'Sentido da vida'], ['espiritualidade', 'Fé e esperança'], ['reflexoes', 'Reflexão do dia']]],
  ['Saúde e vínculos', [['emocional', 'Emoções e autocuidado'], ['relacoes', 'Relacionamentos'], ['emdr', 'EMDR e trauma']]],
  ['Psicologia no dia a dia', [['neuro', 'Cérebro e hábitos'], ['psicoeducacao', 'Dicas (lista)']]],
  ['Do consultório', [['divulgacao', 'Meu trabalho'], ['datas', 'Datas comemorativas'], ['minhas', 'Minhas reflexões']]],
];
const THEMES = GROUPS.flatMap(([, themes]) => themes);
const forTheme = (id) => PHRASES.filter((p) => id === 'minhas' ? p.custom : p.cat === id);
// Layouts que ficam bonitos em cada formato do Instagram
const LAY = {
  story: ['minimal', 'aspas', 'arco', 'cartao', 'circulo', 'folhas', 'moldura', 'editorial', 'campanha', 'dividido', 'tipografico', 'institucional'],
  portrait: ['editorial', 'minimal', 'aspas', 'cartao', 'arco', 'dividido', 'tipografico', 'folhas', 'moldura', 'circulo', 'campanha', 'institucional'],
};
const PHOTO_LAY = ['foto', 'fotoarco', 'fotofaixa', 'fotocirculo'];
const PALS = Object.keys(PALETTES);
const N = 8;

export async function render(view, { query }) {
  const format = query.get('f') === 'feed' ? 'portrait' : query.get('f') === 'story' ? 'story' : null;
  const saved = history.state?.quick || {};
  const topic = query.get('tema');
  const st = { colors: sessionStorage.getItem('sk-colors') || 'todas', ...saved, format,
    theme: THEMES.some(([id]) => id === topic && forTheme(id).length) ? topic : null,
    text: topic === 'propria' ? saved.draft || '' : '', shift: saved.shift || 0 };
  const remember = () => history.replaceState({ ...history.state, quick: { draft: st.draft, photo: st.photo, phraseId: st.phraseId, shift: st.shift } }, '');
  const next = (fmt, topic) => {
    remember();
    const hash = '#/rapido?f=' + (fmt === 'story' ? 'story' : 'feed') + (topic ? '&tema=' + topic : '');
    visitStep(hash, { ...history.state.quick, shift: 0, phraseId: null });
  };
  const box = () => view;
  const paint = () => (st.format ? (st.theme || st.text ? arts() : themes()) : formats());

  function formats() {
    box().innerHTML = `
      <div class="eyebrow">${t('Criar')} · 1 / 3</div>
      <h1 class="h-title" style="margin:4px 0 16px">${t('O que vamos postar?')}</h1>
      <div class="grid c2">
        ${[['story', t('Story'), '9:16', 34, 60], ['portrait', t('Feed'), '4:5', 48, 60]].map(([k, l, r, w, h]) => `
        <button class="card" data-fmt="${k}" style="cursor:pointer;text-align:center;padding:22px 10px">
          <span style="display:block;width:${w}px;height:${h}px;margin:0 auto 12px;border-radius:8px;border:3px solid var(--primary);background:var(--surface-3)"></span>
          <b style="font-size:20px;display:block">${l}</b><span class="small muted">Instagram · ${r}</span></button>`).join('')}
      </div>
      <p class="small muted" style="text-align:center;margin:18px 0 6px">${t('Dica: escolha, toque na arte e poste. Pronto.')}</p>
      <details class="fold" style="margin-top:16px"><summary>${t('Mais opções')}</summary><div class="stack">
        <a class="list-item" href="#/criar"><span class="thumb">${I.grid}</span><span class="grow"><b>${t('Outros formatos e meus projetos')}</b><span class="xs muted">${t('Quadrado, carrossel, editor completo')}</span></span></a>
        <a class="list-item" href="#/textos"><span class="thumb">${I.sparkle}</span><span class="grow"><b>Frankie</b><span class="xs muted">${t('Textos, legendas e minhas reflexões')}</span></span></a>
        <a class="list-item" href="#/documentos"><span class="thumb">${I.doc}</span><span class="grow"><b>${t('Documentos')}</b><span class="xs muted">PDF · Word</span></span></a>
      </div></details>`;
    box().onclick = (e) => { const b = e.target.closest('[data-fmt]'); if (b) { next(b.dataset.fmt); } };
  }

  function themes() {
    const fmtName = st.format === 'story' ? 'Story' : 'Feed';
    box().innerHTML = `
      <div class="eyebrow">${fmtName} · 2 / 3</div>
      <h1 class="h-title">${t('Sobre o que é?')}</h1>
      <div id="th">${GROUPS.map(([group, topics]) => `<section class="quick-group"><h2>${t(group)}</h2><div class="grid c2">${topics.filter(([id]) => forTheme(id).length).map(([id, label]) => `<button class="topic-choice" data-th="${id}">${t(label)}</button>`).join('')}</div></section>`).join('')}</div>
      <h2 class="h-section" style="font-size:20px">${t('Ou escreva sua frase')}</h2>
      <textarea class="input" id="own" maxlength="280" rows="3" placeholder="${t('Ex.: Recomeçar também é um ato de fé.')}">${esc(st.draft || '')}</textarea>
      <button class="btn block" id="go" style="margin-top:10px">${I.wand}${t('Criar artes com minha frase')}</button>`;
    box().onclick = (e) => {
      const b = e.target.closest('[data-th]'); if (b) { next(st.format, b.dataset.th); }
    };
    $('#own', box()).oninput = (e) => { st.draft = e.target.value; remember(); };
    $('#go', box()).onclick = () => { const v = $('#own', box()).value.trim(); if (!v) return toast(t('Escreva sua frase.')); st.draft = v; next(st.format, 'propria'); };
  }

  function specs() {
    const lays = st.photo ? PHOTO_LAY : LAY[st.format];
    let phrases;
    if (st.text) phrases = Array.from({ length: N }, () => ({ id: 'custom', cat: 'minhas', text: st.text }));
    else {
      const chosen = forTheme(st.theme).find((p) => p.id === st.phraseId);
      const all = chosen ? [chosen] : forTheme(st.theme);
      phrases = Array.from({ length: N }, (_, i) => all[(st.shift * N + i) % all.length]);
    }
    return phrases.map((p, i) => {
      const layout = p.items && st.photo ? 'fotolista' : p.items ? (i % 2 ? 'cartaolista' : 'lista') : lays[(st.shift * 3 + i) % lays.length];
      return { phrase: p.id === 'custom' ? p : undefined, phraseId: p.id === 'custom' ? undefined : p.id, layout, palette: (() => { const ks = COLOR_GROUPS[st.colors]?.keys || PALS; return ks[(st.shift * 5 + i * 3) % ks.length]; })(), format: st.format };
    });
  }
  const pagesOf = (spec) => {
    const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
    if (st.photo) for (const pg of pages) for (const l of pg.layers) if (l.type === 'image') l.assetId = st.photo;
    return pages;
  };

  async function arts() {
    await ensureFonts();
    if (!view.isConnected) return;
    const label = st.text ? t('Sua frase') : t(THEMES.find(([id]) => id === st.theme)?.[1] || '');
    const list = specs();
    box().innerHTML = `
      <div class="eyebrow">${st.format === 'story' ? 'Story' : 'Feed'} · 3 / 3 · ${esc(label)}</div>
      <h1 class="h-title" style="margin:12px 0 4px">${t('Escolha uma arte')}</h1>
      <p class="small muted" style="margin:0 0 12px">${t('Toque para ver grande e postar.')}</p>
      <div class="row" style="margin-bottom:12px"><button class="btn sm secondary" id="more">${I.refresh}${t('Outras opções')}</button><button class="btn sm ${st.photo ? 'gold' : 'secondary'}" id="photo">${I.image}${st.photo ? t('Trocar foto') : t('Escolher foto')}</button>${st.photo ? `<button class="btn sm ghost" id="nophoto">${t('Sem foto')}</button>` : ''}</div>
      ${st.theme ? `<label class="field quick-phrase"><span>${t('Escolher frase')}</span><select class="input" id="phrase"><option value="">${t('Variar as frases')}</option>${forTheme(st.theme).map((p) => `<option value="${esc(p.id)}" ${p.id === st.phraseId ? 'selected' : ''}>${esc(p.title || p.text)}</option>`).join('')}</select></label>` : ''}
      <div class="chips" id="cols">${Object.entries(COLOR_GROUPS).filter(([k]) => k !== 'classicas').map(([k, g]) => {
        const sw = g.keys.slice(0, 3).map((pk) => PALETTES[pk].bg).map((b) => `<i style="width:12px;height:12px;border-radius:50%;background:${b.type === 'solid' ? b.c1 : `linear-gradient(${b.c1},${b.c2})`};border:1px solid #0002;margin-right:-4px"></i>`).join('');
        return `<button class="chip" data-col="${k}" aria-pressed="${st.colors === k}">${k === 'todas' ? '' : `<span style="display:inline-flex;margin-right:6px">${sw}</span>`}${t(g.label)}</button>`; }).join('')}</div>
      <div class="grid quick-arts" id="g">${list.map((_, i) => `<button class="art" data-i="${i}" aria-label="${t('Arte')} ${i + 1}"><canvas></canvas></button>`).join('')}</div>`;
    const cs = $$('#g canvas', box());
    for (let i = 0; i < list.length; i++) drawThumb(cs[i], pagesOf(list[i])[0], st.format, st.format === 'story' ? 240 : 300);
    const phrase = $('#phrase', view);
    if (phrase) phrase.onchange = () => { st.phraseId = phrase.value; st.shift = 0; remember(); paint(); };
    box().onclick = async (e) => {
      if (e.target.closest('#more')) { st.shift++; remember(); return paint(); }
      const col = e.target.closest('[data-col]'); if (col) { st.colors = col.dataset.col; sessionStorage.setItem('sk-colors', st.colors); st.shift = 0; remember(); return paint(); }
      if (e.target.closest('#nophoto')) { st.photo = null; remember(); return paint(); }
      if (e.target.closest('#photo')) { const a = await chooseImage({ title: t('Escolher foto'), initialTab: 'studio' }); if (a && view.isConnected) { st.photo = a.id; remember(); paint(); } return; }
      const b = e.target.closest('[data-i]'); if (b) post(list[+b.dataset.i]);
    };
  }

  const post = (spec) => postArt(spec, { photo: st.photo });
  paint();
}

/** Prévia grande com Postar / Baixar / Ajustar. A imagem é gerada antes do toque para o compartilhamento abrir na hora (iPhone). */
export async function postArt(spec, { photo = null, postId = null } = {}) {
    await ensureFonts();
    const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
    if (photo) for (const pg of pages) for (const l of pg.layers) if (l.type === 'image') l.assetId = photo;
    const ph = spec.phrase || phraseById(spec.phraseId);
    const caption = captionFor(ph, { signature: signature() });
    const s = sheet(`<div style="display:grid;place-items:center"><canvas id="big" style="max-height:52vh;width:auto;border-radius:12px;box-shadow:0 10px 30px #0003"></canvas></div>
      <button class="btn block" id="ig" style="margin-top:14px;min-height:54px;font-size:17px" disabled><span class="spinner" style="width:18px;height:18px;border-width:2px"></span>${t('Preparando...')}</button>
      <p class="xs muted" style="text-align:center;margin:6px 0 10px">${t('A legenda é copiada: no Instagram, é só colar.')}</p>
      <div class="grid c2"><button class="btn secondary" id="dl">${I.download}${t('Baixar')}</button><button class="btn secondary" id="edit">${I.wand}${t('Ajustar')}</button></div>
      <details class="fold" style="margin-top:12px"><summary>${t('Ver legenda')}</summary><div><div class="result small">${esc(caption)}</div><button class="btn sm ghost" id="cap" style="margin-top:8px">${I.copy}${t('Copiar legenda')}</button></div></details>`, { label: t('Postar') });
    await drawThumb($('#big', s.el), pages[0], spec.format, 720);
    const files = [];
    for (let i = 0; i < pages.length; i++) files.push(new File([await exportPage(pages[i], spec.format)], `${slug(ph.title || ph.text).slice(0, 40)}${pages.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
    const ig = $('#ig', s.el); ig.disabled = false; ig.innerHTML = `${I.share}${t('Postar no Instagram')}`;
    ig.onclick = () => {
      navigator.clipboard?.writeText(caption).catch(() => {});
      if (navigator.canShare && navigator.canShare({ files })) {
        navigator.share({ files, text: caption }).then(() => toast(t('Legenda copiada — cole no Instagram.'), 4000)).catch((e) => { if (e.name !== 'AbortError') toast(t('Não foi possível compartilhar. Use Baixar.')); });
      } else { for (const f of files) downloadBlob(f, f.name); toast(t('Imagem baixada e legenda copiada. Abra o Instagram e poste.'), 5000); }
    };
    $('#dl', s.el).onclick = () => { for (const f of files) downloadBlob(f, f.name); toast(t('Download iniciado')); };
    $('#cap', s.el).onclick = () => copyText(caption);
    $('#edit', s.el).onclick = async () => {
      const proj = newProjectFromSpec(spec, { sig: signature(), mctx: measureCtx() }); proj.pages = pages; if (postId) proj.postId = postId; await db.put('projects', proj); s.close(); location.hash = `#/editor/${proj.id}`;
    };
    if (postId) ig.addEventListener('click', async () => { const p = await db.get('posts', postId); if (p && p.status !== 'publicado') { p.status = 'publicado'; p.history = [...(p.history || []), { at: Date.now(), status: 'publicado', note: 'Postado pelo Studio' }]; await db.put('posts', p); } });
}
