// Testes automatizados das bibliotecas puras (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatABNT, formatAPA, inText, validDOI, fromCrossref, fromPubmed, plain } from '../js/lib/cite.js';
import { makeZip, crc32 } from '../js/lib/zip.js';
import { buildDocx } from '../js/lib/docx.js';
import { jpegsToPdf } from '../js/lib/pdf.js';
import { allArts, OFFICIAL, PALETTES, buildPages, LAYOUTS, remake } from '../js/lib/templates.js';
import { PHRASES, CATEGORIES, captionFor, registerCustomPhrases, phraseById } from '../js/lib/content.js';
import { generateMonth, generateThemeWeek, monthsAhead } from '../js/lib/plan.js';
import { FORMATS, contrast, hasBrand } from '../js/lib/render.js';
import { buildICS } from '../js/lib/ics.js';
import { debounce } from '../js/lib/util.js';
import { DICT } from '../js/lib/i18n-dict.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ref = { type: 'article', authors: [{ family: 'Shapiro', given: 'Francine' }, { family: 'Silva', given: 'João Pedro' }], title: 'EMDR therapy', container: 'Journal of EMDR Practice and Research', year: '2014', volume: '8', issue: '2', pages: '53-60', doi: '10.1891/1933-3196.8.2.53' };

test('ABNT: sobrenomes em caixa alta, periódico em negrito, DOI', () => {
  const s = formatABNT(ref);
  assert.match(s, /^SHAPIRO, Francine; SILVA, João Pedro\. EMDR therapy\./);
  assert.match(s, /\*\*Journal of EMDR Practice and Research\*\*, v\. 8, n\. 2, p\. 53-60, 2014\./);
  assert.match(s, /DOI: https:\/\/doi\.org\/10\.1891/);
});
test('ABNT: mais de 3 autores usa et al.', () => {
  const r = { ...ref, authors: [1, 2, 3, 4].map((i) => ({ family: 'Autor' + i, given: 'X' })) };
  assert.match(formatABNT(r), /^AUTOR1, X et al\./);
});
test('APA 7: iniciais, & e itálico', () => {
  assert.equal(formatAPA(ref), 'Shapiro, F., & Silva, J. P. (2014). EMDR therapy. *Journal of EMDR Practice and Research*, *8*(2), 53-60. https://doi.org/10.1891/1933-3196.8.2.53');
});
test('citação no texto', () => { assert.equal(inText(ref), '(SHAPIRO; SILVA, 2014)'); assert.equal(inText(ref, 'apa'), '(Shapiro & Silva, 2014)'); });
test('DOI válido/ inválido', () => { assert.ok(validDOI('10.1891/1933-3196.8.2.53')); assert.ok(!validDOI('abc')); });
test('normalização Crossref/PubMed não inventa campos', () => {
  const c = fromCrossref({ title: ['T'], author: [{ family: 'A', given: 'B' }], issued: { 'date-parts': [[2020]] }, type: 'journal-article' });
  assert.equal(c.year, '2020'); assert.equal(c.doi, ''); assert.equal(c.container, '');
  const p = fromPubmed({ uid: '123', title: 'X.', authors: [{ name: 'Frankl V', authtype: 'Author' }], pubdate: '1999 Jan', articleids: [] });
  assert.equal(p.title, 'X'); assert.equal(p.url, 'https://pubmed.ncbi.nlm.nih.gov/123/'); assert.equal(p.doi, '');
});

