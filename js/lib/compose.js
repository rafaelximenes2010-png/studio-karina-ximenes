// Gerador de frases e textos a partir de um tema livre (funciona sem internet e sem IA).
// A base é a mesma do Studio: Logoterapia, fé cristã reformada, EMDR e cuidado emocional.
import { CATEGORIES } from './content.js';

const KEYS = {
  espiritualidade: ['fé', 'fe', 'deus', 'graça', 'oração', 'igreja', 'natal', 'páscoa', 'pascoa', 'esperança', 'perdão', 'cristo', 'jesus', 'bíblia', 'evangelho', 'providência', 'culto', 'salmo'],
  emdr: ['emdr', 'trauma', 'traumas', 'pânico', 'memória', 'memórias', 'gatilho', 'gatilhos', 'abuso', 'violência', 'acidente'],
  logoterapia: ['sentido', 'propósito', 'proposito', 'frankl', 'logoterapia', 'sofrimento', 'liberdade', 'vocação', 'missão', 'escolha', 'escolhas', 'responsabilidade'],
  relacoes: ['casamento', 'relacionamento', 'relacionamentos', 'família', 'familia', 'filho', 'filhos', 'filha', 'maternidade', 'paternidade', 'amizade', 'amor', 'namoro', 'pais', 'mãe', 'pai', 'casal', 'adolescência', 'infância', 'limites', 'perdão'],
  neuro: ['cérebro', 'cerebro', 'hábito', 'hábitos', 'sono', 'dopamina', 'celular', 'telas', 'redes', 'foco', 'atenção', 'memória'],
  emocional: ['ansiedade', 'tristeza', 'depressão', 'luto', 'raiva', 'medo', 'culpa', 'autoestima', 'burnout', 'estresse', 'cansaço', 'solidão', 'vergonha', 'insegurança', 'autocuidado', 'emoções', 'perfeccionismo', 'comparação'],
};
const FEM_EXCEPT = ['solidão', 'gratidão', 'mão', 'fé', 'dor', 'paz', 'luz', 'mãe', 'cruz', 'voz', 'vez', 'ordem', 'imagem', 'viagem'];
const MASC_EXCEPT = ['dia', 'mapa', 'problema', 'sistema', 'tema', 'trauma', 'clima', 'planeta', 'pijama', 'drama'];

