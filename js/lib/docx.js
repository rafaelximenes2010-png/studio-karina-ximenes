// Gera .docx (Office Open XML) sem dependências externas.
import { makeZip } from './zip.js';

const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Converte texto com **negrito** e *itálico* em runs */
function runs(text, base = '') {
  const out = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0; let m;
  const run = (t, extra = '') => {
    const lines = String(t).split('\n');
    lines.forEach((ln, i) => {
      out.push(`<w:r><w:rPr>${base}${extra}</w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(ln)}</w:t></w:r>`);
    });
  };
  while ((m = re.exec(text))) {
    if (m.index > last) run(text.slice(last, m.index));
    if (m[2] !== undefined) run(m[2], '<w:b/>'); else run(m[3], '<w:i/>');
    last = re.lastIndex;
  }
  if (last < text.length) run(text.slice(last));
  return out.join('');
}
const para = (text, style, extraPPr = '', base = '') =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extraPPr}</w:pPr>${runs(text, base)}</w:p>`;

function table(text) {
  const rows = String(text).split('\n').map((r) => r.trim()).filter(Boolean).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="91A595"/>`).join('') + '</w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(cols)}</w:tblGrid>` +
    rows.map((r, i) => `<w:tr>${Array.from({ length: cols }, (_, c) => `<w:tc><w:tcPr>${i === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="E9EFE9"/>' : ''}</w:tcPr>${para(r[c] || '', 'TableText', '', i === 0 ? '<w:b/>' : '')}</w:tc>`).join('')}</w:tr>`).join('') +
    '</w:tbl><w:p/>';
}

function image(relId, n, img, caption) {
  const maxW = 6 * 914400; // 6 polegadas em EMU
  const ratio = img.h / img.w;
  const cx = Math.min(maxW, Math.round(img.w * 9525));
  const cy = Math.round(cx * ratio);
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Imagem ${n}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${n}" name="img${n}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` +
    (caption ? para(caption, 'Caption') : '');
}

/**
 * doc: { title, subtitle, author, date, cover, footer, blocks:[{type,text,assetId,caption}] }
 * opts: { references: string[] (já formatadas), images: { [assetId]: {bytes, ext:'png'|'jpeg', w, h} }, refTitle }
 */
export function buildDocx(doc, opts = {}) {
  const images = opts.images || {};
  const media = []; const rels = [];
  let body = '';
  if (doc.cover !== false) {
    body += '<w:p><w:pPr><w:spacing w:before="2400"/></w:pPr></w:p>';
    if (doc.author) body += para(doc.author.toUpperCase(), 'CoverMeta', '<w:jc w:val="center"/>');
    body += '<w:p><w:pPr><w:spacing w:before="2400"/></w:pPr></w:p>';
    body += para(doc.title || 'Sem título', 'Title', '<w:jc w:val="center"/>');
    if (doc.subtitle) body += para(doc.subtitle, 'Subtitle', '<w:jc w:val="center"/>');
    body += '<w:p><w:pPr><w:spacing w:before="3600"/></w:pPr></w:p>';
    if (doc.date) body += para(doc.date, 'CoverMeta', '<w:jc w:val="center"/>');
    body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  } else {
    body += para(doc.title || 'Sem título', 'Title');
    if (doc.subtitle) body += para(doc.subtitle, 'Subtitle');
  }
  let n = 1;
  for (const b of doc.blocks || []) {
    const t = b.text || '';
    switch (b.type) {
      case 'h1': body += para(t, 'Heading1'); break;
      case 'h2': body += para(t, 'Heading2'); break;
      case 'h3': body += para(t, 'Heading3'); break;
      case 'quote': body += para(t, 'Quote'); break;
      case 'note': body += para(t, 'Note'); break;
      case 'list': for (const l of t.split('\n').filter((s) => s.trim())) body += para('• ' + l.replace(/^[-•*]\s*/, ''), 'ListText'); break;
      case 'olist': t.split('\n').filter((s) => s.trim()).forEach((l, i) => { body += para(`${i + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`, 'ListText'); }); break;
      case 'table': body += table(t); break;
      case 'pagebreak': body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; break;
      case 'image': {
        const img = images[b.assetId];
        if (img) {
          const relId = `rIdImg${n}`; const file = `image${n}.${img.ext === 'png' ? 'png' : 'jpeg'}`;
          media.push({ name: `word/media/${file}`, data: img.bytes });
          rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${file}"/>`);
          body += image(relId, n, img, b.caption); n++;
        } else if (b.caption) body += para(b.caption, 'Caption');
        break;
      }
      default: if (t.trim()) body += para(t, 'BodyText');
    }
  }
  if (opts.references?.length) {
    body += para(opts.refTitle || 'REFERÊNCIAS', 'RefTitle');
    for (const r of opts.references) body += para(r, 'Reference');
  }
  const footerText = doc.footer || '';
  const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="567" w:gutter="0"/>${doc.cover !== false ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9071"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">${x(footerText)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const st = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}<w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="24"/><w:color w:val="33382F"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    st('Title', 'Title', '<w:spacing w:after="240"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="44"/><w:color w:val="435B49"/>') +
    st('Subtitle', 'Subtitle', '<w:spacing w:after="240"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:sz w:val="28"/><w:color w:val="A8834F"/>') +
    st('CoverMeta', 'Cover Meta', '', '<w:caps/><w:sz w:val="22"/><w:spacing w:val="20"/>') +
    st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:caps/><w:sz w:val="28"/><w:color w:val="435B49"/>') +
    st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="26"/><w:color w:val="435B49"/>') +
    st('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="24"/><w:color w:val="33382F"/>') +
    st('BodyText', 'Body Text', '<w:jc w:val="both"/><w:ind w:firstLine="709"/>', '') +
    st('Quote', 'Quote', '<w:ind w:left="2268"/><w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="both"/>', '<w:sz w:val="20"/>') +
    st('Note', 'Note', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="A8834F"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F5EEE2"/><w:ind w:left="284"/>', '<w:sz w:val="22"/>') +
    st('ListText', 'List Text', '<w:ind w:left="567" w:hanging="283"/><w:spacing w:after="60"/>', '') +
    st('TableText', 'Table Text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="20"/>') +
    st('Caption', 'caption', '<w:jc w:val="center"/>', '<w:i/><w:sz w:val="20"/>') +
    st('RefTitle', 'Ref Title', '<w:jc w:val="center"/><w:pageBreakBefore/><w:spacing w:after="240"/>', '<w:b/><w:caps/><w:sz w:val="24"/>') +
    st('Reference', 'Reference', '<w:spacing w:after="240" w:line="240" w:lineRule="auto"/>', '') +
    st('Footer', 'footer', '', '<w:sz w:val="18"/><w:color w:val="6B7A6E"/>') +
    `</w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels.join('')}</Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(doc.title)}</dc:title><dc:creator>${x(doc.author || 'Studio Karina Ximenes')}</dc:creator></cp:coreProperties>`;
  return makeZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/footer1.xml', data: footerXml },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'docProps/core.xml', data: core },
    ...media,
  ]);
}
