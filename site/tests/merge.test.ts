import { expect, test } from 'vitest';
import { mergeGroups, mergeProjects, mergeReleases, releaseSources } from '../src/lib/merge.ts';
import type { ReleasesFile, ReposFile, RepoEntry } from '../scripts/lib/schemas.ts';

const entry = (fullName: string): RepoEntry => ({
  fullName, name: fullName.split('/')[1], owner: fullName.split('/')[0], description: null, htmlUrl: '', homepage: null,
  stars: 1, forks: 0, openIssues: 0, language: null, topics: [], license: null, pushedAt: '2026-01-01T00:00:00Z', archived: false, defaultBranch: 'main',
});
const releases: ReleasesFile = { fetchedAt: 'x', releases: {
  'o/a': [{ repo: 'o/a', tag: '1', name: 'one', publishedAt: '2026-01-01T00:00:00Z', htmlUrl: '', body: '**b**', prerelease: false }],
  'o/b': [
    { repo: 'o/b', tag: '2', name: 'two', publishedAt: '2026-02-01T00:00:00Z', htmlUrl: '', body: '', prerelease: false },
    { repo: 'o/b', tag: '0', name: 'old', publishedAt: '2019-02-01T00:00:00Z', htmlUrl: '', body: '', prerelease: false },
  ],
} };
const meta = { fetchedAt: 'x', projects: { 'o/a': { version: '1.0', zenodoDoi: '10.5281/zenodo.1', license: 'MIT', requiresPython: '>=3.11', pythonVersions: ['3.11'] } } };
const repos: ReposFile = { fetchedAt: 'x', repos: { 'o/a': entry('o/a'), 'o/b': entry('o/b') } };
const projects = [
  { id: 'b', order: 2, name: 'B', repo: 'o/b', title: '', description: '', tags: [] },
  { id: 'a', order: 1, name: 'A', repo: 'o/a', title: '', description: '', tags: [] },
];

test('mergeProjects sorts by order and attaches repo entry, latest release and metadata', () => {
  const v = mergeProjects(projects, repos, releases, meta);
  expect(v.map((p) => p.id)).toEqual(['a', 'b']);
  expect(v[0].repo.fullName).toBe('o/a');
  expect(v[0].latestRelease?.tag).toBe('1');
  expect(v[1].latestRelease?.tag).toBe('2');
  expect(v[0].meta?.zenodoDoi).toBe('10.5281/zenodo.1');
  expect(v[1].meta).toBeNull();
});
test('mergeProjects throws on a missing snapshot entry', () => {
  expect(() => mergeProjects([{ ...projects[0], repo: 'o/zzz' }], repos, releases, meta)).toThrow(/o\/zzz/);
});
test('mergeGroups attaches entries in listed order', () => {
  const v = mergeGroups([{ id: 'g', order: 1, name: 'G', description: '', repos: ['o/b', 'o/a'], charts_exclude: [] }], repos);
  expect(v[0].entries.map((e) => e.fullName)).toEqual(['o/b', 'o/a']);
});
const sources = projects.map((p) => ({ id: p.id, name: p.name, repo: p.repo }));
test('mergeReleases keeps only the latest release per source, rendered and summarised, newest first', () => {
  const v = mergeReleases(sources, releases, (md) => `<p>${md}</p>`, (md) => md.toUpperCase(), '2020-01-01T00:00:00Z');
  expect(v.map((r) => r.tag)).toEqual(['2', '1']);
  expect(v.map((r) => r.projectName)).toEqual(['B', 'A']);
  expect(v[1].bodyHtml).toBe('<p>**b**</p>');
  expect(v[1].summary).toBe('**B**');
});
test('mergeReleases skips sources without releases and latest releases older than `since`', () => {
  const v = mergeReleases([...sources, { id: 'c', name: 'C', repo: 'o/c' }], releases, (md) => md, () => '', '2026-01-15T00:00:00Z');
  expect(v.map((r) => r.projectId)).toEqual(['b']);
});
test('releaseSources lists projects then catalog repos, owner-prefixed for other owners', () => {
  const groups = mergeGroups([{ id: 'g', order: 1, name: 'G', description: '', repos: ['o/b'], charts_exclude: [] }], repos);
  groups[0].entries.push({ ...entry('matthiaskoenig/x') });
  const s = releaseSources(projects, groups);
  expect(s.map((x) => x.name)).toEqual(['A', 'B', 'o/b', 'x']);
});
