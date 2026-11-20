// Criar rápido em 3 passos — formato → assunto (ou frase/foto própria) → escolher a arte e postar.
// Cada passo tem endereço próprio (#/rapido?f=…&th=…), então o Voltar do app e o gesto do iPhone funcionam.
import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, slug } from '../lib/util.js';
import { PHRASES, captionFor, phraseById } from '../lib/content.js';
import { PALETTES, COLOR_GROUPS, buildPages, newProjectFromSpec } from '../lib/templates.js';
import { I, $, $$, sheet, toast, drawThumb, exportPage, ensureFonts, measureCtx, signature, downloadBlob, copyText, assetImage } from '../ui.js';
import { chooseImage, saveImageBlob } from './media.js';
import { monthPhotos } from './photos.js';

// Formatos (Status do WhatsApp usa a mesma medida do Story)
export const QFORMATS = {
  story: { label: 'Story', sub: 'Instagram · 9:16', render: 'story', w: 34, h: 60 },
  feed: { label: 'Feed', sub: 'Instagram · 4:5', render: 'portrait', w: 48, h: 60 },
  status: { label: 'Status', sub: 'WhatsApp · 9:16', render: 'story', w: 34, h: 60, wa: true },
  square: { label: 'Quadrado', sub: 'Post 1:1', render: 'square', w: 54, h: 54 },
  carousel: { label: 'Carrossel', sub: 'Instagram · várias páginas', render: 'portrait', w: 40, h: 50, wide: true },
};
// Assuntos organizados em grupos
const GROUPS = [
  ['Fé e sentido', [['logoterapia', 'Sentido da vida', 'Logoterapia e Viktor Frankl', '🌱', '#E6EDE3'], ['espiritualidade', 'Fé e esperança', 'Graça, providência e recomeços', '✝️', '#EFE3CF']]],
  ['Cuidado emocional', [['emocional', 'Emoções e autocuidado', 'Ansiedade, limites, descanso', '💛', '#FBE7A1'], ['reflexoes', 'Reflexão do dia', 'Frases curtas para acolher', '☀️', '#FFF2CC'], ['relacoes', 'Relacionamentos', 'Família, amor e vínculos', '🤝', '#E9DEF7']]],
  ['Terapia e ciência', [['emdr', 'EMDR e trauma', 'Como funciona, o que esperar', '🧠', '#E9DEF7'], ['neuro', 'Cérebro e hábitos', 'Neurociência do dia a dia', '✨', '#E6EDE3'], ['psicoeducacao', 'Dicas em lista', 'Passo a passo e sinais de alerta', '📝', '#F6E5CE']]],
  ['Seu trabalho e datas', [['datas', 'Campanhas do mês', 'Janeiro Branco, Setembro Amarelo…', '📅', '#F6E5CE'], ['divulgacao', 'Meu trabalho', 'Atendimento, abordagens, agenda', '💼', '#EEE7DA'], ['minhas', 'Minhas reflexões', 'As frases que você escreveu', '🕊️', '#F7F1FF']]],
];
const LAY = {
  story: ['minimal', 'aspas', 'arco', 'cartao', 'circulo', 'folhas', 'moldura', 'editorial', 'campanha'],
  portrait: ['editorial', 'minimal', 'aspas', 'cartao', 'arco', 'dividido', 'tipografico', 'folhas', 'moldura', 'circulo'],
  square: ['minimal', 'aspas', 'cartao', 'circulo', 'moldura', 'editorial', 'folhas'],
};
const PHOTO_LAY = ['foto', 'fotoarco'];
const PALS = Object.keys(PALETTES);

const go = (q) => { location.hash = '#/rapido' + (q ? '?' + new URLSearchParams(q).toString() : ''); };

export async function render(view, { query }) {
  const fk = QFORMATS[query.get('f')] ? query.get('f') : (query.get('f') === 'portrait' ? 'feed' : null);
  const th = query.get('th'); const txt = query.get('txt');
  if (!fk) return formats(view);
  if (!th && !txt) return themes(view, fk);
  return arts(view, fk, th, txt);
}

