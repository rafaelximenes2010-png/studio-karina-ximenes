// Assistente de textos. A IA roda em backend seguro (Cloudflare Worker) — nenhuma chave fica no navegador.
import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, uid, fmtDate } from '../lib/util.js';
import { CATEGORIES } from '../lib/content.js';
import { I, $, $$, sheet, toast, copyText, confirmDialog, refresh, signature } from '../ui.js';
import { openSpec } from './shared.js';
import { loadCustomPhrases } from '../app.js';
import { PALETTES, layoutsFor } from '../lib/templates.js';
import { isoDate } from '../lib/util.js';

/** Coloca a reflexão na próxima publicação automática ainda não editada (a partir de amanhã) */
async function scheduleReflection(rec) {
  const tomorrow = isoDate(new Date(Date.now() + 864e5));
  const next = (await db.all('posts')).filter((p) => p.auto && p.status === 'ideia' && !p.projectId && p.date >= tomorrow && p.format !== 'story' && p.format !== 'carousel').sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const lays = layoutsFor({}); const pal = Object.keys(PALETTES);
  next.art = { phraseId: rec.id, layout: lays[next.date.charCodeAt(9) % lays.length], palette: pal[next.date.charCodeAt(8) % pal.length], format: next.art?.format === 'square' ? 'square' : 'portrait' };
  next.title = rec.text.slice(0, 70); next.category = CATEGORIES.find((c) => c.id === rec.cat)?.label;
  const { captionFor, phraseById } = await import('../lib/content.js');
  next.caption = captionFor(phraseById(rec.id), { signature: signature() });
  next.history = [...(next.history || []), { at: Date.now(), status: 'ideia', note: 'Reflexão da Karina inserida' }];
  await db.put('posts', next);
  return next.date;
}

export const TASKS = {
  reflexao: { label: 'Reflexão original', hint: 'Tema ou ideia central' },
  revisao: { label: 'Revisar texto', hint: 'Cole o texto para revisão' },
  resumo: { label: 'Resumir', hint: 'Cole o texto a resumir' },
  titulos: { label: 'Títulos e ganchos', hint: 'Tema do post' },
  legenda: { label: 'Legenda para post', hint: 'Tema ou texto da arte' },
  adaptar: { label: 'Adaptar para rede', hint: 'Cole o texto a adaptar' },
  roteiro: { label: 'Roteiro de vídeo/Reels', hint: 'Tema do vídeo' },
  calendario: { label: 'Ideias de calendário', hint: 'Tema ou campanha do mês' },
  publico: { label: 'Ajustar ao público', hint: 'Cole o texto e informe o público' },
  traducao: { label: 'Traduzir PT/EN/ES', hint: 'Cole o texto' },
};
export const TONES = { acolhedor: 'Acolhedor', cientifico: 'Científico', reflexivo: 'Reflexivo', institucional: 'Institucional', educativo: 'Educativo' };

