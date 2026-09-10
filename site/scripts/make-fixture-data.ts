/**
 * Writes synthetic snapshot files so the site can be built and developed
 * without a GitHub token. Every repository in the curated YAML gets a fake
 * entry; releases and contributions come from the recorded test fixtures.
 *
 * Usage:  npm run fetch:fixtures
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { repoListFromContent } from './lib/repo-list.ts';
import { apiReleaseSchema, graphqlContributionsSchema, type RepoEntry } from './lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries } from './lib/transform.ts';

const fixturesDir = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const LANGS = ['Python', 'Java', 'JavaScript'];

export function makeFixtureData(opts: { contentDir: string; outDir: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const fetchedAt = now.toISOString();
  const { projects, groups } = loadCuratedYaml(opts.contentDir);
  const { all, main } = repoListFromContent(projects, groups);

  const repos: Record<string, RepoEntry> = {};
  all.forEach((fullName, i) => {
    const [owner, name] = fullName.split('/');
    repos[fullName] = {
      fullName,
      name,
      owner,
      description: `Fixture data for ${fullName}`,
      htmlUrl: `https://github.com/${fullName}`,
      homepage: null,
      stars: i,
      forks: Math.floor(i / 2),
      openIssues: i % 5,
      language: LANGS[i % LANGS.length],
      topics: ['fixture'],
      license: 'MIT',
      pushedAt: new Date(now.getTime() - i * 86400000).toISOString(),
      archived: false,
    };
  });
  const releaseFixture = z.array(apiReleaseSchema).parse(JSON.parse(readFileSync(join(fixturesDir, 'rest-releases.json'), 'utf8')));
  const releases = Object.fromEntries(main.map((r) => [r, toReleaseEntries(r, releaseFixture)]));
  const contribFixture = graphqlContributionsSchema.parse(JSON.parse(readFileSync(join(fixturesDir, 'graphql-contributions.json'), 'utf8')));
  const from = new Date(now.getTime() - 365 * 86400000).toISOString();
  const contributions = toContributions(contribFixture, 'matthiaskoenig', from, fetchedAt, fetchedAt);

  mkdirSync(opts.outDir, { recursive: true });
  const write = (n: string, d: unknown) => writeFileSync(join(opts.outDir, n), JSON.stringify(d, null, 2) + '\n');
  write('repos.json', { fetchedAt, repos });
  write('releases.json', { fetchedAt, releases });
  write('contributions.json', contributions);
  write('stats.json', computeStats(repos, fetchedAt));
  console.log(`Wrote fixture snapshots for ${all.length} repositories to ${opts.outDir}`);
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  makeFixtureData({ contentDir: join(root, 'src/content'), outDir: join(root, 'src/data/github') });
}
