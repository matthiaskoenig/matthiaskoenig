import { describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadCuratedYaml } from '../src/content/schemas.ts';

const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));

describe('curated content', () => {
  test('all three files parse against their schemas', () => {
    const c = loadCuratedYaml(contentDir);
    expect(c.projects.length).toBe(7);
    expect(c.groups.length).toBeGreaterThan(0);
    expect(c.research.length).toBeGreaterThanOrEqual(3);
  });
  test('no repository appears in both projects and groups', () => {
    const c = loadCuratedYaml(contentDir);
    const main = new Set(c.projects.map((p) => p.repo));
    for (const g of c.groups) for (const r of g.repos) expect(main.has(r)).toBe(false);
  });
  test('every project tag is one of the research topics', () => {
    const c = loadCuratedYaml(contentDir);
    const tags = new Set(c.research.map((r) => r.tag));
    for (const p of c.projects) for (const t of p.tags) expect(tags.has(t), `${p.id}: unknown tag ${t}`).toBe(true);
    expect(c.research.length).toBe(5);
  });
  test('charts_exclude names cy2 packages and linux-setup, all within their groups', () => {
    const c = loadCuratedYaml(contentDir);
    const excluded = c.groups.flatMap((g) => g.charts_exclude);
    expect(excluded).toContain('matthiaskoenig/linux-setup');
    expect(excluded.filter((r) => r.includes('/cy2')).length).toBe(4);
  });
  test('project order is 1..n without gaps', () => {
    const orders = loadCuratedYaml(contentDir).projects.map((p) => p.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
