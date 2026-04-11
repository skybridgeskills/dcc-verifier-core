/**
 * Verification context — the composition seam between core logic and external services.
 *
 * Every check receives a `VerificationContext`. It carries injected services
 * (document loader, crypto suites) and configuration (registries, challenge).
 * Callers build it via `buildContext()` with optional overrides.
 *
 * In hexagonal terms, this is where adapters (concrete implementations) are
 * assembled and handed to the core domain. The core never imports concrete
 * dependencies directly — it reads them from the context.
 */

import type { CryptoSuite } from './crypto-suite.js';
import type { EntityIdentityRegistry } from './registry.js';

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
 * Shared resources and configuration available to all verification checks.
 *
 * Built by `buildContext()` from caller-provided `VerifyCredentialOptions`.
 */
export interface VerificationContext {
  documentLoader: DocumentLoader;
  cryptoSuites: CryptoSuite[];
  registries?: EntityIdentityRegistry[];
  /** Expected challenge for VP authentication proof purpose. */
  challenge?: string | null;
  /** Whether to allow unsigned presentations (skip VP signature check). */
  unsignedPresentation?: boolean;
}