/** Chamada ao backend seguro */
export async function callAI(payload) {
  const { aiEndpoint, aiCode } = prefs.get();
  if (!aiEndpoint) throw new Error('no-endpoint');
  const r = await fetch(aiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Access-Code': aiCode || '' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.text;
}

// Modo assistido (sem IA): estruturas e fórmulas determinísticas, claramente sinalizadas
function assisted({ task, text, tone, network }) {
  const base = text.trim() || t('seu tema');
  const tags = CATEGORIES.find((c) => base.toLowerCase().includes(c.label.toLowerCase().split(' ')[0]))?.tags || '#psicologia #saúdemental #autocuidado';
  const len = { Instagram: 2200, LinkedIn: 3000, Facebook: 5000, TikTok: 2200, WhatsApp: 1000 }[network] || 2200;
  switch (task) {
    case 'titulos': return [`O que ninguém te contou sobre ${base}`, `${base}: 3 pontos para refletir`, `Você já pensou em ${base} desta forma?`, `${base} não é fraqueza — é um sinal`, `Um convite a olhar para ${base} com mais gentileza`, `Mitos e verdades sobre ${base}`].map((x, i) => `${i + 1}. ${x}`).join('\n');
    case 'legenda': return `[GANCHO — uma frase que gere identificação sobre ${base}]\n\n[CONTEXTO — 2 a 3 frases explicando, com linguagem ${TONES[tone].toLowerCase()}]\n\n[REFLEXÃO OU DICA PRÁTICA]\n\n[CONVITE] Salve este post e compartilhe com quem precisa ler isso hoje.\n\n${signature()}\n\n${tags}\n\nLimite da rede (${network}): ${len} caracteres.`;
    case 'roteiro': return `ROTEIRO (30–60s) — ${base}\n\n0–3s  Gancho: pergunta direta ao público.\n3–15s  Contexto: por que o tema importa.\n15–40s  2 ou 3 pontos principais (um por corte).\n40–55s  Fechamento acolhedor.\n55–60s  Chamada: "Salve e compartilhe" + assinatura.\n\nTexto na tela: frases curtas, fonte da marca, legenda automática ativada.`;
    case 'calendario': return ['Seg — Reflexão (post vertical)', 'Ter — Psicoeducação (carrossel)', 'Qua — Story com pergunta', 'Qui — Neurociência/EMDR (post)', 'Sex — Divulgação profissional', 'Sáb — Frase curta (story)'].map((x) => `${x}: ${base}`).join('\n') + '\n\nDica: use "Semana temática" na Agenda para gerar as artes automaticamente.';
    case 'adaptar': return `${base.slice(0, len)}\n\n— Caracteres: ${base.length}/${len} (${network})${base.length > len ? '\n⚠️ Texto acima do limite: reduza.' : ''}`;
    default: return null;
  }
}

export async function render(view) {
  const pr = prefs.get(); const hasAI = !!pr.aiEndpoint;
  const texts = await db.all('texts');
  const mine = await db.all('phrases');
  let task = 'reflexao'; let tone = 'acolhedor';
  view.innerHTML = `
    <div class="frank-head" style="margin-bottom:12px"><span class="av">${I.sparkle}</span><div><div class="eyebrow">${t('Assistente de conteúdo')}</div><h1 class="h-title" style="margin-top:2px">Frankie</h1><p class="small muted" style="margin:2px 0 0">${t('Seu mini estúdio de textos: reflexões, legendas, títulos, roteiros e traduções.')}</p></div></div>
    ${hasAI ? `<p class="notice ai small">${t('IA conectada ao backend seguro. Todo conteúdo gerado deve ser revisado por você antes de publicar.')}</p>`
      : `<p class="notice small">${t('IA ainda não conectada. Você pode usar o modo assistido (estruturas e fórmulas, sem IA) ou conectar o backend seguro em Perfil → Ajustes.')} <a href="#/perfil/ajustes">${t('Configurar')}</a></p>`}
    <div class="card stack" style="margin-top:12px">
      <label class="field"><span>${t('Tarefa')}</span><div class="chips" id="tasks">${Object.entries(TASKS).map(([k, v]) => `<button class="chip" data-task="${k}" aria-pressed="${k === task}">${t(v.label)}</button>`).join('')}</div></label>
      <label class="field"><span>${t('Tom')}</span><div class="chips" id="tones">${Object.entries(TONES).map(([k, v]) => `<button class="chip" data-tone="${k}" aria-pressed="${k === tone}">${t(v)}</button>`).join('')}</div></label>
      <label class="field"><span id="hint">${t(TASKS[task].hint)}</span><textarea class="input" id="in" rows="5"></textarea></label>
      <div class="grid c2"><label class="field"><span>${t('Rede / canal')}</span><select class="input" id="net">${['Instagram', 'LinkedIn', 'Facebook', 'TikTok', 'WhatsApp', 'Blog'].map((x) => `<option>${x}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Público')}</span><input class="input" id="aud" placeholder="${t('Ex.: adultos, pais, profissionais')}"></label></div>
      <label class="field" id="langf" hidden><span>${t('Traduzir para')}</span><select class="input" id="lang"><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option></select></label>
      <button class="btn block" id="go">${I.sparkle}${hasAI ? t('Frankie, gerar com IA') : t('Frankie, gerar (modo assistido)')}</button>
    </div>
    <div id="out"></div>
    <h2 class="h-section">${t('Minhas reflexões')} <span class="badge">${mine.length}</span></h2>
    <div class="card stack">
      <p class="small muted" style="margin:0">${t('Escreva o que você está refletindo. O Studio transforma em arte com a sua marca e coloca na próxima publicação programada.')}</p>
      <textarea class="input" id="mytx" rows="3" placeholder="${t('Sua reflexão (até ~280 caracteres funciona melhor na arte)')}"></textarea>
      <div class="grid c2"><label class="field"><span>${t('Eixo')}</span><select class="input" id="mycat">${CATEGORIES.filter((c) => !['datas', 'divulgacao', 'psicoeducacao'].includes(c.id)).map((c) => `<option value="${c.id}">${t(c.label)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('Crédito (opcional)')}</span><input class="input" id="mycr" placeholder="${t('Ex.: cf. Salmo 46 · inspirado em Frankl')}"></label></div>
      <button class="btn" id="mysave">${I.plus}${t('Salvar e programar')}</button>
    </div>
    <div id="mylist" style="margin-top:10px">${mine.map((m) => `<div class="list-item" data-my="${m.id}"><span class="thumb">${I.sparkle}</span><span class="grow"><b style="white-space:normal">${esc(m.text)}</b><span class="xs muted">${t(CATEGORIES.find((c) => c.id === m.cat)?.label || '')}${m.credit ? ' · ' + esc(m.credit) : ''}${m.active === false ? ' · ' + t('pausada') : ''}</span></span><button class="icon-btn" data-myart="${m.id}" aria-label="${t('Ver arte')}">${I.image}</button><button class="icon-btn" data-mytoggle="${m.id}" aria-label="${t('Pausar/ativar')}">${m.active === false ? I.eyeoff : I.eye}</button><button class="icon-btn" data-mydel="${m.id}" aria-label="${t('Excluir')}">${I.trash}</button></div>`).join('')}</div>

    <h2 class="h-section">${t('Meus textos')} <span class="badge">${texts.length}</span></h2>
    <div id="saved">${texts.map((x) => `<div class="list-item" data-txt="${x.id}"><span class="thumb">${x.ai ? I.sparkle : I.text}</span><span class="grow"><b>${esc(x.title)}</b><span class="xs muted">${t(TASKS[x.task]?.label || '')} · ${fmtDate(x.updatedAt, locale())}${x.ai ? ' · ' + t('gerado por IA, revisado') : ''}</span></span></div>`).join('') || `<div class="empty small">${t('Textos salvos aparecerão aqui.')}</div>`}</div>`;

  $('#tasks', view).onclick = (e) => { const b = e.target.closest('[data-task]'); if (!b) return; task = b.dataset.task; $$('#tasks .chip', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#hint', view).textContent = t(TASKS[task].hint); $('#langf', view).hidden = task !== 'traducao'; };
  $('#tones', view).onclick = (e) => { const b = e.target.closest('[data-tone]'); if (!b) return; tone = b.dataset.tone; $$('#tones .chip', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  $('#go', view).onclick = async () => {
    const payload = { task, tone, text: $('#in', view).value.trim(), network: $('#net', view).value, audience: $('#aud', view).value.trim(), lang: $('#lang', view).value, uiLang: locale() };
    if (!payload.text) return toast(t('Conte ao Frankie o tema ou cole o texto.'));
    const out = $('#out', view); out.innerHTML = `<div class="card" style="margin-top:12px"><span class="spinner"></span> ${t('Frankie está escrevendo...')}</div>`;
    let text; let ai = false;
    try {
      if (hasAI) { text = await callAI(payload); ai = true; }
      else { text = assisted(payload); if (!text) { out.innerHTML = `<div class="card" style="margin-top:12px">${t('Esta tarefa precisa da IA conectada. No modo assistido estão disponíveis: Títulos, Legenda, Roteiro, Calendário e Adaptar.')}</div>`; return; } }
    } catch (e) { out.innerHTML = `<div class="card" style="margin-top:12px">${e.message === 'no-endpoint' ? t('IA não configurada.') : t('Falha ao gerar: {e}', { e: esc(e.message) })}</div>`; return; }
    out.innerHTML = `<div class="card" style="margin-top:12px">
      <p class="notice ${ai ? 'ai' : ''} small" style="margin:0 0 10px">${ai ? t('🤖 Conteúdo gerado por IA. Verifique fatos, tom e ética. Referências citadas pela IA NÃO são confiáveis: confirme na Biblioteca científica.') : t('Modo assistido: estrutura gerada por fórmulas (sem IA).')}</p>
      <textarea class="input" id="res" rows="10">${esc(text)}</textarea>
      <label class="toggle"><span class="small">${t('Revisei o conteúdo e assumo a responsabilidade profissional por ele.')}</span><input type="checkbox" id="ok"></label>
      <div class="row"><button class="btn sm" data-u="copy" disabled>${I.copy}${t('Copiar')}</button><button class="btn sm secondary" data-u="save" disabled>${t('Salvar')}</button><button class="btn sm secondary" data-u="art" disabled>${I.image}${t('Criar arte')}</button><button class="btn sm secondary" data-u="mine" disabled>${I.sparkle}${t('Salvar como minha reflexão')}</button></div></div>`;
    const ok = $('#ok', out); ok.onchange = () => $$('[data-u]', out).forEach((b) => (b.disabled = !ok.checked));
    out.onclick = async (e) => {
      const u = e.target.closest('[data-u]')?.dataset.u; if (!u) return; const val = $('#res', out).value;
      if (u === 'copy') copyText(val);
      if (u === 'save') { await db.put('texts', { id: uid('t'), title: val.split('\n')[0].slice(0, 60), task, tone, ai, reviewed: true, text: val }); toast(t('Texto salvo')); refresh(); }
      if (u === 'mine') { const rec = { id: uid('minha-'), text: val.split(/\n\n/)[0].slice(0, 300), cat: 'minhas', credit: '', active: true, ai }; await db.put('phrases', rec); await loadCustomPhrases(); const d = await scheduleReflection(rec); toast(d ? t('Reflexão salva e programada para {d}', { d: fmtDate(d, locale(), { weekday: 'long', day: '2-digit', month: 'long' }) }) : t('Reflexão salva. Ela entra nas próximas programações.'), 4000); }
      if (u === 'art') { const short = val.split(/\n\n/)[0].slice(0, 260); openSpec({ phrase: { id: 'custom', cat: 'reflexoes', text: short }, layout: 'minimal', palette: 'creme', format: 'portrait' }); }
    };
  };
  $('#mysave', view).onclick = async () => {
    const text = $('#mytx', view).value.trim(); if (!text) return toast(t('Escreva sua reflexão.'));
    const rec = { id: uid('minha-'), text, cat: $('#mycat', view).value, credit: $('#mycr', view).value.trim(), active: true };
    await db.put('phrases', rec); await loadCustomPhrases();
    const slot = await scheduleReflection(rec);
    toast(slot ? t('Reflexão salva e programada para {d}', { d: fmtDate(slot, locale(), { weekday: 'long', day: '2-digit', month: 'long' }) }) : t('Reflexão salva. Ela entra nas próximas programações.'), 4000); refresh();
  };
  $('#mylist', view).onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.myart) { const { preview } = await import('./library.js'); preview({ phraseId: b.dataset.myart, layout: 'minimal', palette: 'creme', format: 'portrait' }); }
    if (b.dataset.mytoggle) { const m = mine.find((x) => x.id === b.dataset.mytoggle); m.active = m.active === false; await db.put('phrases', m); await loadCustomPhrases(); refresh(); }
    if (b.dataset.mydel && await confirmDialog(t('Excluir esta reflexão? Artes já criadas continuam salvas.'), { ok: t('Excluir'), danger: true })) { await db.del('phrases', b.dataset.mydel); await loadCustomPhrases(); refresh(); }
  };
  $('#saved', view).onclick = async (e) => {
    const r = e.target.closest('[data-txt]'); if (!r) return; const x = texts.find((y) => y.id === r.dataset.txt);
    const s = sheet(`<h3>${esc(x.title)}</h3>${x.ai ? `<p class="xs muted">${t('Gerado com IA e revisado pela profissional.')}</p>` : ''}<textarea class="input" id="tx" rows="12" style="margin:10px 0">${esc(x.text)}</textarea><div class="row"><button class="btn" id="sv">${t('Salvar')}</button><button class="btn secondary" id="cp">${I.copy}${t('Copiar')}</button><button class="btn danger" id="dl">${I.trash}</button></div>`);
    $('#sv', s.el).onclick = async () => { x.text = $('#tx', s.el).value; await db.put('texts', x); s.close(); toast(t('Texto salvo')); };
    $('#cp', s.el).onclick = () => copyText($('#tx', s.el).value);
    $('#dl', s.el).onclick = async () => { if (await confirmDialog(t('Excluir este texto?'), { ok: t('Excluir'), danger: true })) { await db.del('texts', x.id); s.close(); refresh(); } };
  };
}