function formats(view) {
  view.innerHTML = `
    <div class="row between"><div><div class="eyebrow">${t('Criar')} · ${t('passo')} 1 ${t('de')} 3</div><h1 class="h-title" style="margin-top:4px">${t('O que vamos postar?')}</h1></div><button class="btn sm ghost" id="tour">${I.help}${t('Como fazer')}</button></div>
    <div class="qfmt" id="fmts" style="margin-top:16px">${Object.entries(QFORMATS).map(([k, f]) => `
      <button data-fmt="${k}" class="${f.wide ? 'wide' : ''}"><span class="shape" style="width:${f.w}px;height:${f.h}px">${k === 'carousel' ? '<b style="font-size:11px">1·2·3</b>' : f.wa ? '<b style="font-size:16px">💬</b>' : ''}</span><span style="text-align:${f.wide ? 'left' : 'center'}"><b style="display:block">${t(f.label)}</b><small>${t(f.sub)}</small></span></button>`).join('')}</div>
    <h2 class="h-section" style="font-size:20px">${t('Outras formas de criar')}</h2>
    <a class="list-item" href="#/biblioteca"><span class="thumb">${I.grid}</span><span class="grow"><b>${t('Artes prontas')}</b><span class="xs muted">${t('Centenas de modelos com a sua marca')}</span></span></a>
    <a class="list-item" href="#/agenda"><span class="thumb">${I.calendar}</span><span class="grow"><b>${t('Semana temática')}</b><span class="xs muted">${t('Uma semana inteira de posts de uma vez')}</span></span></a>
    <a class="list-item" href="#/textos"><span class="thumb">${I.sparkle}</span><span class="grow"><b>Frankie</b><span class="xs muted">${t('Textos, legendas e minhas reflexões')}</span></span></a>
    <a class="list-item" href="#/criar"><span class="thumb">${I.pages}</span><span class="grow"><b>${t('Meus projetos e editor completo')}</b><span class="xs muted">${t('Continuar uma arte, documentos')}</span></span></a>`;
  view.onclick = (e) => { const b = e.target.closest('[data-fmt]'); if (b) go({ f: b.dataset.fmt }); };
  $('#tour', view).onclick = () => import('./tour.js').then((m) => m.startTour('criar'));
}

function themes(view, fk) {
  const hasMine = PHRASES.some((p) => p.custom);
  view.innerHTML = `
    <div class="eyebrow">${t(QFORMATS[fk].label)} · ${t('passo')} 2 ${t('de')} 3</div>
    <h1 class="h-title" style="margin:4px 0 6px">${t('Sobre o que é?')}</h1>
    <div class="card" style="margin:12px 0 4px">
      <label class="field"><span>✍️ ${t('Escreva sua frase')}</span><textarea class="input" id="own" rows="2" placeholder="${t('Ex.: Recomeçar também é um ato de fé.')}"></textarea></label>
      <button class="btn block" id="gotxt" style="margin-top:8px">${I.wand}${t('Criar com minha frase')}</button>
    </div>
    ${GROUPS.map(([g, items]) => `<div class="qgroup">${t(g)}</div>${items.filter(([id]) => id !== 'minhas' || hasMine).map(([id, l, d, ic, bg]) => `
      <button class="qtheme" data-th="${id}"><span class="ic" style="background:${bg}">${ic}</span><span><b>${t(l)}</b><small>${t(d)}</small></span><span class="go">›</span></button>`).join('')}`).join('')}`;
  view.onclick = (e) => { const b = e.target.closest('[data-th]'); if (b) go({ f: fk, th: b.dataset.th }); };
  $('#gotxt', view).onclick = () => { const v = $('#own', view).value.trim(); if (!v) return toast(t('Escreva sua frase.')); go({ f: fk, txt: v.slice(0, 280) }); };
}

