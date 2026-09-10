import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureData } from '../scripts/make-fixture-data.ts';
import { contributionsFileSchema, releasesFileSchema, reposFileSchema, statsFileSchema } from '../scripts/lib/schemas.ts';

test('writes four schema-valid snapshot files covering every curated repo', () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const outDir = mkdtempSync(join(tmpdir(), 'snap-'));
  makeFixtureData({ contentDir, outDir, now: new Date('2026-09-10T00:00:00Z') });
  const read = (n: string) => JSON.parse(readFileSync(join(outDir, n), 'utf8'));
  const repos = reposFileSchema.parse(read('repos.json'));
  releasesFileSchema.parse(read('releases.json'));
  contributionsFileSchema.parse(read('contributions.json'));
  statsFileSchema.parse(read('stats.json'));
  expect(Object.keys(repos.repos)).toContain('matthiaskoenig/sbmlutils');
  expect(Object.keys(repos.repos)).toContain('sys-bio/roadrunner');
});
