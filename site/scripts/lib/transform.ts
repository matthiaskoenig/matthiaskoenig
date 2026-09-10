import type { ApiRelease, ApiRepo, ContributionsFile, GraphqlContributions, ReleaseEntry, RepoEntry, StatsFile } from './schemas.ts';

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 } as const;

export function toRepoEntry(api: ApiRepo): RepoEntry {
  return {
    fullName: api.full_name,
    name: api.name,
    owner: api.owner.login,
    description: api.description,
    htmlUrl: api.html_url,
    homepage: api.homepage || null,
    stars: api.stargazers_count,
    forks: api.forks_count,
    openIssues: api.open_issues_count,
    language: api.language,
    topics: api.topics,
    license: api.license?.spdx_id && api.license.spdx_id !== 'NOASSERTION' ? api.license.spdx_id : null,
    pushedAt: api.pushed_at,
    archived: api.archived,
  };
}

/** Published, non-draft releases of one repo, newest first, at most three. */
export function toReleaseEntries(repo: string, api: ApiRelease[]): ReleaseEntry[] {
  return api
    .filter((r) => !r.draft && r.published_at)
    .map((r) => ({
      repo,
      tag: r.tag_name,
      name: r.name?.trim() || r.tag_name,
      publishedAt: r.published_at as string,
      htmlUrl: r.html_url,
      body: r.body ?? '',
      prerelease: r.prerelease,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
}

export function toContributions(g: GraphqlContributions, login: string, from: string, to: string, fetchedAt: string): ContributionsFile {
  const c = g.data.user.contributionsCollection;
  return {
    fetchedAt,
    login,
    from,
    to,
    totals: {
      commits: c.totalCommitContributions,
      pullRequests: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      reviews: c.totalPullRequestReviewContributions,
      restricted: c.restrictedContributionsCount,
      calendar: c.contributionCalendar.totalContributions,
    },
    weeks: c.contributionCalendar.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] })),
    })),
  };
}

/** Aggregates over all fetched repos: totals, primary-language counts, most recently pushed. */
export function computeStats(repos: Record<string, RepoEntry>, fetchedAt: string): StatsFile {
  const list = Object.values(repos);
  const byLang = new Map<string, number>();
  for (const r of list) if (r.language) byLang.set(r.language, (byLang.get(r.language) ?? 0) + 1);
  const withLang = list.filter((r) => r.language).length;
  const languages = [...byLang.entries()]
    .map(([name, repos]) => ({ name, repos, share: withLang ? repos / withLang : 0 }))
    .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name));
  const recentlyPushed = [...list]
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, 5)
    .map((r) => ({ fullName: r.fullName, pushedAt: r.pushedAt }));
  return {
    fetchedAt,
    repoCount: list.length,
    totalStars: list.reduce((n, r) => n + r.stars, 0),
    totalForks: list.reduce((n, r) => n + r.forks, 0),
    languages,
    recentlyPushed,
  };
}
