import type { Group, Project } from '../content/schemas.ts';
import type { ReleaseEntry, ReleasesFile, RepoEntry, ReposFile } from '../../scripts/lib/schemas.ts';

export type ProjectView = Project & { repo: RepoEntry };
export type GroupView = Group & { entries: RepoEntry[] };
export type ReleaseView = ReleaseEntry & { projectId: string; projectName: string; bodyHtml: string };

function lookup(repos: ReposFile, fullName: string): RepoEntry {
  const e = repos.repos[fullName];
  if (!e) throw new Error(`No snapshot entry for ${fullName}; re-run npm run fetch after editing the curated YAML.`);
  return e;
}

export function mergeProjects(projects: Project[], repos: ReposFile): ProjectView[] {
  return [...projects].sort((a, b) => a.order - b.order).map((p) => ({ ...p, repo: lookup(repos, p.repo) }));
}

export function mergeGroups(groups: Group[], repos: ReposFile): GroupView[] {
  return [...groups].sort((a, b) => a.order - b.order).map((g) => ({ ...g, entries: g.repos.map((r) => lookup(repos, r)) }));
}

/** All releases of all projects, rendered, newest first. */
export function mergeReleases(projects: Project[], releases: ReleasesFile, render: (md: string) => string): ReleaseView[] {
  const out: ReleaseView[] = [];
  for (const p of projects) {
    for (const r of releases.releases[p.repo] ?? []) out.push({ ...r, projectId: p.id, projectName: p.name, bodyHtml: render(r.body) });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
