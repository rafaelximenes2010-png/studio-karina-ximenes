// Assistente de textos. A IA roda em backend seguro (Cloudflare Worker) — nenhuma chave fica no navegador.
import { t, locale } from '../lib/i18n.js';
import { db, prefs } from '../lib/store.js';
import { esc, uid, fmtDate } from '../lib/util.js';
import { CATEGORIES } from '../lib/content.js';
import { composeFromTheme } from '../lib/compose.js';
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
  livre: { label: 'Pedido livre (converse com o Frankie)', hint: 'Peça o que quiser: ideias, textos, séries de posts, revisão…' },
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
/** Endereço do backend: o digitado em Ajustes ou o publicado automaticamente (frankie.json) */
export async function aiEndpoint() {
  const p = prefs.get(); if (p.aiEndpoint) return p.aiEndpoint;
  try { const r = await fetch('./frankie.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (/^https:\/\//.test(j.endpoint || '')) return j.endpoint; } } catch { /* offline */ }
  return '';
}
export async function callAI(payload) {
  const { aiCode } = prefs.get(); const endpoint = await aiEndpoint();
  if (!endpoint) throw new Error('no-endpoint');
  if (!aiCode) throw new Error(t('Informe o código de acesso do Frankie em Perfil → Ajustes.'));
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Access-Code': aiCode || '' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.text;
}

// Modo assistido (sem IA): estruturas e fórmulas determinísticas, claramente sinalizadas
function assisted({ task, text, tone, network, audience, lang }) {
  const raw = text.trim();
  const base = raw || t('seu tema');
  const isLong = raw.length > 80 || /[.!?]\s/.test(raw);
  const c = composeFromTheme(isLong ? (raw.split(/[.!?\n]/)[0].slice(0, 40) || 'reflexão') : base);
  const tags = c.caption.split('\n\n').pop();
  const len = { Instagram: 2200, LinkedIn: 3000, Facebook: 5000, TikTok: 2200, WhatsApp: 1000 }[network] || 2200;
  const pick = (arr, n, off = 0) => Array.from({ length: Math.min(n, arr.length) }, (_, i) => arr[(i + off) % arr.length]);
  const ph = c.phrases.map((p) => p.text);
  const sentences = raw.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const fixText = (s0) => {
    const changes = [];
    let s0b = s0.replace(/\bvc\b/gi, 'você').replace(/\bvcs\b/gi, 'vocês').replace(/\btb\b/gi, 'também').replace(/\btbm\b/gi, 'também').replace(/\bpq\b/gi, 'porque').replace(/\bq\b/gi, 'que').replace(/\bmto\b/gi, 'muito').replace(/\bhj\b/gi, 'hoje').replace(/\bn\b/gi, 'não'); if (s0b !== s0) changes.push('abreviações escritas por extenso');
    let s1 = s0b.replace(/[ \t]{2,}/g, ' '); if (s1 !== s0b) changes.push('espaços duplos removidos');
    let s2 = s1.replace(/\s+([,.;:!?])/g, '$1'); if (s2 !== s1) changes.push('espaço antes de pontuação corrigido');
    let s3 = s2.replace(/([,;:])(?=[^\s\d])/g, '$1 ').replace(/([.!?])(?=[A-Za-zÀ-ú])/g, '$1 '); if (s3 !== s2) changes.push('espaço após pontuação');
    let s4 = s3.trim().replace(/(^|[.!?]\s+|\n)([a-zà-ú])/g, (m, p1, l) => p1 + l.toUpperCase()); if (s4 !== s3) changes.push('maiúscula no início das frases');
    const s5 = s4;
    let s6 = /[.!?…]$/.test(s5.trim()) ? s5.trim() : s5.trim() + '.'; if (s6 !== s5.trim()) changes.push('ponto final');
    return { out: s6, changes };
  };
  const toneLine = { acolhedor: c.bright ? 'Que hoje você se permita ir com mais calma.' : 'Você não está sozinho nisso.', cientifico: 'A psicologia oferece caminhos com base em evidências para lidar com isso.', reflexivo: 'Que pergunta a vida está fazendo a você hoje?', institucional: 'Atendimento psicológico com ética, sigilo e cuidado.', educativo: 'Entender o que acontece é o primeiro passo para cuidar.' }[tone] || '';
  switch (task) {
    case 'livre':
    case 'reflexao': {
      const r = [ph[0], ph[3], ph[6], toneLine].filter(Boolean).join(' ');
      if (task === 'reflexao') return `${r}\n\n${signature()}`;
      return `✨ ${t('Ideias do Frankie sobre')} "${c.theme}"\n\n📝 ${t('Reflexão')}:\n${r}\n\n💬 ${t('Frases para artes')}:\n${pick(ph, 6, 1).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n🗂️ ${t('Carrossel')}: ${c.questions.title}\n${c.questions.items.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n📋 ${t('Lista de cuidados')}: ${c.list.title}\n${c.list.items.map((x) => `• ${x}`).join('\n')}\n\n📱 ${t('Legenda pronta')}:\n${c.caption}`;
    }
    case 'titulos': return [c.bright ? `O que ${c.g.o} pode ensinar sobre a vida` : `O que ninguém te contou sobre ${c.g.o}`, `${c.theme}: 3 pontos para refletir`, `Você já pensou ${c.g.no} desta forma?`, ph[1], `Um convite a olhar para ${c.g.o} com mais gentileza`, c.bright ? `${c.theme} e saúde emocional: o que a psicologia diz` : `Mitos e verdades sobre ${c.g.o}`, c.questions.title, c.list.title].map((x, i) => `${i + 1}. ${x}`).join('\n');
    case 'legenda': return `${ph[0]}\n\n${c.text}${toneLine ? ' ' + toneLine : ''}\n\n${signature()}\n\n${tags}`.slice(0, len);
    case 'roteiro': return `ROTEIRO (30–60s) — ${c.theme}\n\n0–3s  ${t('Gancho')}: "${ph[2]}"\n3–15s  ${t('Contexto')}: ${ph[0]}\n15–40s  ${t('Três pontos')} (${t('um por corte')}):\n  • ${c.list.items[0]}\n  • ${c.list.items[1]}\n  • ${c.list.items[2]}\n40–55s  ${t('Fechamento')}: "${ph[5]}"\n55–60s  ${t('Chamada')}: "Salve e compartilhe com quem precisa." + ${signature()}\n\n${t('Texto na tela: frases curtas, fonte da marca, legenda automática ativada.')}`;
    case 'calendario': {
      const d = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const kinds = ['Post vertical', 'Carrossel', 'Story com pergunta', 'Post quadrado', 'Lista de dicas', 'Story curto'];
      const items = [ph[0], c.questions.title, c.questions.items[1], ph[4], c.list.title, ph[7]];
      return d.map((x, i) => `${x} — ${kinds[i]}: ${items[i]}`).join('\n') + `\n\n${t('Dica: use "Semana temática" na Agenda para gerar as artes automaticamente.')}`;
    }
    case 'adaptar': {
      if (!isLong) return assisted({ task: 'legenda', text, tone, network });
      const cut = base.length > len ? base.slice(0, len - 1).replace(/\s+\S*$/, '') + '…' : base;
      const extra = network === 'WhatsApp' ? cut.replace(/#[^\s#]+/g, '').trim() : network === 'LinkedIn' ? cut.replace(/(#[^\s#]+\s*){4,}$/, '').trim() + '\n\n#psicologia #saudemental' : cut;
      return `${extra}\n\n— ${base.length}/${len} ${t('caracteres')} (${network})`;
    }
    case 'revisao': { if (!raw) return null; const { out, changes } = fixText(raw); return `${out}\n\n— ${t('Alterações')}: ${changes.length ? changes.join('; ') : t('nenhuma correção automática necessária. Para revisão de estilo, conecte o Frankie (IA).')}`; }
    case 'resumo': {
      if (!raw) return null;
      const ss = fixText(raw).out.split(/(?<=[.!?…])\s+/);
      const top = ss.length <= 2 ? ss : [ss[0], ...ss.slice(1).map((x, i) => [x, i]).sort((a, b) => b[0].length - a[0].length).slice(0, Math.min(3, Math.ceil(ss.length / 2))).sort((a, b) => a[1] - b[1]).map((x) => x[0])];
      return `${top.join(' ')}\n\n— ${t('Resumo em {n} frases', { n: top.length })}`;
    }
    case 'publico': {
 const who = (audience || '').trim();
      const open = !who ? '' : /pais|mães|família/i.test(who) ? 'Para mães, pais e famílias:' : /adolesc|jovem/i.test(who) ? 'Para você que é jovem:' : /casal|casais/i.test(who) ? 'Para casais:' : /igreja|cristã|fé/i.test(who) ? 'Para quem caminha na fé:' : `Para ${who}:`;
      return `${open ? open + '\n\n' : ''}${fixText(raw || ph[0]).out}\n\n${toneLine}`;
    }
    default: return null;
  }
}

export async function render(view) {
  const endpoint = await aiEndpoint();
  const hasAI = !!(endpoint && prefs.get().aiCode);
  const texts = await db.all('texts');
  const mine = await db.all('phrases');
  let task = 'reflexao'; let tone = 'acolhedor';
  view.innerHTML = `
    <div class="frank-head" style="margin-bottom:12px"><span class="av">${I.sparkle}</span><div><div class="eyebrow">${t('Assistente de conteúdo')}</div><h1 class="h-title" style="margin-top:2px">Frankie</h1><p class="small muted" style="margin:2px 0 0">${t('Seu mini estúdio de textos: reflexões, legendas, títulos, roteiros e traduções.')}</p></div></div>
    ${endpoint && !hasAI ? `<div class="card" style="margin-bottom:12px"><b>✨ ${t('Ligar a IA do Frankie')}</b><p class="xs muted" style="margin:4px 0 8px">${t('Digite o código de acesso uma vez neste aparelho.')}</p><div class="row" style="gap:8px"><input class="input grow" id="aicode" type="password" autocomplete="off" placeholder="${t('Código de acesso')}"><button class="btn" id="aisave">${t('Ligar')}</button></div></div>` : ''}
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
  const sv = $('#aisave', view);
  if (sv) sv.onclick = () => { const v = $('#aicode', view).value.trim(); if (!v) return toast(t('Digite o código de acesso.')); prefs.set({ aiCode: v }); toast(t('Frankie com IA ligado!')); render(view); };
  $('#go', view).onclick = async () => {
    const payload = { task, tone, text: $('#in', view).value.trim(), network: $('#net', view).value, audience: $('#aud', view).value.trim(), lang: $('#lang', view).value, uiLang: locale() };
    if (!payload.text) return toast(t('Conte ao Frankie o tema ou cole o texto.'));
    const out = $('#out', view); out.innerHTML = `<div class="card" style="margin-top:12px"><span class="spinner"></span> ${t('Frankie está escrevendo...')}</div>`;
    let text; let ai = false;
    try {
      if (hasAI) {
        try { text = await callAI(payload); ai = true; }
        catch (e) { text = assisted(payload); if (!text) throw e; toast(t('IA indisponível agora ({e}). Usei o modo assistido.', { e: e.message }), 5000); }
      } else { text = assisted(payload); if (!text) { out.innerHTML = `<div class="card" style="margin-top:12px">${payload.task === 'traducao' ? t('A tradução precisa do Frankie (IA) conectado.') : t('Escreva o texto no campo acima para o Frankie trabalhar.')}</div>`; return; } }
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
