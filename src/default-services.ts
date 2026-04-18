/**
 * Lazy memoized factories for the default service implementations the
 * `Verifier` falls back to when the caller doesn't pass overrides.
 *
 * Memoization is per-process and only of *construction*. Each factory
 * caches the constructed object so we don't pay for repeated module
 * setup, but the returned objects are themselves stateless adapters
 * (HTTP, JSON-LD loader) — except for `defaultCacheService`, which
 * intentionally returns a fresh in-memory store on first call so two
 * separate `createVerifier()` instances default to the same underlying
 * cache.
 *
 * Internal module — not exported from `index.ts`.
 */

import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalcredentials/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite';
import { securityLoader } from '@digitalcredentials/security-document-loader';
import { BuiltinHttpGetService } from './services/http-get-service/builtin-http-get-service.js';
import { InMemoryCacheService } from './services/cache-service/in-memory-cache-service.js';
import { DataIntegrityCryptoService } from './services/data-integrity-crypto.js';
import { documentLoaderFromHttpGet } from './util/document-loader-from-http-get.js';
import type { CryptoService } from './types/crypto-service.js';
import type { CryptoSuite } from './types/crypto-suite.js';
import type { DocumentLoader } from './types/context.js';
import type { HttpGetService } from './services/http-get-service/http-get-service.js';
import type { CacheService } from './services/cache-service/cache-service.js';

/** Default {@link HttpGetService}. Memoized per process. */
export function defaultHttpGetService(): HttpGetService {
  if (!cachedHttp) cachedHttp = BuiltinHttpGetService();
  return cachedHttp;
}

/** Default {@link CacheService}. Memoized per process — see module doc. */
export function defaultCacheService(): CacheService {
  if (!cachedCache) cachedCache = InMemoryCacheService();
  return cachedCache;
}

/**
 * Default crypto suites: Ed25519Signature2020 + EdDSA/RDFC 2022.
 *
 * Both are included because credentials in the wild use either the older
 * Linked Data Proof or the newer Data Integrity Proof.
 */
export function defaultCryptoSuites(): CryptoSuite[] {
  if (!cachedCryptoSuites) {
    cachedCryptoSuites = [
      new Ed25519Signature2020(),
      new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite }),
    ];
  }
  return cachedCryptoSuites;
}

/** Default {@link CryptoService} stack — one Data Integrity adapter using {@link defaultCryptoSuites}. */
export function defaultCryptoServices(): CryptoService[] {
  if (!cachedCryptoServices) {
    cachedCryptoServices = [DataIntegrityCryptoService({ suites: defaultCryptoSuites() })];
  }
  return cachedCryptoServices;
}

/**
 * Build a {@link DocumentLoader} for the given {@link HttpGetService}.
 *
 * When `httpGetService` is the package default, this returns the
 * memoized `securityLoader`-based loader (bundled common contexts +
 * remote fetch). When it's a caller-provided service, returns a fresh
 * loader derived from it so the loader's HTTP behavior matches the
 * caller's service (mocks, fixtures, custom retry, etc.).
 */
export function defaultDocumentLoaderFor(httpGetService: HttpGetService): DocumentLoader {
  if (httpGetService === cachedHttp || httpGetService === undefined) {
    if (cachedDocumentLoader === undefined) {
      const loader = securityLoader({ fetchRemoteContexts: true }).build() as DocumentLoader;
      cachedDocumentLoader = loader;
      return loader;
    }
    return cachedDocumentLoader;
  }
  return documentLoaderFromHttpGet(httpGetService);
}

let cachedHttp: HttpGetService | undefined;
let cachedCache: CacheService | undefined;
let cachedCryptoSuites: CryptoSuite[] | undefined;
let cachedCryptoServices: CryptoService[] | undefined;
let cachedDocumentLoader: DocumentLoader | undefined;
