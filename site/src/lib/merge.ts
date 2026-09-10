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

/** The latest release of each project (projects without releases are skipped), rendered and summarised, newest first. */
export function mergeReleases(
  projects: Project[],
  releases: ReleasesFile,
  render: (md: string) => string,
  summarize: (md: string) => string = () => '',
): ReleaseView[] {
  const out: ReleaseView[] = [];
  for (const p of projects) {
    const latest = [...(releases.releases[p.repo] ?? [])].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    if (latest) out.push({ ...latest, projectId: p.id, projectName: p.name, bodyHtml: render(latest.body), summary: summarize(latest.body) });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
