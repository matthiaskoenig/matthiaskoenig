# GitHub profile site — design

Date: 2026-09-10
Status: approved in brainstorming, awaiting implementation plan

## Goal

Replace the 2015-era Jekyll site at https://matthiaskoenig.github.io with a
static Astro site whose source lives in this repository
(`matthiaskoenig/matthiaskoenig`, the GitHub profile repository). The site
presents Matthias König's software and research software engineering work:
the main open-source projects, GitHub activity, release news, a grouped
catalog of all repositories, and a short overview of research interests.

It is complementary to https://livermetabolism.com (the lab site, source in
`../livermetabolism-site`): the lab site covers people, publications,
projects and teaching; this site covers software and GitHub contributions.

## Non-goals (first version)

- Site search, dark mode, RSS feed for releases.
- Publications, people, teaching (stay on livermetabolism.com).
- Community/standards contributions (SBML/SED-ML editor roles etc.).
- Live browser-side GitHub API calls.
- Emptying the old `matthiaskoenig.github.io` repository — done by hand
  after the first successful deploy.

## Decisions taken

| Question | Decision |
|---|---|
| URL | Keep `https://matthiaskoenig.github.io`. Source and CI live here; the Action pushes the built site into the `matthiaskoenig.github.io` repository, which becomes a pure deploy target. |
| GitHub data | Fetched at build time by a script; site rebuilt weekly and on push. No browser-side API calls. |
| Contribution scope | GitHub activity (calendar, totals, stars, languages) plus a hand-curated repository catalog, plus release news from the curated repositories. |
| Research text | Curated subset copied into this repo, with a link to livermetabolism.com. No cross-repo build dependency. |
| Look | Visually related to livermetabolism.com (colours, fonts, banner), implemented with plain CSS and Tailwind. No Bootstrap. |
| Stack | Astro 7 + `@astrojs/vue` (Vue 3 islands) + Tailwind 4 via `@tailwindcss/vite`. Vitest for tests. Node 24. |

## Repository layout

```
README.md                       profile README (unchanged role; gains a link to the site)
CLAUDE.md                       guidance for Claude Code
docs/superpowers/specs/         design docs
images/banner.png               existing banner, reused by the site
.github/workflows/deploy.yml    fetch → build → deploy to matthiaskoenig.github.io
.github/workflows/ci.yml        test + build on pull requests (no deploy)
site/                           the Astro project
  package.json
  astro.config.mjs
  src/
    content.config.ts           content collections + zod schemas
    content/
      projects.yml              six main projects (curated)
      groups.yml                grouped catalog of the other repos (curated)
      research.yml              research interest areas (curated)
    data/github/                fetched JSON snapshots (gitignored)
      repos.json
      releases.json
      contributions.json
      stats.json
    layouts/Base.astro
    pages/
      index.astro               single page with anchored sections
      impressum.astro           imprint / privacy (site served from Germany)
    components/                 .astro (static) and .vue (islands)
    styles/global.css           Tailwind import + theme tokens
  scripts/
    fetch-github.ts             GitHub REST + GraphQL fetcher
    lib/                        pure functions used by the fetcher (tested)
  tests/
    fixtures/                   recorded API responses
    *.test.ts
```

The Astro project lives in `site/` so the repository root stays a readable
profile repo.

## Curated content (`site/src/content/*.yml`)

All three files are validated by zod schemas in `content.config.ts`; a
schema violation fails the build.

### `projects.yml` — main projects

One entry per main project, in display order:
`pkdb`, `visfem`, `libsbgnpy`, `sbmlutils`, `pymetadata`, `cy3sbml`.

```yaml
- id: sbmlutils
  name: sbmlutils
  repo: matthiaskoenig/sbmlutils     # owner/name, key into repos.json
  title: Python utilities for SBML
  description: >-                    # one paragraph, copied/adapted from livermetabolism-site
    ...
  homepage: https://github.com/matthiaskoenig/sbmlutils
  doi: 10.5281/zenodo.597149         # optional
  tags: [Open & FAIR, Digital Twins] # free strings, used for badges and filtering
  image: sbmlutils.webp              # optional, under site/src/assets/projects/
```

