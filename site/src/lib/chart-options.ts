// ECharts option builders shared by the Vue islands (interactive) and the
// server-side SVG rendering for the README. Pure functions.
import type { ReleaseRow } from './charts.ts';

export const palette = ['#2c3e50', '#18bc9c', '#3498db', '#f39c12', '#e74c3c', '#95a5a6', '#8e44ad', '#16a085'];
const muted = '#95a5a6';
const ink = '#212529';
const grid = '#ecf0f1';

export function releaseTimelineOption(rows: ReleaseRow[], opts: { interactive: boolean } = { interactive: true }) {
  const names = rows.map((r) => r.name);
  return {
    animation: false,
    tooltip: opts.interactive
      ? { trigger: 'item', formatter: (p: { value: [string, number, string, string] }) => `<b>${names[p.value[1]]}</b> ${p.value[2]}<br>${p.value[0].slice(0, 10)}` }
      : undefined,
    grid: { left: 8, right: 16, top: 8, bottom: opts.interactive ? 56 : 8, containLabel: true },
    xAxis: { type: 'time', axisLabel: { color: muted } },
    yAxis: { type: 'category', data: names, inverse: true, axisLabel: { color: ink }, axisTick: { show: false } },
    dataZoom: opts.interactive ? [{ type: 'slider', xAxisIndex: 0, height: 20, bottom: 12, borderColor: grid }, { type: 'inside', xAxisIndex: 0 }] : undefined,
    series: [
      {
        type: 'scatter',
        symbolSize: 11,
        data: rows.flatMap((r, i) => r.points.map((p) => ({ value: [p.date, i, p.tag, p.url], itemStyle: { color: palette[i % palette.length] } }))),
        emphasis: { scale: 1.6 },
      },
    ],
  };
}
export const releaseTimelineHeight = (rows: number, interactive = true) => Math.max(220, rows * 26 + (interactive ? 90 : 40));

export function contributionsOption(months: { month: string; count: number }[]) {
  const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return {
    animation: false,
    tooltip: { trigger: 'axis', formatter: (ps: { name: string; value: number }[]) => `<b>${ps[0].name}</b><br>${ps[0].value} contributions` },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: months.map((m) => label(m.month)), axisLabel: { color: muted } },
    yAxis: { type: 'value', axisLabel: { color: muted }, splitLine: { lineStyle: { color: grid } } },
    series: [{ type: 'bar', data: months.map((m) => m.count), itemStyle: { color: '#18bc9c', borderRadius: [3, 3, 0, 0] } }],
  };
}

export interface StarRow { name: string; stars: number; language: string | null; url: string }
export const starsLanguages = (rows: StarRow[]) => [...new Set(rows.map((r) => r.language ?? 'other'))];
export const languageColor = (languages: string[], l: string | null) => palette[languages.indexOf(l ?? 'other') % palette.length];

export function starsOption(rows: StarRow[]) {
  const languages = starsLanguages(rows);
  return {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; dataIndex: number }) => `<b>${p.name}</b><br>★ ${p.value} · ${rows[p.dataIndex].language ?? '—'}` },
    grid: { left: 8, right: 32, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: muted }, splitLine: { lineStyle: { color: grid } } },
    yAxis: { type: 'category', data: rows.map((r) => r.name), inverse: true, axisLabel: { color: ink }, axisTick: { show: false } },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => ({ value: r.stars, itemStyle: { color: languageColor(languages, r.language) } })),
        barCategoryGap: '30%',
        label: { show: true, position: 'right', color: muted },
      },
    ],
  };
}
export const starsHeight = (rows: number) => rows * 24 + 50;
