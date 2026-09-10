import type { ProjectMeta } from './schemas.ts';

const ZENODO_DOI = /10\.5281\/zenodo\.\d+/;

/** `doi`, `version` and `license` top-level keys of a CITATION.cff (no YAML parser needed). */
export function parseCitationCff(text: string): Partial<Pick<ProjectMeta, 'version' | 'zenodoDoi' | 'license'>> {
  const get = (key: string) => text.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'))?.[1]?.trim() ?? null;
  const doi = get('doi');
  return {
    version: get('version'),
    zenodoDoi: doi && ZENODO_DOI.test(doi) ? doi.match(ZENODO_DOI)![0] : null,
    license: get('license'),
  };
}

/** `requires-python`, the Python classifiers and the license of a pyproject.toml. */
export function parsePyproject(text: string): Pick<ProjectMeta, 'requiresPython' | 'pythonVersions' | 'license'> & { version: string | null } {
  const requiresPython = text.match(/^requires-python\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  const pythonVersions = [...text.matchAll(/Programming Language :: Python :: (3\.\d+)/g)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
  const license =
    text.match(/^license\s*=\s*["']([^"']+)["']/m)?.[1] ?? text.match(/^license\s*=\s*\{\s*text\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  const version = text.match(/^version\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  return { requiresPython, pythonVersions, license, version };
}

/** A Zenodo DOI from a README badge or link, or the URL of a `latestdoi` badge that still has to be resolved. */
export function findZenodoInReadme(text: string): { doi: string | null; latestDoiBadge: string | null } {
  const doi = text.match(/zenodo\.org\/badge\/DOI\/(10\.5281\/zenodo\.\d+)/)?.[1] ?? text.match(/doi\.org\/(10\.5281\/zenodo\.\d+)/)?.[1] ?? null;
  const latestDoiBadge = text.match(/https?:\/\/zenodo\.org\/badge\/latestdoi\/[\w./-]+/)?.[0] ?? null;
  return { doi, latestDoiBadge };
}

/** Combines the three sources; CITATION.cff wins over pyproject.toml, which wins over the README. */
export function buildProjectMeta(parts: {
  citation?: string | null;
  pyproject?: string | null;
  readme?: string | null;
  resolvedBadgeDoi?: string | null;
}): ProjectMeta {
  const c = parts.citation ? parseCitationCff(parts.citation) : {};
  const p = parts.pyproject ? parsePyproject(parts.pyproject) : { requiresPython: null, pythonVersions: [], license: null, version: null };
  const r = parts.readme ? findZenodoInReadme(parts.readme) : { doi: null, latestDoiBadge: null };
  return {
    version: c.version ?? p.version ?? null,
    zenodoDoi: c.zenodoDoi ?? r.doi ?? parts.resolvedBadgeDoi ?? null,
    license: c.license ?? p.license ?? null,
    requiresPython: p.requiresPython,
    pythonVersions: p.pythonVersions,
  };
}
