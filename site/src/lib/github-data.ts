import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'astro/zod';
import { contributionsFileSchema, releasesFileSchema, reposFileSchema, statsFileSchema } from '../../scripts/lib/schemas.ts';
import type { ContributionsFile, ReleasesFile, ReposFile, StatsFile } from '../../scripts/lib/schemas.ts';

export interface GithubData {
  repos: ReposFile;
  releases: ReleasesFile;
  contributions: ContributionsFile;
  stats: StatsFile;
}

const defaultDir = fileURLToPath(new URL('../data/github/', import.meta.url));

function readSnapshot<T>(dir: string, name: string, schema: z.ZodType<T>): T {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing snapshot ${path}. Run \`npm run fetch\` (needs GITHUB_TOKEN) or \`npm run fetch:fixtures\`.`);
  }
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/** Reads and validates the four snapshot files written by `npm run fetch`. */
export function loadGithubData(dir: string = defaultDir): GithubData {
  return {
    repos: readSnapshot(dir, 'repos.json', reposFileSchema),
    releases: readSnapshot(dir, 'releases.json', releasesFileSchema),
    contributions: readSnapshot(dir, 'contributions.json', contributionsFileSchema),
    stats: readSnapshot(dir, 'stats.json', statsFileSchema),
  };
}
