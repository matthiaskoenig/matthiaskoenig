/** Thin GitHub API client: auth headers, JSON parsing, retry with backoff. */
export class GitHubHttpError extends Error {
  status: number;
  path: string;
  retryAfterSeconds = 0;
  constructor(status: number, path: string, body: string) {
    super(`GitHub ${status} for ${path}: ${body.slice(0, 200)}`);
    this.status = status;
    this.path = path;
  }
}
export class GitHubNotFoundError extends GitHubHttpError {
  constructor(path: string) {
    super(404, path, 'not found');
  }
}

const RETRY_STATUS = new Set([403, 429, 500, 502, 503, 504]);
const BACKOFF_MS = [1000, 2000, 4000];
const TIMEOUT_MS = 30_000;

/** Network-level failure (DNS, reset, timeout): retried like a 5xx. */
export class GitHubNetworkError extends Error {
  constructor(url: string, cause: unknown) {
    super(`Network error for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

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

  /** fetch with a timeout; a thrown network error becomes a GitHubNetworkError. */
  private async doFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
    } catch (err) {
      throw new GitHubNetworkError(url, err);
    }
  }

  /** Runs `fn` up to three times, backing off on retryable HTTP errors and network errors. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let last: Error | null = null;
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const retryable = err instanceof GitHubNetworkError || (err instanceof GitHubHttpError && RETRY_STATUS.has(err.status));
        if (!retryable) throw err;
        last = err as Error;
        const retryAfter = err instanceof GitHubHttpError ? err.retryAfterSeconds : 0;
        await this.sleep(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS[attempt]);
      }
    }
    throw last!;
  }

  private request<T>(path: string, init: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    return this.withRetry(async () => {
      const res = await this.doFetch(url, { ...init, headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) } });
      if (res.status === 404) throw new GitHubNotFoundError(path);
      if (res.ok) return (await res.json()) as T;
      const err = new GitHubHttpError(res.status, path, await res.text());
      err.retryAfterSeconds = Number(res.headers.get('retry-after')) || 0;
      throw err;
    });
  }

  rest<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  /** Raw file from a repository, or null when it does not exist. */
  raw(repo: string, branch: string, file: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
    return this.withRetry(async () => {
      const res = await this.doFetch(url, { headers: { 'user-agent': 'matthiaskoenig-site-fetch' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new GitHubHttpError(res.status, url, await res.text());
      return await res.text();
    });
  }

  /**
   * Resolves a Zenodo `latestdoi` badge to the DOI it redirects to. Optional
   * metadata: a failure (after retries) yields null with a warning instead of
   * failing the whole fetch.
   */
  async resolveZenodoBadge(url: string): Promise<string | null> {
    try {
      return await this.withRetry(async () => {
        // Zenodo answers 403 to Node's default user agent; a browser-like one with contact info passes.
        const res = await this.doFetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; matthiaskoenig-site-fetch; +https://github.com/matthiaskoenig/matthiaskoenig)' },
        });
        if (res.status >= 500 || res.status === 429) throw new GitHubHttpError(res.status, url, '');
        const location = res.headers.get('location') ?? '';
        const m = location.match(/(10\.5281\/zenodo\.\d+)/);
        return m ? m[1] : null;
      });
    } catch (err) {
      console.warn(`Could not resolve ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const body = await this.request<{ data?: unknown; errors?: Array<{ message: string }> }>('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (body.errors?.length) throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
    return body as T;
  }
}
