import { expect, test } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixtureData } from '../scripts/make-fixture-data.ts';
import { buildReadme } from '../scripts/render-readme.ts';

test('the README renders every section from fixture snapshots and the curated YAML', () => {
  const contentDir = fileURLToPath(new URL('../src/content/', import.meta.url));
  const dataDir = mkdtempSync(join(tmpdir(), 'readme-'));
  makeFixtureData({ contentDir, outDir: dataDir, now: new Date('2026-09-10T00:00:00Z') });
  const md = buildReadme(contentDir, dataDir);
  for (const h of ['# Prof. Dr. Matthias König', '## 🔬 Research interests', '## 💻 Main projects', '## 🚀 Latest releases', '## 📊 Activity', '## 📚 Learn more']) {
    expect(md).toContain(h);
  }
  expect(md.match(/^\| <img/gm)?.length).toBe(7); // one table row per main project
  expect(md).toContain('**[Digital Pathology](');
  expect(md).toContain('data fetched on 2026-09-10');
  expect(md).not.toContain('undefined');
  expect(md).toMatch(/- <img src="[^"]+\/projects\/sbmlutils\.webp" height="16" alt=""> \*\*sbmlutils\*\*/);
});
