// Mídia: fotos do aparelho, biblioteca pessoal, banco Wikimedia Commons (com licença), colar/arrastar.
import { t } from '../lib/i18n.js';
import { db } from '../lib/store.js';
import { uid, esc } from '../lib/util.js';
import { I, sheet, toast, $, $$, assetImage } from '../ui.js';

/** Otimiza e salva uma imagem como ativo local. Retorna o registro {id,w,h,...} */
export async function saveImageBlob(blob, meta = {}) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error(t('Arquivo de imagem inválido'))); im.src = url; });
    let w = img.naturalWidth; let h = img.naturalHeight; let out = blob;
    const max = 2400;
    if (Math.max(w, h) > max || blob.size > 2.5e6) {
      const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const png = blob.type === 'image/png' && blob.size < 4e6;
      out = await new Promise((ok) => c.toBlob(ok, png ? 'image/png' : 'image/jpeg', 0.9));
    }
    const rec = { id: meta.id || uid('a'), blob: out, w, h, type: out.type, name: meta.name || 'imagem', source: meta.source || 'device', license: meta.license || '', author: meta.author || '', url: meta.url || '' };
    await db.put('assets', rec);
    return rec;
  } finally { URL.revokeObjectURL(url); }
}

export function pickFiles({ multiple = false } = {}) {
  return new Promise((ok) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = multiple;
    inp.onchange = () => ok([...(inp.files || [])]);
    inp.click();
  });
}

/** Busca no Wikimedia Commons (imagens com licença livre; atribuição registrada) */
// Palavras que nunca combinam com posts de cuidado emocional (guerra, desastres, anúncios, veículos...)
export const BLOCKED = /\b(war|wars|guerra|battle|batalha|military|militar|army|exército|soldiers?|weapons?|arma|armas|bomb\w*|explos\w*|fire|fires|incêndio|burning|ships?|navio|ferry|ferries|boats?|barco|catamaran|warship|tanks?|aircraft|airplane|avião|trains?|trem|bus|ônibus|cars?|carro|trucks?|accident\w*|acidente|disaster\w*|desastre|flood\w*|enchente|ruins?|death|morte|dead|graves?|cemetery|cemitério|funeral|protest\w*|protesto|riots?|police|polícia|prison|blood|sangue|hunting|caça|advert\w*|logo|poster|maps?|mapa|diagram|chart|flags?|bandeira|nude|naked|crowd|multidão|selfie)\b/i;

/** Busca no Wikimedia Commons. curated: só fotos premiadas/de qualidade, sem temas pesados. */
export async function searchCommons(q, limit = 24, { curated = false } = {}) {
  const run = async (query) => {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(query) +
      `&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=1600&format=json&origin=*`;
    const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
    return Object.values(j.query?.pages || {}).filter((p) => p.imageinfo?.[0]?.thumburl).map((p) => {
      const ii = p.imageinfo[0]; const md = ii.extmetadata || {};
      return { title: p.title.replace(/^File:/, ''), thumb: ii.thumburl, page: ii.descriptionurl, license: strip(md.LicenseShortName?.value), author: strip(md.Artist?.value).slice(0, 80),
        w: ii.width, h: ii.height, cats: strip(md.Categories?.value), desc: strip(md.ImageDescription?.value).slice(0, 300) };
    });
  };
  if (!curated) return run(q + ' filetype:bitmap');
  const clean = (list) => list.filter((p) => !BLOCKED.test(`${p.title} ${p.cats} ${p.desc}`));
  let list = clean(await run(`${q} filetype:bitmap incategory:"Featured_pictures_on_Wikimedia_Commons|Quality_images"`));
  if (list.length < 3) list = [...list, ...clean(await run(q + ' filetype:bitmap'))];
  return list;
}

/**
 * Seletor de imagem profissional (aparelho · minha mídia · banco livre).
 * Resolve com o registro do ativo salvo ou null.
 */
const STUDIO_PHOTOS = [
  ['eucalipto', 'Folhas de eucalipto'], ['mar', 'Mar ao amanhecer'], ['caderno', 'Caderno à janela'],
  ['trilha', 'Trilha na mata'], ['cha', 'Chá da tarde'], ['montanhas', 'Montanhas ao sol'],
];

