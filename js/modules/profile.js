import { t, LANGS, setLang, locale } from '../lib/i18n.js';
import { db, prefs, exportAll, importAll, wipeAll, STORES } from '../lib/store.js';
import { esc, fmtDate } from '../lib/util.js';
import { BRAND } from '../lib/render.js';
import { allArts, OFFICIAL, PALETTES } from '../lib/templates.js';
import { PHRASES } from '../lib/content.js';
import { I, $, $$, sheet, toast, confirmDialog, copyText, downloadBlob, refresh, logoSrc, getLogo } from '../ui.js';
import { applyTheme, paintChrome, VERSION } from '../app.js';
import { setPin, clearPin } from './lock.js';

const APP_URL = 'https://rafaelximenes2010-png.github.io/studio-karina-ximenes/';
const INSTALL_URL = APP_URL + 'instalar.html';

export async function render(view, { id }) {
  const page = id || '';
  const pages = { '': hub, ajustes: settings, marca: brand, instalar: install, privacidade: privacy, admin, tutorial: () => { showTutorial(); hub(view); } };
  return (pages[page] || hub)(view);
}

function hub(view) {
  const p = prefs.get();
  view.innerHTML = `
    <div class="card" style="display:flex;gap:14px;align-items:center"><img src="${logoSrc}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px var(--gold)"><div><h1 class="h-title" style="font-size:26px">Karina Ximenes</h1><div class="eyebrow">${t('Psicóloga')}</div><p class="xs muted" style="margin:4px 0 0">Pessoas • Histórias • Recomeços</p></div></div>
    <div style="margin-top:14px">
      ${[['ajustes', I.settings, t('Ajustes'), t('Idioma, tema, assinatura, Frankie (IA) e PIN de acesso')],
    ['marca', I.palette, t('Identidade visual'), t('Logomarca oficial, paleta, fontes e ícones')],
    ['instalar', I.install, t('Instalar e compartilhar'), t('iPhone, Android, Mac e Windows')],
    ['privacidade', I.shield, t('Privacidade, segurança e ética'), t('LGPD, CFP, backup e exclusão de dados')],
    ['tutorial', I.help, t('Tutorial'), t('Conheça o Studio em 1 minuto')],
    ['admin', I.grid, t('Administração'), t('Armazenamento, versão, diagnóstico')]].map(([k, ic, a, b]) => `<a class="list-item" href="#/perfil/${k}"><span class="thumb">${ic}</span><span class="grow"><b>${a}</b><span class="xs muted">${b}</span></span></a>`).join('')}
    </div>
    <p class="xs muted" style="text-align:center;margin-top:24px">KXS · Studio Karina Ximenes · v${VERSION}${p.pinHash ? ' · ' + t('acesso protegido por PIN') : ''}</p>`;
}