async function arts(view, fk, th, txt) {
  await ensureFonts();
  const F = QFORMATS[fk]; const fmt = F.render;
  const st = { colors: sessionStorage.getItem('sk-colors') || 'todas', photo: sessionStorage.getItem('sk-photo') || null, shift: +(sessionStorage.getItem('sk-shift-' + (th || 'txt')) || 0) };
  const N = fk === 'carousel' ? 4 : fmt === 'portrait' ? 6 : 9;
  const palsOf = () => COLOR_GROUPS[st.colors]?.keys || PALS;
  const specs = () => {
    const ks = palsOf();
    if (fk === 'carousel') {
      const pool = PHRASES.filter((p) => (th ? p.cat === th : true) && !p.items);
      return Array.from({ length: N }, (_, i) => {
        const ids = Array.from({ length: 5 }, (_, j) => pool[(st.shift * 5 + i * 2 + j) % Math.max(1, pool.length)]?.id).filter(Boolean);
        return { layout: 'carrossel-tema', cat: th || 'reflexoes', phraseIds: [...new Set(ids)], palette: ks[(st.shift * 3 + i * 2) % ks.length], format: 'portrait', title: txt || undefined };
      });
    }
    const lays = st.photo ? PHOTO_LAY : LAY[fmt];
    const list = txt ? Array.from({ length: N }, () => ({ id: 'custom', cat: 'minhas', text: txt }))
      : (() => { const all = PHRASES.filter((p) => p.cat === th && (fmt !== 'story' || !p.items)); return Array.from({ length: N }, (_, i) => all[(st.shift * N + i) % all.length]); })();
    return list.filter(Boolean).map((p, i) => ({
      phrase: p.id === 'custom' ? p : undefined, phraseId: p.id === 'custom' ? undefined : p.id,
      layout: p.items ? (i % 2 ? 'cartaolista' : 'lista') : lays[(st.shift * 3 + i) % lays.length],
      palette: ks[(st.shift * 5 + i * 3) % ks.length], format: fmt,
    }));
  };
  const mine = (await db.all('assets')).slice(0, 12);
  const label = txt ? t('Sua frase') : t(GROUPS.flatMap(([, it]) => it).find(([id]) => id === th)?.[1] || '');
  view.innerHTML = `
    <div class="eyebrow">${t(F.label)} · ${esc(label)} · ${t('passo')} 3 ${t('de')} 3</div>
    <h1 class="h-title" style="margin:4px 0 2px">${t('Escolha uma arte')}</h1>
    <p class="small muted" style="margin:0 0 10px">${t('Toque na arte para ver grande e postar.')}</p>
    ${fk === 'carousel' ? '' : `<div class="qgroup" style="margin-top:6px">📷 ${t('Foto (opcional)')}</div>
    <div class="qphotos" id="ph">
      <button data-ph="" aria-pressed="${!st.photo}">${t('Sem foto')}</button>
      <button data-add aria-label="${t('Do celular')}">${I.plus}</button>
      ${mine.map((a) => `<button data-ph="${a.id}" aria-pressed="${st.photo === a.id}"><img data-asset="${a.id}" alt=""></button>`).join('')}
      <span id="month" style="display:contents"></span>
    </div>`}
    <div class="qgroup">🎨 ${t('Cores')}</div>
    <div class="chips" id="cols">${Object.entries(COLOR_GROUPS).filter(([k]) => k !== 'classicas').map(([k, g]) => {
      const sw = g.keys.slice(0, 3).map((pk) => PALETTES[pk].bg).map((b) => `<i style="width:12px;height:12px;border-radius:50%;background:${b.type === 'solid' ? b.c1 : `linear-gradient(${b.c1},${b.c2})`};border:1px solid #0002;margin-right:-4px"></i>`).join('');
      return `<button class="chip" data-col="${k}" aria-pressed="${st.colors === k}">${k === 'todas' ? '' : `<span style="display:inline-flex;margin-right:6px">${sw}</span>`}${t(g.label)}</button>`; }).join('')}</div>
    <div class="grid" style="grid-template-columns:repeat(${fmt === 'story' ? 3 : 2},minmax(0,1fr));margin-top:8px" id="g"></div>
    <button class="btn block secondary" id="more" style="margin-top:14px">${I.refresh}${t('Ver outras artes')}</button>`;
  for (const im of $$('img[data-asset]', view)) assetImage(im.dataset.asset).then((x) => { if (x) im.src = x.src; });
  // fotos do mês (sugestões renovadas mensalmente)
  if (fk !== 'carousel') monthPhotos().then((list) => {
    const m = $('#month', view); if (!m || !list.length) return;
    m.innerHTML = list.slice(0, 10).map((p, i) => `<button data-mp="${i}" title="${esc(p.license)} · ${esc(p.author)}"><img loading="lazy" src="${esc(p.thumb)}" alt="${esc(p.title)}"></button>`).join('');
    m.onclick = async (e) => {
      const b = e.target.closest('[data-mp]'); if (!b) return; e.stopPropagation(); const p = list[+b.dataset.mp];
      toast(t('Baixando imagem...'));
      try { const a = await saveImageBlob(await (await fetch(p.full)).blob(), { name: p.title, source: 'wikimedia', license: p.license, author: p.author, url: p.page }); sessionStorage.setItem('sk-photo', a.id); toast(t('Foto do mês aplicada · {l}', { l: p.license || 'licença livre' })); arts(view, fk, th, txt); }
      catch { toast(t('Não foi possível baixar esta imagem.')); }
    };
  }).catch(() => {});
  const grid = $('#g', view);
  const paintGrid = () => {
    const list = specs();
    grid.innerHTML = list.map((_, i) => `<button class="art" data-i="${i}" aria-label="${t('Arte')} ${i + 1}">${fk === 'carousel' ? `<span class="pill">${t('Carrossel')}</span>` : ''}<canvas></canvas></button>`).join('');
    const cs = $$('canvas', grid);
    list.forEach((sp, i) => { const pg = pagesOf(sp, st.photo)[0]; drawThumb(cs[i], pg, sp.format, fmt === 'story' ? 240 : 300); });
    grid.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) postArt(list[+b.dataset.i], { photo: st.photo, wa: !!F.wa }); };
  };
  paintGrid();
  view.onclick = async (e) => {
    if (e.target.closest('#more')) { st.shift++; sessionStorage.setItem('sk-shift-' + (th || 'txt'), st.shift); paintGrid(); window.scrollTo({ top: grid.offsetTop - 80, behavior: 'smooth' }); return; }
    const col = e.target.closest('[data-col]'); if (col) { st.colors = col.dataset.col; sessionStorage.setItem('sk-colors', st.colors); $$('#cols .chip', view).forEach((x) => x.setAttribute('aria-pressed', x === col)); return paintGrid(); }
    const ph = e.target.closest('[data-ph]'); if (ph) { st.photo = ph.dataset.ph || null; st.photo ? sessionStorage.setItem('sk-photo', st.photo) : sessionStorage.removeItem('sk-photo'); $$('#ph button', view).forEach((x) => x.setAttribute('aria-pressed', x === ph)); return paintGrid(); }
    if (e.target.closest('[data-add]')) { const a = await chooseImage({ title: t('Sua foto') }); if (a) { sessionStorage.setItem('sk-photo', a.id); arts(view, fk, th, txt); } }
  };
}

