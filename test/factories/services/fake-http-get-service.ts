import type { HttpGetResult } from '../../../src/types/http.js';
import type { HttpGetService } from '../../../src/services/http-get-service/http-get-service.js';

export type FakeHttpGetServiceOptions = {
  /** Called for every GET (after map lookup fails if no map entry). */
  fallback?: HttpGetService;
};

/**
 * Test double: URL → fixed {@link HttpGetResult} (status 200 by default).
 * Throws if URL unmapped and no fallback.
 */
export function FakeHttpGetService(
  urlMap: Record<string, HttpGetResult>,
  options: FakeHttpGetServiceOptions = {},
): HttpGetService {
  const { fallback } = options;

  return {
    async get(url: string): Promise<HttpGetResult> {
      if (Object.prototype.hasOwnProperty.call(urlMap, url)) {
        return urlMap[url];
      }
      if (fallback !== undefined) {
        return fallback.get(url);
      }
      throw new Error(`No fake HttpGetService for URL: ${url}`);
    },
  };
}

export type FakeHttpGetService = ReturnType<typeof FakeHttpGetService>;

/** Build a 200 OK result with JSON body and empty Headers. */
export function okJsonBody(body: unknown): HttpGetResult {
  return { body, headers: new Headers(), status: 200 };
}

/** Build an {@link HttpGetResult} with arbitrary status (e.g. 404, 503). */
export function httpGetResult(
  status: number,
  body: unknown,
  headers: Headers = new Headers(),
): HttpGetResult {
  return { body, headers, status };
}
