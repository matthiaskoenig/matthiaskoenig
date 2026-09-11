import { expect, test } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureData } from '../scripts/make-fixture-data.ts';
import { buildReadme } from '../scripts/render-readme.ts';
import { renderImages } from '../scripts/render-images.ts';
import { existsSync, readFileSync } from 'node:fs';

test('the README renders every section from fixture snapshots and the curated YAML', () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const dataDir = mkdtempSync(join(tmpdir(), 'readme-'));
  makeFixtureData({ contentDir, outDir: dataDir, now: new Date('2026-09-10T00:00:00Z') });
  const md = buildReadme(contentDir, dataDir);
  for (const h of ['# Prof. Dr. Matthias König', '## 🔬 Research interests', '## 💻 Main projects', '## 📊 Contributions', '## 🚀 Latest releases', '## ⭐ Repositories', '## 📚 Learn more']) {
    expect(md).toContain(h);
  }
  expect(md.match(/^\| <img/gm)?.length).toBe(7); // one table row per main project
  expect(md).toContain('**[Digital Pathology](');
  expect(md).toContain('./images/generated/topics/digital-pathology.svg');
  expect(md).toContain('./images/generated/charts/release-timeline.svg');
  expect(md).toContain('data fetched on 2026-09-10');
  expect(md).not.toContain('undefined');
  expect(md).toMatch(/- <img src="[^"]+\/projects\/sbmlutils\.webp" height="16" alt=""> \*\*sbmlutils\*\*/);
});

test('renderImages writes the charts, the calendar and the five topic icons as SVG', () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const dataDir = mkdtempSync(join(tmpdir(), 'readme-data-'));
  const outDir = mkdtempSync(join(tmpdir(), 'readme-img-'));
  makeFixtureData({ contentDir, outDir: dataDir, now: new Date('2026-09-10T00:00:00Z') });
  const files = renderImages(contentDir, dataDir, outDir);
  expect(files).toContain('charts/release-timeline.svg');
  expect(files.filter((f) => f.startsWith('topics/')).length).toBe(5);
  for (const f of files) {
    expect(existsSync(join(outDir, f))).toBe(true);
    expect(readFileSync(join(outDir, f), 'utf8')).toMatch(/^<svg/);
  }
  expect(readFileSync(join(outDir, 'charts/calendar.svg'), 'utf8')).toContain('contributions in the last year');
});
