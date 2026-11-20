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

/** Lembretes recorrentes para criar (aparecem na tela bloqueada via calendário do celular). days: 0..6, time 'HH:MM' */
export function buildReminderICS({ days = [1, 3, 5], time = '09:00', url = '' } = {}) {
  const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const now = new Date(); const [hh, mm] = time.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hh, mm);
  const loc = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(start.getTime() + 15 * 60000);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studio Karina Ximenes//Lembretes//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:kxs-lembrete-${Date.now()}@studio-karina-ximenes`, `DTSTAMP:${stamp(now)}`, `DTSTART:${loc(start)}`, `DTEND:${loc(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => map[d]).join(',')}`,
    `SUMMARY:${esc('✨ Hora de criar no KXS')}`, `DESCRIPTION:${esc('Seu post de hoje leva 1 minuto: Story ou Feed em 3 passos. ' + url)}`, url ? `URL:${url}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('✨ Hora de criar no KXS')}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,74}/g).join('\r\n ') : l)).join('\r\n');
}
