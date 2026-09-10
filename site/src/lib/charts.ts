// Pure data preparation for the ECharts islands; kept free of DOM and ECharts
// imports so it can be unit-tested and run at build time.
import type { ContributionsFile, ReleasesFile, RepoEntry } from '../../scripts/lib/schemas.ts';
import type { ReleaseSource } from './merge.ts';

export interface ReleasePoint { date: string; tag: string; url: string; name: string }
export interface ReleaseRow { name: string; repo: string; points: ReleasePoint[] }

/** One row per source that has releases and is not excluded, ordered by the date of its latest release (newest first). */
export function releaseTimeline(sources: ReleaseSource[], releases: ReleasesFile, exclude: Set<string> = new Set()): ReleaseRow[] {
  const rows: ReleaseRow[] = [];
  for (const s of sources) {
    if (exclude.has(s.repo)) continue;
    const list = releases.releases[s.repo] ?? [];
    if (list.length === 0) continue;
    rows.push({
      name: s.name,
      repo: s.repo,
      points: [...list]
        .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
        .map((r) => ({ date: r.publishedAt, tag: r.tag, url: r.htmlUrl, name: r.name })),
    });
  }
  return rows.sort((a, b) => b.points[b.points.length - 1].date.localeCompare(a.points[a.points.length - 1].date));
}

/** Contributions per calendar month, oldest first, from the daily calendar. */
export function monthlyContributions(contributions: ContributionsFile): { month: string; count: number }[] {
  const byMonth = new Map<string, number>();
  for (const w of contributions.weeks) for (const d of w.days) byMonth.set(d.date.slice(0, 7), (byMonth.get(d.date.slice(0, 7)) ?? 0) + d.count);
  return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
}

/** Repositories by stars, descending, at most `limit`, with the primary language; excluded repos are skipped. */
export function starsByRepo(
  repos: Record<string, RepoEntry>,
  limit = 15,
  exclude: Set<string> = new Set(),
): { name: string; stars: number; language: string | null; url: string }[] {
  return Object.values(repos)
    .filter((r) => r.stars > 0 && !exclude.has(r.fullName))
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, limit)
    .map((r) => ({ name: r.owner === 'matthiaskoenig' ? r.name : r.fullName, stars: r.stars, language: r.language, url: r.htmlUrl }));
}

/** Union of every group's `charts_exclude`. */
export function chartExclusions(groups: { charts_exclude: string[] }[]): Set<string> {
  return new Set(groups.flatMap((g) => g.charts_exclude));
}
