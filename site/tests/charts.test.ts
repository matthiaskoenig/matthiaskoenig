import { describe, expect, test } from 'vitest';
import { chartExclusions, monthlyContributions, releaseTimeline, starsByRepo } from '../src/lib/charts.ts';
import type { ReleasesFile, RepoEntry } from '../scripts/lib/schemas.ts';

const rel = (repo: string, tag: string, date: string) => ({ repo, tag, name: tag, publishedAt: date, htmlUrl: `u/${tag}`, body: '', prerelease: false });

describe('releaseTimeline', () => {
  test('one row per source with releases, points oldest first, rows by latest release', () => {
    const releases: ReleasesFile = { fetchedAt: 'x', releases: {
      'o/a': [rel('o/a', '2', '2026-02-01T00:00:00Z'), rel('o/a', '1', '2025-01-01T00:00:00Z')],
      'o/b': [rel('o/b', '9', '2026-05-01T00:00:00Z')],
      'o/c': [],
    } };
    const rows = releaseTimeline([{ id: 'a', name: 'A', repo: 'o/a' }, { id: 'b', name: 'B', repo: 'o/b' }, { id: 'c', name: 'C', repo: 'o/c' }], releases);
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
    expect(rows[1].points.map((p) => p.tag)).toEqual(['1', '2']);
    expect(releaseTimeline([{ id: 'a', name: 'A', repo: 'o/a' }, { id: 'b', name: 'B', repo: 'o/b' }], releases, new Set(['o/b'])).map((r) => r.name)).toEqual(['A']);
  });
});

test('chartExclusions unions the groups', () => {
  expect([...chartExclusions([{ charts_exclude: ['o/a'] }, { charts_exclude: ['o/b', 'o/a'] }])]).toEqual(['o/a', 'o/b']);
});

describe('monthlyContributions', () => {
  test('sums days per month in order', () => {
    const c = { fetchedAt: '', login: '', from: '', to: '', totals: { commits: 0, pullRequests: 0, issues: 0, reviews: 0, restricted: 0, calendar: 0 }, weeks: [
      { days: [{ date: '2026-01-30', count: 2, level: 1 }, { date: '2026-02-01', count: 5, level: 2 }] },
      { days: [{ date: '2026-02-03', count: 1, level: 1 }] },
    ] };
    expect(monthlyContributions(c)).toEqual([{ month: '2026-01', count: 2 }, { month: '2026-02', count: 6 }]);
  });
});

describe('starsByRepo', () => {
  const entry = (fullName: string, stars: number): RepoEntry => ({
    fullName, name: fullName.split('/')[1], owner: fullName.split('/')[0], description: null, htmlUrl: `h/${fullName}`, homepage: null,
    stars, forks: 0, openIssues: 0, language: 'Python', topics: [], license: null, pushedAt: '', archived: false, defaultBranch: 'main',
  });
  test('sorts by stars, drops zero-star repos, prefixes foreign owners, limits', () => {
    const repos = { 'matthiaskoenig/a': entry('matthiaskoenig/a', 5), 'sys-bio/b': entry('sys-bio/b', 50), 'matthiaskoenig/c': entry('matthiaskoenig/c', 0), 'matthiaskoenig/d': entry('matthiaskoenig/d', 7) };
    expect(starsByRepo(repos, 2).map((r) => r.name)).toEqual(['sys-bio/b', 'd']);
    expect(starsByRepo(repos, 2, new Set(['sys-bio/b'])).map((r) => r.name)).toEqual(['d', 'a']);
  });
});