export function chooseImage({ title = t('Adicionar imagem'), initialTab = 'dev' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); s.close(); } };
    const s = sheet(`<div class="row between" style="margin-bottom:10px"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="${t('Fechar')}">${I.close}</button></div>
      <div class="tabs" role="tablist"><button role="tab" data-t="studio">${t('Coleção Studio')}</button><button role="tab" aria-selected="true" data-t="dev">${t('Aparelho')}</button><button role="tab" aria-selected="false" data-t="mine">${t('Minha mídia')}</button><button role="tab" aria-selected="false" data-t="bank">${t('Banco livre')}</button></div>
      <div id="pane"></div>`, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    const pane = $('#pane', s.el);
    const tabs = {
      async studio() {
        pane.innerHTML = `<p class="small muted">${t('Imagens criadas com IA para suas artes.')}</p><div class="grid photo-collection">${STUDIO_PHOTOS.map(([id, label]) =>
          `<button class="art" data-studio="${id}"><img src="./assets/photos/${id}.jpg" alt=""><span>${t(label)}</span></button>`).join('')}</div>`;
        pane.onclick = async (e) => {
          const button = e.target.closest('[data-studio]');
          if (!button || button.disabled) return;
          const [id, label] = STUDIO_PHOTOS.find(([key]) => key === button.dataset.studio);
          button.disabled = true;
          try {
            const assetId = 'studio-photo-' + id;
            let asset = await db.get('assets', assetId);
            if (!asset) {
              const r = await fetch('./assets/photos/' + id + '.jpg');
              if (!r.ok) throw new Error();
              asset = await saveImageBlob(await r.blob(), { id: assetId, name: t(label), source: 'studio' });
            }
            if (button.isConnected) finish(asset);
          } catch { toast(t('Não foi possível baixar esta imagem.')); }
          finally { button.disabled = false; }
        };
      },
      async dev() {
        pane.innerHTML = `<div class="stack"><button class="btn block" id="pick">${I.image}${t('Escolher da galeria ou câmera')}</button>
          <button class="btn secondary block" id="paste">${I.copy}${t('Colar imagem copiada')}</button>
          <p class="xs muted">${t('Dica: no computador, você também pode arrastar uma foto para a arte ou colar com Ctrl+V.')}</p></div>`;
        $('#pick', pane).onclick = async () => { const [f] = await pickFiles(); if (f) { toast(t('Otimizando imagem...')); finish(await saveImageBlob(f, { name: f.name })); } };
        $('#paste', pane).onclick = async () => {
          try {
            const items = await navigator.clipboard.read();
            for (const it of items) { const type = it.types.find((x) => x.startsWith('image/')); if (type) { finish(await saveImageBlob(await it.getType(type), { name: 'colada' })); return; } }
            toast(t('Nenhuma imagem na área de transferência'));
          } catch { toast(t('Seu navegador não permitiu colar. Use Ctrl+V na arte.')); }
        };
      },
      async mine() {
        const list = (await db.all('assets'));
        if (!pane.isConnected || !s.el.querySelector('[data-t=mine]').matches('[aria-selected=true]')) return;
        if (!list.length) { pane.innerHTML = `<div class="empty small">${t('Sua mídia aparecerá aqui depois que você adicionar fotos.')}</div>`; return; }
        pane.innerHTML = `<div class="grid" style="grid-template-columns:repeat(3,1fr)">${list.map((a) => `<button class="art" data-a="${a.id}" style="aspect-ratio:1"><img data-src="${a.id}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover"></button>`).join('')}</div>`;
        for (const im of $$('img[data-src]', pane)) assetImage(im.dataset.src).then((x) => { if (x) im.src = x.src; });
        pane.onclick = async (e) => { const b = e.target.closest('[data-a]'); if (b) finish(await db.get('assets', b.dataset.a)); };
      },
      async bank() {
        pane.innerHTML = `<form class="row nowrap" id="f"><input class="input grow" id="q" type="search" placeholder="${t('Ex.: natureza, flores, mar, pessoas')}" enterkeyhint="search"><button class="btn">${I.search}</button></form>
          <div class="chips" style="margin-top:8px">${['natureza', 'flores', 'folhas', 'mar', 'pôr do sol', 'montanhas', 'café', 'livros', 'mãos', 'caminho'].map((x) => `<button class="chip" data-q="${x}">${x}</button>`).join('')}</div>
          <p class="xs muted">${t('Imagens do Wikimedia Commons com licença livre. Autor e licença ficam registrados; confira antes de publicar.')}</p><div id="r" class="grid" style="grid-template-columns:repeat(3,1fr)"></div>`;
        const r = $('#r', pane);
        const run = async (q) => {
          r.innerHTML = '<div class="spinner"></div>';
          try {
            const res = await searchCommons(q);
            r.innerHTML = res.length ? res.map((x, i) => `<button class="art" data-i="${i}" style="aspect-ratio:1" title="${esc(x.license)} · ${esc(x.author)}"><img loading="lazy" src="${esc(x.thumb)}" alt="${esc(x.title)}" style="width:100%;height:100%;object-fit:cover"></button>`).join('') : `<p class="muted">${t('Nada encontrado.')}</p>`;
            r.onclick = async (e) => {
              const b = e.target.closest('[data-i]'); if (!b) return;
              const x = res[+b.dataset.i]; toast(t('Baixando imagem...'));
              try { const blob = await (await fetch(x.thumb)).blob(); finish(await saveImageBlob(blob, { name: x.title, source: 'wikimedia', license: x.license, author: x.author, url: x.page })); toast(t('Licença: {l} · Autor: {a}', { l: x.license || '?', a: x.author || '?' }), 5000); }
              catch { toast(t('Não foi possível baixar esta imagem.')); }
            };
          } catch { r.innerHTML = `<p class="muted">${t('Sem conexão com o banco de imagens agora.')}</p>`; }
        };
        $('#f', pane).onsubmit = (e) => { e.preventDefault(); const q = $('#q', pane).value.trim(); if (q) run(q); };
        pane.querySelector('.chips').onclick = (e) => { const c = e.target.closest('[data-q]'); if (c) { $('#q', pane).value = c.dataset.q; run(c.dataset.q); } };
      },
    };
    const showTab = (key) => {
      $$('.tabs button', s.el).forEach((button) => button.setAttribute('aria-selected', button.dataset.t === key));
      pane.onclick = null;
      tabs[key]();
    };
    s.el.querySelector('.tabs').onclick = (e) => {
      const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t);
    };
    showTab(initialTab);
  });
}
