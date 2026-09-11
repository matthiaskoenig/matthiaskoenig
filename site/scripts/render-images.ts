/**
 * Renders the static pictures used by the profile README: the three charts
 * and the contribution calendar as SVG (ECharts server-side), and the five
 * topic icons. Written to <outDir>/charts/*.svg and <outDir>/topics/*.svg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { init, use } from 'echarts/core';
import { BarChart, ScatterChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { loadGithubData } from '../src/lib/github-data.ts';
import { mergeGroups, releaseSources } from '../src/lib/merge.ts';
import { chartExclusions, monthlyContributions, releaseTimeline, starsByRepo } from '../src/lib/charts.ts';
import { contributionsOption, languageColor, releaseTimelineHeight, releaseTimelineOption, starsHeight, starsLanguages, starsOption } from '../src/lib/chart-options.ts';
import { calendarSvg } from '../src/lib/calendar-svg.ts';
import { topicIconSvg } from '../src/lib/icons.ts';

use([BarChart, ScatterChart, GridComponent, SVGRenderer]);

function toSvg(option: object, width: number, height: number): string {
  const chart = init(null, null, { renderer: 'svg', ssr: true, width, height });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

/** Legend for the stars chart as a small SVG strip (the README has no HTML legend). */
function legendSvg(languages: string[]): string {
  const items = languages.map((l, i) => {
    const x = i * 120;
    return `<rect x="${x}" y="4" width="10" height="10" rx="2" fill="${languageColor(languages, l)}"/><text x="${x + 14}" y="13" font-size="11" fill="#95a5a6">${l}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${languages.length * 120}" height="20" font-family="Helvetica, Arial, sans-serif">${items.join('')}</svg>`;
}

export function renderImages(contentDir: string, dataDir: string, outDir: string): string[] {
  const data = loadGithubData(dataDir);
  const { projects, groups, research } = loadCuratedYaml(contentDir);
  const groupViews = mergeGroups(groups, data.repos);
  const excluded = chartExclusions(groupViews);
  const timeline = releaseTimeline(releaseSources(projects, groupViews), data.releases, excluded);
  const stars = starsByRepo(data.repos.repos, 15, excluded);
  const months = monthlyContributions(data.contributions);

  const files: [string, string][] = [
    ['charts/release-timeline.svg', toSvg(releaseTimelineOption(timeline, { interactive: false }), 1000, releaseTimelineHeight(timeline.length, false))],
    ['charts/contributions.svg', toSvg(contributionsOption(months), 1000, 240)],
    ['charts/stars.svg', toSvg(starsOption(stars), 1000, starsHeight(stars.length))],
    ['charts/stars-legend.svg', legendSvg(starsLanguages(stars))],
    ['charts/calendar.svg', calendarSvg(data.contributions.weeks, data.contributions.totals.calendar)],
    ...research.map((r): [string, string] => [`topics/${r.id}.svg`, topicIconSvg(r.icon, r.color)]),
  ];
  for (const [name, content] of files) {
    mkdirSync(join(outDir, name.split('/')[0]), { recursive: true });
    writeFileSync(join(outDir, name), content);
  }
  return files.map(([name]) => name);
}