### `groups.yml` — repository catalog

Grouped list of the remaining repositories, seeded from the old site
(`../matthiaskoenig.github.io/index.md`) and pruned of dead or archived
repositories at implementation time.

```yaml
- id: cytoscape
  name: Cytoscape apps
  description: Visualisation of SBML and flux data in Cytoscape.
  repos:
    - matthiaskoenig/cy3sbml
    - matthiaskoenig/cy3fluxviz
- id: liver-models
  name: Liver and PBPK models
  repos: [...]
```

Repos may belong to organisations other than `matthiaskoenig` (e.g.
`sys-bio/roadrunner`). Groups: standards, Cytoscape apps, Python libraries,
liver and PBPK models, whole-cell, other. Main projects are not repeated
here; the catalog lists everything else.

### `research.yml` — research interests

Three to four areas, each with `id`, `name`, `icon` (optional), one
paragraph `description`, and `link` into livermetabolism.com. Seeded from
the lab site's tags and homepage text: digital twins / PBPK, pharmacometrics
and PK-DB, open & FAIR research software, standards (SBML, SED-ML, SBGN).

## Fetched data (`site/scripts/fetch-github.ts`)

Run as `npm run fetch` inside `site/`. Requires `GITHUB_TOKEN` in the
environment (the Action's default token is sufficient; locally a
fine-grained PAT with public read scope). Writes the four JSON files below
to `site/src/data/github/`, each with a top-level `fetchedAt` ISO timestamp.

The list of repositories to fetch is the union of `projects[].repo` and
`groups[].repos[]` read from the curated YAML, so the fetcher and the site
can never disagree about which repositories exist.

| File | Source | Content |
|---|---|---|
| `repos.json` | REST `GET /repos/{owner}/{repo}` | keyed by `owner/name`: description, html_url, homepage, stars, forks, open issues, primary language, topics, license, pushed_at, archived flag |
| `releases.json` | REST `GET /repos/{owner}/{repo}/releases?per_page=3` for main projects only | keyed by `owner/name`: up to three latest releases with tag, name, published_at, html_url, body (markdown) |
| `contributions.json` | GraphQL `user(login).contributionsCollection` for the last 365 days | calendar (weeks → days with date, count, level), totalCommitContributions, totalPullRequestContributions, totalIssueContributions, restrictedContributionsCount |
| `stats.json` | derived from `repos.json` | repo count, total stars, total forks, language byte totals across the listed repos, most recently pushed repos (top 5) |

Behaviour:

- Requests are made with a small concurrency limit (4) and retried with
  backoff on HTTP 403/429 (rate limit) and 5xx, up to three attempts.
- A repository that returns 404 is reported by name and fails the run; the
  curated YAML should be fixed rather than silently dropping the repo.
- Every response is parsed through a zod schema before being written, so an
  API shape change fails fetch rather than producing a broken page.
- Exit code is non-zero on any failure; nothing is written on failure
  (write to temp files, rename at the end).
- Pure transformation functions (`lib/`) take parsed API responses and
  return the file shapes; these are unit-tested with recorded fixtures.
  Network calls live in one thin module.

## Site structure

Single page (`index.astro`) with anchored sections, plus `impressum.astro`.
Static Astro components render everything that does not need interaction;
Vue islands are used only where noted.

