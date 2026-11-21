// Criar rápido em 3 passos — formato → assunto (ou frase/foto própria) → escolher a arte e postar.
// Cada passo tem endereço próprio (#/rapido?f=…&th=…), então o Voltar do app e o gesto do iPhone funcionam.
import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { esc, slug } from '../lib/util.js';
import { PHRASES, captionFor, phraseById } from '../lib/content.js';
import { PALETTES, COLOR_GROUPS, buildPages, newProjectFromSpec, STYLES, VANGUARDA } from '../lib/templates.js';
import { I, $, $$, sheet, toast, zoomPages, drawThumb, exportPage, ensureFonts, measureCtx, signature, downloadBlob, copyText, assetImage } from '../ui.js';
import { chooseImage, saveImageBlob } from './media.js';
import { monthPhotos, landscapePhotos } from './photos.js';
import { composeFromTheme } from '../lib/compose.js';
import { COMPARES, compareCaption } from '../lib/compare.js';

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
  ['Fé e sentido', [['logoterapia', 'Sentido da vida', 'Logoterapia e Viktor Frankl', I.compass, '#E6EDE3'], ['espiritualidade', 'Fé e esperança', 'Graça, providência e recomeços', I.cross, '#EFE3CF']]],
  ['Cuidado emocional', [['emocional', 'Emoções e autocuidado', 'Ansiedade, limites, descanso', I.heart, '#FBE7A1'], ['reflexoes', 'Reflexão do dia', 'Frases curtas para acolher', I.sun, '#FFF2CC'], ['relacoes', 'Relacionamentos', 'Família, amor e vínculos', I.users, '#E9DEF7']]],
  ['Terapia e ciência', [['emdr', 'EMDR e trauma', 'Como funciona, o que esperar', I.brain, '#E9DEF7'], ['neuro', 'Cérebro e hábitos', 'Neurociência do dia a dia', I.sparkle, '#E6EDE3'], ['ladoalado', 'Lado a lado', 'O que faz bem × o que faz mal', I.scale, '#E8F0E1'], ['psicoeducacao', 'Dicas em lista', 'Passo a passo e sinais de alerta', I.list, '#F6E5CE']]],
  ['Seu trabalho e datas', [['datas', 'Campanhas do mês', 'Janeiro Branco, Setembro Amarelo…', I.calendar, '#F6E5CE'], ['divulgacao', 'Meu trabalho', 'Atendimento, abordagens, agenda', I.briefcase, '#EEE7DA'], ['minhas', 'Minhas reflexões', 'As frases que você escreveu', I.feather, '#F7F1FF']]],
];
const LAY = {
  story: ['minimal', 'aspas', 'arco', 'cartao', 'circulo', 'folhas', 'moldura', 'editorial', 'campanha'],
  portrait: ['editorial', 'minimal', 'aspas', 'cartao', 'arco', 'dividido', 'tipografico', 'folhas', 'moldura', 'circulo'],
  square: ['minimal', 'aspas', 'cartao', 'circulo', 'moldura', 'editorial', 'folhas'],
};
const PHOTO_LAY = ['foto', 'fotoarco', 'fotofaixa', 'fotocirculo'];
// Com a foto da própria Karina: modernos primeiro
const OWN_LAY = ['paisagem', 'foto', 'paisagemcentro', 'fotoarco', 'fotofaixa', 'fotocirculo'];
const MIX = ['reflexoes', 'logoterapia', 'espiritualidade', 'emocional', 'relacoes'];
const MODERN_LAY = ['paisagem', 'paisagemcentro', 'paisagem', 'foto', 'paisagemcentro', 'fotofaixa'];
const STUDIO = ['eucalipto', 'mar', 'caderno', 'trilha', 'cha', 'montanhas'];
const PALS = Object.keys(PALETTES);

const go = (q) => { location.hash = '#/rapido' + (q ? '?' + new URLSearchParams(q).toString() : ''); };

export async function render(view, { query }) {
  const fk = QFORMATS[query.get('f')] ? query.get('f') : (query.get('f') === 'portrait' ? 'feed' : null);
  const th = query.get('th'); const txt = query.get('txt'); const tema = query.get('tema');
  if (query.get('foto') === '1' && fk) return arts(view, fk, th || 'mix', txt, tema, true);
  if (query.get('vg') === '1') return arts(view, fk || 'story', th || 'mix', txt, tema, false, true);
  if (!fk) return formats(view);
  if (!th && !txt && !tema) return themes(view, fk);
  return arts(view, fk, th, txt, tema);
}

