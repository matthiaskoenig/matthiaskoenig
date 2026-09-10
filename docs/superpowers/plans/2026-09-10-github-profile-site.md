# GitHub Profile Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Astro site under `site/` that replaces matthiaskoenig.github.io, with a GitHub data fetcher, curated content, Vue islands, tests, and deploy/CI workflows.

**Architecture:** A TypeScript fetch script (run natively by Node 24) queries the GitHub REST and GraphQL APIs and writes four JSON snapshots into a gitignored folder. Astro reads curated YAML through content collections and the snapshots through a small loader, merges them at build time, and passes plain props to three Vue islands. A GitHub Action runs fetch → test → build and pushes `site/dist` to the `matthiaskoenig.github.io` repository.

**Tech Stack:** Astro 7.3, @astrojs/vue 7, Vue 3.5, Tailwind 4 (`@tailwindcss/vite`), Vitest 5, `astro/zod` (zod 4), `js-yaml`, `marked`, `sanitize-html`, Node 24, npm.

**Spec:** `docs/superpowers/specs/2026-09-10-github-profile-site-design.md`

## Global Constraints

- Node `>=22.12` (we use 24); npm. `site/package.json` has `"type": "module"` so Node runs `.ts` scripts natively (no enums, no `namespace`, relative imports carry the `.ts` extension, type-only imports use `import type`).
- Zod always comes from `astro/zod` (v4), never from a separate `zod` package, so schemas work in content collections, scripts and tests alike.
- Snapshots live in `site/src/data/github/` and are gitignored. The build fails with a message pointing to `npm run fetch` when they are missing.
- The repository set the fetcher queries is derived from `projects.yml` ∪ `groups.yml`. A 404 fails the fetch.
- Islands never fetch; they receive props computed at build time and use `client:visible`.
- Release-note markdown is rendered and sanitised at build time.
- No third-party tracking. Fonts are self-hosted via `@fontsource`.
- Colours/fonts: primary `#2c3e50`, accent `#18bc9c`, info `#3498db`, warning `#f39c12`, danger `#e74c3c`, gray-200 `#ecf0f1`, gray-600 `#95a5a6`, gray-900 `#212529`; display font "Source Serif 4", brand font "Space Grotesk", body system sans.
- Spec deviation (agreed here): language statistics use the **primary language per repository** (count of repos), not byte totals; the languages endpoint is not called, which halves the request count and avoids docs-HTML skew.
- Commit after every task with the attribution trailer given in the session.

## File structure

```
site/
  package.json, astro.config.mjs, tsconfig.json, .gitignore
  README.md                                developer docs (how to run, what happens)
  src/styles/global.css                    Tailwind import + @theme tokens + fonts
  src/content.config.ts                    collections: projects, groups, research (file loader)
  src/content/schemas.ts                   zod schemas for the three YAML files (shared with tests)
  src/content/projects.yml | groups.yml | research.yml
  src/data/github/                         gitignored snapshots
  src/lib/github-data.ts                   loadGithubData(): reads + validates the four snapshots
  src/lib/markdown.ts                      renderMarkdown(md): marked + sanitize-html
  src/lib/merge.ts                         mergeProjects(), mergeGroups(), mergeReleases()
  src/layouts/Base.astro
  src/pages/index.astro | impressum.astro
  src/components/Nav.astro Hero.astro Section.astro ResearchSection.astro
                 ProjectCard.astro ProjectsSection.astro StatTiles.astro
                 ContributionsSection.astro ReleasesSection.astro
                 RepositoriesSection.astro Footer.astro
  src/components/ContributionCalendar.vue ReleaseFeed.vue RepoCatalog.vue
  scripts/fetch-github.ts                  orchestration + file writing
  scripts/make-fixture-data.ts             synthetic snapshots for offline dev
  scripts/lib/schemas.ts                   zod schemas of API responses and snapshot files
  scripts/lib/repo-list.ts                 repoListFromContent()
  scripts/lib/transform.ts                 toRepoEntry(), toReleaseEntry(), toContributions(), computeStats()
  scripts/lib/github-client.ts             GitHubClient with retry/backoff
  tests/fixtures/rest-repo.json rest-releases.json graphql-contributions.json
  tests/*.test.ts
.github/workflows/deploy.yml, ci.yml
```

---

### Task 1: Scaffold the Astro project

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/.gitignore`, `site/src/styles/global.css`, `site/src/layouts/Base.astro`, `site/src/pages/index.astro`, `site/vitest.config.ts`, `site/tests/smoke.test.ts`

**Interfaces:**
- Produces: `Base.astro` layout with props `{ title: string; description?: string }` and a default slot; global theme tokens `--color-primary`, `--color-accent`, `--color-info`, `--color-warning`, `--color-danger`, `--color-surface`, `--color-muted`, `--color-ink`, `--font-display`, `--font-brand`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "matthiaskoenig-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "fetch": "node scripts/fetch-github.ts",
    "fetch:fixtures": "node scripts/make-fixture-data.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/vue": "^7.0.2",
    "@fontsource-variable/source-serif-4": "^5.3.0",
    "@fontsource/space-grotesk": "^5.3.0",
    "@tailwindcss/vite": "^4.3.3",
    "astro": "^7.3.2",
    "js-yaml": "^5.4.1",
    "marked": "^18.0.12",
    "sanitize-html": "^2.17.7",
    "tailwindcss": "^4.3.3",
    "vue": "^3.5.42"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "@types/js-yaml": "^4.0.9",
    "@types/sanitize-html": "^2.16.1",
    "typescript": "^5.9.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create astro.config.mjs, tsconfig.json, .gitignore, vitest.config.ts**

```js
// site/astro.config.mjs
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://matthiaskoenig.github.io',
  base: '/',
  integrations: [vue()],
  vite: { plugins: [tailwindcss()] },
});
```

```json
// site/tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": { "allowImportingTsExtensions": true, "noEmit": true }
}
```

```
# site/.gitignore
node_modules/
dist/
.astro/
src/data/github/
```

```ts
// site/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 3: Create global.css with theme tokens and fonts**

```css
/* site/src/styles/global.css */
@import "tailwindcss";
@import "@fontsource-variable/source-serif-4";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";

@theme {
  --color-primary: #2c3e50;
  --color-accent: #18bc9c;
  --color-info: #3498db;
  --color-warning: #f39c12;
  --color-danger: #e74c3c;
  --color-surface: #ecf0f1;
  --color-muted: #95a5a6;
  --color-ink: #212529;
  --font-display: "Source Serif 4 Variable", Georgia, "Times New Roman", serif;
  --font-brand: "Space Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

html { scroll-behavior: smooth; }
body { @apply bg-white text-ink; }
h1, h2, h3 { @apply font-display; }
```

- [ ] **Step 4: Create Base.astro and a placeholder index.astro**

```astro
---
// site/src/layouts/Base.astro
import '../styles/global.css';
interface Props { title: string; description?: string }
const { title, description = 'Matthias König – software and research software engineering' } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body class="min-h-screen flex flex-col">
    <slot />
  </body>
</html>
```

```astro
---
// site/src/pages/index.astro
import Base from '../layouts/Base.astro';
---
<Base title="Matthias König">
  <main class="flex-1 px-4"><h1 class="text-3xl">Matthias König</h1></main>
</Base>
```

- [ ] **Step 5: Smoke test and install**

```ts
// site/tests/smoke.test.ts
import { expect, test } from 'vitest';
test('vitest runs', () => { expect(1 + 1).toBe(2); });
```

Run: `cd site && npm install && npm test && npm run build`
Expected: test passes; build writes `site/dist/index.html`.

- [ ] **Step 6: Commit** — `git add site && git commit -m "Scaffold Astro site with Vue and Tailwind"` (package-lock.json included).

---

### Task 2: Curated content schemas and YAML files

**Files:**
- Create: `site/src/content/schemas.ts`, `site/src/content.config.ts`, `site/src/content/projects.yml`, `site/src/content/groups.yml`, `site/src/content/research.yml`
- Test: `site/tests/content.test.ts`

**Interfaces:**
- Produces: `repoRef` (zod string `owner/name`), `projectSchema`, `groupSchema`, `researchSchema` and types `Project`, `Group`, `Research` exported from `src/content/schemas.ts`; `loadCuratedYaml(dir)` returning `{ projects: Project[]; groups: Group[]; research: Research[] }` (used by tests and by the fetcher's repo-list module).

- [ ] **Step 1: Write the failing test**

```ts
// site/tests/content.test.ts
import { describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadCuratedYaml } from '../src/content/schemas.ts';

const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));

describe('curated content', () => {
  test('all three files parse against their schemas', () => {
    const c = loadCuratedYaml(contentDir);
    expect(c.projects.length).toBe(6);
    expect(c.groups.length).toBeGreaterThan(0);
    expect(c.research.length).toBeGreaterThanOrEqual(3);
  });
  test('no repository appears in both projects and groups', () => {
    const c = loadCuratedYaml(contentDir);
    const main = new Set(c.projects.map((p) => p.repo));
    for (const g of c.groups) for (const r of g.repos) expect(main.has(r)).toBe(false);
  });
  test('project order is 1..n without gaps', () => {
    const orders = loadCuratedYaml(contentDir).projects.map((p) => p.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (module not found).

- [ ] **Step 3: Write schemas.ts**

```ts
// site/src/content/schemas.ts
import { z } from 'astro/zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const repoRef = z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name');

