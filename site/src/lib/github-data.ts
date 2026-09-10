import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'astro/zod';
import { contributionsFileSchema, projectMetaFileSchema, releasesFileSchema, reposFileSchema, statsFileSchema } from '../../scripts/lib/schemas.ts';
import type { ContributionsFile, ProjectMetaFile, ReleasesFile, ReposFile, StatsFile } from '../../scripts/lib/schemas.ts';

export interface GithubData {
  repos: ReposFile;
  releases: ReleasesFile;
  contributions: ContributionsFile;
  stats: StatsFile;
  projectMeta: ProjectMetaFile;
}

// Resolved from the working directory (npm scripts run from site/), because
// import.meta.url points into dist/.prerender once Astro has bundled this file.
const defaultDir = join(process.cwd(), 'src/data/github');

function readSnapshot<T>(dir: string, name: string, schema: z.ZodType<T>): T {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing snapshot ${path}. Run \`npm run fetch\` (needs GITHUB_TOKEN) or \`npm run fetch:fixtures\`.`);
  }
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/** Reads and validates the five snapshot files written by `npm run fetch`. */
export function loadGithubData(dir: string = defaultDir): GithubData {
  return {
    repos: readSnapshot(dir, 'repos.json', reposFileSchema),
    releases: readSnapshot(dir, 'releases.json', releasesFileSchema),
    contributions: readSnapshot(dir, 'contributions.json', contributionsFileSchema),
    stats: readSnapshot(dir, 'stats.json', statsFileSchema),
    projectMeta: readSnapshot(dir, 'project-meta.json', projectMetaFileSchema),
  };
}
