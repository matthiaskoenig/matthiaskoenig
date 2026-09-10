import { expect, test } from 'vitest';
import { mergeGroups, mergeProjects, mergeReleases } from '../src/lib/merge.ts';
import type { ReleasesFile, ReposFile, RepoEntry } from '../scripts/lib/schemas.ts';

const entry = (fullName: string): RepoEntry => ({
  fullName, name: fullName.split('/')[1], owner: fullName.split('/')[0], description: null, htmlUrl: '', homepage: null,
  stars: 1, forks: 0, openIssues: 0, language: null, topics: [], license: null, pushedAt: '2026-01-01T00:00:00Z', archived: false,
});
const repos: ReposFile = { fetchedAt: 'x', repos: { 'o/a': entry('o/a'), 'o/b': entry('o/b') } };
const projects = [
  { id: 'b', order: 2, name: 'B', repo: 'o/b', title: '', description: '', tags: [] },
  { id: 'a', order: 1, name: 'A', repo: 'o/a', title: '', description: '', tags: [] },
];

test('mergeProjects sorts by order and attaches repo entries', () => {
  const v = mergeProjects(projects, repos);
  expect(v.map((p) => p.id)).toEqual(['a', 'b']);
  expect(v[0].repo.fullName).toBe('o/a');
});
test('mergeProjects throws on a missing snapshot entry', () => {
  expect(() => mergeProjects([{ ...projects[0], repo: 'o/zzz' }], repos)).toThrow(/o\/zzz/);
});
test('mergeGroups attaches entries in listed order', () => {
  const v = mergeGroups([{ id: 'g', order: 1, name: 'G', description: '', repos: ['o/b', 'o/a'] }], repos);
  expect(v[0].entries.map((e) => e.fullName)).toEqual(['o/b', 'o/a']);
});
test('mergeReleases flattens, renders and sorts newest first', () => {
  const releases: ReleasesFile = { fetchedAt: 'x', releases: {
    'o/a': [{ repo: 'o/a', tag: '1', name: 'one', publishedAt: '2026-01-01T00:00:00Z', htmlUrl: '', body: '**b**', prerelease: false }],
    'o/b': [{ repo: 'o/b', tag: '2', name: 'two', publishedAt: '2026-02-01T00:00:00Z', htmlUrl: '', body: '', prerelease: false }],
  } };
  const v = mergeReleases(projects, releases, (md) => `<p>${md}</p>`);
  expect(v.map((r) => r.tag)).toEqual(['2', '1']);
  expect(v[1].projectName).toBe('A');
  expect(v[1].bodyHtml).toBe('<p>**b**</p>');
});