const norm = (s) => s.normalize('NFC').trim().replace(/\s+/g, ' ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Artigos e contrações em português para um tema digitado ("ansiedade" → "a ansiedade", "da ansiedade"). */
export function grammar(raw) {
  let t = norm(raw).replace(/[.!?;:]+$/, '');
  t = t.replace(/^(a|o|as|os)\s+/i, '');
  const low = t.toLowerCase();
  const head = low.split(' ')[0];
  const plural = /[^ê]s$/.test(head) && head.length > 3 && !/(ês|is|us)$/.test(head);
  const base = plural ? head.replace(/e?s$/, '') : head;
  let fem = FEM_EXCEPT.includes(base) || (!MASC_EXCEPT.includes(base) && /(a|ade|ção|são|gem|ude|ice|ez)$/.test(base));
  if (base.endsWith('ão') && !FEM_EXCEPT.includes(base) && !/(ção|são)$/.test(base)) fem = false;
  const art = (fem ? 'a' : 'o') + (plural ? 's' : '');
  // O celular põe maiúscula sozinho: só mantém em nomes próprios (Natal, Páscoa, Deus) e siglas
  const PROPER = /^(natal|páscoa|pascoa|deus|jesus|cristo|bíblia|biblia|advento|pentecostes|brasil|recife)$/i;
  const word = /^(emdr|tdah|tea|toc|tag)$/i.test(head) ? t.toUpperCase()
    : PROPER.test(head) ? cap(t) : /^[A-ZÁÉÍÓÚÂÊÔÃÕ][a-zà-ú]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  return {
    t: word, T: cap(word), o: `${art} ${word}`, O: cap(`${art} ${word}`),
    do: `d${art} ${word}`, no: `n${art} ${word}`, ao: (art.startsWith('a') ? 'à' + art.slice(1) : 'a' + art) + ' ' + word,
    plural, fem,
  };
}

export function guessCategory(raw) {
  const words = norm(raw).toLowerCase().split(/[^a-zà-ú0-9]+/);
  if (HARD.test(raw)) return 'emocional';
  for (const [cat, keys] of Object.entries(KEYS)) if (words.some((w) => keys.includes(w))) return cat;
  return 'reflexoes';
}

const GENERAL = [
  (g) => `Falar sobre ${g.o} é o primeiro passo para cuidar do que dói em silêncio.`,
  (g) => `${g.O} não ${g.plural ? 'definem' : 'define'} quem você é. Mas ${g.plural ? 'podem' : 'pode'} revelar do que você precisa.`,
  (g) => `Quando o assunto é ${g.t}, acolher vem antes de explicar.`,
  (g) => `Ninguém precisa atravessar ${g.o} sozinho.`,
  (g) => `Olhar para ${g.o} com honestidade também é um ato de cuidado.`,
  (g) => `Sobre ${g.t}: o que você sente merece ser ouvido, não julgado.`,
  (g) => `${g.O} ${g.plural ? 'pedem' : 'pede'} tempo, paciência e presença. Inclusive a sua.`,
  (g) => `Diante ${g.do}, um passo de cada vez já é caminho.`,
  (g) => `Cuidar de si diante ${g.do} não é egoísmo. É responsabilidade com a própria vida.`,
  (g) => `Você pode falar sobre ${g.o} sem culpa. Nomear é começar a cuidar.`,
];
// Temas de violência ou abuso nunca recebem frases que soem como incentivo
const HARD = /(abus|tóxic|toxic|violên|violen|agress|assédio|assedio|traição|traicao|manipula|bullying|vício|vicio|dependência química)/i;
const HARD_PHRASES = [
  (g) => `${g.O} não ${g.plural ? 'são' : 'é'} culpa de quem sofre. Pedir ajuda é um ato de coragem.`,
  (g) => `Reconhecer ${g.o} é o primeiro passo para se proteger.`,
  () => 'Cuidado de verdade não machuca, não controla e não humilha.',
  () => 'Você merece segurança, respeito e uma rede de apoio por perto.',
];
// Temas que pedem cuidado (dor, perda, sofrimento); os demais recebem frases luminosas
const DIFFICULT = /(ansiedade|depress|luto|perda|crise|doença|dor\b|separação|divórcio|medo|culpa|vergonha|solidão|tristeza|raiva|burnout|estresse|cansaço|trauma|pânico|insônia|sofrimento|frustra|rejeição|abandono|insegurança|comparação|perfeccionismo)/i;
const POSITIVE = [
  (g) => `${g.O} nos ${g.plural ? 'lembram' : 'lembra'} de que a vida também é feita de pequenas belezas.`,
  (g) => `Hoje, olhe para ${g.o} com olhos de gratidão.`,
  (g) => `Há sentido escondido nas coisas simples, como ${g.o}.`,
  (g) => `Que ${g.o} ${g.plural ? 'sejam' : 'seja'} um convite a desacelerar e respirar.`,
  (g) => `Cuidar da alma também é parar para contemplar ${g.o}.`,
  (g) => `${g.O} também ${g.plural ? 'falam' : 'fala'} da graça que nos sustenta todos os dias.`,
  (g) => `Gratidão é perceber ${g.o} que já ${g.plural ? 'estavam' : 'estava'} ali.`,
  (g) => `Pequenos momentos, como ${g.o}, também cuidam da saúde emocional.`,
  (g) => `Quando a vida pesa, lembrar ${g.do} ajuda a reencontrar leveza.`,
  (g) => `Que ${g.o} de hoje aqueça o que anda cansado em você.`,
  (g) => `Presença é isto: estar inteiro diante ${g.do}, sem pressa.`,
];
const BY_CAT = {
  logoterapia: [
    (g) => `Mesmo diante ${g.do}, ainda é possível escolher a atitude com que se caminha.`,
    (g) => `${g.O} também ${g.plural ? 'podem' : 'pode'} ser lugar onde o sentido se revela.`,
    (g) => `A pergunta não é só por que ${g.o}, mas para quê. O sentido nasce da resposta que damos à vida.`,
  ],
  espiritualidade: [
    (g) => `Diante ${g.do}, a graça não nos poupa da dor, mas nos sustenta nela.`,
    (g) => `A fé não apaga ${g.o}; ela nos lembra de que não caminhamos sós.`,
    (g) => `Em meio ${g.ao}, Deus continua sendo refúgio e fortaleza.`,
  ],
  emdr: [
    (g) => `${g.O} ${g.plural ? 'podem' : 'pode'} deixar marcas, mas memórias podem ser reprocessadas com cuidado.`,
    (g) => `O corpo também guarda ${g.o}. Na terapia, ele pode aprender que o perigo passou.`,
    (g) => `O que aconteceu em ${g.t} faz parte da sua história, mas não precisa comandar o seu presente.`,
  ],
  relacoes: [
    (g) => `${g.O} se ${g.plural ? 'fortalecem' : 'fortalece'} no cuidado de cada dia, não na perfeição.`,
    (g) => `Escuta, limites e afeto: é assim que ${g.o} ${g.plural ? 'ficam' : 'fica'} mais saudáve${g.plural ? 'is' : 'l'}.`,
    (g) => `Em ${g.t}, ninguém acerta sempre. O que sustenta é a disposição de recomeçar.`,
  ],
  neuro: [
    (g) => `O cérebro aprende com a repetição: pequenos passos sobre ${g.t} geram grandes mudanças.`,
    (g) => `Entender como o cérebro reage ${g.ao} ajuda a ter mais compaixão consigo.`,
    (g) => `Hábitos mudam devagar. Sobre ${g.t}, constância vale mais que intensidade.`,
  ],
  emocional: [
    (g) => `Sentir ${g.o} não é fraqueza. É um sinal pedindo cuidado.`,
    (g) => `${g.O} ${g.plural ? 'merecem' : 'merece'} acolhimento, não pressa.`,
    (g) => `Você não é ${g.o} que sente. Você é quem pode cuidar dela com gentileza.`.replace(' dela', g.fem ? (g.plural ? ' delas' : ' dela') : (g.plural ? ' deles' : ' dele')),
  ],
  reflexoes: [
    (g) => `Hoje, permita-se pensar ${g.no} com mais gentileza.`,
    (g) => `${g.O} ${g.plural ? 'ensinam' : 'ensina'} quando a gente para para escutar.`,
    (g) => `Talvez ${g.o} ${g.plural ? 'sejam' : 'seja'} um convite a desacelerar e olhar para dentro.`,
  ],
};

/** Gera frases, uma lista de cuidados, perguntas para refletir e uma legenda a partir de um tema livre. */
export function composeFromTheme(raw, { cat, context = '' } = {}) {
  const g = grammar(raw);
  const c = cat || guessCategory(raw);
  const hard = HARD.test(raw + ' ' + context);
  const bright = !hard && !DIFFICULT.test(raw + ' ' + context) && !['emocional', 'emdr'].includes(c);
  const own = (hard ? HARD_PHRASES : bright ? [...(['relacoes', 'neuro'].includes(c) ? BY_CAT[c] : []), ...POSITIVE] : BY_CAT[c] || BY_CAT.reflexoes).map((f) => f(g));
  const texts = [...own, ...(bright ? [] : GENERAL.filter((_, i) => !hard || ![6, 8].includes(i)).map((f) => f(g)))].filter((v, i, a) => a.indexOf(v) === i);
  const id = (i) => `tema-${g.t.toLowerCase().replace(/[^a-z0-9à-ú]+/g, '-')}-${i}`;
  const phrases = texts.map((text, i) => ({ id: id(i), cat: c, text, generated: true }));
  const list = { id: id('lista'), cat: 'psicoeducacao', generated: true, title: `Como cuidar de si diante ${g.do}`, text: `Como cuidar de si diante ${g.do}`,
    items: ['Dê nome ao que você sente', 'Respeite o seu ritmo', 'Converse com alguém de confiança', 'Cuide do sono e do corpo', 'Lembre-se do que dá sentido à sua vida'] };
  const questions = { id: id('perguntas'), cat: 'logoterapia', generated: true, title: `Perguntas para refletir sobre ${g.o}`, text: `Perguntas para refletir sobre ${g.o}`,
    items: [`O que ${g.o} tem me mostrado?`, 'Do que eu preciso neste momento?', 'Quem pode caminhar comigo?', 'Que atitude escolho diante do que não posso mudar?'] };
  const tag = '#' + g.t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const tags = (CATEGORIES.find((x) => x.id === c)?.tags || '#psicologia') + ' ' + tag;
  const text = bright ? [
    `${g.O} ${g.plural ? 'parecem' : 'parece'} simples, mas ${g.plural ? 'guardam' : 'guarda'} um convite: parar, perceber e agradecer.`,
    `Cuidar da saúde emocional também é dar atenção ao que é bom, ao que nos devolve fôlego e sentido.`,
    c === 'espiritualidade' ? 'Toda boa dádiva vem do alto: perceber isso muda a forma como vivemos o dia.' : 'Como lembrava Viktor Frankl, a vida tem sentido em todas as circunstâncias, inclusive nas mais simples.',
    'Se isso tocou você, salve este post e compartilhe com alguém especial.',
  ].join(' ') : [
    `${g.O} ${g.plural ? 'fazem' : 'faz'} parte da vida de muita gente, e quase sempre ${g.plural ? 'chegam' : 'chega'} acompanhad${g.fem ? 'a' : 'o'}${g.plural ? 's' : ''} de silêncio.`,
    `Falar sobre ${g.t} com acolhimento ajuda a entender o que sentimos e a encontrar caminhos possíveis, sem pressa e sem julgamento.`,
    hard ? 'Se você vive isso, procure ajuda: você não está sozinho. Em situação de risco, ligue 190 ou 180 (Central de Atendimento à Mulher).' : c === 'espiritualidade' ? 'A fé não nos tira da dor, mas nos dá chão para atravessá-la.' : 'Como lembrava Viktor Frankl, ainda podemos escolher a atitude diante do que vivemos.',
    'Se isso faz sentido para você, salve este post e compartilhe com quem precisa ler hoje.',
  ].join(' ');
  // Várias listas e perguntas para os carrosséis não se repetirem
  const mk = (suffix, title, items, cat = 'psicoeducacao') => ({ id: id(suffix), cat, generated: true, title, text: title, items });
  const questionSets = [questions,
    mk('perg-b', `Antes de dormir, pense sobre ${g.o}`, ['O que foi mais difícil hoje?', 'O que me trouxe alívio?', 'Pelo que posso agradecer?', 'Qual pequeno passo darei amanhã?'], 'logoterapia'),
    mk('perg-c', 'Uma conversa honesta com você', ['Como eu realmente estou?', 'O que estou evitando sentir?', 'O que eu diria a alguém que amo nessa situação?', 'Onde encontro sentido agora?'], 'logoterapia'),
    mk('perg-d', `Diário: ${g.t}`, [`Quando ${g.o} aparece com mais força?`, 'O que meu corpo sente nesses momentos?', 'O que já me ajudou antes?', 'Que verdade quero lembrar?'], 'logoterapia')];
  const listSets = [list,
    bright ? mk('lista-b', 'Pequenos rituais de cuidado', ['Comece o dia com calma', 'Faça uma pausa de 5 minutos', 'Escreva 3 gratidões', 'Caminhe ao ar livre', 'Durma no seu horário'])
      : mk('lista-b', 'Primeiros socorros emocionais', ['Respire devagar por um minuto', 'Nomeie o que está sentindo', 'Beba água e mova o corpo', 'Fale com alguém de confiança', 'Busque ajuda se persistir']),
    bright ? mk('lista-c', `Como trazer mais leveza ao dia`, ['Desacelere entre uma tarefa e outra', 'Olhe para o céu por um minuto', 'Ouça uma música que acalma', 'Agradeça por algo simples', 'Desligue as telas mais cedo'])
      : mk('lista-c', `O que evitar quando ${g.o} aparece`, ['Cobrar-se perfeição', 'Isolar-se por muito tempo', 'Comparar a sua dor', 'Ignorar os sinais do corpo', 'Desistir de pedir ajuda'])];
  if (bright) { list.title = `Como aproveitar melhor ${g.o}`; list.text = list.title; list.items = ['Pare por um minuto e respire', 'Perceba os detalhes ao redor', 'Agradeça por algo simples', 'Compartilhe o momento com alguém', 'Guarde essa lembrança para os dias difíceis']; }
  return { g, bright, questionSets, listSets, theme: g.T, cat: c, phrases, list, questions, caption: `${text}\n\n${tags}`, text };
}
