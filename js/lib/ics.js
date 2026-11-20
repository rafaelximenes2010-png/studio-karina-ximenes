// Gera arquivo .ics (lembretes no calendário do celular/computador)
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
function stamp(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; }
/** posts: [{id,title,date:'YYYY-MM-DD',time:'HH:MM',caption,network}] ; alarmMin: minutos antes */
export function buildICS(posts, { alarmMin = 60 } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studio Karina Ximenes//Agenda editorial//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const p of posts) {
    const [y, m, d] = p.date.split('-').map(Number); const [hh, mm] = (p.time || '19:00').split(':').map(Number);
    const start = new Date(y, m - 1, d, hh, mm); const end = new Date(start.getTime() + 30 * 60000);
    lines.push('BEGIN:VEVENT', `UID:${p.id}@studio-karina-ximenes`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc('📣 ' + (p.network || 'Post') + ': ' + p.title)}`, `DESCRIPTION:${esc((p.caption || '').slice(0, 900))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Publicar: ' + p.title)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,74}/g).join('\r\n ') : l)).join('\r\n');
}
