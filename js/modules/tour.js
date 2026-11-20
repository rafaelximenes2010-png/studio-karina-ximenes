// Tutorial guiado com destaque, seta e explicação, passando pelas telas reais do app.
import { t } from '../lib/i18n.js';
import { $ } from '../ui.js';

const TOURS = {
  criar: [
    { route: '#/rapido', sel: '#fmts [data-fmt=story]', title: 'Passo 1 · Onde vai postar', text: 'Toque em Story, Feed, Status do WhatsApp, Quadrado ou Carrossel.' },
    { route: '#/rapido?f=story', sel: '#own', title: 'Passo 2 · Sua frase…', text: 'Escreva o que você está refletindo. Ex.: "Recomeçar também é um ato de fé."' },
    { route: '#/rapido?f=story', sel: '[data-th=logoterapia]', title: '…ou um assunto pronto', text: 'Escolha um tema: Sentido da vida, Fé, EMDR, Emoções e outros.' },
    { route: '#/rapido?f=story&th=logoterapia', sel: '#ph', title: 'Foto (opcional)', text: 'Use uma foto sua (+) ou uma das Fotos do mês, que se renovam todo mês.' },
    { route: '#/rapido?f=story&th=logoterapia', sel: '#cols', title: 'Cores', text: 'Filtre por Alegres, Amarelo, Lilás, Bronze ou Verde.' },
    { route: '#/rapido?f=story&th=logoterapia', sel: '#g .art', title: 'Passo 3 · Escolha a arte', text: 'Toque na arte que gostou. Depois é só “Postar no Instagram” — a legenda já vai copiada.' },
    { route: '#/rapido?f=story&th=logoterapia', sel: '#more', title: 'Quer outras?', text: 'Toque aqui para ver novas artes. Para mexer no texto ou na foto, use “Ajustar”.' },
  ],
};

let el = null;
function close() { el?.remove(); el = null; window.removeEventListener('resize', reposition); }
let current = null;
function reposition() { if (current) place(current); }

async function waitFor(sel, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const n = document.querySelector(sel); if (n && n.getBoundingClientRect().height > 0) return n; await new Promise((r) => setTimeout(r, 80)); }
  return null;
}

function place({ node, step, i, n }) {
  node.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
  const r = node.getBoundingClientRect(); const pad = 8;
  const spot = $('.tour-spot', el); const tip = $('.tour-tip', el); const arrow = $('.tour-arrow', el);
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  $('.tour-title', el).textContent = t(step.title); $('.tour-text', el).textContent = t(step.text);
  $('.tour-count', el).textContent = `${i + 1}/${n}`; $('[data-next]', el).textContent = i === n - 1 ? t('Entendi!') : t('Próximo') + ' →';
  const below = r.top < window.innerHeight * 0.55;
  const tipH = tip.offsetHeight || 150;
  const top = below ? Math.min(window.innerHeight - tipH - 12, r.bottom + pad + 26) : Math.max(12, r.top - pad - 26 - tipH);
  tip.style.top = `${top}px`;
  const cx = Math.min(Math.max(r.left + r.width / 2, 28), window.innerWidth - 28);
  Object.assign(arrow.style, { left: `${cx - 14}px`, top: below ? `${r.bottom + pad + 2}px` : `${r.top - pad - 26}px`, transform: below ? 'none' : 'rotate(180deg)' });
}

export async function startTour(name = 'criar') {
  const steps = TOURS[name]; if (!steps) return;
  close();
  el = document.createElement('div');
  el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="tour-spot"></div><svg class="tour-arrow" viewBox="0 0 28 26" width="28" height="26" aria-hidden="true"><path d="M14 0 L28 26 L0 26 Z" fill="#FFFFFF"/></svg>
    <div class="tour-tip"><div class="row between"><b class="tour-title"></b><span class="tour-count xs muted"></span></div><p class="tour-text"></p>
    <div class="row between"><button class="btn sm ghost" data-skip>${t('Pular')}</button><button class="btn sm" data-next></button></div></div>`;
  document.body.appendChild(el);
  let i = 0;
  const show = async () => {
    const step = steps[i];
    if (location.hash !== step.route) { location.hash = step.route; await new Promise((r) => setTimeout(r, 350)); }
    const node = await waitFor(step.sel);
    if (!node) { i++; return i < steps.length ? show() : close(); }
    current = { node, step, i, n: steps.length }; place(current);
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-skip]')) return close();
    if (e.target.closest('[data-next]')) { i++; if (i >= steps.length) { close(); localStorage.setItem('sk-tour-criar', '1'); } else show(); }
  });
  window.addEventListener('resize', reposition);
  show();
}
