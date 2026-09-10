import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFetch } from '../scripts/fetch-github.ts';
import { reposFileSchema } from '../scripts/lib/schemas.ts';
import repoFixture from './fixtures/rest-repo.json';
import releasesFixture from './fixtures/rest-releases.json';
import contribFixture from './fixtures/graphql-contributions.json';

test('snapshot entries are keyed by the YAML spelling even when GitHub returns another full_name', async () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const outDir = mkdtempSync(join(tmpdir(), 'fetch-'));
  const client = {
    rest: async <T>(path: string): Promise<T> => {
      if (path.endsWith('/releases?per_page=3')) return releasesFixture as T;
      const requested = path.replace('/repos/', '');
      // Simulate GitHub canonicalising the owner, as it does for sed-ml -> SED-ML.
      return { ...repoFixture, full_name: requested.toUpperCase(), name: requested.split('/')[1] } as T;
    },
    graphql: async <T>(): Promise<T> => contribFixture as T,
  };
  await runFetch({ token: 'x', login: 'matthiaskoenig', contentDir, outDir, client, now: new Date('2026-09-10T00:00:00Z') });
  const repos = reposFileSchema.parse(JSON.parse(readFileSync(join(outDir, 'repos.json'), 'utf8')));
  expect(repos.repos['sed-ml/sed-ml']).toBeDefined();
  expect(repos.repos['sed-ml/sed-ml'].fullName).toBe('SED-ML/SED-ML');
  expect(Object.keys(repos.repos)).toContain('matthiaskoenig/pkdb');
});