function settings(view) {
  const p = prefs.get();
  view.innerHTML = `<h1 class="h-title" style="margin-bottom:14px">${t('Ajustes')}</h1>
    <div class="card stack">
      <label class="field"><span>${t('Como devo chamar você?')}</span><input class="input" id="nm" value="${esc(p.name)}"></label>
      <label class="field"><span>${t('Assinatura nas artes')}</span><input class="input" id="sg" value="${esc(p.signature)}"><span class="xs muted">${t('Formato: Nome | Profissão. A logomarca oficial é sempre aplicada.')}</span></label>
      <label class="field"><span>${t('Idioma')}</span><select class="input" id="lg">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${p.lang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>${t('Aparência')}</span><div class="seg" id="th">${[['auto', t('Automático')], ['light', t('Claro')], ['dark', t('Escuro')]].map(([k, v]) => `<button data-th="${k}" aria-pressed="${p.theme === k}">${v}</button>`).join('')}</div></label>
    </div>
    <h2 class="h-section">${t('Dados profissionais')}</h2>
    <div class="card stack">
      <p class="small muted" style="margin:0">${t('Usados na Política de Privacidade e nos documentos. Ficam só neste aparelho.')}</p>
      <label class="field"><span>${t('Nome completo')}</span><input class="input" id="pfn" value="${esc(p.fullName || '')}" autocomplete="name"></label>
      <div class="grid c2"><label class="field"><span>CRP</span><input class="input" id="pcrp" value="${esc(p.crp || '')}" placeholder="00/00000"></label>
      <label class="field"><span>${t('Cidade/UF')}</span><input class="input" id="pcity" value="${esc(p.city || '')}"></label></div>
      <label class="field"><span>${t('E-mail para contato e privacidade')}</span><input class="input" id="pmail" type="email" value="${esc(p.email || '')}" autocomplete="email"></label>
    </div>
    <h2 class="h-section">Frankie · ${t('IA')}</h2>
    <div class="card stack">
      <p class="small muted" style="margin:0">${t('O Frankie usa IA por um backend seguro (Cloudflare Worker) onde fica a chave — nada sensível é guardado no app. Sem backend, ele funciona no modo assistido.')}</p>
      <p class="xs muted" style="margin:0">${t('Se o Frankie foi publicado pelo GitHub, o endereço é preenchido sozinho — basta o código de acesso.')}</p>
      <label class="field"><span>${t('Endereço do backend')}</span><input class="input" id="ae" placeholder="https://frankie.SEU-SUBDOMINIO.workers.dev" value="${esc(p.aiEndpoint)}" inputmode="url"></label>
      <label class="field"><span>${t('Código de acesso')}</span><input class="input" id="ac" type="password" value="${esc(p.aiCode)}" autocomplete="off"></label>
      <p class="xs muted" style="margin:0">${t('Guia de instalação do backend: arquivo worker/README.md no repositório.')}</p>
    </div>
    <h2 class="h-section">${t('Acesso protegido')}</h2>
    <div class="card stack">
      <p class="small muted" style="margin:0">${t('Peça um PIN ao abrir o Studio neste aparelho. O PIN é guardado apenas como código cifrado (PBKDF2).')}</p>
      ${p.pinHash ? `<div class="row"><span class="badge aprovado">${t('PIN ativo')}</span><button class="btn sm secondary" id="chpin">${t('Trocar PIN')}</button><button class="btn sm danger" id="rmpin">${t('Remover PIN')}</button></div>` : `<button class="btn sm" id="chpin">${I.lock}${t('Criar PIN')}</button>`}
    </div>
    <button class="btn block" id="sv" style="margin-top:16px">${t('Salvar ajustes')}</button>`;
  $('#th', view).onclick = (e) => { const b = e.target.closest('[data-th]'); if (!b) return; prefs.set({ theme: b.dataset.th }); applyTheme(b.dataset.th); $$('#th button', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  $('#sv', view).onclick = () => {
    const ae = $('#ae', view).value.trim();
    if (ae && !/^https:\/\//.test(ae)) return toast(t('O endereço do backend precisa começar com https://'));
    const email = $('#pmail', view).value.trim(); if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast(t('E-mail inválido'));
    const crp = $('#pcrp', view).value.trim(); if (crp && !/^\d{2}\/\d{3,6}$/.test(crp)) return toast(t('CRP no formato 00/00000'));
    prefs.set({ fullName: $('#pfn', view).value.trim(), crp, city: $('#pcity', view).value.trim(), email, name: $('#nm', view).value.trim() || 'Karina', signature: $('#sg', view).value.trim() || 'Karina Ximenes | Psicóloga', lang: $('#lg', view).value, aiEndpoint: ae, aiCode: $('#ac', view).value });
    setLang($('#lg', view).value); paintChrome(); toast(t('Ajustes salvos')); refresh();
  };
  $('#chpin', view).onclick = () => {
    const s = sheet(`<h3>${t('Definir PIN')}</h3><div class="stack" style="margin-top:10px"><input class="input" id="p1" type="password" inputmode="numeric" maxlength="8" placeholder="${t('4 a 8 dígitos')}" autocomplete="new-password"><input class="input" id="p2" type="password" inputmode="numeric" maxlength="8" placeholder="${t('Repita o PIN')}" autocomplete="new-password"><button class="btn block" id="ok">${t('Salvar PIN')}</button></div>`);
    $('#ok', s.el).onclick = async () => { const a = $('#p1', s.el).value; if (!/^\d{4,8}$/.test(a)) return toast(t('Use de 4 a 8 números.')); if (a !== $('#p2', s.el).value) return toast(t('Os PINs não conferem.')); await setPin(a); s.close(); toast(t('PIN ativado')); refresh(); };
  };
  $('#rmpin', view)?.addEventListener('click', async () => { if (await confirmDialog(t('Remover o PIN de acesso?'))) { clearPin(); toast(t('PIN removido')); refresh(); } });
}

async function brand(view) {
  const colors = [['Verde profundo', BRAND.green], ['Verde-sálvia', BRAND.sage], ['Creme', BRAND.cream], ['Dourado', BRAND.gold], ['Grafite', BRAND.graphite]];
  view.innerHTML = `<h1 class="h-title">${t('Identidade visual')}</h1><p class="muted small">${t('Karina Ximenes — Psicóloga. Estética elegante, acolhedora, contemporânea e minimalista.')}</p>
    <div class="card" style="text-align:center"><img src="${logoSrc}" alt="${t('Logomarca oficial')}" style="width:200px;max-width:60%;border-radius:16px"><p class="xs muted">${t('Arquivo original da proprietária — usado sem redesenho em ícones, abertura, cabeçalho, artes, PDFs e documentos.')}</p>
      <div class="row" style="justify-content:center"><button class="btn sm" id="dl">${I.download}${t('Baixar logomarca original')}</button></div></div>
    <h2 class="h-section">${t('Paleta oficial')}</h2>
    <div class="palette">${colors.map(([n, c]) => `<button data-hex="${c}"><i style="background:${c}"></i><span>${t(n)}<br>${c}</span></button>`).join('')}</div>
    <p class="xs muted">${t('Toque numa cor para copiar o código.')}</p>
    <h2 class="h-section">${t('Tipografia')}</h2>
    <div class="card"><p style="font-family:var(--serif);font-size:32px;margin:0">Cormorant Garamond</p><p class="small muted">${t('Títulos e frases — elegância editorial')}</p><p style="font-family:var(--sans);font-size:22px;margin:10px 0 0">Inter</p><p class="small muted">${t('Textos de apoio e interface — legibilidade')}</p></div>
    <h2 class="h-section">${t('Ícones do aplicativo')}</h2>
    <div class="card row" style="justify-content:space-around">${[['icon-180.png', 'iPhone 180'], ['icon-192.png', 'Android 192'], ['icon-maskable-512.png', 'Maskable 512'], ['favicon-48.png', 'Favicon']].map(([f, l]) => `<div style="text-align:center"><img src="./assets/brand/${f}?v=2.0.4" alt="${l}" style="width:64px;height:64px;border-radius:14px;box-shadow:var(--shadow-1)"><div class="xs muted">${l}</div></div>`).join('')}</div>
    <h2 class="h-section">${t('Paletas para artes')}</h2>
    <div class="chips">${Object.values(PALETTES).map((p) => `<span class="chip"><i style="width:14px;height:14px;border-radius:50%;background:${p.bg.type === 'solid' ? p.bg.c1 : `linear-gradient(${p.bg.c1},${p.bg.c2})`};border:1px solid #0002"></i>${t(p.name)}</span>`).join('')}</div>`;
  $('.palette', view).onclick = (e) => { const b = e.target.closest('[data-hex]'); if (b) copyText(b.dataset.hex); };
  $('#dl', view).onclick = async () => downloadBlob(await (await fetch(logoSrc)).blob(), 'logomarca-karina-ximenes-original.jpg');
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
function install(view) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  view.innerHTML = `<h1 class="h-title">${t('Instalar e compartilhar')}</h1>
    ${standalone ? `<p class="notice ai small">${t('Você já está usando o Studio como aplicativo instalado.')}</p>` : ''}
    ${deferredPrompt ? `<button class="btn block" id="inst" style="margin:12px 0">${I.install}${t('Instalar agora')}</button>` : ''}
    <details class="fold" open><summary>iPhone / iPad</summary><div><ol class="small"><li>${t('Abra o link no Safari.')}</li><li>${t('Toque em Compartilhar (quadrado com seta).')}</li><li>${t('Escolha "Adicionar à Tela de Início".')}</li><li>${t('Mantenha "Abrir como app web" ativado e toque em Adicionar.')}</li></ol><p class="xs muted">${t('Se um ícone antigo aparecer, remova o atalho e adicione novamente: o iOS guarda o ícone da primeira instalação.')}</p></div></details>
    <details class="fold"><summary>Android</summary><div><ol class="small"><li>${t('Abra no Chrome.')}</li><li>${t('Menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".')}</li></ol></div></details>
    <details class="fold"><summary>Mac / Windows</summary><div><p class="small">${t('No Chrome ou Edge, clique no ícone de instalação na barra de endereço. No Safari (macOS), use Arquivo → Adicionar ao Dock.')}</p></div></details>
    <h2 class="h-section">${t('Compartilhar o link')}</h2>
    <div class="card"><p class="small muted" style="margin-top:0">${t('Link de instalação (abre com a logomarca e o passo a passo para iPhone e Android):')}</p><p class="small" style="word-break:break-all"><b>${INSTALL_URL}</b></p>
      <a class="btn block" href="https://wa.me/?text=${encodeURIComponent('KXS · ' + t('Studio Karina Ximenes — instale o app no celular:').replace(/^KXS · /, '') + ' ' + INSTALL_URL)}" target="_blank" rel="noopener">${I.share}${t('Enviar pelo WhatsApp')}</a>
      <div class="row" style="margin-top:8px"><button class="btn sm secondary" id="cp">${I.copy}${t('Copiar link')}</button><button class="btn sm secondary" id="sh">${I.share}${t('Compartilhar')}</button></div>
    <p class="xs muted">${t('Os dados ficam em cada aparelho. Quem abrir o link terá um Studio vazio, sem acesso aos seus projetos.')}</p></div>`;
  $('#cp', view).onclick = () => copyText(INSTALL_URL);
  $('#sh', view).onclick = async () => { try { await navigator.share({ title: 'Studio Karina Ximenes', text: t('Instale o app no celular:'), url: INSTALL_URL }); } catch { copyText(INSTALL_URL); } };
  $('#inst', view)?.addEventListener('click', async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; refresh(); });
}

function privacy(view) {
  const pf = prefs.get();
  const F = (v, label) => (v ? esc(v) : `<a class="fill" href="#/perfil/ajustes">[${esc(t('preencher em Ajustes'))}: ${esc(label)}]</a>`);
  const missing = !pf.fullName || !pf.crp || !pf.email;
  view.innerHTML = `<h1 class="h-title">${t('Privacidade, segurança e ética')}</h1>
    ${missing ? `<p class="notice small">${t('Complete nome completo, CRP e e-mail em Perfil → Ajustes para finalizar a política.')} <a href="#/perfil/ajustes">${t('Ajustes')}</a></p>` : `<p class="notice ai small">${t('Política completa com seus dados profissionais. Recomendamos revisão jurídica antes de divulgação pública.')}</p>`}
    <div class="card" style="margin-top:12px"><h3 class="small">${t('Seus dados')}</h3><p class="small muted">${t('Tudo o que você cria fica salvo apenas neste aparelho (IndexedDB). Não há envio para servidores, exceto: buscas no Crossref, PubMed e Wikimedia (só o termo pesquisado) e textos enviados ao Frankie quando a IA estiver conectada.')}</p>
      <div class="row"><button class="btn sm" id="exp">${I.download}${t('Exportar backup')}</button><label class="btn sm secondary">${I.up}${t('Importar backup')}<input type="file" accept="application/json" id="imp" hidden></label><button class="btn sm danger" id="wipe">${I.trash}${t('Apagar todos os dados')}</button></div></div>
    <div class="legal card" style="margin-top:12px">
      <h3>${t('Política de Privacidade')}</h3>
      <p class="xs muted">Versão 1.0 — ${new Date().toLocaleDateString('pt-BR')}. Documento elaborado com base na LGPD (Lei 13.709/2018) e no Código de Ética Profissional do Psicólogo (Resolução CFP 010/2005); recomenda-se revisão por profissional do Direito.</p>
      <p><b>1. Quem somos.</b> O Studio Karina Ximenes é um aplicativo de uso profissional de ${F(pf.fullName, 'nome completo')}, psicóloga, ${pf.crp ? 'CRP ' + esc(pf.crp) : F('', 'CRP')}${pf.city ? ', ' + esc(pf.city) : ''}, que atua como <b>controladora</b> dos dados tratados no aplicativo. Contato para assuntos de privacidade (encarregada): ${F(pf.email, 'e-mail')}.</p>
      <p><b>2. Finalidade.</b> Criar, organizar e publicar conteúdos educativos, científicos e institucionais em Psicologia. O aplicativo <b>não</b> se destina ao registro de prontuários, atendimentos ou quaisquer dados de pacientes.</p>
      <p><b>3. Dados tratados.</b> (a) conteúdos criados pela usuária (artes, textos, documentos, agenda, referências); (b) imagens adicionadas pela usuária ou obtidas em bancos de licença livre; (c) preferências do aplicativo. Não coletamos dados de navegação, localização, contatos nem usamos cookies de rastreamento.</p>
      <p><b>4. Onde ficam.</b> Todos os dados ficam armazenados <b>apenas no aparelho</b> (IndexedDB/armazenamento local do navegador). Não há servidor do Studio que receba ou guarde esses dados.</p>
      <p><b>5. Compartilhamento.</b> Somente quando a usuária aciona: termos de busca enviados ao Crossref (EUA), à National Library of Medicine/PubMed (EUA) e à Wikimedia Foundation (EUA); textos enviados ao assistente Frankie, que trafegam pelo backend próprio na Cloudflare (rede global) até o provedor de IA Anthropic (EUA). Não há venda nem uso publicitário de dados.</p>
      <p><b>6. Bases legais.</b> Legítimo interesse da controladora na produção de conteúdo profissional (art. 7º, IX) e execução de suas atividades profissionais (art. 7º, V). Dados pessoais sensíveis (art. 11) não devem ser inseridos no aplicativo.</p>
      <p><b>7. Transferência internacional.</b> As buscas e o uso da IA envolvem fornecedores fora do Brasil, com base no art. 33 da LGPD (cláusulas e garantias contratuais dos fornecedores). Não envie ao Frankie nomes, histórias ou dados identificáveis de pacientes.</p>
      <p><b>8. Retenção e exclusão.</b> Os dados permanecem no aparelho até que a usuária os exclua. A qualquer momento é possível exportar (portabilidade) ou apagar todos os dados nesta tela.</p>
      <p><b>9. Direitos do titular (art. 18).</b> Confirmação, acesso, correção, portabilidade, eliminação e informação sobre compartilhamento — exercidos diretamente no aplicativo ou pelo e-mail acima.</p>
      <p><b>10. Segurança.</b> HTTPS, política de segurança de conteúdo (CSP), PIN opcional cifrado (PBKDF2), backend de IA com código de acesso, origem restrita e limite de uso; nenhuma chave secreta no aplicativo.</p>
      <h3>${t('Termos de uso')}</h3>
      <p>1. O aplicativo é de uso exclusivo de ${F(pf.fullName, 'nome completo')} e de pessoas por ela autorizadas. 2. O conteúdo produzido é de responsabilidade da profissional, que deve revisá-lo antes de publicar, inclusive o gerado com apoio de IA. 3. Imagens de bancos livres devem ter licença e autoria conferidas antes da publicação. 4. As frases e modelos do Studio são originais; referências bíblicas são indicadas por "cf." e citações de domínio público são identificadas. 5. Proibido inserir dados de pacientes ou usar o aplicativo para atendimento, diagnóstico ou promessa de resultado.</p>
      <h3>${t('Compromissos éticos (Código de Ética do CFP)')}</h3>
      <ul><li>Sem promessa de cura, garantia de resultados ou sensacionalismo na publicidade.</li><li>Sem diagnóstico ou atendimento pelas redes sociais.</li><li>Sigilo: nunca publicar dados ou relatos identificáveis de pacientes.</li><li>Conteúdo gerado por IA é sinalizado e sempre revisado por humana.</li><li>Referências científicas apenas de fontes verificáveis; nada é inventado.</li><li>Temas de risco com indicação de ajuda: CVV 188, Central da Mulher 180, SAMU 192.</li><li>Divulgação profissional com nome e número do CRP.</li></ul>
    </div>`;
  $('#exp', view).onclick = async () => { const data = await exportAll(); downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `backup-studio-karina-${new Date().toISOString().slice(0, 10)}.json`); toast(t('Backup exportado')); };
  $('#imp', view).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { await importAll(JSON.parse(await f.text())); toast(t('Backup importado')); refresh(); } catch (err) { toast(err.message); } };
  $('#wipe', view).onclick = async () => { if (await confirmDialog(t('Apagar TODOS os projetos, documentos, referências, agenda e mídia deste aparelho? Recomendamos exportar um backup antes.'), { ok: t('Apagar tudo'), danger: true })) { await wipeAll(); toast(t('Dados apagados')); setTimeout(() => location.reload(), 800); } };
}