/** Começa a criação com uma foto do celular (usado no Início e no passo 1) */
export async function startFromPhoto(f) {
  if (!f) return;
  toast(t('Preparando sua foto...'));
  try {
    const a = await saveImageBlob(f, { name: f.name || 'minha-foto', source: 'celular' });
    sessionStorage.setItem('sk-photo', a.id); sessionStorage.removeItem('sk-paisagem');
    go({ f: 'story', th: 'mix', foto: '1' });
  } catch (err) { toast(err.message || t('Não foi possível usar esta imagem.')); }
}

function formats(view) {
  const big = [['story', I.story, 'Story', 'Instagram · 9:16'], ['feed', I.feed, 'Feed', 'Instagram · 4:5'], ['foto', I.camera, 'Da minha foto', 'Escolha a foto e pronto'], ['carousel', I.carousel, 'Carrossel', 'Várias páginas']];
  view.innerHTML = `
    <div class="row between"><div><div class="eyebrow">${t('Criar')} · ${t('passo')} 1 ${t('de')} 3</div><h1 class="h-title" style="margin-top:4px">${t('O que vamos postar?')}</h1></div><button class="btn sm ghost" id="tour">${I.help}${t('Como fazer')}</button></div>
    <div class="qmain" id="fmts">${big.map(([k, ic, l, sub]) => k === 'foto'
      ? `<label class="qbig photo" data-big="foto"><input type="file" accept="image/*" id="myph" hidden><span class="ic">${ic}</span><b>${t(l)}</b><small>${t(sub)}</small></label>`
      : `<button class="qbig" data-fmt="${k}"><span class="ic">${ic}</span><b>${t(l)}</b><small>${t(sub)}</small></button>`).join('')}</div>
    <a class="vg-banner" href="#/rapido?f=story&th=mix&vg=1" style="margin-top:12px"><span class="vg-tag">✦ ${t('Novo')}</span><b>${t('Vanguarda')}</b><small>${t('Estilos que param o scroll: revista, aura, conversa, neo-brutal e mais')}</small><i>→</i></a>
    <div class="qgroup" style="margin-top:16px">${t('Mais formatos')}</div>
    <div class="chips" id="fmts2"><button class="chip ic" data-fmt="status">${I.chat}${t('Status do WhatsApp')}</button><button class="chip ic" data-fmt="square">${I.square}${t('Quadrado 1:1')}</button><button class="chip ic" data-fmt="feed" data-th="ladoalado">${I.scale}${t('Lado a lado')}</button></div>
    <h2 class="h-section" style="font-size:20px">${t('Outras formas de criar')}</h2>
    <a class="list-item" href="#/biblioteca"><span class="thumb">${I.grid}</span><span class="grow"><b>${t('Artes prontas')}</b><span class="xs muted">${t('Centenas de modelos com a sua marca')}</span></span></a>
    <a class="list-item" href="#/agenda"><span class="thumb">${I.calendar}</span><span class="grow"><b>${t('Semana temática')}</b><span class="xs muted">${t('Uma semana inteira de posts de uma vez')}</span></span></a>
    <a class="list-item" href="#/textos"><span class="thumb">${I.sparkle}</span><span class="grow"><b>Frankie</b><span class="xs muted">${t('Textos, legendas e minhas reflexões')}</span></span></a>
    <a class="list-item" href="#/criar"><span class="thumb">${I.pages}</span><span class="grow"><b>${t('Meus projetos e editor completo')}</b><span class="xs muted">${t('Continuar uma arte, documentos')}</span></span></a>`;
  view.onclick = (e) => { const b = e.target.closest('[data-fmt]'); if (b) go(b.dataset.th ? { f: b.dataset.fmt, th: b.dataset.th } : { f: b.dataset.fmt }); };
  // Da minha foto: 1) toca aqui 2) escolhe a foto 3) toca na arte
  $('#myph', view).onchange = (e) => startFromPhoto(e.target.files?.[0]);
  $('#tour', view).onclick = () => import('./tour.js').then((m) => m.startTour('criar'));
}

