/**
 * Verification context — the composition seam between core logic and external services.
 *
 * Every check receives a `VerificationContext`. It carries injected services
 * (document loader, plain JSON fetch, crypto) and configuration (registries, challenge).
 * Callers build it via `buildContext()` with optional overrides.
 *
 * In hexagonal terms, this is where adapters (concrete implementations) are
 * assembled and handed to the core domain. The core never imports concrete
 * dependencies directly — it reads them from the context.
 */

import type { CryptoService } from './crypto-service.js';
import type { CryptoSuite } from './crypto-suite.js';
import type { EntityIdentityRegistry, LookupIssuers } from './registry.js';

/**
 * Resolves a URL to a JSON-LD document (or other linked resource).
 *
 * This is a port interface — the default implementation uses
 * `@digitalcredentials/security-document-loader` with cached contexts,
 * but callers can inject any loader (e.g. one that reads from a fixture map
 * in tests).
 */
export type DocumentLoader = (url: string) => Promise<unknown>;

/**
 * Fetches a plain JSON document by URL — no JSON-LD envelope.
 *
 * Used for resources that are not JSON-LD (e.g. JSON Schema for OBv3 AJV, and in the
 * future OIDF entity configs, OIDC discovery, JWKS). Kept separate from
 * {@link DocumentLoader} because JSON-LD loaders wrap results in
 * `{ contextUrl, document, documentUrl }` and use different fetch semantics.
 */
export type FetchJson = (url: string) => Promise<unknown>;

/**
 * Shared resources and configuration available to all verification checks.
 *
 * Built by `buildContext()` from caller-provided `VerifyCredentialOptions`.
 */
export interface VerificationContext {
  documentLoader: DocumentLoader;
  fetchJson: FetchJson;
  /**
   * Linked Data Proof / Data Integrity suite instances for `@digitalcredentials/vc`.
   *
   * Mirrored into the default {@link cryptoServices} entry by `buildContext()`. Callers may
   * override {@link cryptoServices} alone; this field stays in sync when only `cryptoSuites`
   * is overridden.
   */
  cryptoSuites: CryptoSuite[];
  /**
   * Pluggable crypto verification services (Data Integrity today; JWT / others later).
   * The proof suite dispatches to the first service whose `canVerify(subject)` is true.
   */
  cryptoServices: CryptoService[];
  registries?: EntityIdentityRegistry[];
  /**
   * Optional issuer registry lookup. When omitted, the registry check uses the default
   * adapter (phase 3).
   */
  lookupIssuers?: LookupIssuers;
  /** Expected challenge for VP authentication proof purpose. */
  challenge?: string | null;
  /** Whether to allow unsigned presentations (skip VP signature check). */
  unsignedPresentation?: boolean;
}