async function admin(view) {
  const counts = {}; for (const s of STORES) counts[s] = (await db.all(s)).length;
  const est = (await navigator.storage?.estimate?.()) || {};
  const persisted = await navigator.storage?.persisted?.();
  const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
  view.innerHTML = `<h1 class="h-title">${t('Administração')}</h1>
    <div class="kpis" style="margin-top:12px"><div class="kpi"><b>${counts.projects}</b><span>${t('projetos')}</span></div><div class="kpi"><b>${counts.posts}</b><span>${t('publicações')}</span></div><div class="kpi"><b>${counts.refs}</b><span>${t('referências')}</span></div><div class="kpi"><b>${counts.docs}</b><span>${t('documentos')}</span></div><div class="kpi"><b>${counts.assets}</b><span>${t('fotos')}</span></div><div class="kpi"><b>${counts.texts}</b><span>${t('textos')}</span></div></div>
    <div class="card" style="margin-top:12px"><p class="small"><b>${t('Armazenamento')}:</b> ${est.usage ? mb(est.usage) : '—'} ${t('de')} ${est.quota ? mb(est.quota) : '—'} · ${persisted ? t('persistente') : t('pode ser limpo pelo sistema')}</p>
      ${persisted ? '' : `<button class="btn sm secondary" id="persist">${t('Pedir armazenamento persistente')}</button>`}
      <p class="small"><b>${t('Conteúdo')}:</b> ${PHRASES.length} ${t('frases originais')} · ${allArts().length} ${t('artes prontas')} · ${OFFICIAL.length} ${t('modelos oficiais')}</p>
      <p class="small"><b>${t('Versão')}:</b> ${VERSION}</p></div>
    <h2 class="h-section">${t('Diagnóstico')}</h2><div class="card" id="diag"><span class="spinner"></span></div>
    <button class="btn sm ghost" id="cache" style="margin-top:12px">${I.refresh}${t('Limpar cache e recarregar')}</button>`;
  $('#persist', view)?.addEventListener('click', async () => { const ok = await navigator.storage.persist(); toast(ok ? t('Armazenamento persistente concedido') : t('O navegador não concedeu agora')); refresh(); });
  $('#cache', view).onclick = async () => { for (const k of await caches.keys()) await caches.delete(k); for (const r of (await navigator.serviceWorker?.getRegistrations?.()) || []) await r.unregister(); location.reload(); };
  const checks = [];
  const ck = async (name, fn) => { try { const r = await fn(); checks.push([name, !!r, typeof r === 'string' ? r : '']); } catch (e) { checks.push([name, false, e.message]); } };
  await ck(t('Logomarca original carregada'), async () => { const im = await getLogo(); return im.naturalWidth >= 400 && `${im.naturalWidth}×${im.naturalHeight}`; });
  for (const [f, sz] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) await ck(`${t('Ícone')} ${f}`, () => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im.naturalWidth === sz && `${sz}×${sz}`); im.onerror = () => ok(false); im.src = `./assets/brand/${f}?v=2.0.4`; }));
  await ck(t('Manifesto PWA'), async () => { const m = await (await fetch('./manifest.webmanifest?v=2.0.4')).json(); return m.icons.length >= 4 && m.name; });
  await ck(t('Fontes da marca'), async () => { await document.fonts.ready; return document.fonts.check('600 20px "Cormorant Garamond"') && document.fonts.check('400 16px Inter'); });
  await ck(t('Banco de dados local'), async () => { await db.put('texts', { id: '__diag', title: 'diag', text: '' }); await db.del('texts', '__diag'); return true; });
  await ck(t('Modo offline (service worker)'), async () => !!navigator.serviceWorker?.controller || (location.protocol === 'https:' ? '' : 'http local'));
  await ck(t('Conexão segura (HTTPS)'), async () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  $('#diag', view).innerHTML = checks.map(([n, ok, d]) => `<div class="row between small" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${ok ? '✅' : '⚠️'} ${esc(n)}</span><span class="xs muted">${esc(d)}</span></div>`).join('');
}