function themes(view, fk) {
  const hasMine = PHRASES.some((p) => p.custom);
  view.innerHTML = `
    <div class="eyebrow">${t(QFORMATS[fk].label)} · ${t('passo')} 2 ${t('de')} 3</div>
    <h1 class="h-title" style="margin:4px 0 6px">${t('Sobre o que é?')}</h1>
    <div class="card" style="margin:12px 0 10px">
      <label class="field"><span>💡 ${t('Digite um tema e eu crio frases e textos')}</span><input class="input" id="tema" maxlength="60" placeholder="${t('Ex.: ansiedade, luto, Natal, maternidade')}" enterkeyhint="go"></label>
      <div class="chips" id="temasug" style="margin-top:8px">${['ansiedade', 'luto', 'recomeço', 'gratidão', 'maternidade', 'autoestima', 'perdão', 'Natal'].map((x) => `<button class="chip" data-tema="${x}">${x}</button>`).join('')}</div>
      <button class="btn block" id="gotema" style="margin-top:8px">${I.sparkle}${t('Criar frases sobre este tema')}</button>
    </div>
    <div class="card" style="margin:0 0 4px">
      <label class="field"><span>✍️ ${t('Escreva sua frase')}</span><textarea class="input" id="own" rows="2" placeholder="${t('Ex.: Recomeçar também é um ato de fé.')}"></textarea></label>
      <button class="btn block" id="gotxt" style="margin-top:8px">${I.wand}${t('Criar com minha frase')}</button>
    </div>
    ${GROUPS.map(([g, items]) => `<div class="qgroup">${t(g)}</div>${items.filter(([id]) => id !== 'minhas' || hasMine).map(([id, l, d, ic, bg]) => `
      <button class="qtheme" data-th="${id}"><span class="ic" style="background:${bg}">${ic}</span><span><b>${t(l)}</b><small>${t(d)}</small></span><span class="go">›</span></button>`).join('')}`).join('')}`;
  view.onclick = (e) => {
    const sg = e.target.closest('[data-tema]'); if (sg) return go({ f: fk, tema: sg.dataset.tema });
    const b = e.target.closest('[data-th]'); if (b) go({ f: fk, th: b.dataset.th });
  };
  const goTema = () => { const v = $('#tema', view).value.trim(); if (!v) return toast(t('Digite um tema.')); go({ f: fk, tema: v.slice(0, 60) }); };
  $('#gotema', view).onclick = goTema;
  $('#tema', view).onkeydown = (e) => { if (e.key === 'Enter') goTema(); };
  $('#gotxt', view).onclick = () => { const v = $('#own', view).value.trim(); if (!v) return toast(t('Escreva sua frase.')); go({ f: fk, txt: v.slice(0, 280) }); };
}

