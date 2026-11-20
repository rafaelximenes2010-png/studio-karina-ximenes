// Referências bibliográficas: normalização (Crossref/PubMed) e formatação ABNT/APA.
// Nunca inventa dados: campos ausentes ficam ausentes.

/** Referência normalizada:
 * { id, type:'article'|'book'|'chapter'|'web'|'other', authors:[{family, given}], title, container, year,
 *   volume, issue, pages, doi, url, publisher, place, accessed, source:'crossref'|'pubmed'|'manual', pmid } */

export function parseAuthor(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  if (s.includes(',')) { const [family, given] = s.split(',').map((x) => x.trim()); return { family, given: given || '' }; }
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { family: parts[0], given: '' };
  return { family: parts.pop(), given: parts.join(' ') };
}

export function fromCrossref(it) {
  const year = it?.issued?.['date-parts']?.[0]?.[0] || it?.published?.['date-parts']?.[0]?.[0] || '';
  const t = it.type || '';
  return {
    type: t.includes('journal') ? 'article' : t.includes('chapter') ? 'chapter' : t.includes('book') ? 'book' : 'other',
    authors: (it.author || []).map((a) => ({ family: a.family || a.name || '', given: a.given || '' })).filter((a) => a.family),
    title: (it.title && it.title[0]) || '',
    container: (it['container-title'] && it['container-title'][0]) || '',
    year: year ? String(year) : '',
    volume: it.volume || '', issue: it.issue || '', pages: it.page || '',
    doi: it.DOI || '', url: it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : ''),
    publisher: it.publisher || '', source: 'crossref',
  };
}

export function fromPubmed(sum) {
  const year = (sum.pubdate || sum.epubdate || '').slice(0, 4);
  const doi = (sum.articleids || []).find((a) => a.idtype === 'doi')?.value || '';
  return {
    type: 'article',
    authors: (sum.authors || []).filter((a) => a.authtype === 'Author' || !a.authtype).map((a) => {
      const [family, ...ini] = String(a.name).split(' ');
      return { family, given: ini.join(' ') };
    }),
    title: String(sum.title || '').replace(/\.$/, ''),
    container: sum.fulljournalname || sum.source || '',
    year, volume: sum.volume || '', issue: sum.issue || '', pages: sum.pages || '',
    doi, url: `https://pubmed.ncbi.nlm.nih.gov/${sum.uid}/`, pmid: String(sum.uid || ''), source: 'pubmed',
  };
}

const initials = (given, dot = true) => String(given || '').split(/[\s-]+/).filter(Boolean)
  .map((g) => (g.length <= 2 && g === g.toUpperCase() ? g.split('').map((c) => c + (dot ? '.' : '')).join(' ') : g[0].toUpperCase() + (dot ? '.' : ''))).join(' ');

// ---------- ABNT (NBR 6023:2018) ----------
function abntAuthors(authors) {
  if (!authors?.length) return '';
  const fmt = (a) => `${a.family.toUpperCase()}${a.given ? ', ' + a.given : ''}`;
  if (authors.length > 3) return `${fmt(authors[0])} et al.`;
  return authors.map(fmt).join('; ');
}
export function formatABNT(r) {
  const parts = [];
  const au = abntAuthors(r.authors);
  const title = (r.title || '').replace(/\.$/, '');
  if (r.type === 'article') {
    parts.push(au ? au + '. ' : '');
    parts.push(au ? `${title}. ` : `${title.toUpperCase()}. `);
    if (r.container) parts.push(`**${r.container}**`);
    const det = [r.volume && `v. ${r.volume}`, r.issue && `n. ${r.issue}`, r.pages && `p. ${r.pages}`, r.year].filter(Boolean);
    if (det.length) parts.push((r.container ? ', ' : '') + det.join(', '));
    parts.push('.');
  } else {
    parts.push(au ? au + '. ' : '');
    parts.push(au ? `**${title}**. ` : `${title.toUpperCase()}. `);
    const pub = [r.place && r.place, r.publisher].filter(Boolean).join(': ');
    if (pub || r.year) parts.push([pub, r.year].filter(Boolean).join(', ') + '.');
  }
  if (r.doi) parts.push(` DOI: https://doi.org/${r.doi}.`);
  else if (r.url) parts.push(` Disponível em: ${r.url}.${r.accessed ? ` Acesso em: ${r.accessed}.` : ''}`);
  return parts.join('').replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
}

// ---------- APA 7 ----------
function apaAuthors(authors) {
  if (!authors?.length) return '';
  const fmt = (a) => `${a.family}${a.given ? ', ' + initials(a.given) : ''}`;
  const list = authors.map(fmt);
  if (list.length === 1) return list[0];
  if (list.length <= 20) return list.slice(0, -1).join(', ') + ', & ' + list[list.length - 1];
  return list.slice(0, 19).join(', ') + ', . . . ' + list[list.length - 1];
}
export function formatAPA(r) {
  const au = apaAuthors(r.authors);
  const year = `(${r.year || 's.d.'})`;
  const title = (r.title || '').replace(/\.$/, '');
  let s;
  if (r.type === 'article') {
    s = `${au ? au + ' ' : ''}${au ? year + '. ' : ''}${title}.${au ? '' : ' ' + year + '.'}`;
    if (r.container) {
      s += ` *${r.container}*`;
      if (r.volume) s += `, *${r.volume}*`;
      if (r.issue) s += `(${r.issue})`;
      if (r.pages) s += `, ${r.pages}`;
      s += '.';
    }
  } else {
    s = `${au ? au + ' ' + year + '. ' : ''}*${title}*.${au ? '' : ' ' + year + '.'}${r.publisher ? ' ' + r.publisher + '.' : ''}`;
  }
  if (r.doi) s += ` https://doi.org/${r.doi}`;
  else if (r.url) s += ` ${r.url}`;
  return s.replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
}

export const formatRef = (r, style = 'abnt') => (style === 'apa' ? formatAPA(r) : formatABNT(r));

/** Remove marcadores de ênfase (**negrito**, *itálico*) para texto puro */
export const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
/** Converte marcadores para HTML seguro (recebe função de escape) */
export const toHTML = (s, esc) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

export function sortRefs(list, style = 'abnt') {
  return [...list].sort((a, b) => plain(formatRef(a, style)).localeCompare(plain(formatRef(b, style)), 'pt'));
}

/** Citação curta no texto: (SOBRENOME, ano) ABNT / (Sobrenome, ano) APA */
export function inText(r, style = 'abnt') {
  const a = r.authors || [];
  const fam = (x) => (style === 'abnt' ? x.family.toUpperCase() : x.family);
  let who = a.length === 0 ? (r.title || '').split(' ').slice(0, 3).join(' ') : a.length === 1 ? fam(a[0])
    : a.length === 2 ? `${fam(a[0])} ${style === 'abnt' ? ';' : '&'} ${fam(a[1])}` : `${fam(a[0])} et al.`;
  if (style === 'abnt' && a.length === 2) who = `${fam(a[0])}; ${fam(a[1])}`;
  return `(${who}, ${r.year || 's.d.'})`;
}

export function validDOI(doi) { return /^10\.\d{4,9}\/\S+$/.test(String(doi || '').trim()); }
