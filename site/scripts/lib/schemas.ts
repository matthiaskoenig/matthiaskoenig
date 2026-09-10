import { z } from 'astro/zod';

// ---------------------------------------------------------------------------
// GitHub API shapes (only the fields the site uses). Parsing responses
// through these makes an API change fail the fetch instead of the page.
// ---------------------------------------------------------------------------
export const apiRepoSchema = z.object({
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable(),
  html_url: z.string(),
  homepage: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  language: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  license: z.object({ spdx_id: z.string().nullable() }).nullable(),
  pushed_at: z.string(),
  archived: z.boolean(),
});

export const apiReleaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable(),
  published_at: z.string().nullable(),
  html_url: z.string(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

export const graphqlContributionsSchema = z.object({
  data: z.object({
    user: z.object({
      contributionsCollection: z.object({
        totalCommitContributions: z.number(),
        totalPullRequestContributions: z.number(),
        totalIssueContributions: z.number(),
        totalPullRequestReviewContributions: z.number(),
        restrictedContributionsCount: z.number(),
        contributionCalendar: z.object({
          totalContributions: z.number(),
          weeks: z.array(
            z.object({
              contributionDays: z.array(
                z.object({
                  date: z.string(),
                  contributionCount: z.number(),
                  contributionLevel: z.enum(['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE']),
                }),
              ),
            }),
          ),
        }),
      }),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Snapshot files written to src/data/github/ and read by the Astro build.
// ---------------------------------------------------------------------------
export const repoEntrySchema = z.object({
  fullName: z.string(),
  name: z.string(),
  owner: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string(),
  homepage: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  openIssues: z.number(),
  language: z.string().nullable(),
  topics: z.array(z.string()),
  license: z.string().nullable(),
  pushedAt: z.string(),
  archived: z.boolean(),
});
export const reposFileSchema = z.object({
  fetchedAt: z.string(),
  repos: z.record(z.string(), repoEntrySchema),
});

export const releaseEntrySchema = z.object({
  repo: z.string(),
  tag: z.string(),
  name: z.string(),
  publishedAt: z.string(),
  htmlUrl: z.string(),
  body: z.string(),
  prerelease: z.boolean(),
});
export const releasesFileSchema = z.object({
  fetchedAt: z.string(),
  releases: z.record(z.string(), z.array(releaseEntrySchema)),
});

export const contributionsFileSchema = z.object({
  fetchedAt: z.string(),
  login: z.string(),
  from: z.string(),
  to: z.string(),
  totals: z.object({
    commits: z.number(),
    pullRequests: z.number(),
    issues: z.number(),
    reviews: z.number(),
    restricted: z.number(),
    calendar: z.number(),
  }),
  weeks: z.array(
    z.object({
      days: z.array(z.object({ date: z.string(), count: z.number(), level: z.number().int().min(0).max(4) })),
    }),
  ),
});

export const statsFileSchema = z.object({
  fetchedAt: z.string(),
  repoCount: z.number(),
  totalStars: z.number(),
  totalForks: z.number(),
  languages: z.array(z.object({ name: z.string(), repos: z.number(), share: z.number() })),
  recentlyPushed: z.array(z.object({ fullName: z.string(), pushedAt: z.string() })),
});

export type ApiRepo = z.infer<typeof apiRepoSchema>;
export type ApiRelease = z.infer<typeof apiReleaseSchema>;
export type GraphqlContributions = z.infer<typeof graphqlContributionsSchema>;
export type RepoEntry = z.infer<typeof repoEntrySchema>;
export type ReposFile = z.infer<typeof reposFileSchema>;
export type ReleaseEntry = z.infer<typeof releaseEntrySchema>;
export type ReleasesFile = z.infer<typeof releasesFileSchema>;
export type ContributionsFile = z.infer<typeof contributionsFileSchema>;
export type StatsFile = z.infer<typeof statsFileSchema>;
