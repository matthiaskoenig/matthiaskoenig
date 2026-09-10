import { expect, test } from 'vitest';
import { repoListFromContent } from '../scripts/lib/repo-list.ts';

const p = (id: string, order: number, repo: string) =>
  ({ id, order, name: id, repo, title: '', description: '', tags: [] });
const g = (id: string, order: number, repos: string[]) =>
  ({ id, order, name: id, description: '', repos });

test('main repos come first in project order, then group repos', () => {
  const r = repoListFromContent(
    [p('b', 2, 'o/b'), p('a', 1, 'o/a')],
    [g('g2', 2, ['o/y']), g('g1', 1, ['o/x'])],
  );
  expect(r.main).toEqual(['o/a', 'o/b']);
  expect(r.all).toEqual(['o/a', 'o/b', 'o/x', 'o/y']);
});

test('throws when a repo is both a project and in a group', () => {
  expect(() => repoListFromContent([p('a', 1, 'o/a')], [g('g', 1, ['o/a'])]))
    .toThrow(/o\/a/);
});
