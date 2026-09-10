# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Two things in one repository:

1. `README.md` is the **GitHub profile README** of `matthiaskoenig` (rendered
   on https://github.com/matthiaskoenig). Keep it a short, hand-written
   profile; it is not generated.
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
    `groups.yml` (grouped catalog of all other repos), `research.yml`
    (research interest areas).
  - `src/data/github/*.json` — **gitignored** snapshots written by
    `npm run fetch` (`repos.json`, `releases.json`, `contributions.json`,
    `stats.json`). The build fails without them.
  - `src/pages/index.astro` — single page with anchored sections;
    `impressum.astro` — imprint.
  - `src/components/*.astro` — static parts; `*.vue` — the three islands
    (`ContributionCalendar`, `ReleaseFeed`, `RepoCatalog`). Islands only
    present props computed at build time; they never fetch.
  - `scripts/fetch-github.ts` — GitHub REST + GraphQL fetcher;
    `scripts/lib/` — pure transformation functions (unit-tested).
  - `tests/` — Vitest, with recorded API responses in `tests/fixtures/`.
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
purpose; fix or remove it in the YAML. Releases are fetched for main
projects only.

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

## One-time setup (manual, not yet done)

1. Create an SSH key pair. Add the public key as a deploy key with write
   access on `matthiaskoenig/matthiaskoenig.github.io`; add the private key
   as the secret `PAGES_DEPLOY_KEY` in this repository.
2. In `matthiaskoenig.github.io`, set GitHub Pages to serve from branch
   `main`, root. After the first successful deploy the old Jekyll files are
   overwritten by the Action; remove any leftovers by hand.
3. Merge the `feat/astro-site` branch into `main` (the deploy workflow only
   runs on `main`).
