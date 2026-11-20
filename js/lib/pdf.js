// PDF mínimo com uma imagem JPEG por página (exporta carrosséis/posts em PDF sem dependências).
/** pages: [{ jpeg: Uint8Array, w: number, h: number }] → Uint8Array (página com o tamanho da imagem, em pt) */
export function jpegsToPdf(pages, { title = 'Studio Karina Ximenes' } = {}) {
  const enc = new TextEncoder();
  const chunks = []; const offsets = []; let len = 0;
  const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); for (const b of [].concat(body)) push(b); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // 1 catálogo, 2 páginas, 3 info; por página: page, content, image
  const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  const safe = title.replace(/[()\\]/g, '').replace(/[^\x20-\x7E]/g, '');
  obj(3, `<< /Title (${safe}) /Producer (Studio Karina Ximenes) >>`);
  pages.forEach((p, i) => {
    const base = 4 + i * 3;
    const W = (p.w * 0.75).toFixed(2); const H = (p.h * 0.75).toFixed(2);
    obj(base, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${base + 2} 0 R >> >> /Contents ${base + 1} 0 R >>`);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(base + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
    obj(base + 2, [`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });
  const total = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
