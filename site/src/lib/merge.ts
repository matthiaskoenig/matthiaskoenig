import type { Group, Project } from '../content/schemas.ts';
import type { ProjectMeta, ProjectMetaFile, ReleaseEntry, ReleasesFile, RepoEntry, ReposFile } from '../../scripts/lib/schemas.ts';

export type ProjectView = Omit<Project, 'repo'> & { repo: RepoEntry; latestRelease: ReleaseEntry | null; meta: ProjectMeta | null };
export type GroupView = Group & { entries: RepoEntry[] };
export type ReleaseView = ReleaseEntry & { projectId: string; projectName: string; bodyHtml: string; summary: string };

function lookup(repos: ReposFile, fullName: string): RepoEntry {
  const e = repos.repos[fullName];
  if (!e) throw new Error(`No snapshot entry for ${fullName}; re-run npm run fetch after editing the curated YAML.`);
  return e;
}

export function mergeProjects(projects: Project[], repos: ReposFile, releases: ReleasesFile, meta: ProjectMetaFile): ProjectView[] {
  return [...projects]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({
      ...p,
      repo: lookup(repos, p.repo),
      latestRelease: releases.releases[p.repo]?.[0] ?? null,
      meta: meta.projects[p.repo] ?? null,
    }));
}

export function mergeGroups(groups: Group[], repos: ReposFile): GroupView[] {
  return [...groups].sort((a, b) => a.order - b.order).map((g) => ({ ...g, entries: g.repos.map((r) => lookup(repos, r)) }));
}

/** What the release feed lists: a main project or a catalog repository. */
export interface ReleaseSource { id: string; name: string; repo: string }

/**
 * The latest release of each source that has one published on or after `since`
 * (ISO date), rendered and summarised, newest first.
 */
export function mergeReleases(
  sources: ReleaseSource[],
  releases: ReleasesFile,
  render: (md: string) => string,
  summarize: (md: string) => string,
  since: string,
): ReleaseView[] {
  const out: ReleaseView[] = [];
  for (const src of sources) {
    const latest = [...(releases.releases[src.repo] ?? [])].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    if (!latest || latest.publishedAt < since) continue;
    out.push({ ...latest, projectId: src.id, projectName: src.name, bodyHtml: render(latest.body), summary: summarize(latest.body) });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Feed sources: main projects by name, then every catalog repository by its name (owner-prefixed unless it is matthiaskoenig's). */
export function releaseSources(projects: Project[], groups: GroupView[]): ReleaseSource[] {
  const out: ReleaseSource[] = [...projects].sort((a, b) => a.order - b.order).map((p) => ({ id: p.id, name: p.name, repo: p.repo }));
  for (const g of groups) for (const e of g.entries) out.push({ id: e.fullName, name: e.owner === 'matthiaskoenig' ? e.name : e.fullName, repo: e.fullName });
  return out;
}