export const projectSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
  repo: repoRef,
  title: z.string(),
  description: z.string(),
  homepage: z.string().url().optional(),
  docs: z.string().url().optional(),
  doi: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const groupSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  repos: z.array(repoRef).min(1),
});

export const researchSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  link: z.string().url(),
});

export type Project = z.infer<typeof projectSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Research = z.infer<typeof researchSchema>;

function loadList<T>(path: string, schema: z.ZodType<T>): T[] {
  const raw = yaml.load(readFileSync(path, 'utf8'));
  return z.array(schema).parse(raw);
}

export function loadCuratedYaml(dir: string) {
  return {
    projects: loadList(join(dir, 'projects.yml'), projectSchema),
    groups: loadList(join(dir, 'groups.yml'), groupSchema),
    research: loadList(join(dir, 'research.yml'), researchSchema),
  };
}
```

- [ ] **Step 4: Write content.config.ts**

```ts
// site/src/content.config.ts
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { groupSchema, projectSchema, researchSchema } from './content/schemas.ts';

export const collections = {
  projects: defineCollection({ loader: file('src/content/projects.yml'), schema: projectSchema }),
  groups: defineCollection({ loader: file('src/content/groups.yml'), schema: groupSchema }),
  research: defineCollection({ loader: file('src/content/research.yml'), schema: researchSchema }),
};
```

- [ ] **Step 5: Write projects.yml** (descriptions adapted from livermetabolism-site `software.yml`; note libsbgnpy's repo is `matthiaskoenig/libsbgnpy`)

```yaml
- id: pkdb
  order: 1
  name: PK-DB
  repo: matthiaskoenig/pkdb
  title: Pharmacokinetics database
  description: >-
    The first FAIR-compliant open database for pharmacokinetics, integrating
    clinical and pre-clinical trial data. PK-DB enables reproducible PBPK/PD
    modeling and individualized simulations and has become a key
    infrastructure for computational pharmacology research.
  homepage: https://alpha.pk-db.com
  doi: 10.1093/nar/gkaa990
  tags: [Pharmacometrics, Digital Twins, Open & FAIR]
- id: sbmlutils
  order: 2
  name: sbmlutils
  repo: matthiaskoenig/sbmlutils
  title: Python utilities for SBML
  description: >-
    A versatile Python library that streamlines working with SBML models:
    model creation, annotation, reports, and integration with libSBML.
    Widely used in reproducible modeling workflows across systems biology.
  docs: https://matthiaskoenig.github.io/sbmlutils
  doi: 10.5281/zenodo.597149
  tags: [Open & FAIR, Digital Twins]
- id: pymetadata
  order: 3
  name: pymetadata
  repo: matthiaskoenig/pymetadata
  title: Metadata and COMBINE archives in Python
  description: >-
    Python utilities for working with metadata, ontologies and identifiers,
    and for reading and writing COMBINE archives, so that models and data
    carry the annotations that make them FAIR.
  docs: https://matthiaskoenig.github.io/pymetadata
  tags: [Open & FAIR]
- id: libsbgnpy
  order: 4
  name: libsbgnpy
  repo: matthiaskoenig/libsbgnpy
  title: Python library for SBGN
  description: >-
    A Python library for the Systems Biology Graphical Notation (SBGN),
    supporting standardized visualization and exchange of pathway maps.
  docs: https://matthiaskoenig.github.io/libsbgnpy
  tags: [Open & FAIR]
- id: visfem
  order: 5
  name: VisFEM
  repo: matthiaskoenig/visfem
  title: Web visualization of FEM models
  description: >-
    A browser-based visualization tool for finite element method (FEM)
    simulation results, making FEM-based digital twin models interactively
    explorable and shareable directly from the web.
  docs: https://matthiaskoenig.github.io/visfem
  tags: [Digital Twins, AI, Open & FAIR]
- id: cy3sbml
  order: 6
  name: cy3sbml
  repo: matthiaskoenig/cy3sbml
  title: SBML for Cytoscape 3
  description: >-
    A widely used Cytoscape app for the visualization of SBML models in
    network contexts, enabling intuitive exploration of complex models in
    systems biology and bioinformatics.
  doi: 10.5281/zenodo.597154
  tags: [Open & FAIR, Digital Twins]
```

- [ ] **Step 6: Write groups.yml** (old-site list minus the 404s: multiscale-galactose, pkpd, acetaminophen, antipyrine, caffeine, codeine, metacethin, icg, pkdb_data, pkdb_models)

```yaml
- id: modeling
  order: 1
  name: Modeling and simulation
  description: Python tools for building, simulating and reporting SBML models.
  repos:
    - matthiaskoenig/sbmlsim
    - matthiaskoenig/sbml4humans
    - matthiaskoenig/pkdb_analysis
    - matthiaskoenig/brendapy
    - matthiaskoenig/dfba
    - matthiaskoenig/modelmanager
    - matthiaskoenig/tellurium-web
- id: community
  order: 2
  name: Community software
  description: Simulation and modeling software developed together with the systems biology community.
  repos:
    - sys-bio/roadrunner
    - sys-bio/tellurium
    - opencobra/cobrapy
- id: standards
  order: 3
  name: Standards
  description: Specifications for exchanging models and simulation experiments.
  repos:
    - sed-ml/sed-ml
- id: cytoscape
  order: 4
  name: Cytoscape apps
  description: Visualization of SBML models, flux data and SABIO-RK kinetics in Cytoscape 2 and 3.
  repos:
    - matthiaskoenig/cy3fluxviz
    - matthiaskoenig/cy3sabiork
    - matthiaskoenig/cy3robundle
    - matthiaskoenig/cy2sbml
    - matthiaskoenig/cy2fluxviz
    - matthiaskoenig/cy2sabiork
    - matthiaskoenig/cy2reposition
- id: liver
  order: 5
  name: Liver and whole-cell models
  description: Early metabolic network and whole-cell modeling projects.
  repos:
    - matthiaskoenig/hepatonet
    - matthiaskoenig/glucose-model
    - whole-cell-tutors/whole-cell-reduced
    - dagwa/wholecell-metabolism
- id: other
  order: 6
  name: Other
  description: Websites and setup.
  repos:
    - matthiaskoenig/livermetabolism-site
    - matthiaskoenig/matthiaskoenig
    - matthiaskoenig/linux-setup
```

- [ ] **Step 7: Write research.yml**

```yaml
- id: digital-twins
  order: 1
  name: Digital twins of human physiology
  description: >-
    Mechanistic, physiologically based models spanning molecule to whole body
    that mirror an individual's physiology, enabling simulation-based
    prediction of disease progression and treatment response.
  link: https://livermetabolism.com/research/?tag=Digital%20Twins
- id: pharmacometrics
  order: 2
  name: Pharmacometrics and PBPK/PD
  description: >-
    Physiologically based pharmacokinetic and pharmacodynamic modeling of drug
    absorption, distribution, metabolism and excretion, backed by PK-DB as an
    open database of pharmacokinetics data, to support precision dosing.
  link: https://livermetabolism.com/research/?tag=Pharmacometrics
- id: open-fair
  order: 3
  name: Open and FAIR research software
  description: >-
    Open, FAIR and reproducible models, data and software that the community
    can build on: versioned workflows, standardized formats and open-source
    tools maintained over years.
  link: https://livermetabolism.com/research/?tag=Open%20%26%20FAIR
- id: standards
  order: 4
  name: Standards for computational biology
  description: >-
    Active contributions to community standards such as SBML, SED-ML, SBGN and
    PEtab, including editor roles and coordination of the COMBINE network.
  link: https://livermetabolism.com/research/#editors
```

- [ ] **Step 8: Run** `npm test` → PASS. Run `npx astro sync` → types generated without error.
- [ ] **Step 9: Commit** — `git commit -m "Add curated content collections with schemas"`.

---

### Task 3: Snapshot schemas and repository list derivation

**Files:**
- Create: `site/scripts/lib/schemas.ts`, `site/scripts/lib/repo-list.ts`
- Test: `site/tests/repo-list.test.ts`

**Interfaces:**
- Produces (schemas.ts): `apiRepoSchema`, `apiReleaseSchema`, `graphqlContributionsSchema`; `repoEntrySchema`, `reposFileSchema`, `releaseEntrySchema`, `releasesFileSchema`, `contributionsFileSchema`, `statsFileSchema`; types `RepoEntry`, `ReposFile`, `ReleaseEntry`, `ReleasesFile`, `ContributionsFile`, `StatsFile`.
- Produces (repo-list.ts): `repoListFromContent(projects: Project[], groups: Group[]): { all: string[]; main: string[] }` — deduplicated, `main` = project repos in `order`, `all` = main followed by group repos in group order. Throws if a repo is in both.

- [ ] **Step 1: Write the failing test**

```ts
// site/tests/repo-list.test.ts
import { expect, test } from 'vitest';
import { repoListFromContent } from '../scripts/lib/repo-list.ts';