test('ZIP: assinaturas e CRC', () => {
  const z = makeZip([{ name: 'a.txt', data: 'olá' }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(z.buffer).getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('DOCX: pacote contém partes obrigatórias e texto', () => {
  const z = buildDocx({ title: 'Título & teste', author: 'K', footer: 'Rodapé', blocks: [{ type: 'h1', text: 'Intro' }, { type: 'p', text: '**forte**' }, { type: 'table', text: 'a|b\n1|2' }] }, { references: ['REF. **X**.'] });
  const s = new TextDecoder().decode(z);
  for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels']) assert.ok(s.includes(part), part);
  assert.ok(s.includes('Título &amp; teste')); assert.ok(s.includes('<w:b/>')); assert.ok(s.includes('<w:tbl>'));
});
test('PDF: cabeçalho, objetos e xref coerentes', () => {
  const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = jpegsToPdf([{ jpeg: fake, w: 1080, h: 1350 }, { jpeg: fake, w: 1080, h: 1350 }]);
  const s = Buffer.from(pdf).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4')); assert.ok(s.trimEnd().endsWith('%%EOF')); assert.match(s, /\/Count 2/);
  const xref = +s.match(/startxref\n(\d+)/)[1]; assert.equal(s.slice(xref, xref + 4), 'xref');
  const offs = [...s.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1]);
  offs.forEach((o, i) => assert.ok(s.slice(o).startsWith(`${i + 1} 0 obj`), `obj ${i + 1}`));
});

test('conteúdo: ids únicos, sem promessa de cura, CVV nas campanhas de prevenção', () => {
  const ids = new Set(PHRASES.map((p) => p.id)); assert.equal(ids.size, PHRASES.length);
  for (const p of PHRASES) assert.doesNotMatch((p.text + ' ' + (p.items || []).join(' ')).toLowerCase(), /\b(curar|cura garantida|garant)/, p.id);
  for (const p of PHRASES.filter((x) => x.campaign === 'Setembro Amarelo' || x.campaign === 'Prevenção do Suicídio')) assert.match(p.text, /188/, p.id);
  assert.ok(PHRASES.filter((p) => p.cat === 'logoterapia').length >= 15);
  assert.ok(PHRASES.filter((p) => p.cat === 'espiritualidade').length >= 20);
});
test('legenda inclui assinatura e hashtags', () => {
  const c = captionFor(PHRASES[0], { signature: 'Karina Ximenes | Psicóloga' });
  assert.match(c, /Karina Ximenes \| Psicóloga/); assert.match(c, /#psicologia/);
});

test('templates: 30 oficiais, centenas de artes, todas com a logomarca em todos os formatos', () => {
  assert.equal(OFFICIAL.length, 30);
  assert.equal(new Set(OFFICIAL.map((o) => o.cat)).size, 10);
  const arts = allArts(); assert.ok(arts.length >= 400, String(arts.length));
  for (const a of arts) for (const f of Object.keys(FORMATS)) {
    const pages = buildPages({ ...a, format: f });
    for (const pg of pages) {
      assert.ok(hasBrand(pg), `sem logomarca: ${a.id} ${f}`);
      for (const l of pg.layers) { assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y), `${a.id} posição`); if (l.type === 'text') assert.ok(l.size >= 20, `${a.id} fonte ${l.size}`); }
    }
  }
});
test('paletas: contraste do texto principal ≥ 4.5 (WCAG AA)', () => {
  for (const [k, p] of Object.entries(PALETTES)) {
    for (const bg of [p.bg.c1, p.bg.c2].filter(Boolean)) assert.ok(contrast(p.ink, bg) >= 4.5, `${k}: ${p.ink} sobre ${bg} = ${contrast(p.ink, bg).toFixed(2)}`);
    assert.ok(contrast(p.cardInk, p.card) >= 4.5, `${k} cartão`);
    assert.ok(contrast(p.ink, p.soft) >= 4.5, `${k}: texto sobre forma suave = ${contrast(p.ink, p.soft).toFixed(2)}`);
  }
});

test('programação automática: sem frases repetidas no mês, campanhas presentes, determinística', () => {
  for (const [y, m] of monthsAhead(new Date(2027, 0, 1), 12)) {
    const ps = generateMonth(y, m); const ids = ps.map((p) => p.art.phraseId);
    assert.equal(new Set(ids).size, ids.length, `repetição em ${y}-${m}`);
    assert.ok(ps.length >= 10, `${y}-${m}: ${ps.length}`);
    assert.deepEqual(generateMonth(y, m).map((p) => p.id), ps.map((p) => p.id));
  }
  assert.ok(generateMonth(2027, 9).some((p) => /188/.test(p.caption)), 'Setembro Amarelo com CVV');
  assert.ok(generateMonth(2027, 8).some((p) => p.date === '2027-08-27'), 'Dia do Psicólogo');
});
test('programação evita frases já usadas em meses anteriores', () => {
  const a = generateMonth(2027, 3); const used = new Set(a.map((p) => p.art.phraseId));
  const b = generateMonth(2027, 4, { used }).filter((p) => p.origin === 'rotação');
  const rep = b.filter((p) => used.has(p.art.phraseId)).length;
  assert.ok(rep <= 1, `repetidas: ${rep}`);
});
test('reflexões da Karina entram com prioridade', () => {
  registerCustomPhrases([{ id: 'minha-teste', text: 'Minha reflexão de teste sobre sentido.', cat: 'minhas' }]);
  assert.ok(phraseById('minha-teste'));
  assert.ok(generateMonth(2027, 5).some((p) => p.art.phraseId === 'minha-teste'));
  assert.ok(buildPages({ phraseId: 'minha-teste', layout: 'minimal', palette: 'creme', format: 'story' }).length === 1);
  registerCustomPhrases([]); assert.equal(phraseById('minha-teste'), undefined);
});
test('semana temática: mesmo tema e paleta, carrossel de abertura', () => {
  const w = generateThemeWeek('logoterapia', { start: new Date(2027, 1, 1), stories: true });
  assert.equal(w[0].format, 'carousel'); assert.equal(new Set(w.map((p) => p.art.palette)).size, 1);
  assert.ok(buildPages(w[0].art).length >= 5);
  for (const p of w.slice(1)) assert.equal(phraseById(p.art.phraseId).cat, 'logoterapia');
});

test('ICS: estrutura e lembrete', () => {
  const s = buildICS([{ id: 'x', title: 'Post, teste', date: '2027-01-05', time: '19:00', caption: 'a\nb', network: 'Instagram' }]);
  assert.match(s, /BEGIN:VCALENDAR/); assert.match(s, /BEGIN:VALARM/); assert.match(s, /Post\\, teste/);
});

test('i18n: todo texto da interface tem EN e ES', () => {
  const NEUTRAL = new Set(['EMDR', 'Instagram', 'Story', 'Layout', 'Logo', 'Karina Ximenes | Psicóloga']);
  const keys = new Set();
  const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(p, e.name)) : [path.join(p, e.name)]));
  for (const f of walk(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) if (m[1].trim()) keys.add(m[1]);
  const missing = [...keys].filter((k) => !NEUTRAL.has(k) && !(DICT[k]?.en && DICT[k]?.es));
  assert.deepEqual(missing, []);
  for (const c of CATEGORIES) assert.ok(NEUTRAL.has(c.label) || DICT[c.label], c.label);
  for (const p of Object.values(PALETTES)) assert.ok(DICT[p.name], p.name);
  for (const l of Object.values(LAYOUTS)) assert.ok(DICT[l], l);
});

