/**
 * Caller-facing option types for `verifyCredential` and `verifyPresentation`.
 *
 * Options are the public API surface — they accept `unknown` inputs (parsed
 * internally via Zod) and optional overrides for services and configuration.
 * Internally, options are translated into a `VerificationContext` via
 * `buildContext()` before checks run.
 */

import type { VerificationSuite } from './check.js';
import type { CacheService } from '../services/cache-service/cache-service.js';
import type { DocumentLoader, FetchJson } from './context.js';
import type { HttpGetService } from '../services/http-get-service/http-get-service.js';
import type { CryptoService } from './crypto-service.js';
import type { CryptoSuite } from './crypto-suite.js';
import type { EntityIdentityRegistry, LookupIssuers } from './registry.js';

/**
 * Options for `verifyCredential`.
 *
 * Only `credential` is required. All other fields override defaults from
 * `buildContext()`.
 */
export interface VerifyCredentialOptions {
  /** The credential to verify (unknown type, will be parsed) */
  credential: unknown;

  /** Optional issuer registries for registry checks (alias: knownDIDRegistries) */
  registries?: EntityIdentityRegistry[];
  /** @deprecated Use registries instead */
  knownDIDRegistries?: EntityIdentityRegistry[];

  /** Additional custom verification suites to run */
  additionalSuites?: VerificationSuite[];

  /**
   * When `false`, skips the OBv3 JSON Schema / result-ref suite (`schema.obv3`).
   * Faster; less Open Badges conformance signal. Default: validate OBv3 when applicable.
   */
  verifyObv3Schema?: boolean;

  /** Custom document loader (defaults to securityLoader) */
  documentLoader?: DocumentLoader;

  /** Plain JSON fetcher (defaults to fetch + json(); used by OBv3 schema after phase 3) */
  fetchJson?: FetchJson;

  /**
   * Unified HTTP GET service. When set without {@link documentLoader} / {@link fetchJson},
   * those are derived from this in `buildContext()`.
   */
  httpGetService?: HttpGetService;

  /** Domain cache service (registry lookups, etc.). */
  cacheService?: CacheService;

  /** Custom crypto suites for signature verification */
  cryptoSuites?: CryptoSuite[];

  /** Pluggable crypto services */
  cryptoServices?: CryptoService[];

  /** Custom registry lookup */
  lookupIssuers?: LookupIssuers;
}

/**
 * Options for `verifyPresentation`.
 *
 * Only `presentation` is required. Includes presentation-specific fields
 * (`challenge`, `unsignedPresentation`) plus the same overrides as credential
 * verification.
 */
export interface VerifyPresentationOptions {
  /** The presentation to verify (unknown type, will be parsed) */
  presentation: unknown;

  /** Expected challenge for authentication proof purpose */
  challenge?: string | null;

  /** Whether to allow unsigned presentations */
  unsignedPresentation?: boolean;

  /** Optional issuer registries for registry checks (alias: knownDIDRegistries) */
  registries?: EntityIdentityRegistry[];
  /** @deprecated Use registries instead */
  knownDIDRegistries?: EntityIdentityRegistry[];

  /** Additional custom verification suites to run */
  additionalSuites?: VerificationSuite[];

  /** @see {@link VerifyCredentialOptions.verifyObv3Schema} */
  verifyObv3Schema?: boolean;

  /** Custom document loader (defaults to securityLoader) */
  documentLoader?: DocumentLoader;

  /** Plain JSON fetcher (defaults to fetch + json(); used by OBv3 schema after phase 3) */
  fetchJson?: FetchJson;

  /** @see {@link VerifyCredentialOptions.httpGetService} */
  httpGetService?: HttpGetService;

  /** @see {@link VerifyCredentialOptions.cacheService} */
  cacheService?: CacheService;

  /** Custom crypto suites for signature verification */
  cryptoSuites?: CryptoSuite[];

  /** Pluggable crypto services */
  cryptoServices?: CryptoService[];

  /** Custom registry lookup */
  lookupIssuers?: LookupIssuers;
}