/** Tutorial guiado */
export function showTutorial(first = false) {
  const steps = [
    [I.home, t('Bem-vinda ao seu Studio'), t('Aqui você cria artes, textos, documentos e organiza suas publicações — sempre com a sua logomarca e a sua paleta.')],
    [I.grid, t('Centenas de artes prontas'), t('Na Biblioteca, escolha uma arte, troque layout, paleta e formato (Story, post, carrossel) e edite o que quiser.')],
    [I.calendar, t('Programação automática'), t('A Agenda já vem com os próximos meses preenchidos, seguindo campanhas e datas. Use "Semana temática" para um tema por semana.')],
    [I.image, t('Suas fotos, com acabamento'), t('No editor, coloque fotos em molduras (arco, círculo, folha), aplique filtros e reenquadre com os dedos.')],
    [I.sparkle, t('Conheça o Frankie'), t('O botão do Frankie abre o assistente de textos: reflexões, legendas, títulos e roteiros. Revise sempre antes de publicar.')],
    [I.shield, t('Ética e privacidade'), t('Seus dados ficam no aparelho. Nada de dados de pacientes; nenhuma referência é inventada. Faça backups em Perfil.')],
  ];
  let i = 0;
  const s = sheet('<div id="tut"></div>', { onClose: () => prefs.set({ onboarded: true }), label: t('Tutorial') });
  const paint = () => {
    const [ic, ti, tx] = steps[i];
    $('#tut', s.el).innerHTML = `<div style="text-align:center;padding:8px 6px"><div style="width:72px;height:72px;margin:0 auto 14px;border-radius:22px;background:var(--surface-3);color:var(--primary);display:grid;place-items:center">${ic.replace('<svg', '<svg style="width:36px;height:36px"')}</div>
      <h2 class="h-title" style="font-size:26px">${ti}</h2><p class="muted" style="margin:8px 0 18px">${tx}</p>
      <div class="row" style="justify-content:center;gap:6px;margin-bottom:16px">${steps.map((_, j) => `<span style="width:${j === i ? 22 : 8}px;height:8px;border-radius:4px;background:${j === i ? 'var(--primary)' : 'var(--line-2)'}"></span>`).join('')}</div>
      <div class="row"><button class="btn ghost grow" id="skip">${i ? t('Voltar') : t('Pular')}</button><button class="btn grow" id="nx">${i === steps.length - 1 ? t('Começar') : t('Próximo')}</button></div></div>`;
    $('#nx', s.el).onclick = () => { if (i === steps.length - 1) s.close(); else { i++; paint(); } };
    $('#skip', s.el).onclick = () => { if (i) { i--; paint(); } else s.close(); };
  };
  paint();
}