async function arts(view, fk, th, txt, tema, own = false, vg = false) {
  await ensureFonts();
  const F = QFORMATS[fk]; const fmt = F.render;
  const st = { colors: sessionStorage.getItem('sk-colors') || 'todas', photo: sessionStorage.getItem('sk-photo') || null, shift: +(sessionStorage.getItem('sk-shift-' + (th || tema || 'txt')) || 0) };
  const N = vg ? 12 : fk === 'carousel' ? 4 : fmt === 'portrait' ? 6 : 9;
  const palsOf = () => COLOR_GROUPS[st.colors]?.keys || PALS;
  const themeLabel = th ? GROUPS.flatMap(([, it]) => it).find(([id]) => id === th)?.[1] : null;
  const comp = tema ? composeFromTheme(tema) : th && th !== 'minhas' && themeLabel ? composeFromTheme(themeLabel, { cat: th }) : null;
  st.ctype = sessionStorage.getItem('sk-ctype') || 'frases';
  st.style = sessionStorage.getItem('sk-style') || '';
  const specs = () => {
    const ks = palsOf();
    const pal = (i, k = 5) => ks[(st.shift * k + i * 3) % ks.length];
    if (th === 'ladoalado') {
      const light = ks.filter((k) => /^#(F|E)/i.test(PALETTES[k]?.bg?.c1 || '')); const lp = light.length ? light : ks;
      return Array.from({ length: Math.min(N, COMPARES.length) }, (_, i) => {
        const c = COMPARES[(st.shift * N + i) % COMPARES.length];
        return { layout: 'comparativo', phrase: { id: c.id, cat: 'psicoeducacao', generated: true, text: c.title, compare: c }, palette: lp[(st.shift + i) % lp.length],
          format: fmt === 'square' ? 'portrait' : fmt, caption: compareCaption(c, signature()) };
      });
    }
    if (fk === 'carousel') {
      const cap = comp && tema ? comp.caption : undefined;
      if (st.ctype === 'dicas' || st.ctype === 'perguntas') {
        const lists = st.ctype === 'perguntas' ? [comp?.questions || composeFromTheme(txt || 'a vida').questions]
          : [...PHRASES.filter((p) => p.items && (th ? p.cat === th : tema ? false : true)), comp?.list || composeFromTheme(txt || 'o dia a dia').list];
        return Array.from({ length: N }, (_, i) => {
          const p = lists[(st.shift + i) % lists.length];
          return { layout: 'carrossel', ...(p.generated ? { phrase: p } : { phraseId: p.id }), palette: pal(i, 3), format: 'portrait', caption: cap };
        });
      }
      const inner = ['minimal', 'aspas', 'cartao', 'moldura'];
      const pool = comp?.phrases?.length ? comp.phrases : PHRASES.filter((p) => (th ? p.cat === th || (th === 'minhas' && p.custom) : true) && !p.items);
      return Array.from({ length: N }, (_, i) => {
        const ps = Array.from({ length: 5 }, (_, j) => pool[(st.shift * 5 + i * 2 + j) % Math.max(1, pool.length)]).filter(Boolean);
        const uniq = ps.filter((p, k) => ps.findIndex((x) => x.id === p.id) === k);
        return { layout: 'carrossel-tema', cat: comp?.cat || th || 'reflexoes', ...(comp ? { phrases: uniq } : { phraseIds: uniq.map((p) => p.id) }), inner: inner[(st.shift + i) % inner.length],
          palette: pal(i, 3), format: 'portrait', title: txt || (tema ? comp.theme : undefined), caption: cap };
      });
    }
    const modern = st.photo && st.photo === sessionStorage.getItem('sk-paisagem');
    const lays = vg ? VANGUARDA : modern ? MODERN_LAY : own && st.photo ? OWN_LAY : st.photo ? PHOTO_LAY : LAY[fmt];
    let list;
    if (txt) list = Array.from({ length: N }, () => ({ id: 'custom', cat: 'minhas', text: txt }));
    else if (tema) list = Array.from({ length: N }, (_, i) => comp.phrases[(st.shift * N + i) % comp.phrases.length]);
    else { const all = PHRASES.filter((p) => (th === 'minhas' ? p.custom : th === 'mix' ? MIX.includes(p.cat) || p.custom : p.cat === th) && (fmt !== 'story' || !p.items) && (th !== 'mix' || !p.items)); list = Array.from({ length: N }, (_, i) => all[(st.shift * N + i) % all.length]); }
    return list.filter(Boolean).map((p, i) => ({
      ...(p.id === 'custom' || p.generated ? { phrase: p } : { phraseId: p.id }),
      layout: vg ? lays[(st.shift * 5 + i) % lays.length] : p.items && st.photo ? 'fotolista' : p.items ? (i % 2 ? 'cartaolista' : 'lista') : lays[(st.shift * 3 + i) % lays.length],
      palette: pal(i), format: fmt, caption: tema ? comp.caption : undefined,
    }));
  };
  const mine = (await db.all('assets')).slice(0, 12);
  const label = txt ? t('Sua frase') : tema ? comp.theme : th === 'mix' ? t('Minha foto') : t(themeLabel || '');
  const modeChips = (key) => `<div class="chips" id="ownfmt">${[['story', I.story + 'Story'], ['feed', I.feed + 'Feed'], ['status', I.chat + 'Status'], ['square', I.square + t('Quadrado')]].map(([k, l]) => `<button class="chip ic" data-ownf="${k}" aria-pressed="${fk === k}">${l}</button>`).join('')}</div>
    <div class="chips" id="ownth" style="margin-top:6px">${[['mix', I.sparkle + t('Variado')], ['espiritualidade', I.cross + t('Fé')], ['logoterapia', I.compass + t('Sentido')], ['emocional', I.leaf + t('Cuidado')], ['relacoes', I.users + t('Relações')], ...(PHRASES.some((p) => p.custom) ? [['minhas', I.feather + t('Minhas')]] : [])].map(([k, l]) => `<button class="chip ic" data-ownt="${k}" aria-pressed="${th === k}">${l}</button>`).join('')}</div>`;
  const vgBlock = vg ? `<section class="vg-hero"><div><span class="vg-tag">✦ ${t('Vanguarda')}</span><h1>${t('Estilos que param o scroll')}</h1><p>${t('12 formatos ousados, sempre com a sua marca.')}</p></div><span class="vg-num">12</span></section>
    <div class="vg-write">
      <label for="vgtxt"><b>${t('Escreva o que quiser')}</b><small>${t('Seu texto entra nos 12 modelos. Depois é só escolher a arte.')}</small></label>
      <textarea id="vgtxt" class="input" rows="3" maxlength="280" placeholder="${t('Ex.: Você não precisa ter todas as respostas hoje.')}">${esc(txt || '')}</textarea>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn grow" id="vggo">${I.sparkle}${t('Ver nas artes')}</button>${txt ? `<button class="btn ghost" id="vgclear">${t('Limpar')}</button>` : ''}</div>
    </div>
    ${txt ? modeChips().split('<div class="chips" id="ownth"')[0] : modeChips()}` : '';
  const ownBlock = own ? `<div class="own-head">
      <img data-asset="${st.photo || ''}" alt="" class="own-ph">
      <div class="grow"><b>${t('Sua foto já está nas artes')}</b><small>${t('Escolha o formato e o assunto, ou toque numa arte para postar.')}</small>
        <label class="btn sm secondary" style="margin-top:8px">${I.image}${t('Trocar foto')}<input type="file" accept="image/*" id="ownswap" hidden></label></div></div>
    ${modeChips()}` : '';
  view.innerHTML = `
    ${vg ? vgBlock : `<div class="eyebrow">${own ? `${t('Da minha foto')} · ${t(F.label)}` : `${t(F.label)} · ${esc(label)} · ${t('passo')} 3 ${t('de')} 3`}</div>
    <h1 class="h-title" style="margin:4px 0 2px">${t('Escolha uma arte')}</h1>
    <p class="small muted" style="margin:0 0 10px">${t('Toque na arte para ver grande e postar.')}</p>`}
    ${fk === 'carousel' ? '' : `<div class="qgroup" style="margin-top:10px">✦ ${t('Estilos')}</div><div class="styles" id="styles"><button data-style="" aria-pressed="${!st.style}"><canvas></canvas><span>${t('Original')}</span></button>${STYLES.map((x) => `<button data-style="${x.id}" aria-pressed="${st.style === x.id}"><canvas></canvas><span>${t(x.label)}</span></button>`).join('')}</div>`}
    ${fk === 'carousel' ? `<div class="qgroup" style="margin-top:6px">🗂️ ${t('Tipo de carrossel')}</div>
    <div class="chips" id="ctype">${[['frases', I.quote + t('Frases do tema')], ['dicas', I.list + t('Dicas passo a passo')], ['perguntas', I.help + t('Perguntas para refletir')]].map(([k, l]) => `<button class="chip ic" data-ctype="${k}" aria-pressed="${st.ctype === k}">${l}</button>`).join('')}</div>` : ''}
    ${tema ? `<details class="fold" style="margin:8px 0"><summary>✨ ${t('Texto pronto sobre')} ${esc(comp.theme)}</summary><div><div class="result small">${esc(comp.caption)}</div><button class="btn sm ghost" id="copytema" style="margin-top:8px">${I.copy}${t('Copiar texto')}</button></div></details>` : ''}
    ${ownBlock}
    ${fk === 'carousel' || own || vg ? '' : `<div class="qgroup" style="margin-top:6px">🏞️ ${t('Paisagens reais · posts modernos')}</div>
    <div class="qphotos" id="land"><span class="xs muted" style="align-self:center">${t('Carregando paisagens...')}</span></div>`}
    ${fk === 'carousel' || own ? '' : `<div class="qgroup" style="margin-top:6px">📷 ${t('Foto (opcional)')}</div>
    <div class="qphotos" id="ph">
      <button data-ph="" aria-pressed="${!st.photo}">${t('Sem foto')}</button>
      <button data-add aria-label="${t('Do celular')}">${I.plus}</button>
      ${mine.map((a) => `<button data-ph="${a.id}" aria-pressed="${st.photo === a.id}"><img data-asset="${a.id}" alt=""></button>`).join('')}
      ${STUDIO.map((id) => `<button data-sp="${id}" aria-pressed="${st.photo === 'studio-photo-' + id}"><img loading="lazy" src="./assets/photos/${id}.jpg" alt=""></button>`).join('')}
      <span id="month" class="qphotos-inline"></span>
    </div>`}
    <div class="qgroup">🎨 ${t('Cores')}</div>
    <div class="chips" id="cols">${Object.entries(COLOR_GROUPS).filter(([k]) => k !== 'classicas').map(([k, g]) => {
      const sw = g.keys.slice(0, 3).map((pk) => PALETTES[pk].bg).map((b) => `<i style="width:12px;height:12px;border-radius:50%;background:${b.type === 'solid' ? b.c1 : `linear-gradient(${b.c1},${b.c2})`};border:1px solid #0002;margin-right:-4px"></i>`).join('');
      return `<button class="chip" data-col="${k}" aria-pressed="${st.colors === k}">${k === 'todas' ? '' : `<span style="display:inline-flex;margin-right:6px">${sw}</span>`}${t(g.label)}</button>`; }).join('')}</div>
    <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px" id="g"></div>
    <button class="btn block secondary" id="more" style="margin-top:14px">${I.plus}${t('Carregar mais artes')}</button>
    <p class="xs muted" style="text-align:center;margin:6px 0 0">${t('Role até o fim para carregar mais sozinho.')}</p>`;
  for (const im of $$('img[data-asset]', view)) assetImage(im.dataset.asset).then((x) => { if (x) im.src = x.src; });
  // Aplica uma foto da Wikimedia (paisagem ou foto do mês) na arte
  const usePhoto = async (p, modern) => {
    toast(modern ? t('Baixando paisagem...') : t('Baixando imagem...'));
    try {
      const a = await saveImageBlob(await (await fetch(p.full)).blob(), { name: p.title, source: 'wikimedia', license: p.license, author: p.author, url: p.page });
      sessionStorage.setItem('sk-photo', a.id); modern ? sessionStorage.setItem('sk-paisagem', a.id) : sessionStorage.removeItem('sk-paisagem');
      toast((modern ? t('Paisagem aplicada · {l}', { l: p.license || 'licença livre' }) : t('Foto do mês aplicada · {l}', { l: p.license || 'licença livre' })));
      arts(view, fk, th, txt, tema, own, vg);
    } catch { toast(t('Não foi possível baixar esta imagem.')); }
  };
  // Galeria grande para escolher com calma
  const bigPicker = (list, modern) => {
    const s = sheet(`<h3 style="margin:0 0 4px">${modern ? t('Paisagens reais') : t('Fotos do mês')}</h3><p class="xs muted" style="margin:0 0 12px">${t('Toque na foto para usar na arte.')}</p>
      <div class="big-photos">${list.map((p, i) => `<button data-bi="${i}"><img loading="lazy" src="${esc(p.thumb.replace(/\/\d+px-/, '/500px-'))}" data-full="${esc(p.full)}" alt="${esc(p.title)}"><span>${esc(p.title.replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 48))}</span></button>`).join('')}</div>`, { label: t('Escolher foto') });
    fixThumbs(s.el);
    s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-bi]'); if (b) { s.close(); usePhoto(list[+b.dataset.bi], modern); } });
  };
  const strip = (sel, list, modern, max) => {
    const m = $(sel, view); if (!m) return;
    if (!list.length) { if (modern) m.innerHTML = `<span class="xs muted">${t('Sem internet: as paisagens aparecem quando voltar a conexão.')}</span>`; return; }
    m.innerHTML = list.slice(0, max).map((p, i) => `<button data-pi="${i}" title="${esc(p.title)} · ${esc(p.license)}"><img loading="lazy" src="${esc(p.thumb)}" data-full="${esc(p.full)}" alt="${esc(p.title)}"></button>`).join('')
      + `<button data-bigall class="see-all">${I.grid}<span>${t('Ver maiores')}</span></button>`;
    fixThumbs(m);
    m.onclick = (e) => {
      e.stopPropagation();
      if (e.target.closest('[data-bigall]')) return bigPicker(list, modern);
      const b = e.target.closest('[data-pi]'); if (b) usePhoto(list[+b.dataset.pi], modern);
    };
  };
  if (fk !== 'carousel' && !own && !vg) landscapePhotos().then((list) => strip('#land', list, true, 16)).catch(() => {});
  if (fk !== 'carousel' && !own) monthPhotos().then((list) => strip('#month', list, false, 10)).catch(() => {});
  const grid = $('#g', view);
  // Grade com "Carregar mais": acrescenta artes no fim, sem apagar as que já estão na tela
  let items = []; const base0 = st.shift; let loads = 0;
  const drawObs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return; drawObs.unobserve(en.target); const i = +en.target.closest('[data-i]').dataset.i;
    drawThumb(en.target, pagesOf(items[i], st.photo)[0], items[i].format, 420);
  }), { rootMargin: '300px' }) : null;
  const addBatch = (list) => {
    const start = items.length; items = items.concat(list.map((sp) => (st.style ? { ...sp, style: st.style } : sp)));
    grid.insertAdjacentHTML('beforeend', list.map((_, k) => `<button class="art" data-i="${start + k}" aria-label="${t('Arte')} ${start + k + 1}">${fk === 'carousel' ? `<span class="pill">${t('Carrossel')}</span>` : ''}<canvas></canvas></button>`).join(''));
    $$('canvas', grid).slice(start).forEach((c, k) => (drawObs ? drawObs.observe(c) : drawThumb(c, pagesOf(items[start + k], st.photo)[0], items[start + k].format, 420)));
  };
  const paintGrid = () => {
    items = []; loads = 0; st.shift = base0; grid.innerHTML = '';
    addBatch(specs());
    grid.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) postArt(items[+b.dataset.i], { photo: st.photo, wa: !!F.wa }); };
  };
  const loadMore = () => {
    st.shift++; loads++; const next = specs();
    // evita repetir exatamente a mesma arte na tela
    const seen = new Set(items.map((x) => `${x.phraseId || x.phrase?.text}|${x.layout}|${x.palette}`));
    addBatch(next.filter((x) => !seen.has(`${x.phraseId || x.phrase?.text}|${x.layout}|${x.palette}`)));
    st.shift = base0 + loads; sessionStorage.setItem('sk-shift-' + (th || tema || 'txt'), base0);
  };
  paintGrid();
  // carrega mais sozinho ao chegar no fim (até 12 vezes; depois é pelo botão)
  const moreBtn = $('#more', view);
  if (moreBtn && 'IntersectionObserver' in window) new IntersectionObserver((es) => { if (es[0].isIntersecting && loads < 12 && moreBtn.isConnected) loadMore(); }, { rootMargin: '200px' }).observe(moreBtn);
  if (vg && txt) setTimeout(() => $('#styles', view)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  const sbox = $('#styles', view);
  if (sbox) {
    const base = specs()[0];
    if (base) for (const b of $$('[data-style]', sbox)) { const sp = b.dataset.style ? { ...base, style: b.dataset.style } : base; drawThumb($('canvas', b), pagesOf(sp, st.photo)[0], sp.format, 160); }
  }
  if (own) {
    const sw = $('#ownswap', view);
    if (sw) sw.onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const a = await saveImageBlob(f, { name: f.name || 'minha-foto', source: 'celular' }); sessionStorage.setItem('sk-photo', a.id); arts(view, fk, th, txt, tema, true, vg); } catch (err) { toast(err.message); } };
  }
  view.onclick = async (e) => {
    const mode = vg ? { vg: '1', ...(txt ? { txt } : {}) } : { foto: '1' };
    if (e.target.closest('#vggo')) { const v = $('#vgtxt', view).value.trim(); if (!v) return toast(t('Escreva uma frase.')); return go({ f: fk, th, vg: '1', txt: v.slice(0, 280) }); }
    if (e.target.closest('#vgclear')) return go({ f: fk, th, vg: '1' });
    const of = e.target.closest('[data-ownf]'); if (of) return go({ f: of.dataset.ownf, th, ...mode });
    const ot = e.target.closest('[data-ownt]'); if (ot) return go({ f: fk, th: ot.dataset.ownt, ...mode });
    const sb = e.target.closest('[data-style]');
    if (sb) { st.style = sb.dataset.style; sessionStorage.setItem('sk-style', st.style); $$('#styles [data-style]', view).forEach((x) => x.setAttribute('aria-pressed', x === sb)); return paintGrid(); }
    if (e.target.closest('#copytema')) { copyText(comp.caption); return toast(t('Texto copiado.')); }
    const ct = e.target.closest('[data-ctype]'); if (ct) { st.ctype = ct.dataset.ctype; sessionStorage.setItem('sk-ctype', st.ctype); $$('#ctype .chip', view).forEach((x) => x.setAttribute('aria-pressed', x === ct)); return paintGrid(); }
    if (e.target.closest('#more')) return loadMore();
    const col = e.target.closest('[data-col]'); if (col) { st.colors = col.dataset.col; sessionStorage.setItem('sk-colors', st.colors); $$('#cols .chip', view).forEach((x) => x.setAttribute('aria-pressed', x === col)); return paintGrid(); }
    const ph = e.target.closest('[data-ph]'); if (ph) { st.photo = ph.dataset.ph || null; st.photo ? sessionStorage.setItem('sk-photo', st.photo) : sessionStorage.removeItem('sk-photo'); $$('#ph button', view).forEach((x) => x.setAttribute('aria-pressed', x === ph)); return paintGrid(); }
    const sp = e.target.closest('[data-sp]');
    if (sp) {
      const id = 'studio-photo-' + sp.dataset.sp;
      try {
        if (!(await db.get('assets', id))) await saveImageBlob(await (await fetch('./assets/photos/' + sp.dataset.sp + '.jpg')).blob(), { id, name: sp.dataset.sp, source: 'studio' });
        sessionStorage.setItem('sk-photo', id); return arts(view, fk, th, txt, tema, own, vg);
      } catch { return toast(t('Não foi possível baixar esta imagem.')); }
    }
    if (e.target.closest('[data-add]')) { const a = await chooseImage({ title: t('Sua foto') }); if (a) { sessionStorage.setItem('sk-photo', a.id); arts(view, fk, th, txt, tema, own, vg); } }
  };
}

