// Cloudflare Worker — backend seguro do assistente de IA do Studio Karina Ximenes.
// A chave da API fica APENAS aqui, como segredo (wrangler secret put ANTHROPIC_API_KEY).
// Variáveis: ANTHROPIC_API_KEY (segredo), ACCESS_CODE (segredo), ALLOWED_ORIGIN, MODEL (opcional), DAILY_LIMIT (opcional)
// KV opcional para limite de uso: binding RATE (namespace KV).

const TASKS = {
  reflexao: 'Escreva uma reflexão ORIGINAL curta (até 90 palavras) para post sobre o tema informado.',
  revisao: 'Revise o texto: corrija gramática, clareza e fluidez, preservando a voz da autora. Devolva apenas o texto revisado e, ao final, uma lista curta do que foi alterado.',
  resumo: 'Resuma o texto em até 5 frases, sem acrescentar informações que não estejam no original.',
  titulos: 'Proponha 8 títulos/ganchos curtos e éticos para o tema (sem sensacionalismo).',
  legenda: 'Escreva uma legenda para Instagram: gancho, desenvolvimento curto, chamada para ação ética e 5 a 8 hashtags relevantes.',
  adaptar: 'Adapte o texto para a rede indicada, respeitando o limite de caracteres e o estilo da plataforma.',
  roteiro: 'Escreva um roteiro de vídeo curto (30–60s) com marcação de tempo, fala e texto na tela.',
  calendario: 'Sugira um calendário editorial de 2 semanas (data relativa, formato, tema, objetivo) para o tema/campanha.',
  publico: 'Reescreva o texto para o público indicado, ajustando vocabulário e exemplos.',
  traducao: 'Traduza o texto para o idioma de destino, com naturalidade e mantendo termos técnicos corretos.',
};
const TONES = { acolhedor: 'acolhedor e empático', cientifico: 'científico e preciso', reflexivo: 'reflexivo e contemplativo', institucional: 'institucional e sóbrio', educativo: 'educativo e claro' };

const SYSTEM = `Você é Frankie, o assistente de conteúdo do Studio Karina Ximenes. Você auxilia a psicóloga Karina Ximenes (Brasil) a produzir conteúdo de comunicação em Psicologia, Logoterapia, EMDR, Neurociência, saúde mental e espiritualidade cristã quando pertinente.
Base de conteúdo da Karina: Logoterapia e Análise Existencial de Viktor Frankl; fé cristã de tradição reformada (graça, providência, imago Dei, vocação, Soli Deo Gloria), com referências bíblicas indicadas como "cf." (sem reproduzir longos trechos de traduções protegidas); EMDR; cuidado com as pessoas, restauração e recomeços. Use o toque cristão de forma respeitosa e não proselitista quando o tema não for explicitamente de fé.
Regras obrigatórias:
- Respeite o Código de Ética Profissional do Psicólogo (CFP) e as orientações de publicidade do CFP: sem promessa de cura, sem garantia de resultados, sem sensacionalismo, sem depoimentos de pacientes, sem diagnóstico pelas redes.
- Distinga evidência científica, interpretação e reflexão pessoal/espiritual.
- NUNCA invente artigos, autores, DOI, estatísticas ou citações. Se mencionar evidências, fale de forma geral e recomende verificação; não crie referências.
- Não atribua frases a autores (ex.: Viktor Frankl) como citação literal; use "inspirado em".
- Temas de risco (suicídio, violência): linguagem responsável e indicação de ajuda (CVV 188; violência contra a mulher 180; emergência 192).
- Não solicite nem utilize dados identificáveis de pacientes.
- Responda em português do Brasil, salvo pedido de tradução.
- Entregue apenas o conteúdo pedido, pronto para revisão humana.`;

const cors = (origin, allowed) => ({
  'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a)); const y = new TextEncoder().encode(String(b));
  if (x.length !== y.length) return false;
  let r = 0; for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || 'https://rafaelximenes2010-png.github.io';
    const h = cors(origin, allowed);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405, h);
    if (origin !== allowed) return json({ error: 'Origem não autorizada' }, 403, h);
    if (!env.ACCESS_CODE || !timingSafeEqual(req.headers.get('X-Access-Code') || '', env.ACCESS_CODE)) return json({ error: 'Código de acesso inválido' }, 401, h);

    // Limite diário de uso (opcional, requer KV "RATE")
    if (env.RATE) {
      const day = new Date().toISOString().slice(0, 10); const key = `uso:${day}`;
      const n = parseInt((await env.RATE.get(key)) || '0', 10); const lim = parseInt(env.DAILY_LIMIT || '150', 10);
      if (n >= lim) return json({ error: 'Limite diário de uso atingido' }, 429, h);
      await env.RATE.put(key, String(n + 1), { expirationTtl: 172800 });
    }

    let body; try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400, h); }
    const task = TASKS[body.task]; if (!task) return json({ error: 'Tarefa desconhecida' }, 400, h);
    const text = String(body.text || '').slice(0, 8000); if (!text.trim()) return json({ error: 'Texto vazio' }, 400, h);
    const prompt = `${task}\nTom: ${TONES[body.tone] || TONES.acolhedor}.\nRede/canal: ${String(body.network || 'Instagram').slice(0, 30)}.\nPúblico: ${String(body.audience || 'geral').slice(0, 120)}.${body.task === 'traducao' ? `\nIdioma de destino: ${({ en: 'inglês', es: 'espanhol', pt: 'português' })[body.lang] || 'inglês'}.` : ''}\n\nConteúdo/tema:\n"""\n${text}\n"""`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 1400, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return json({ error: `Falha no provedor de IA (${r.status})` }, 502, h);
    const data = await r.json();
    const out = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return json({ text: out, model: data.model, ai: true }, 200, h);
  },
};