| Section | Anchor | Rendering |
|---|---|---|
| Hero | top | banner image, name, one-line tagline, links to GitHub, ORCID, livermetabolism.com |
| Research interests | `#research` | static cards from `research.yml` |
| Main projects | `#projects` | static cards from `projects.yml` merged with `repos.json` (stars, language, last push) |
| Contributions | `#contributions` | Vue island `ContributionCalendar.vue` (heat-map with hover tooltip per day) + static stat tiles from `stats.json` (repos, stars, commits last year, language bar) |
| Latest releases | `#releases` | Vue island `ReleaseFeed.vue`: releases from all main projects merged and sorted by date, project filter chips, expandable release notes |
| Repository catalog | `#repositories` | Vue island `RepoCatalog.vue`: grouped list from `groups.yml` merged with `repos.json`; text filter, sort by name / stars / last push, group toggle |
| Footer | — | links, imprint, "data fetched on <fetchedAt>" |

Release notes are GitHub-flavoured markdown; they are rendered to HTML at
build time (Astro side, e.g. with `marked`) and passed to the island as
sanitised HTML, so the island stays small and no markdown parser ships to
the browser.

Islands receive their data as props from Astro at build time; there is no
client-side fetching. Islands use `client:visible` so the page stays fast.

## Styling

Tailwind 4 via the Vite plugin. Theme tokens in `global.css` (`@theme`)
define the colour palette and fonts taken from livermetabolism-site's
`main.scss`, so the two sites share a family look. Layout is responsive
(single column below ~768px). Semantic HTML, focus-visible styles, and
sufficient contrast are required; the contribution calendar has a text
alternative (totals) for screen readers.

## Deployment

`.github/workflows/deploy.yml`:

- Triggers: `push` to `main`, `schedule` weekly (Monday 04:00 UTC),
  `workflow_dispatch`.
- Steps: checkout → setup Node 24 → `npm ci` → `npm run fetch`
  (`GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`) → `npm test` →
  `npm run build` → deploy.
- Deploy: `peaceiris/actions-gh-pages` with `external_repository:
  matthiaskoenig/matthiaskoenig.github.io`, `publish_branch: main`,
  `publish_dir: site/dist`, `deploy_key: ${{ secrets.PAGES_DEPLOY_KEY }}`.
  The deploy key pair is created once: private key as a secret here, public
  key as a write-enabled deploy key on the target repository.
- Because fetch runs before build and the job fails on fetch error, a failed
  scheduled run leaves the previous deployment in place; the site never
  regresses to empty data.

`.github/workflows/ci.yml` runs on pull requests: `npm ci`, `npm test`,
`npm run fetch`, `npm run build`. No deploy.

The target repository needs GitHub Pages configured to serve from `main`
(root). A `.nojekyll` file is included in `dist/` so Pages does not run
Jekyll on the output. Astro's `site` is set to
`https://matthiaskoenig.github.io` with `base: '/'`.

## Local development

```bash
cd site
npm ci
GITHUB_TOKEN=... npm run fetch   # once; snapshots are gitignored
npm run dev                      # http://localhost:4321
npm test
npm run build && npm run preview
```

Without snapshots the build fails with a message pointing to `npm run
fetch`. A small committed fixture set under `site/tests/fixtures/` is used
by the tests, not by the site.

## Testing

- Vitest unit tests for `scripts/lib/*`: transformation of recorded REST /
  GraphQL fixtures into the four file shapes; aggregation of stats; merging
  and sorting of releases; repository list derivation from the curated YAML.
- Schema tests: the three curated YAML files parse against their zod
  schemas; every `projects[].repo` and `groups[].repos[]` entry is
  `owner/name`; no repo appears in both projects and groups.
- Build check: `astro check` and `astro build` run in CI.
- Islands are kept thin (presentation of pre-computed props) and are covered
  by the build and a manual check, not by component tests, in the first
  version.

## First prototype scope

Everything above, with real data: six project cards, research section,
contribution calendar with stats, release feed, grouped catalog, imprint,
deploy workflow, CI workflow, and `CLAUDE.md`. The README gains a link to
the site. Emptying the old repository and creating the deploy key are
manual follow-ups documented in `CLAUDE.md`.
