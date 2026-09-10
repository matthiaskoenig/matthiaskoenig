/**
 * Fetches GitHub data for every repository listed in the curated YAML and
 * writes four snapshot files to src/data/github/ (gitignored):
 *   repos.json, releases.json, contributions.json, stats.json
 *
 * Usage:  GITHUB_TOKEN=... npm run fetch
 * The Action's default GITHUB_TOKEN is sufficient (public data only).
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { GitHubClient } from './lib/github-client.ts';
import { repoListFromContent } from './lib/repo-list.ts';
import { apiReleaseSchema, apiRepoSchema, graphqlContributionsSchema, type ReleaseEntry, type RepoEntry } from './lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries, toRepoEntry } from './lib/transform.ts';

const CONTRIBUTIONS_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Write to a temp file and rename, so a failed run never leaves a half-written snapshot. */
function writeJsonAtomic(outDir: string, name: string, data: unknown) {
  const tmp = join(outDir, `.${name}.tmp`);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, join(outDir, name));
}

export async function runFetch(opts: {
  token: string;
  login: string;
  contentDir: string;
  outDir: string;
  now?: Date;
  client?: GitHubClient;
}) {
  const now = opts.now ?? new Date();
  const fetchedAt = now.toISOString();
  const client = opts.client ?? new GitHubClient({ token: opts.token });
  const { projects, groups } = loadCuratedYaml(opts.contentDir);
  const { all, main } = repoListFromContent(projects, groups);
  console.log(`Fetching ${all.length} repositories (${main.length} main projects) as of ${fetchedAt}`);

  const repoEntries = await mapLimit(all, 4, async (fullName) => {
    const api = apiRepoSchema.parse(await client.rest(`/repos/${fullName}`));
    return toRepoEntry(api);
  });
  const repos: Record<string, RepoEntry> = Object.fromEntries(repoEntries.map((r) => [r.fullName, r]));

  const releaseLists = await mapLimit(main, 4, async (fullName) => {
    const api = z.array(apiReleaseSchema).parse(await client.rest(`/repos/${fullName}/releases?per_page=3`));
    return [fullName, toReleaseEntries(fullName, api)] as [string, ReleaseEntry[]];
  });
  const releases = Object.fromEntries(releaseLists);

  const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
  const raw = await client.graphql(CONTRIBUTIONS_QUERY, { login: opts.login, from, to: fetchedAt });
  const contributions = toContributions(graphqlContributionsSchema.parse(raw), opts.login, from, fetchedAt, fetchedAt);

  const stats = computeStats(repos, fetchedAt);

  mkdirSync(opts.outDir, { recursive: true });
  writeJsonAtomic(opts.outDir, 'repos.json', { fetchedAt, repos });
  writeJsonAtomic(opts.outDir, 'releases.json', { fetchedAt, releases });
  writeJsonAtomic(opts.outDir, 'contributions.json', contributions);
  writeJsonAtomic(opts.outDir, 'stats.json', stats);
  console.log(`Wrote 4 snapshot files to ${opts.outDir}`);
}

if (import.meta.main) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(
      'GITHUB_TOKEN is not set. Create a fine-grained token with public read access, or run `npm run fetch:fixtures` for offline development.',
    );
    process.exit(2);
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  runFetch({ token, login: 'matthiaskoenig', contentDir: join(root, 'src/content'), outDir: join(root, 'src/data/github') }).catch(
    (err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