function pagesOf(spec, photo) {
  const pages = buildPages(spec, { sig: signature(), mctx: measureCtx() });
  if (photo) for (const pg of pages) for (const l of pg.layers) if (l.type === 'image') l.assetId = photo;
  return pages;
}

/** Prévia grande com Postar / Baixar / Ajustar. A imagem é gerada antes do toque para o compartilhamento abrir na hora (iPhone). */
export async function postArt(spec, { photo = null, postId = null, wa = false } = {}) {
  await ensureFonts();
  const pages = pagesOf(spec, photo);
  const ph = spec.phrase || phraseById(spec.phraseId) || { text: spec.title || 'Studio Karina', cat: spec.cat || 'reflexoes' };
  const caption = spec.layout === 'carrossel-tema' ? (spec.phraseIds || []).map((id, i) => `${i + 1}. ${phraseById(id)?.text || ''}`).join('\n') + `\n\n${signature()}` : captionFor(ph, { signature: signature() });
  const cap = wa ? caption.replace(/\n\n#[\s\S]*$/, '') : caption;
  const where = wa ? t('Postar no Status do WhatsApp') : t('Postar no Instagram');
  const s = sheet(`<div style="display:grid;place-items:center"><canvas id="big" style="max-height:50vh;width:auto;border-radius:12px;box-shadow:0 10px 30px #0003"></canvas></div>
    ${pages.length > 1 ? `<p class="xs muted" style="text-align:center;margin:6px 0 0">${pages.length} ${t('páginas no carrossel')}</p>` : ''}
    <button class="btn block" id="ig" style="margin-top:14px;min-height:56px;font-size:17px" disabled><span class="spinner" style="width:18px;height:18px;border-width:2px"></span>${t('Preparando...')}</button>
    <p class="xs muted" style="text-align:center;margin:6px 0 10px">${wa ? t('No WhatsApp, escolha "Meu status".') : t('A legenda é copiada: no Instagram, é só colar.')}</p>
    <div class="grid c2"><button class="btn secondary" id="dl">${I.download}${t('Baixar')}</button><button class="btn secondary" id="edit">${I.wand}${t('Ajustar')}</button></div>
    <details class="fold" style="margin-top:12px"><summary>${t('Ver legenda')}</summary><div><div class="result small">${esc(cap)}</div><button class="btn sm ghost" id="cap" style="margin-top:8px">${I.copy}${t('Copiar legenda')}</button></div></details>`, { label: t('Postar') });
  await drawThumb($('#big', s.el), pages[0], spec.format, 720);
  const files = [];
  for (let i = 0; i < pages.length; i++) files.push(new File([await exportPage(pages[i], spec.format)], `${slug(ph.title || ph.text).slice(0, 40)}${pages.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
  const ig = $('#ig', s.el); ig.disabled = false; ig.innerHTML = `${I.share}${where}`;
  ig.onclick = () => {
    navigator.clipboard?.writeText(cap).catch(() => {});
    if (navigator.canShare && navigator.canShare({ files })) {
      navigator.share({ files, text: cap }).then(() => toast(wa ? t('Pronto! Confira seu Status.') : t('Legenda copiada — cole no Instagram.'), 4000)).catch((e) => { if (e.name !== 'AbortError') toast(t('Não foi possível compartilhar. Use Baixar.')); });
    } else { for (const f of files) downloadBlob(f, f.name); toast(t('Imagem baixada e legenda copiada. Abra o Instagram e poste.'), 5000); }
  };
  $('#dl', s.el).onclick = () => { for (const f of files) downloadBlob(f, f.name); toast(t('Download iniciado')); };
  $('#cap', s.el).onclick = () => copyText(cap);
  $('#edit', s.el).onclick = async () => {
    const proj = newProjectFromSpec(spec, { sig: signature(), mctx: measureCtx() }); proj.pages = pages; if (postId) proj.postId = postId; await db.put('projects', proj); s.close(); location.hash = `#/editor/${proj.id}`;
  };
  if (postId) ig.addEventListener('click', async () => { const p = await db.get('posts', postId); if (p && p.status !== 'publicado') { p.status = 'publicado'; p.history = [...(p.history || []), { at: Date.now(), status: 'publicado', note: 'Postado pelo Studio' }]; await db.put('posts', p); } });
}
