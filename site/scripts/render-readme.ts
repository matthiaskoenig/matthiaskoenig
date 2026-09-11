/**
 * Writes the repository's README.md (the GitHub profile README) from the
 * curated YAML and the snapshots in src/data/github/, plus the static SVG
 * pictures it embeds (../images/generated/).
 *
 * Usage (from site/, after `npm run fetch`):  npm run readme
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { loadGithubData } from '../src/lib/github-data.ts';
import { renderMarkdown, summarizeMarkdown } from '../src/lib/markdown.ts';
import { mergeGroups, mergeProjects, mergeReleases, releaseSources } from '../src/lib/merge.ts';
import { logoFor } from '../src/lib/logos-map.ts';
import { renderReadme } from './lib/readme.ts';
import { renderImages } from './render-images.ts';

export function buildReadme(contentDir: string, dataDir: string): string {
  const data = loadGithubData(dataDir);
  const { projects, groups, research } = loadCuratedYaml(contentDir);
  const projectViews = mergeProjects(projects, data.repos, data.releases, data.projectMeta);
  const groupViews = mergeGroups(groups, data.repos);
  const since = new Date(new Date(data.releases.fetchedAt).getTime() - 2 * 365 * 86400000).toISOString();
  const releases = mergeReleases(releaseSources(projects, groupViews), data.releases, renderMarkdown, summarizeMarkdown, since);
  const logoFiles = readdirSync(fileURLToPath(new URL('../src/assets/logos/', import.meta.url)));
  const logos = Object.fromEntries(Object.keys(data.repos.repos).map((r) => [r, logoFor(r, projects, logoFiles)]));
  return renderReadme({ research, projects: projectViews, releases, logos, stats: data.stats, contributions: data.contributions, fetchedAt: data.repos.fetchedAt });
}

if (import.meta.main) {
  const site = fileURLToPath(new URL('..', import.meta.url));
  const md = buildReadme(join(site, 'src/content'), join(site, 'src/data/github'));
  const target = join(site, '..', 'README.md');
  writeFileSync(target, md);
  const images = renderImages(join(site, 'src/content'), join(site, 'src/data/github'), join(site, '..', 'images/generated'));
  console.log(`Wrote ${target} (${md.length} characters) and ${images.length} images in images/generated/`);
  process.exit(0);
}
