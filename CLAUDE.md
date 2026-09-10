# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Two things in one repository:

1. `README.md` is the **GitHub profile README** of `matthiaskoenig` (rendered
   on https://github.com/matthiaskoenig). It is **generated** by
   `site/scripts/render-readme.ts` (template: `site/scripts/lib/readme.ts`)
   from the same curated YAML and snapshots as the site; never edit it by
   hand. `npm run readme` (in `site/`, after `npm run fetch`) regenerates it;
   the *Update profile README* workflow does the same weekly on `develop`,
   pushing with the `README_DEPLOY_KEY` deploy key (deploy keys bypass the
   develop ruleset).
2. `site/` is the **source of https://matthiaskoenig.github.io**, a static
   Astro site about Matthias König's software and research software
   engineering work. It replaces the old Jekyll site that lived in the
   `matthiaskoenig.github.io` repository; that repository is now only the
   deploy target.

The site is complementary to https://livermetabolism.com (source:
`../livermetabolism-site`, Jekyll). The lab site owns people, publications,
projects, teaching; this site owns software, GitHub activity, releases and
the repository catalog. Do not duplicate lab content here; link to it.

Design spec: `docs/superpowers/specs/2026-09-10-github-profile-site-design.md`.

## Layout

- `site/` — Astro 7 + Vue 3 islands + Tailwind 4 (`@tailwindcss/vite`), Node 24.
  - `src/content/*.yml` — hand-curated content, validated by zod schemas in
    `src/content.config.ts`: `projects.yml` (six main projects),
    `groups.yml` (grouped catalog of all other repos; `charts_exclude` per
    group hides repos from the charts), `research.yml`
    (research interest areas).
  - `src/data/github/*.json` — **gitignored** snapshots written by
    `npm run fetch` (`repos.json`, `releases.json`, `contributions.json`,
    `stats.json`, `project-meta.json`). The build fails without them.
    `project-meta.json` (DOI, license, Python versions, version) is parsed
    from `CITATION.cff`, `pyproject.toml` and the README of each main
    project's default branch (`scripts/lib/project-meta.ts`).
  - `src/pages/index.astro` — single page with anchored sections;
    `impressum.astro` — imprint.
  - `src/components/*.astro` — static parts; `*.vue` — the islands
    (`ContributionCalendar`, `ReleaseFeed`, `RepoCatalog`, and the ECharts
    plots `ReleaseTimeline`, `ContributionsChart`, `StarsChart` built on
    `useChart.ts`, data prepared in `src/lib/charts.ts`). Islands only
    present props computed at build time; they never fetch.
  - `research.yml` holds the five lab topics (tag, icon, colour as on
    livermetabolism.com); project tags must match a topic (tested).
  - `scripts/fetch-github.ts` — GitHub REST + GraphQL fetcher;
    `scripts/lib/` — pure transformation functions (unit-tested).
  - `tests/` — Vitest, with recorded API responses in `tests/fixtures/`.
- `.github/workflows/update-readme.yml` — weekly: fetch → `npm run readme`
  → commit README to `develop`.
- `.github/workflows/deploy.yml` — fetch → test → build → push `site/dist`
  to `matthiaskoenig/matthiaskoenig.github.io` (weekly, on push to main,
  manual). `ci.yml` — test + build on pull requests.
- `images/` — banner used by both the README and the site.

## Commands

All inside `site/`:

```bash
npm ci
GITHUB_TOKEN=<token> npm run fetch   # writes src/data/github/*.json; needs public read scope
npm run fetch:fixtures               # offline alternative: synthetic snapshots for every curated repo
npm run dev                          # http://localhost:4321
npm test                             # vitest
npm run check                        # astro check
npm run build && npm run preview
```

In GitHub Actions the default `GITHUB_TOKEN` is enough for the fetch.

## Data flow

The set of repositories the fetcher queries is derived from the curated YAML
(`projects[].repo` ∪ `groups[].repos[]`), so add a repository by editing the
YAML, then re-run `npm run fetch`. A repository that 404s fails the fetch on
purpose; fix or remove it in the YAML. Releases (last ten per repo) are
fetched for every repository, project metadata for main projects only. The
feed shows each repository once with its latest release if it is less than
two years old; the cards show the latest release of each main project.

Astro merges curated entries with the snapshot by `owner/name` key at build
time and passes plain data to the islands as props. `src/lib/github-data.ts`
resolves the snapshot directory from the working directory (npm scripts run
from `site/`), because `import.meta.url` points into `dist/` once bundled.

Language statistics count the primary language per repository (from the repo
response) rather than byte totals; the languages endpoint is not called.

## Conventions

- Zod always comes from `astro/zod` (zod 4), never a separate `zod` package,
  so the same schemas work in content collections, scripts and tests.
- Scripts run natively under Node 24 (`node scripts/foo.ts`): no enums, no
  `namespace`, no parameter properties in constructors, relative imports with
  `.ts` extension, `import type` for types.
- Curated content changes go in `src/content/*.yml`; text about research
  interests is a deliberately short copy of the lab site, not synced from
  it.
- Fetcher: network code in one thin module, everything else pure functions
  with tests against fixtures. Every API response is parsed through zod
  before use.
- Styling: Tailwind utilities plus theme tokens in `src/styles/global.css`
  (colours/fonts follow livermetabolism.com). No Bootstrap, no CSS
  frameworks beyond Tailwind.
- Islands use `client:visible`. Keep them thin; markdown (release notes) is
  rendered to HTML at build time, not in the browser.
- The deploy job must fail if fetch fails so the live site never regresses
  to empty data.
- Do not add tracking scripts. The imprint page documents what is collected
  (nothing beyond GitHub Pages' own logs).

Developer documentation for humans is `site/README.md`; keep the two in sync
when commands or layout change.

## Branch model

Same as sbmlutils and sbmlsim, enforced by GitHub rulesets: `develop` is the
default branch and takes pull requests only (checks `tests` and `build` from
`ci.yml`, linear history, squash/rebase merge, branch deleted after merge);
`main` is the deployed branch and is updated by merging `develop` into it,
which triggers `deploy.yml`; `main` and tags cannot be deleted or
force-pushed. Feature work: branch from `develop`, open a PR against
`develop`. Do not commit directly to `develop` or `main`.

The deploy key, the `PAGES_DEPLOY_KEY` secret and the Pages configuration
of `matthiaskoenig.github.io` (branch `main`, root) were set up on
2026-09-10; `site/README.md` documents how to rotate the key.
