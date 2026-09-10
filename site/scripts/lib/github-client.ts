/** Thin GitHub API client: auth headers, JSON parsing, retry with backoff. */
export class GitHubHttpError extends Error {
  status: number;
  path: string;
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
      const res = await this.fetchImpl(url, {
        ...init,
        headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
      });
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
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (body.errors?.length) throw new Error(`GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`);
    return body as T;
  }
}