// Miniatura que falhar (rede, tamanho recusado) troca pela foto grande; se falhar de novo, some
function fixThumbs(root) {
  for (const im of root.querySelectorAll('img[data-full]')) im.addEventListener('error', () => { if (im.dataset.full && im.src !== im.dataset.full) { im.src = im.dataset.full; im.dataset.full = ''; } else im.closest('button')?.remove(); });
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
  const caption = spec.caption ? `${spec.caption}\n\n${signature()}`
    : spec.layout === 'carrossel-tema' ? (spec.phrases || (spec.phraseIds || []).map(phraseById)).map((p, i) => `${i + 1}. ${p?.text || ''}`).join('\n') + `\n\n${signature()}` : captionFor(ph, { signature: signature() });
  const cap = wa ? caption.replace(/\n\n#[\s\S]*$/, '') : caption;
  const where = wa ? t('Postar no Status do WhatsApp') : t('Postar no Instagram');
  const s = sheet(`<div style="display:grid;place-items:center"><canvas id="big" class="tap-zoom" style="max-height:58vh;width:auto;border-radius:12px;box-shadow:0 10px 30px #0003"></canvas><span class="xs muted" style="margin-top:6px">🔍 ${t('Toque na arte para ver em tela cheia')}</span></div>
    ${pages.length > 1 ? `<p class="xs muted" style="text-align:center;margin:6px 0 0">${pages.length} ${t('páginas no carrossel')}</p>` : ''}
    <button class="btn block" id="ig" style="margin-top:14px;min-height:56px;font-size:17px" disabled><span class="spinner" style="width:18px;height:18px;border-width:2px"></span>${t('Preparando...')}</button>
    <p class="xs muted" style="text-align:center;margin:6px 0 10px">${wa ? t('No WhatsApp, escolha "Meu status".') : t('A legenda é copiada: no Instagram, é só colar.')}</p>
    <div class="grid c2"><button class="btn secondary" id="dl">${I.download}${t('Baixar')}</button><button class="btn secondary" id="edit">${I.wand}${t('Ajustar')}</button></div>
    <details class="fold" style="margin-top:12px"><summary>${t('Ver legenda')}</summary><div><div class="result small">${esc(cap)}</div><button class="btn sm ghost" id="cap" style="margin-top:8px">${I.copy}${t('Copiar legenda')}</button></div></details>`, { label: t('Postar') });
  await drawThumb($('#big', s.el), pages[0], spec.format, 720);
  $('#big', s.el).onclick = () => zoomPages(pages, spec.format);
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
