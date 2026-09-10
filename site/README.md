# Site source for matthiaskoenig.github.io

This folder is the source of **https://matthiaskoenig.github.io**, a static
site about Matthias König's software and research software engineering work.
It is complementary to the lab site https://livermetabolism.com: the lab site
covers people, publications, projects and teaching; this site covers software,
GitHub activity, releases and a catalog of repositories.

Built with [Astro](https://astro.build) (static output), [Vue](https://vuejs.org)
islands for the interactive parts, and [Tailwind CSS](https://tailwindcss.com).
Deployed by GitHub Actions into the `matthiaskoenig.github.io` repository,
which GitHub Pages serves.

## How it works

```
src/content/*.yml            hand-curated content (projects, groups, research)
        │
        ▼
scripts/fetch-github.ts      GitHub REST + GraphQL  ──►  src/data/github/*.json
        │                                                (snapshots, gitignored)
        ▼
astro build                  merges YAML + snapshots, renders HTML + Vue islands
        │
        ▼
dist/                        pushed to matthiaskoenig/matthiaskoenig.github.io
```

1. **Curated content** lives in `src/content/`:
   - `projects.yml`: the six main projects shown as cards (PK-DB, sbmlutils,
     pymetadata, libsbgnpy, VisFEM, cy3sbml) with a description, links and tags.
   - `groups.yml`: every other repository, grouped by topic, for the catalog.
   - `research.yml`: a short overview of research interests linking to the lab site.

   All three are validated by zod schemas in `src/content/schemas.ts`; a typo
   fails the build with a clear message.

2. **GitHub data** is fetched at build time, not in the browser. `npm run fetch`
   reads the curated YAML, derives the set of repositories (projects ∪ groups),
   and queries the GitHub API for each: repository metadata, the latest three
   releases of each main project, the contribution calendar of the last year,
   aggregate statistics, and per main project the metadata kept in the
   repository itself: `CITATION.cff` (Zenodo DOI, version, license),
   `pyproject.toml` (supported Python versions, license) and the README's
   Zenodo badge as a fallback for the DOI. The results are written to
   `src/data/github/` as five JSON files (`repos.json`, `releases.json`,
   `contributions.json`, `stats.json`, `project-meta.json`), each validated
   against a schema before writing.

3. **The Astro build** (`npm run build`) loads the snapshots, merges them with the
   curated entries by `owner/name`, renders release notes from markdown to
   sanitised HTML, and produces `dist/`. Three Vue components are hydrated in
   the browser (contribution calendar, release feed with filter, repository
   catalog with search and sorting); they receive their data as props and never
   call the API. The release feed lists the latest release of each main
   project, newest first, with a summary of its notes.

4. **Deployment**: `.github/workflows/deploy.yml` runs on every push to `main`,
   every Monday (to refresh the GitHub data) and on demand. It runs fetch →
   test → build and pushes `dist/` to the `main` branch of
   `matthiaskoenig/matthiaskoenig.github.io`. If the fetch fails, the job stops
   before deploying, so the live site keeps its previous data.

## Branches and workflow

The repository follows the same model as sbmlutils and sbmlsim:

- `develop` is the default branch. Day-to-day work happens on feature branches
  and lands in `develop` through pull requests; the ruleset on `develop`
  requires a pull request with the `tests` and `build` checks green, a linear
  history, and squash or rebase merges (merged branches are deleted
  automatically).
- `main` is the deployed branch. Merging `develop` into `main` (a pull request,
  or a fast-forward push) triggers the *Deploy site* workflow. `main` and tags
  cannot be deleted or force-pushed.
- `.github/workflows/ci.yml` runs `tests` (vitest + astro check) and `build`
  (fetch + astro build) on every push and pull request.

## Local development

Requires Node ≥ 22.12 (the workflows use Node 24) and npm.

```bash
cd site
npm ci

# Option A: real data (needs a GitHub token, see below)
GITHUB_TOKEN=<token> npm run fetch

# Option B: offline, synthetic data for every repository in the YAML
npm run fetch:fixtures

npm run dev        # http://localhost:4321, live reload
npm test           # vitest
npm run check      # astro check (TypeScript + component props)
npm run build      # writes dist/
npm run preview    # serves dist/ locally
```

Without snapshot files the build fails with
`Missing snapshot ... Run npm run fetch ... or npm run fetch:fixtures`.

**GitHub token.** Create a fine-grained personal access token at
https://github.com/settings/personal-access-tokens with *Public repositories
(read-only)* access; no other permissions are needed. In GitHub Actions the
default `GITHUB_TOKEN` is used automatically.

## Editing content

| Change | Where | Then |
|---|---|---|
| Add or edit a main project | `src/content/projects.yml` (logo file goes to `src/assets/projects/`) | `npm run fetch` |
| Add a repository to the catalog | `src/content/groups.yml` | `npm run fetch` |
| Change the research overview | `src/content/research.yml` | rebuild |
| Change texts in the hero, footer, imprint | `src/components/Hero.astro`, `Footer.astro`, `src/pages/impressum.astro` | rebuild |
| DOI, license, Python versions of a project | `CITATION.cff` / `pyproject.toml` in that project's repository | `npm run fetch` |
| Colours, fonts | `src/styles/global.css` (`@theme` block) | rebuild |

A repository that no longer exists on GitHub makes the fetch fail with its
name; remove it from the YAML. A repository must not be listed both as a
project and in a group.

## Layout

```
astro.config.mjs        Astro config: site URL, Vue integration, Tailwind plugin
src/content.config.ts   registers the three YAML files as content collections
src/content/            curated YAML + schemas.ts
src/data/github/        snapshots (gitignored)
src/lib/                github-data.ts (load + validate snapshots),
                        merge.ts (YAML ⨯ snapshots), markdown.ts (release notes)
src/layouts/Base.astro  html shell with nav and footer
src/pages/              index.astro (single page, anchored sections), impressum.astro
src/components/         *.astro static sections, *.vue islands
src/styles/global.css   Tailwind import, theme tokens, fonts
scripts/                fetch-github.ts, make-fixture-data.ts, lib/ (pure functions)
tests/                  vitest suites; fixtures/ holds recorded API responses
public/                 favicon, .nojekyll
```

## Tests

`npm test` covers the pure parts: schema validation of the curated YAML,
derivation of the repository list, transformation of recorded API responses
into the snapshot shapes, statistics, the retry behaviour of the API client
(with a fake `fetch`), markdown sanitising, and the merge functions. The Vue
islands are covered by `npm run check` and the build; there are no component
tests yet.

## Deployment setup (done once, 2026-09-10)

The deploy works through an SSH deploy key. If it ever has to be rotated:

1. Create an SSH key pair: `ssh-keygen -t ed25519 -C pages-deploy -f pages-deploy -N ''`.
2. In `matthiaskoenig/matthiaskoenig.github.io` → Settings → Deploy keys, add
   `pages-deploy.pub` with **write access** (replace the existing key).
3. In `matthiaskoenig/matthiaskoenig` → Settings → Secrets → Actions, store the
   private key as `PAGES_DEPLOY_KEY`.
4. `matthiaskoenig.github.io` → Settings → Pages serves branch `main`, folder
   `/`. The Action pushes with `force_orphan: true`, so the target branch always
   holds a single commit with the current build; its `README.md` (from
   `public/README.md`) points back to this source repository.

## Troubleshooting

- **`Missing snapshot`** during build: run `npm run fetch` or `npm run fetch:fixtures`.
- **`GitHub 404 for /repos/...`** during fetch: the repository was renamed or
  deleted; fix `src/content/*.yml`.
- **`GitHub 403`** repeatedly: rate limit. Unauthenticated requests are not
  supported; make sure `GITHUB_TOKEN` is set. The client retries three times
  with backoff.
- **`No snapshot entry for ...`** during build: the YAML changed after the last
  fetch; run `npm run fetch` again.