test('trocar formato/paleta preserva edições da usuária', () => {
  const spec = { phraseId: PHRASES.find((p) => p.cat === 'logoterapia' && !p.items).id, layout: 'fotoarco', palette: 'creme', format: 'story' };
  const pages = buildPages(spec);
  const txt = pages[0].layers.find((l) => l.type === 'text' && l.size > 40); txt.text = 'Texto editado pela Karina';
  pages[0].layers.find((l) => l.type === 'image').assetId = 'foto-1';
  pages[0].layers.push({ id: 'meu', type: 'text', text: 'Camada minha', x: 100, y: 1500, w: 800, size: 40 });
  const sq = remake(pages, 'story', { ...spec, format: 'square' }, { keepColors: true });
  const L = sq[0].layers;
  assert.ok(L.some((l) => l.text === 'Texto editado pela Karina'));
  assert.ok(L.some((l) => l.type === 'image' && l.assetId === 'foto-1'));
  const mine = L.find((l) => l.id === 'meu'); assert.ok(mine && mine.y < 1080, 'camada da usuária reposicionada dentro do quadrado');
  assert.ok(hasBrand(sq[0]));
  const verde = remake(sq, 'square', { ...spec, format: 'square', palette: 'verde' }, { keepColors: false });
  assert.equal(verde[0].bg.c1, PALETTES.verde.bg.c1);
  const main = verde[0].layers.find((l) => l.text === 'Texto editado pela Karina');
  assert.ok(contrast(main.color, PALETTES.verde.bg.c1) >= 4.5 || main.color === PALETTES.verde.ink);
});

test('salvamento: flush só grava quando há mudança pendente', async () => {
  const calls = []; const d = debounce((v) => calls.push(v), 50);
  d.flush(); assert.equal(calls.length, 0, 'sem pendência não grava');
  d('a'); d('b'); d.flush(); assert.deepEqual(calls, ['b']);
  d.flush(); assert.deepEqual(calls, ['b'], 'flush repetido não regrava');
  d('c'); await new Promise((r) => setTimeout(r, 80)); assert.deepEqual(calls, ['b', 'c']);
});
