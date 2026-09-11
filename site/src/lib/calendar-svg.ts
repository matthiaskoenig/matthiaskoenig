// Static SVG of the contribution calendar (README version of ContributionCalendar.vue).
export const calendarColors = ['#ecf0f1', '#a8e6d6', '#5fd1b3', '#18bc9c', '#0f7c67'];

export function calendarSvg(weeks: { days: { date: string; count: number; level: number }[] }[], total: number): string {
  const cell = 12, gap = 3, step = cell + gap, top = 16;
  const width = weeks.length * step;
  const height = 7 * step + top + 20;
  const parts: string[] = [];
  let lastMonth = '';
  weeks.forEach((w, i) => {
    const d = w.days[0];
    if (!d) return;
    const m = d.date.slice(0, 7);
    if (m !== lastMonth) {
      parts.push(`<text x="${i * step}" y="10" font-size="10" fill="#95a5a6">${new Date(d.date).toLocaleString('en', { month: 'short', timeZone: 'UTC' })}</text>`);
      lastMonth = m;
    }
    for (const day of w.days) {
      const y = top + new Date(day.date).getUTCDay() * step;
      parts.push(`<rect x="${i * step}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${calendarColors[day.level]}"><title>${day.count} contributions on ${day.date}</title></rect>`);
    }
  });
  parts.push(`<text x="0" y="${height - 4}" font-size="11" fill="#212529">${total} contributions in the last year</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="${total} contributions in the last year">${parts.join('')}</svg>`;
}
