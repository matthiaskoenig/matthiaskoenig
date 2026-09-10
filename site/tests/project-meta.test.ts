import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildProjectMeta, findZenodoInReadme, parseCitationCff, parsePyproject } from '../scripts/lib/project-meta.ts';
import { projectMetaSchema } from '../scripts/lib/schemas.ts';

const fx = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)), 'utf8');

describe('parseCitationCff', () => {
  test('reads doi, version and license from the real sbmlutils file', () => {
    expect(parseCitationCff(fx('CITATION.cff'))).toEqual({ version: '0.10.0', zenodoDoi: '10.5281/zenodo.597149', license: 'MIT' });
  });
  test('ignores non-Zenodo DOIs', () => {
    expect(parseCitationCff('doi: 10.1093/nar/gkaa990\n').zenodoDoi).toBeNull();
  });
});

describe('parsePyproject', () => {
  test('reads requires-python, sorted classifiers and license from the real sbmlutils file', () => {
    const p = parsePyproject(fx('pyproject.toml'));
    expect(p.requiresPython).toBe('>=3.11');
    expect(p.pythonVersions).toEqual(['3.11', '3.12', '3.13', '3.14']);
    expect(p.license).toBe('MIT');
  });
  test('handles the table form of license and missing classifiers', () => {
    const p = parsePyproject('[project]\nname = "x"\nlicense = { text = "LGPL-3.0" }\n');
    expect(p.license).toBe('LGPL-3.0');
    expect(p.pythonVersions).toEqual([]);
    expect(p.requiresPython).toBeNull();
  });
});

describe('findZenodoInReadme', () => {
  test('finds the DOI badge', () => {
    expect(findZenodoInReadme(fx('README-badges.md')).doi).toBe('10.5281/zenodo.597155');
  });
  test('reports a latestdoi badge for later resolution', () => {
    const r = findZenodoInReadme('[![DOI](https://zenodo.org/badge/5066/matthiaskoenig/cy3sbml.svg)](https://zenodo.org/badge/latestdoi/5066/matthiaskoenig/cy3sbml)');
    expect(r.doi).toBeNull();
    expect(r.latestDoiBadge).toBe('https://zenodo.org/badge/latestdoi/5066/matthiaskoenig/cy3sbml');
  });
});

describe('buildProjectMeta', () => {
  test('prefers CITATION.cff, falls back to pyproject and README, validates against the schema', () => {
    const m = buildProjectMeta({ citation: fx('CITATION.cff'), pyproject: fx('pyproject.toml'), readme: fx('README-badges.md') });
    expect(projectMetaSchema.parse(m)).toEqual({
      version: '0.10.0', zenodoDoi: '10.5281/zenodo.597149', license: 'MIT', requiresPython: '>=3.11', pythonVersions: ['3.11', '3.12', '3.13', '3.14'],
    });
  });
  test('uses the resolved badge DOI when nothing else is available', () => {
    const m = buildProjectMeta({ readme: 'no badge', resolvedBadgeDoi: '10.5281/zenodo.17406771' });
    expect(m.zenodoDoi).toBe('10.5281/zenodo.17406771');
    expect(m.pythonVersions).toEqual([]);
  });
});
