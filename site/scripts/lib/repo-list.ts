import type { Group, Project } from '../../src/content/schemas.ts';

/**
 * Derives the set of repositories to fetch from the curated YAML.
 * `main` are the project repos in display order; `all` is `main` followed
 * by the group repos in group order, deduplicated. A repo listed both as a
 * project and in a group is an error.
 */
export function repoListFromContent(projects: Project[], groups: Group[]): { all: string[]; main: string[] } {
  const main = [...projects].sort((a, b) => a.order - b.order).map((p) => p.repo);
  const mainSet = new Set(main);
  const rest: string[] = [];
  for (const g of [...groups].sort((a, b) => a.order - b.order)) {
    for (const r of g.repos) {
      if (mainSet.has(r)) throw new Error(`Repository ${r} is listed both in projects.yml and groups.yml (${g.id})`);
      if (!rest.includes(r)) rest.push(r);
    }
  }
  return { main, all: [...main, ...rest] };
}
