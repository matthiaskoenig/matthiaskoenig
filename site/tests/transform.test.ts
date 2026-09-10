import { describe, expect, test } from 'vitest';
import { z } from 'astro/zod';
import { apiReleaseSchema, apiRepoSchema, graphqlContributionsSchema, statsFileSchema, contributionsFileSchema } from '../scripts/lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries, toRepoEntry } from '../scripts/lib/transform.ts';
import repoFixture from './fixtures/rest-repo.json';
import releasesFixture from './fixtures/rest-releases.json';
import contribFixture from './fixtures/graphql-contributions.json';

const NOW = '2026-09-10T00:00:00.000Z';

describe('toRepoEntry', () => {
  test('maps the REST repo response', () => {
    const e = toRepoEntry(apiRepoSchema.parse(repoFixture));
    expect(e.fullName).toBe('matthiaskoenig/sbmlutils');
    expect(e.owner).toBe('matthiaskoenig');
    expect(e.stars).toBeGreaterThan(0);
    expect(e.license).toBe('MIT');
    expect(typeof e.pushedAt).toBe('string');
    expect(e.archived).toBe(false);
  });
});

describe('toReleaseEntries', () => {
  test('keeps at most three published releases, newest first, with string fields', () => {
    const list = toReleaseEntries('matthiaskoenig/sbmlutils', z.array(apiReleaseSchema).parse(releasesFixture));
    expect(list.length).toBeLessThanOrEqual(3);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.repo === 'matthiaskoenig/sbmlutils')).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].publishedAt >= list[i].publishedAt).toBe(true);
    expect(list.every((r) => typeof r.body === 'string' && typeof r.name === 'string')).toBe(true);
  });
  test('drops drafts and unpublished releases', () => {
    const draft = { tag_name: 'v9', name: null, published_at: null, html_url: 'u', body: null, draft: true, prerelease: false };
    expect(toReleaseEntries('o/r', [draft])).toEqual([]);
  });
});

describe('toContributions', () => {
  test('maps levels to 0..4 and copies totals', () => {
    const c = toContributions(graphqlContributionsSchema.parse(contribFixture), 'matthiaskoenig', '2025-09-10T00:00:00Z', NOW, NOW);
    expect(contributionsFileSchema.parse(c)).toBeTruthy();
    expect(c.weeks[0].days.map((d) => d.level)).toEqual([0, 1, 2, 3, 4, 1, 0]);
    expect(c.totals).toEqual({ commits: 812, pullRequests: 14, issues: 9, reviews: 5, restricted: 3, calendar: 843 });
  });
});

describe('computeStats', () => {
  const base = toRepoEntry(apiRepoSchema.parse(repoFixture));
  const repos = {
    'o/a': { ...base, fullName: 'o/a', stars: 10, forks: 1, language: 'Python', pushedAt: '2026-01-01T00:00:00Z' },
    'o/b': { ...base, fullName: 'o/b', stars: 5, forks: 2, language: 'Python', pushedAt: '2026-03-01T00:00:00Z' },
    'o/c': { ...base, fullName: 'o/c', stars: 1, forks: 0, language: 'Java', pushedAt: '2026-02-01T00:00:00Z' },
    'o/d': { ...base, fullName: 'o/d', stars: 0, forks: 0, language: null, pushedAt: '2025-02-01T00:00:00Z' },
  };
  test('sums stars/forks, counts primary languages, lists most recently pushed', () => {
    const s = computeStats(repos, NOW);
    expect(statsFileSchema.parse(s)).toBeTruthy();
    expect(s.repoCount).toBe(4);
    expect(s.totalStars).toBe(16);
    expect(s.totalForks).toBe(3);
    expect(s.languages[0]).toEqual({ name: 'Python', repos: 2, share: 2 / 3 });
    expect(s.languages.map((l) => l.name)).toEqual(['Python', 'Java']);
    expect(s.recentlyPushed.map((r) => r.fullName)).toEqual(['o/b', 'o/c', 'o/a', 'o/d']);
  });
});
