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
  test('returns parsed json for the api url', async () => {
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
    const f = fakeFetch([{ status: 404 }, { status: 404 }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.rest('/repos/o/gone')).rejects.toThrow(/\/repos\/o\/gone/);
    await expect(c.rest('/repos/o/gone')).rejects.toBeInstanceOf(GitHubNotFoundError);
    expect(f.calls).toHaveLength(2);
  });
});

describe('GitHubClient.graphql', () => {
  test('rejects when the response carries errors', async () => {
    const f = fakeFetch([{ status: 200, body: { errors: [{ message: 'bad' }] } }]);
    const c = new GitHubClient({ token: 't', fetchImpl: f.impl, sleep: noSleep });
    await expect(c.graphql('query {}', {})).rejects.toThrow(/bad/);
  });
});

describe('GitHubClient.raw / resolveZenodoBadge', () => {
  test('raw returns text, or null on 404', async () => {
    const calls: string[] = [];
    const impl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return String(url).endsWith('missing.txt') ? new Response('', { status: 404 }) : new Response('doi: x', { status: 200 });
    }) as typeof fetch;
    const c = new GitHubClient({ token: 't', fetchImpl: impl, sleep: noSleep });
    await expect(c.raw('o/r', 'develop', 'CITATION.cff')).resolves.toBe('doi: x');
    await expect(c.raw('o/r', 'develop', 'missing.txt')).resolves.toBeNull();
    expect(calls[0]).toBe('https://raw.githubusercontent.com/o/r/develop/CITATION.cff');
  });
  test('resolveZenodoBadge reads the DOI from the redirect location', async () => {
    const impl = (async () => new Response('', { status: 302, headers: { location: 'https://doi.org/10.5281/zenodo.17406771' } })) as typeof fetch;
    const c = new GitHubClient({ token: 't', fetchImpl: impl, sleep: noSleep });
    await expect(c.resolveZenodoBadge('https://zenodo.org/badge/latestdoi/5066/matthiaskoenig/cy3sbml')).resolves.toBe('10.5281/zenodo.17406771');
  });
});