const p = (id: string, order: number, repo: string) =>
  ({ id, order, name: id, repo, title: '', description: '', tags: [] });
const g = (id: string, order: number, repos: string[]) =>
  ({ id, order, name: id, description: '', repos });

test('main repos come first in project order, then group repos', () => {
  const r = repoListFromContent(
    [p('b', 2, 'o/b'), p('a', 1, 'o/a')],
    [g('g2', 2, ['o/y']), g('g1', 1, ['o/x'])],
  );
  expect(r.main).toEqual(['o/a', 'o/b']);
  expect(r.all).toEqual(['o/a', 'o/b', 'o/x', 'o/y']);
});

test('throws when a repo is both a project and in a group', () => {
  expect(() => repoListFromContent([p('a', 1, 'o/a')], [g('g', 1, ['o/a'])]))
    .toThrow(/o\/a/);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Write schemas.ts**

```ts
// site/scripts/lib/schemas.ts
import { z } from 'astro/zod';

// --- GitHub API shapes (only the fields we use) ---
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
          weeks: z.array(z.object({
            contributionDays: z.array(z.object({
              date: z.string(),
              contributionCount: z.number(),
              contributionLevel: z.enum(['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE']),
            })),
          })),
        }),
      }),
    }),
  }),
});

// --- snapshot file shapes ---
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
  weeks: z.array(z.object({
    days: z.array(z.object({ date: z.string(), count: z.number(), level: z.number().int().min(0).max(4) })),
  })),
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
```

- [ ] **Step 4: Write repo-list.ts**

```ts
// site/scripts/lib/repo-list.ts
import type { Group, Project } from '../../src/content/schemas.ts';

export function repoListFromContent(projects: Project[], groups: Group[]): { all: string[]; main: string[] } {
  const main = [...projects].sort((a, b) => a.order - b.order).map((p) => p.repo);
  const mainSet = new Set(main);
  const rest: string[] = [];
  for (const g of [...groups].sort((a, b) => a.order - b.order)) {
    for (const r of g.repos) {
      if (mainSet.has(r)) throw new Error(`Repository ${r} is listed both in projects.yml and groups.yml (${g.id})`);
      if (!rest.includes(r)) rest.push(r);
    }
  }
  return { main, all: [...main, ...rest] };
}
```

- [ ] **Step 5: Run** `npm test` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "Add snapshot schemas and repository list derivation"`.

---

### Task 4: Transformation functions with recorded fixtures

**Files:**
- Create: `site/scripts/lib/transform.ts`, `site/tests/fixtures/rest-repo.json` (recorded `GET /repos/matthiaskoenig/sbmlutils`), `site/tests/fixtures/rest-releases.json` (recorded `GET .../releases?per_page=3`), `site/tests/fixtures/graphql-contributions.json`
- Test: `site/tests/transform.test.ts`

**Interfaces:**
- Produces: `toRepoEntry(api: ApiRepo): RepoEntry`; `toReleaseEntries(repo: string, api: ApiRelease[]): ReleaseEntry[]` (drops drafts and releases without `published_at`, newest first, max 3); `toContributions(g: GraphqlContributions, login, from, to, fetchedAt): ContributionsFile`; `computeStats(repos: Record<string, RepoEntry>, fetchedAt): StatsFile`.

- [ ] **Step 1: Put the recorded fixtures in place.** The REST fixtures were recorded on 2026-09-10 (copy from the scratchpad `fixtures/` folder). Write the GraphQL fixture by hand in the exact API shape, two weeks:

```json
{
  "data": { "user": { "contributionsCollection": {
    "totalCommitContributions": 812, "totalPullRequestContributions": 14,
    "totalIssueContributions": 9, "totalPullRequestReviewContributions": 5,
    "restrictedContributionsCount": 3,
    "contributionCalendar": { "totalContributions": 843, "weeks": [
      { "contributionDays": [
        { "date": "2025-09-07", "contributionCount": 0, "contributionLevel": "NONE" },
        { "date": "2025-09-08", "contributionCount": 3, "contributionLevel": "FIRST_QUARTILE" },
        { "date": "2025-09-09", "contributionCount": 7, "contributionLevel": "SECOND_QUARTILE" },
        { "date": "2025-09-10", "contributionCount": 12, "contributionLevel": "THIRD_QUARTILE" },
        { "date": "2025-09-11", "contributionCount": 20, "contributionLevel": "FOURTH_QUARTILE" },
        { "date": "2025-09-12", "contributionCount": 1, "contributionLevel": "FIRST_QUARTILE" },
        { "date": "2025-09-13", "contributionCount": 0, "contributionLevel": "NONE" } ] },
      { "contributionDays": [
        { "date": "2025-09-14", "contributionCount": 2, "contributionLevel": "FIRST_QUARTILE" } ] }
    ] } } } }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// site/tests/transform.test.ts
import { describe, expect, test } from 'vitest';
import { apiReleaseSchema, apiRepoSchema, graphqlContributionsSchema, reposFileSchema, statsFileSchema, contributionsFileSchema } from '../scripts/lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries, toRepoEntry } from '../scripts/lib/transform.ts';
import repoFixture from './fixtures/rest-repo.json';
import releasesFixture from './fixtures/rest-releases.json';
import contribFixture from './fixtures/graphql-contributions.json';
import { z } from 'astro/zod';

const NOW = '2026-09-10T00:00:00.000Z';

describe('toRepoEntry', () => {
  test('maps the REST repo response', () => {
    const e = toRepoEntry(apiRepoSchema.parse(repoFixture));
    expect(e.fullName).toBe('matthiaskoenig/sbmlutils');
    expect(e.owner).toBe('matthiaskoenig');
    expect(e.stars).toBeGreaterThan(0);
    expect(e.license).toBe('MIT');
    expect(typeof e.pushedAt).toBe('string');
    expect(e.archived).toBe(false);
  });
});

describe('toReleaseEntries', () => {
  test('keeps at most three published releases, newest first, with string fields', () => {
    const list = toReleaseEntries('matthiaskoenig/sbmlutils', z.array(apiReleaseSchema).parse(releasesFixture));
    expect(list.length).toBeLessThanOrEqual(3);
    expect(list.every((r) => r.repo === 'matthiaskoenig/sbmlutils')).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].publishedAt >= list[i].publishedAt).toBe(true);
    expect(list.every((r) => typeof r.body === 'string' && typeof r.name === 'string')).toBe(true);
  });
  test('drops drafts and unpublished releases', () => {
    const draft = { tag_name: 'v9', name: null, published_at: null, html_url: 'u', body: null, draft: true, prerelease: false };
    expect(toReleaseEntries('o/r', [draft])).toEqual([]);
  });
});

describe('toContributions', () => {
  test('maps levels to 0..4 and copies totals', () => {
    const c = toContributions(graphqlContributionsSchema.parse(contribFixture), 'matthiaskoenig', '2025-09-10T00:00:00Z', NOW, NOW);
    expect(contributionsFileSchema.parse(c)).toBeTruthy();
    expect(c.weeks[0].days.map((d) => d.level)).toEqual([0, 1, 2, 3, 4, 1, 0]);
    expect(c.totals).toEqual({ commits: 812, pullRequests: 14, issues: 9, reviews: 5, restricted: 3, calendar: 843 });
  });
});

describe('computeStats', () => {
  const base = toRepoEntry(apiRepoSchema.parse(repoFixture));
  const repos = {
    'o/a': { ...base, fullName: 'o/a', stars: 10, forks: 1, language: 'Python', pushedAt: '2026-01-01T00:00:00Z' },
    'o/b': { ...base, fullName: 'o/b', stars: 5, forks: 2, language: 'Python', pushedAt: '2026-03-01T00:00:00Z' },
    'o/c': { ...base, fullName: 'o/c', stars: 1, forks: 0, language: 'Java', pushedAt: '2026-02-01T00:00:00Z' },
    'o/d': { ...base, fullName: 'o/d', stars: 0, forks: 0, language: null, pushedAt: '2025-02-01T00:00:00Z' },
  };
  test('sums stars/forks, counts primary languages, lists 5 most recently pushed', () => {
    const s = computeStats(repos, NOW);
    expect(statsFileSchema.parse(s)).toBeTruthy();
    expect(s.repoCount).toBe(4);
    expect(s.totalStars).toBe(16);
    expect(s.totalForks).toBe(3);
    expect(s.languages[0]).toEqual({ name: 'Python', repos: 2, share: 2 / 3 });
    expect(s.languages.map((l) => l.name)).toEqual(['Python', 'Java']);
    expect(s.recentlyPushed.map((r) => r.fullName)).toEqual(['o/b', 'o/c', 'o/a', 'o/d']);
  });
});
```

- [ ] **Step 3: Run** `npm test` → FAIL (transform.ts missing). (`resolveJsonModule` is on in Astro's strict tsconfig.)

- [ ] **Step 4: Write transform.ts**

```ts
// site/scripts/lib/transform.ts
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
    fetchedAt, login, from, to,
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
```

- [ ] **Step 5: Run** `npm test` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "Add snapshot transformations with recorded API fixtures"`.

---

### Task 5: GitHub client with retry and the fetch script

**Files:**
- Create: `site/scripts/lib/github-client.ts`, `site/scripts/fetch-github.ts`
- Test: `site/tests/github-client.test.ts`

**Interfaces:**
- Produces: `class GitHubClient { constructor(opts: { token: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }); rest<T>(path: string): Promise<T>; graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> }`. `rest` throws `GitHubNotFoundError` (with `.path`) on 404; retries 403/429/5xx up to 3 attempts with backoff 1s, 2s, 4s (honouring `retry-after` when present); throws `GitHubHttpError` after the last attempt.
- Produces: `runFetch(opts: { token: string; login: string; contentDir: string; outDir: string; now?: Date; client?: GitHubClient }): Promise<void>` exported from `fetch-github.ts`; the script calls it when run directly.

- [ ] **Step 1: Write the failing test**

```ts
// site/tests/github-client.test.ts
import { describe, expect, test } from 'vitest';
import { GitHubClient, GitHubHttpError, GitHubNotFoundError } from '../scripts/lib/github-client.ts';

function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const r = responses.shift() ?? { status: 500 };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } });
  }) as typeof fetch;
  return { impl, calls };
}
const noSleep = async () => {};

describe('GitHubClient.rest', () => {
  test('returns parsed json and sends auth header path', async () => {
    const f = fakeFetch([{ status: 200, body: { ok: true } }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.rest('/repos/o/r')).resolves.toEqual({ ok: true });
    expect(f.calls[0]).toBe('https://api.github.com/repos/o/r');
  });
  test('retries on 403 then succeeds', async () => {
    const f = fakeFetch([{ status: 403 }, { status: 200, body: { n: 1 } }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.rest('/x')).resolves.toEqual({ n: 1 });
    expect(f.calls).toHaveLength(2);
  });
  test('gives up after three attempts', async () => {
    const f = fakeFetch([{ status: 500 }, { status: 502 }, { status: 503 }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.rest('/x')).rejects.toBeInstanceOf(GitHubHttpError);
    expect(f.calls).toHaveLength(3);
  });
  test('404 is not retried and names the path', async () => {
    const f = fakeFetch([{ status: 404 }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.rest('/repos/o/gone')).rejects.toThrow(/\/repos\/o\/gone/);
    await expect(c.rest('/repos/o/gone')).rejects.toBeInstanceOf(GitHubNotFoundError);
  });
});

describe('GitHubClient.graphql', () => {
  test('posts query and rejects when errors are present', async () => {
    const f = fakeFetch([{ status: 200, body: { errors: [{ message: 'bad' }] } }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.graphql('query {}', {})).rejects.toThrow(/bad/);
  });
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Write github-client.ts**

```ts
// site/scripts/lib/github-client.ts
export class GitHubHttpError extends Error {
  constructor(public status: number, public path: string, body: string) {
    super(`GitHub ${status} for ${path}: ${body.slice(0, 200)}`);
  }
}
export class GitHubNotFoundError extends GitHubHttpError {
  constructor(path: string) { super(404, path, 'not found'); }
}

const RETRY_STATUS = new Set([403, 429, 500, 502, 503, 504]);
const BACKOFF_MS = [1000, 2000, 4000];

export class GitHubClient {
  private fetchImpl: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  private token: string;
  constructor(opts: { token: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }) {
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  private headers(): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${this.token}`,
      'user-agent': 'matthiaskoenig-site-fetch',
      'x-github-api-version': '2022-11-28',
    };
  }
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    let last: GitHubHttpError | null = null;
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      const res = await this.fetchImpl(url, { ...init, headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) } });
      if (res.status === 404) throw new GitHubNotFoundError(path);
      if (res.ok) return (await res.json()) as T;
      last = new GitHubHttpError(res.status, path, await res.text());
      if (!RETRY_STATUS.has(res.status)) throw last;
      const retryAfter = Number(res.headers.get('retry-after'));
      await this.sleep(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS[attempt]);
    }
    throw last!;
  }
  rest<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }
  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const body = await this.request<{ data?: unknown; errors?: Array<{ message: string }> }>('/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }),
    });
    if (body.errors?.length) throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
    return body as T;
  }
}
```

- [ ] **Step 4: Run** `npm test` → PASS. Commit — `git commit -m "Add GitHub API client with retry"`.

- [ ] **Step 5: Write fetch-github.ts**

```ts
// site/scripts/fetch-github.ts
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { GitHubClient } from './lib/github-client.ts';
import { repoListFromContent } from './lib/repo-list.ts';
import { apiReleaseSchema, apiRepoSchema, graphqlContributionsSchema, type ReleaseEntry, type RepoEntry } from './lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries, toRepoEntry } from './lib/transform.ts';

const CONTRIBUTIONS_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function writeJsonAtomic(outDir: string, name: string, data: unknown) {
  const tmp = join(outDir, `.${name}.tmp`);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, join(outDir, name));
}

export async function runFetch(opts: { token: string; login: string; contentDir: string; outDir: string; now?: Date; client?: GitHubClient }) {
  const now = opts.now ?? new Date();
  const fetchedAt = now.toISOString();
  const client = opts.client ?? new GitHubClient({ token: opts.token });
  const { projects, groups } = loadCuratedYaml(opts.contentDir);
  const { all, main } = repoListFromContent(projects, groups);
  console.log(`Fetching ${all.length} repositories (${main.length} main projects) as of ${fetchedAt}`);

  const repoEntries = await mapLimit(all, 4, async (fullName) => {
    const api = apiRepoSchema.parse(await client.rest(`/repos/${fullName}`));
    return toRepoEntry(api);
  });
  const repos: Record<string, RepoEntry> = Object.fromEntries(repoEntries.map((r) => [r.fullName, r]));

  const releaseLists = await mapLimit(main, 4, async (fullName) => {
    const api = z.array(apiReleaseSchema).parse(await client.rest(`/repos/${fullName}/releases?per_page=3`));
    return [fullName, toReleaseEntries(fullName, api)] as [string, ReleaseEntry[]];
  });
  const releases = Object.fromEntries(releaseLists);

  const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
  const raw = await client.graphql(CONTRIBUTIONS_QUERY, { login: opts.login, from, to: fetchedAt });
  const contributions = toContributions(graphqlContributionsSchema.parse(raw), opts.login, from, fetchedAt, fetchedAt);

  const stats = computeStats(repos, fetchedAt);

  mkdirSync(opts.outDir, { recursive: true });
  writeJsonAtomic(opts.outDir, 'repos.json', { fetchedAt, repos });
  writeJsonAtomic(opts.outDir, 'releases.json', { fetchedAt, releases });
  writeJsonAtomic(opts.outDir, 'contributions.json', contributions);
  writeJsonAtomic(opts.outDir, 'stats.json', stats);
  console.log(`Wrote 4 snapshot files to ${opts.outDir}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is not set. Create a fine-grained token with public read access, or run `npm run fetch:fixtures` for offline development.');
    process.exit(2);
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  runFetch({ token, login: 'matthiaskoenig', contentDir: join(root, 'src/content'), outDir: join(root, 'src/data/github') })
    .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
}
```

(The `import.meta.url` guard: `process.argv[1]` is an absolute path when run via `node scripts/fetch-github.ts`; compare after normalising through `file://`. If the guard misbehaves on Linux, replace it with `import.meta.main`, which Node 24 supports.)

- [ ] **Step 6: Verify without network** — `node -e "import('./scripts/fetch-github.ts').then(()=>console.log('import ok'))"` from `site/` prints `import ok`. Running `npm run fetch` without a token exits 2 with the hint. With a token (if available) it writes four files.
- [ ] **Step 7: Commit** — `git commit -m "Add GitHub fetch script writing snapshot files"`.

---

### Task 6: Fixture snapshot generator for offline development

**Files:**
- Create: `site/scripts/make-fixture-data.ts`
- Test: `site/tests/make-fixture-data.test.ts`

**Interfaces:**
- Produces: `makeFixtureData(opts: { contentDir: string; outDir: string; now?: Date }): void` writing four valid snapshot files: every repo from the curated YAML gets a synthetic `RepoEntry` (description "Fixture data for owner/name", stars = index, language cycles Python/Java/JavaScript, pushedAt spaced one day apart), the releases fixture is used for every main project, contributions come from the GraphQL fixture.

- [ ] **Step 1: Write the failing test**

```ts
// site/tests/make-fixture-data.test.ts
import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureData } from '../scripts/make-fixture-data.ts';
import { contributionsFileSchema, releasesFileSchema, reposFileSchema, statsFileSchema } from '../scripts/lib/schemas.ts';

test('writes four schema-valid snapshot files covering every curated repo', () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const outDir = mkdtempSync(join(tmpdir(), 'snap-'));
  makeFixtureData({ contentDir, outDir, now: new Date('2026-09-10T00:00:00Z') });
  const read = (n: string) => JSON.parse(readFileSync(join(outDir, n), 'utf8'));
  const repos = reposFileSchema.parse(read('repos.json'));
  releasesFileSchema.parse(read('releases.json'));
  contributionsFileSchema.parse(read('contributions.json'));
  statsFileSchema.parse(read('stats.json'));
  expect(Object.keys(repos.repos)).toContain('matthiaskoenig/sbmlutils');
  expect(Object.keys(repos.repos)).toContain('sys-bio/roadrunner');
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Write make-fixture-data.ts**

```ts
// site/scripts/make-fixture-data.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import { loadCuratedYaml } from '../src/content/schemas.ts';
import { repoListFromContent } from './lib/repo-list.ts';
import { apiReleaseSchema, graphqlContributionsSchema, type RepoEntry } from './lib/schemas.ts';
import { computeStats, toContributions, toReleaseEntries } from './lib/transform.ts';

const fixturesDir = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const LANGS = ['Python', 'Java', 'JavaScript'];

export function makeFixtureData(opts: { contentDir: string; outDir: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const fetchedAt = now.toISOString();
  const { projects, groups } = loadCuratedYaml(opts.contentDir);
  const { all, main } = repoListFromContent(projects, groups);

  const repos: Record<string, RepoEntry> = {};
  all.forEach((fullName, i) => {
    const [owner, name] = fullName.split('/');
    repos[fullName] = {
      fullName, name, owner,
      description: `Fixture data for ${fullName}`,
      htmlUrl: `https://github.com/${fullName}`,
      homepage: null,
      stars: i, forks: Math.floor(i / 2), openIssues: i % 5,
      language: LANGS[i % LANGS.length],
      topics: ['fixture'],
      license: 'MIT',
      pushedAt: new Date(now.getTime() - i * 86400000).toISOString(),
      archived: false,
    };
  });
  const releaseFixture = z.array(apiReleaseSchema).parse(JSON.parse(readFileSync(join(fixturesDir, 'rest-releases.json'), 'utf8')));
  const releases = Object.fromEntries(main.map((r) => [r, toReleaseEntries(r, releaseFixture)]));
  const contribFixture = graphqlContributionsSchema.parse(JSON.parse(readFileSync(join(fixturesDir, 'graphql-contributions.json'), 'utf8')));
  const from = new Date(now.getTime() - 365 * 86400000).toISOString();
  const contributions = toContributions(contribFixture, 'matthiaskoenig', from, fetchedAt, fetchedAt);

  mkdirSync(opts.outDir, { recursive: true });
  const write = (n: string, d: unknown) => writeFileSync(join(opts.outDir, n), JSON.stringify(d, null, 2) + '\n');
  write('repos.json', { fetchedAt, repos });
  write('releases.json', { fetchedAt, releases });
  write('contributions.json', contributions);
  write('stats.json', computeStats(repos, fetchedAt));
  console.log(`Wrote fixture snapshots for ${all.length} repositories to ${opts.outDir}`);
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  makeFixtureData({ contentDir: join(root, 'src/content'), outDir: join(root, 'src/data/github') });
}
```

- [ ] **Step 4: Run** `npm test` → PASS; `npm run fetch:fixtures` writes `src/data/github/*.json`.
- [ ] **Step 5: Commit** — `git commit -m "Add fixture snapshot generator for offline development"`.

---

### Task 7: Build-time data loading, markdown rendering and merging

**Files:**
- Create: `site/src/lib/github-data.ts`, `site/src/lib/markdown.ts`, `site/src/lib/merge.ts`
- Test: `site/tests/merge.test.ts`, `site/tests/markdown.test.ts`

**Interfaces:**
- Produces: `loadGithubData(dir?: string): GithubData` where `GithubData = { repos: ReposFile; releases: ReleasesFile; contributions: ContributionsFile; stats: StatsFile }`; throws `Error("Missing snapshot <file>. Run `npm run fetch` (needs GITHUB_TOKEN) or `npm run fetch:fixtures`.")`.
- Produces: `renderMarkdown(md: string): string` (GFM, sanitised; allows headings, p, ul/ol/li, a[href], code, pre, strong, em, blockquote, img[src,alt]; strips everything else).
- Produces: `ProjectView = Project & { repo: RepoEntry }`, `mergeProjects(projects: Project[], repos: ReposFile): ProjectView[]` (sorted by `order`, throws on missing repo); `GroupView = Group & { entries: RepoEntry[] }`, `mergeGroups(groups: Group[], repos: ReposFile): GroupView[]`; `ReleaseView = ReleaseEntry & { projectName: string; projectId: string; bodyHtml: string }`, `mergeReleases(projects: Project[], releases: ReleasesFile, render: (md: string) => string): ReleaseView[]` (all projects merged, newest first).

- [ ] **Step 1: Write the failing tests**

```ts
// site/tests/markdown.test.ts
import { expect, test } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown.ts';

test('renders GFM lists and links', () => {
  const html = renderMarkdown('## Changes\n- item [x](https://e.com)\n');
  expect(html).toContain('<h2');
  expect(html).toContain('<li>');
  expect(html).toContain('href="https://e.com"');
});
test('strips scripts and event handlers', () => {
  const html = renderMarkdown('<script>alert(1)</script><a href="#" onclick="x()">a</a>');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onclick');
});
```

```ts
// site/tests/merge.test.ts
import { expect, test } from 'vitest';
import { mergeGroups, mergeProjects, mergeReleases } from '../src/lib/merge.ts';
import type { ReleasesFile, ReposFile, RepoEntry } from '../scripts/lib/schemas.ts';

const entry = (fullName: string): RepoEntry => ({
  fullName, name: fullName.split('/')[1], owner: fullName.split('/')[0], description: null, htmlUrl: '', homepage: null,
  stars: 1, forks: 0, openIssues: 0, language: null, topics: [], license: null, pushedAt: '2026-01-01T00:00:00Z', archived: false,
});
const repos: ReposFile = { fetchedAt: 'x', repos: { 'o/a': entry('o/a'), 'o/b': entry('o/b') } };
const projects = [
  { id: 'b', order: 2, name: 'B', repo: 'o/b', title: '', description: '', tags: [] },
  { id: 'a', order: 1, name: 'A', repo: 'o/a', title: '', description: '', tags: [] },
];

test('mergeProjects sorts by order and attaches repo entries', () => {
  const v = mergeProjects(projects, repos);
  expect(v.map((p) => p.id)).toEqual(['a', 'b']);
  expect(v[0].repo.fullName).toBe('o/a');
});
test('mergeProjects throws on a missing snapshot entry', () => {
  expect(() => mergeProjects([{ ...projects[0], repo: 'o/zzz' }], repos)).toThrow(/o\/zzz/);
});
test('mergeGroups attaches entries in listed order', () => {
  const v = mergeGroups([{ id: 'g', order: 1, name: 'G', description: '', repos: ['o/b', 'o/a'] }], repos);
  expect(v[0].entries.map((e) => e.fullName)).toEqual(['o/b', 'o/a']);
});
test('mergeReleases flattens, renders and sorts newest first', () => {
  const releases: ReleasesFile = { fetchedAt: 'x', releases: {
    'o/a': [{ repo: 'o/a', tag: '1', name: 'one', publishedAt: '2026-01-01T00:00:00Z', htmlUrl: '', body: '**b**', prerelease: false }],
    'o/b': [{ repo: 'o/b', tag: '2', name: 'two', publishedAt: '2026-02-01T00:00:00Z', htmlUrl: '', body: '', prerelease: false }],
  } };
  const v = mergeReleases(projects, releases, (md) => `<p>${md}</p>`);
  expect(v.map((r) => r.tag)).toEqual(['2', '1']);
  expect(v[1].projectName).toBe('A');
  expect(v[1].bodyHtml).toBe('<p>**b**</p>');
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Write the three modules**

```ts
// site/src/lib/github-data.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import { contributionsFileSchema, releasesFileSchema, reposFileSchema, statsFileSchema } from '../../scripts/lib/schemas.ts';
import type { ContributionsFile, ReleasesFile, ReposFile, StatsFile } from '../../scripts/lib/schemas.ts';

export interface GithubData { repos: ReposFile; releases: ReleasesFile; contributions: ContributionsFile; stats: StatsFile }

const defaultDir = fileURLToPath(new URL('../data/github/', import.meta.url));

function readSnapshot<T>(dir: string, name: string, schema: z.ZodType<T>): T {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing snapshot ${path}. Run \`npm run fetch\` (needs GITHUB_TOKEN) or \`npm run fetch:fixtures\`.`);
  }
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function loadGithubData(dir: string = defaultDir): GithubData {
  return {
    repos: readSnapshot(dir, 'repos.json', reposFileSchema),
    releases: readSnapshot(dir, 'releases.json', releasesFileSchema),
    contributions: readSnapshot(dir, 'contributions.json', contributionsFileSchema),
    stats: readSnapshot(dir, 'stats.json', statsFileSchema),
  };
}
```

```ts
// site/src/lib/markdown.ts
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { gfm: true, async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'strong', 'em', 'blockquote', 'img', 'br', 'hr', 'del', 'input'],
    allowedAttributes: { a: ['href'], img: ['src', 'alt'], input: ['type', 'checked', 'disabled'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}
```

```ts
// site/src/lib/merge.ts
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

export function mergeReleases(projects: Project[], releases: ReleasesFile, render: (md: string) => string): ReleaseView[] {
  const out: ReleaseView[] = [];
  for (const p of projects) {
    for (const r of releases.releases[p.repo] ?? []) out.push({ ...r, projectId: p.id, projectName: p.name, bodyHtml: render(r.body) });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
```

- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add snapshot loading, markdown rendering and content merging"`.

---

### Task 8: Static page: layout, nav, hero, research, projects, footer

**Files:**
- Modify: `site/src/layouts/Base.astro`, `site/src/pages/index.astro`
- Create: `site/src/components/Nav.astro`, `Hero.astro`, `Section.astro`, `ResearchSection.astro`, `ProjectCard.astro`, `ProjectsSection.astro`, `Footer.astro`, `site/public/favicon.svg`, `site/public/.nojekyll`, `site/src/assets/banner.png` (copy of `images/banner.png`)

**Interfaces:**
- `Section.astro` props `{ id: string; title: string; lead?: string }` with a slot; renders `<section id={id} class="scroll-mt-20 py-12">` with an `h2`.
- `ProjectCard.astro` props `{ project: ProjectView }`.
- `Footer.astro` props `{ fetchedAt: string }`.

- [ ] **Step 1: Components**

```astro
---
// site/src/components/Nav.astro
const links = [
  ['#research', 'Research'], ['#projects', 'Projects'], ['#contributions', 'Contributions'],
  ['#releases', 'Releases'], ['#repositories', 'Repositories'],
];
---
<header class="sticky top-0 z-20 bg-primary text-white shadow">
  <nav class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
    <a href="/" class="font-brand text-lg font-bold tracking-tight">Matthias König</a>
    <ul class="flex flex-wrap gap-4 text-sm">
      {links.map(([href, label]) => <li><a class="hover:text-accent" href={href}>{label}</a></li>)}
    </ul>
    <a class="ml-auto text-sm hover:text-accent" href="https://livermetabolism.com">livermetabolism.com ↗</a>
  </nav>
</header>
```

```astro
---
// site/src/components/Hero.astro
import { Image } from 'astro:assets';
import banner from '../assets/banner.png';
---
<div class="bg-surface">
  <div class="mx-auto max-w-6xl px-4 py-10">
    <Image src={banner} alt="König Lab banner" class="mb-8 w-full rounded-lg shadow" loading="eager" />
    <h1 class="text-4xl md:text-5xl">Matthias König</h1>
    <p class="mt-3 max-w-3xl text-lg text-ink/80">
      Research software engineering for systems medicine: open-source tools, standards and
      reproducible workflows for digital twins of the liver and human physiology.
      Group leader of the <a class="text-accent underline" href="https://livermetabolism.com">König Lab</a>
      at Humboldt-University Berlin.
    </p>
    <ul class="mt-5 flex flex-wrap gap-3 text-sm">
      <li><a class="rounded-full bg-primary px-4 py-1.5 text-white hover:bg-accent" href="https://github.com/matthiaskoenig">GitHub</a></li>
      <li><a class="rounded-full bg-primary px-4 py-1.5 text-white hover:bg-accent" href="https://orcid.org/0000-0003-1725-179X">ORCID</a></li>
      <li><a class="rounded-full bg-primary px-4 py-1.5 text-white hover:bg-accent" href="https://livermetabolism.com/cv/">CV</a></li>
    </ul>
  </div>
</div>
```

```astro
---
// site/src/components/Section.astro
interface Props { id: string; title: string; lead?: string }
const { id, title, lead } = Astro.props;
---
<section id={id} class="scroll-mt-20 py-12">
  <div class="mx-auto max-w-6xl px-4">
    <h2 class="text-3xl">{title}</h2>
    {lead && <p class="mt-2 max-w-3xl text-ink/70">{lead}</p>}
    <div class="mt-6"><slot /></div>
  </div>
</section>
```

```astro
---
// site/src/components/ResearchSection.astro
import Section from './Section.astro';
import type { Research } from '../content/schemas.ts';
interface Props { items: Research[] }
const items = [...Astro.props.items].sort((a, b) => a.order - b.order);
---
<Section id="research" title="Research interests" lead="Software is how we do science. These are the questions the tools serve; the full picture is on livermetabolism.com.">
  <div class="grid gap-6 md:grid-cols-2">
    {items.map((r) => (
      <article class="rounded-lg border border-surface p-5">
        <h3 class="text-xl">{r.name}</h3>
        <p class="mt-2 text-ink/80">{r.description}</p>
        <a class="mt-3 inline-block text-sm text-accent underline" href={r.link}>Read more on livermetabolism.com</a>
      </article>
    ))}
  </div>
</Section>
```

```astro
---
// site/src/components/ProjectCard.astro
import type { ProjectView } from '../lib/merge.ts';
interface Props { project: ProjectView }
const { project: p } = Astro.props;
const pushed = new Date(p.repo.pushedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
---
<article class="flex flex-col rounded-lg border border-surface bg-white p-5 shadow-sm">
  <h3 class="text-xl"><a class="hover:text-accent" href={p.repo.htmlUrl}>{p.name}</a></h3>
  <p class="text-sm text-muted">{p.title}</p>
  <p class="mt-3 flex-1 text-ink/80">{p.description}</p>
  <ul class="mt-3 flex flex-wrap gap-2 text-xs">
    {p.tags.map((t) => <li class="rounded-full bg-surface px-2 py-0.5">{t}</li>)}
  </ul>
  <dl class="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/70">
    <div><dt class="sr-only">Stars</dt><dd>★ {p.repo.stars}</dd></div>
    <div><dt class="sr-only">Forks</dt><dd>⑂ {p.repo.forks}</dd></div>
    {p.repo.language && <div><dt class="sr-only">Language</dt><dd>{p.repo.language}</dd></div>}
    <div><dt class="sr-only">Last push</dt><dd>updated {pushed}</dd></div>
  </dl>
  <ul class="mt-3 flex flex-wrap gap-3 text-sm">
    <li><a class="text-accent underline" href={p.repo.htmlUrl}>Repository</a></li>
    {p.docs && <li><a class="text-accent underline" href={p.docs}>Documentation</a></li>}
    {p.homepage && <li><a class="text-accent underline" href={p.homepage}>Website</a></li>}
    {p.doi && <li><a class="text-accent underline" href={`https://doi.org/${p.doi}`}>DOI</a></li>}
  </ul>
</article>
```

```astro
---
// site/src/components/ProjectsSection.astro
import Section from './Section.astro';
import ProjectCard from './ProjectCard.astro';
import type { ProjectView } from '../lib/merge.ts';
interface Props { projects: ProjectView[] }
---
<Section id="projects" title="Main projects" lead="Open-source software developed and maintained over many years.">
  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Astro.props.projects.map((p) => <ProjectCard project={p} />)}
  </div>
</Section>
```

```astro
---
// site/src/components/Footer.astro
interface Props { fetchedAt: string }
const date = new Date(Astro.props.fetchedAt).toISOString().slice(0, 10);
---
<footer class="mt-auto bg-primary py-8 text-sm text-white/80">
  <div class="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-4">
    <span>© 2016–{new Date().getFullYear()} Matthias König</span>
    <a class="hover:text-accent" href="https://github.com/matthiaskoenig/matthiaskoenig">Site source</a>
    <a class="hover:text-accent" href="/impressum/">Imprint & privacy</a>
    <span class="ml-auto">GitHub data fetched on {date}</span>
  </div>
</footer>
```

- [ ] **Step 2: Update Base.astro** to include Nav and Footer around the slot (Footer needs `fetchedAt`, so pass it as a layout prop `{ title; description?; fetchedAt: string }`), add `<link rel="icon" href="/favicon.svg">`. Create `public/favicon.svg` (a simple rounded square in `#2c3e50` with a white "MK" in Space Grotesk, 64×64) and an empty `public/.nojekyll`. Copy `images/banner.png` to `site/src/assets/banner.png`.

- [ ] **Step 3: index.astro**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import ResearchSection from '../components/ResearchSection.astro';
import ProjectsSection from '../components/ProjectsSection.astro';
import { loadGithubData } from '../lib/github-data.ts';
import { mergeProjects } from '../lib/merge.ts';

const data = loadGithubData();
const projects = mergeProjects((await getCollection('projects')).map((e) => e.data), data.repos);
const research = (await getCollection('research')).map((e) => e.data);
---
<Base title="Matthias König – software & research software engineering" fetchedAt={data.repos.fetchedAt}>
  <Hero />
  <main class="flex-1">
    <ResearchSection items={research} />
    <ProjectsSection projects={projects} />
  </main>
</Base>
```

- [ ] **Step 4: Run** `npm run fetch:fixtures && npm run check && npm run build` → success; open `npm run preview` and confirm hero, four research cards, six project cards render at desktop and ~400px width.
- [ ] **Step 5: Commit** — `git commit -m "Add static sections: hero, research, projects, footer"`.

---

### Task 9: Contributions section with calendar island and stat tiles

**Files:**
- Create: `site/src/components/ContributionCalendar.vue`, `site/src/components/StatTiles.astro`, `site/src/components/ContributionsSection.astro`
- Modify: `site/src/pages/index.astro`

**Interfaces:**
- `ContributionCalendar.vue` props `{ weeks: { days: { date: string; count: number; level: number }[] }[]; total: number }`.
- `StatTiles.astro` props `{ stats: StatsFile; contributions: ContributionsFile }`.
- `ContributionsSection.astro` props `{ stats: StatsFile; contributions: ContributionsFile }`.

- [ ] **Step 1: ContributionCalendar.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
interface Day { date: string; count: number; level: number }
const props = defineProps<{ weeks: { days: Day[] }[]; total: number }>();
const hovered = ref<Day | null>(null);
const colors = ['#ecf0f1', '#a8e6d6', '#5fd1b3', '#18bc9c', '#0f7c67'];
const months = computed(() => {
  const out: { label: string; col: number }[] = [];
  let last = '';
  props.weeks.forEach((w, i) => {
    const d = w.days[0]; if (!d) return;
    const m = d.date.slice(0, 7);
    if (m !== last) { out.push({ label: new Date(d.date).toLocaleString('en', { month: 'short' }), col: i }); last = m; }
  });
  return out;
});
const cell = 12, gap = 3;
const width = computed(() => props.weeks.length * (cell + gap));
const height = 7 * (cell + gap) + 16;
</script>

<template>
  <figure>
    <div class="overflow-x-auto">
      <svg :width="width" :height="height" role="img" :aria-label="`${total} contributions in the last year`">
        <text v-for="m in months" :key="m.col" :x="m.col * (cell + gap)" y="10" font-size="10" fill="#95a5a6">{{ m.label }}</text>
        <g v-for="(w, wi) in weeks" :key="wi">
          <rect
            v-for="d in w.days" :key="d.date"
            :x="wi * (cell + gap)" :y="16 + new Date(d.date).getUTCDay() * (cell + gap)"
            :width="cell" :height="cell" rx="2" :fill="colors[d.level]"
            @mouseenter="hovered = d" @mouseleave="hovered = null" @focus="hovered = d" @blur="hovered = null"
            tabindex="0"
          >
            <title>{{ d.count }} contributions on {{ d.date }}</title>
          </rect>
        </g>
      </svg>
    </div>
    <figcaption class="mt-2 flex items-center justify-between text-sm text-ink/70">
      <span aria-live="polite">{{ hovered ? `${hovered.count} contributions on ${hovered.date}` : `${total} contributions in the last year` }}</span>
      <span class="flex items-center gap-1">Less <i v-for="c in colors" :key="c" class="inline-block h-3 w-3 rounded-sm" :style="{ background: c }" /> More</span>
    </figcaption>
  </figure>
</template>
```

- [ ] **Step 2: StatTiles.astro and ContributionsSection.astro**

```astro
---
// site/src/components/StatTiles.astro
import type { ContributionsFile, StatsFile } from '../../scripts/lib/schemas.ts';
interface Props { stats: StatsFile; contributions: ContributionsFile }
const { stats, contributions } = Astro.props;
const tiles = [
  ['Repositories', stats.repoCount],
  ['Stars', stats.totalStars],
  ['Commits, last year', contributions.totals.commits],
  ['Pull requests, last year', contributions.totals.pullRequests],
];
const top = stats.languages.slice(0, 6);
const palette = ['#2c3e50', '#18bc9c', '#3498db', '#f39c12', '#e74c3c', '#95a5a6'];
---
<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {tiles.map(([label, value]) => (
    <div class="rounded-lg bg-surface p-4">
      <div class="font-brand text-3xl font-bold text-primary">{value}</div>
      <div class="text-sm text-ink/70">{label}</div>
    </div>
  ))}
</div>
<div class="mt-6">
  <h3 class="text-lg">Primary languages across repositories</h3>
  <div class="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-surface" role="img" aria-label={top.map((l) => `${l.name} ${l.repos}`).join(', ')}>
    {top.map((l, i) => <span style={`width:${l.share * 100}%;background:${palette[i]}`} />)}
  </div>
  <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70">
    {top.map((l, i) => <li><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={`background:${palette[i]}`}></i>{l.name} · {l.repos}</li>)}
  </ul>
</div>
```

```astro
---
// site/src/components/ContributionsSection.astro
import Section from './Section.astro';
import StatTiles from './StatTiles.astro';
import ContributionCalendar from './ContributionCalendar.vue';
import type { ContributionsFile, StatsFile } from '../../scripts/lib/schemas.ts';
interface Props { stats: StatsFile; contributions: ContributionsFile }
const { stats, contributions } = Astro.props;
---
<Section id="contributions" title="Contributions" lead="GitHub activity across the repositories listed on this page, refreshed weekly.">
  <StatTiles stats={stats} contributions={contributions} />
  <div class="mt-8">
    <ContributionCalendar client:visible weeks={contributions.weeks} total={contributions.totals.calendar} />
  </div>
</Section>
```

- [ ] **Step 3: Wire into index.astro** after `ProjectsSection`: `<ContributionsSection stats={data.stats} contributions={data.contributions} />`.
- [ ] **Step 4: Run** `npm run check && npm run build && npm run preview` → calendar renders (two weeks with fixture data), tiles show numbers, hover updates the caption.
- [ ] **Step 5: Commit** — `git commit -m "Add contributions section with calendar island"`.

---

### Task 10: Release feed island

**Files:**
- Create: `site/src/components/ReleaseFeed.vue`, `site/src/components/ReleasesSection.astro`
- Modify: `site/src/pages/index.astro`

**Interfaces:**
- `ReleaseFeed.vue` props `{ releases: ReleaseView[]; projects: { id: string; name: string }[] }`.

- [ ] **Step 1: ReleaseFeed.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
interface Release { repo: string; tag: string; name: string; publishedAt: string; htmlUrl: string; bodyHtml: string; prerelease: boolean; projectId: string; projectName: string }
const props = defineProps<{ releases: Release[]; projects: { id: string; name: string }[] }>();
const active = ref<string | null>(null);
const open = ref<Set<string>>(new Set());
const shown = computed(() => active.value ? props.releases.filter((r) => r.projectId === active.value) : props.releases);
const key = (r: Release) => `${r.repo}@${r.tag}`;
function toggle(r: Release) { const k = key(r); const s = new Set(open.value); s.has(k) ? s.delete(k) : s.add(k); open.value = s; }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2 text-sm" role="group" aria-label="Filter releases by project">
      <button class="rounded-full border px-3 py-1" :class="active === null ? 'bg-primary text-white border-primary' : 'border-surface hover:border-accent'" @click="active = null">All</button>
      <button v-for="p in projects" :key="p.id" class="rounded-full border px-3 py-1"
        :class="active === p.id ? 'bg-primary text-white border-primary' : 'border-surface hover:border-accent'" @click="active = p.id">{{ p.name }}</button>
    </div>
    <ol class="mt-6 divide-y divide-surface">
      <li v-for="r in shown" :key="key(r)" class="py-4">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="font-brand font-bold text-primary">{{ r.projectName }}</span>
          <a class="text-accent underline" :href="r.htmlUrl">{{ r.name }}</a>
          <span v-if="r.prerelease" class="rounded-full bg-warning/20 px-2 text-xs">pre-release</span>
          <time class="text-sm text-muted" :datetime="r.publishedAt">{{ fmt(r.publishedAt) }}</time>
          <button v-if="r.bodyHtml" class="ml-auto text-sm text-accent underline" :aria-expanded="open.has(key(r))" @click="toggle(r)">
            {{ open.has(key(r)) ? 'Hide notes' : 'Release notes' }}
          </button>
        </div>
        <div v-if="open.has(key(r))" class="prose prose-sm mt-3 max-w-none rounded bg-surface/60 p-4" v-html="r.bodyHtml" />
      </li>
    </ol>
    <p v-if="shown.length === 0" class="text-ink/70">No releases recorded for this project.</p>
  </div>
</template>
```

The `prose` classes need minimal styling without the typography plugin: add to `global.css`:

```css
.prose :is(h1,h2,h3,h4) { @apply mt-4 mb-2 text-base font-semibold; }
.prose p, .prose ul, .prose ol { @apply my-2; }
.prose ul { @apply list-disc pl-5; }
.prose ol { @apply list-decimal pl-5; }
.prose a { @apply text-accent underline; }
.prose code { @apply rounded bg-white px-1 text-[0.9em]; }
.prose pre { @apply overflow-x-auto rounded bg-white p-3 text-sm; }
```

- [ ] **Step 2: ReleasesSection.astro**

```astro
---
import Section from './Section.astro';
import ReleaseFeed from './ReleaseFeed.vue';
import type { ReleaseView } from '../lib/merge.ts';
interface Props { releases: ReleaseView[]; projects: { id: string; name: string }[] }
const { releases, projects } = Astro.props;
---
<Section id="releases" title="Latest releases" lead="The three most recent releases of each main project, with their release notes.">
  <ReleaseFeed client:visible releases={releases} projects={projects} />
</Section>
```

- [ ] **Step 3: Wire into index.astro**: compute `const releases = mergeReleases(projectsRaw, data.releases, renderMarkdown);` where `projectsRaw` is the collection data array, and pass `projects={projects.map((p) => ({ id: p.id, name: p.name }))}`.
- [ ] **Step 4: Run** `npm run check && npm run build && npm run preview` → filter chips work, notes expand.
- [ ] **Step 5: Commit** — `git commit -m "Add release feed island"`.

---

### Task 11: Repository catalog island

**Files:**
- Create: `site/src/components/RepoCatalog.vue`, `site/src/components/RepositoriesSection.astro`
- Modify: `site/src/pages/index.astro`

**Interfaces:**
- `RepoCatalog.vue` props `{ groups: { id: string; name: string; description: string; entries: RepoEntry[] }[] }`.

- [ ] **Step 1: RepoCatalog.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
interface Repo { fullName: string; name: string; owner: string; description: string | null; htmlUrl: string; homepage: string | null; stars: number; forks: number; language: string | null; pushedAt: string; archived: boolean; license: string | null }
interface Group { id: string; name: string; description: string; entries: Repo[] }
const props = defineProps<{ groups: Group[] }>();
const query = ref('');
const sort = ref<'name' | 'stars' | 'pushed'>('pushed');
const collapsed = ref<Set<string>>(new Set());
const sorters = {
  name: (a: Repo, b: Repo) => a.name.localeCompare(b.name),
  stars: (a: Repo, b: Repo) => b.stars - a.stars,
  pushed: (a: Repo, b: Repo) => b.pushedAt.localeCompare(a.pushedAt),
};
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.groups
    .map((g) => ({ ...g, entries: g.entries.filter((r) => !q || r.fullName.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)).sort(sorters[sort.value]) }))
    .filter((g) => g.entries.length > 0);
});
function toggle(id: string) { const s = new Set(collapsed.value); s.has(id) ? s.delete(id) : s.add(id); collapsed.value = s; }
const year = (iso: string) => iso.slice(0, 4);
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <label class="flex items-center gap-2">Filter
        <input v-model="query" type="search" placeholder="name or description" class="rounded border border-surface px-2 py-1" />
      </label>
      <label class="flex items-center gap-2">Sort by
        <select v-model="sort" class="rounded border border-surface px-2 py-1">
          <option value="pushed">last push</option><option value="stars">stars</option><option value="name">name</option>
        </select>
      </label>
    </div>
    <div v-for="g in visible" :key="g.id" class="mt-8">
      <button class="flex w-full items-baseline gap-3 text-left" :aria-expanded="!collapsed.has(g.id)" @click="toggle(g.id)">
        <h3 class="text-xl">{{ g.name }}</h3>
        <span class="text-sm text-muted">{{ g.entries.length }} · {{ g.description }}</span>
        <span class="ml-auto text-muted">{{ collapsed.has(g.id) ? '+' : '−' }}</span>
      </button>
      <ul v-if="!collapsed.has(g.id)" class="mt-3 grid gap-3 md:grid-cols-2">
        <li v-for="r in g.entries" :key="r.fullName" class="rounded border border-surface p-3">
          <div class="flex flex-wrap items-baseline gap-2">
            <a class="font-semibold text-primary hover:text-accent" :href="r.htmlUrl">{{ r.owner }}/<span class="font-bold">{{ r.name }}</span></a>
            <span v-if="r.archived" class="rounded-full bg-surface px-2 text-xs">archived</span>
            <span class="ml-auto text-xs text-muted">★ {{ r.stars }} · {{ r.language ?? '—' }} · {{ year(r.pushedAt) }}</span>
          </div>
          <p v-if="r.description" class="mt-1 text-sm text-ink/80">{{ r.description }}</p>
        </li>
      </ul>
    </div>
    <p v-if="visible.length === 0" class="mt-6 text-ink/70">No repositories match “{{ query }}”.</p>
  </div>
</template>
```

- [ ] **Step 2: RepositoriesSection.astro**

```astro
---
import Section from './Section.astro';
import RepoCatalog from './RepoCatalog.vue';
import type { GroupView } from '../lib/merge.ts';
interface Props { groups: GroupView[] }
---
<Section id="repositories" title="Repository catalog" lead="Everything else: libraries, apps, models and community projects, grouped by topic.">
  <RepoCatalog client:visible groups={Astro.props.groups} />
</Section>
```

- [ ] **Step 3: Wire into index.astro**: `const groups = mergeGroups((await getCollection('groups')).map((e) => e.data), data.repos);` and `<RepositoriesSection groups={groups} />` as last section.
- [ ] **Step 4: Run** `npm run check && npm run build && npm run preview` → filter, sort and collapse work; page has no horizontal scroll at 400px.
- [ ] **Step 5: Commit** — `git commit -m "Add repository catalog island"`.

---

### Task 12: Imprint page

**Files:**
- Create: `site/src/pages/impressum.astro`

- [ ] **Step 1: Write the page** using `Base` (pass `fetchedAt` from `loadGithubData().repos.fetchedAt`), with sections: "Angaben gemäß § 5 TMG / Imprint" (Matthias König, Humboldt-Universität zu Berlin, Institute for Theoretical Biology, Philippstraße 13, 10115 Berlin, Germany; e-mail `konigmatt@googlemail.com`), and "Privacy": the site is static, hosted on GitHub Pages (GitHub Inc. server logs apply, link to GitHub's privacy statement), sets no cookies, loads no third-party scripts or fonts, and the GitHub data shown is public repository metadata refreshed weekly. Link back to `/`.
- [ ] **Step 2: Run** `npm run build` → `dist/impressum/index.html` exists.
- [ ] **Step 3: Commit** — `git commit -m "Add imprint page"`.

---

### Task 13: Workflows

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`

- [ ] **Step 1: deploy.yml**

```yaml
name: Deploy site
on:
  push:
    branches: [main]
    paths: ['site/**', '.github/workflows/deploy.yml']
  schedule:
    - cron: '0 4 * * 1'   # Mondays 04:00 UTC: refresh GitHub data
  workflow_dispatch:
concurrency:
  group: deploy
  cancel-in-progress: false
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: site } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: site/package-lock.json }
      - run: npm ci
      - run: npm run fetch
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
      - run: npm test
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          deploy_key: ${{ secrets.PAGES_DEPLOY_KEY }}
          external_repository: matthiaskoenig/matthiaskoenig.github.io
          publish_branch: main
          publish_dir: ./site/dist
          force_orphan: true
          cname: ''
```

(`force_orphan: true` keeps the target repository's history to a single commit so the old Jekyll sources disappear on the first deploy. `cname: ''` because no custom domain.)

- [ ] **Step 2: ci.yml**

```yaml
name: CI
on:
  pull_request:
    paths: ['site/**', '.github/workflows/ci.yml']
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: site } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: site/package-lock.json }
      - run: npm ci
      - run: npm test
      - run: npm run fetch
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
      - run: npm run check
      - run: npm run build
```

- [ ] **Step 3: Validate YAML** — `node -e "require('js-yaml')"` is not available at root; instead run from `site/`: `node -e "import('js-yaml').then(y=>{for(const f of ['deploy','ci']) y.default.load(require('fs').readFileSync('../.github/workflows/'+f+'.yml','utf8')); console.log('yaml ok')})"`.
- [ ] **Step 4: Commit** — `git commit -m "Add deploy and CI workflows"`.

---

### Task 14: Documentation

**Files:**
- Create: `site/README.md`
- Modify: `README.md` (root), `CLAUDE.md`, spec (language stats deviation)

- [ ] **Step 1: site/README.md** — sections: What this is; How it works (diagram in words: curated YAML + fetch script → JSON snapshots → Astro build → dist → pushed to matthiaskoenig.github.io); Local development (commands from CLAUDE.md, including `fetch:fixtures` for offline work and how to create a fine-grained token); Editing content (which YAML for what, then re-run fetch); Testing; Deployment and the weekly schedule; One-time setup of the deploy key and Pages; Troubleshooting (missing snapshot error, 404 for a repo, rate limits).
- [ ] **Step 2: Root README.md** — add at the end a short section "This repository" with two sentences: it is the profile README and the source of https://matthiaskoenig.github.io; developer documentation is in `site/README.md`. Add the site link near the top ("🔗 Software & GitHub overview: https://matthiaskoenig.github.io").
- [ ] **Step 3: CLAUDE.md** — add `npm run fetch:fixtures` to the commands and note the primary-language stats decision; point to `site/README.md`.
- [ ] **Step 4: Spec** — replace "language byte totals across the listed repos" with "primary-language counts across the listed repos" in the fetched-data table.
- [ ] **Step 5: Commit** — `git commit -m "Document the site: README, CLAUDE.md, spec update"`.

---

### Task 15: Final verification

- [ ] `cd site && rm -rf src/data/github && npm run build` → fails with the "Missing snapshot" message (proves the guard).
- [ ] `npm run fetch:fixtures && npm test && npm run check && npm run build` → all green.
- [ ] If a `GITHUB_TOKEN` is available: `npm run fetch && npm run build`, inspect the real page in `npm run preview`.
- [ ] `git status` clean; snapshots not tracked.
