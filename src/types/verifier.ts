/**
 * Public types for the `createVerifier(...)` factory.
 *
 * The verifier owns long-lived dependencies (HTTP, cache, crypto services,
 * registries, registry handlers, document loader) and exposes per-call
 * methods that share those dependencies — most importantly, the cache.
 *
 * Hold a single `Verifier` for any batch or repeated verification work so
 * issuer DID documents, status list credentials, and JSON-LD contexts are
 * fetched once. The standalone `verifyCredential` / `verifyPresentation`
 * functions construct a fresh `Verifier` per call and are intended only
 * for one-shot use.
 *
 * @see {@link createVerifier}
 */

import type { CacheService } from '../services/cache-service/cache-service.js';
import type { CryptoService } from './crypto-service.js';
import type { DocumentLoader } from './context.js';
import type { HttpGetService } from '../services/http-get-service/http-get-service.js';
import type { EntityIdentityRegistry } from './registry.js';
import type { VerificationSuite } from './check.js';
import type { RecognizerSpec } from './recognition.js';
import type { RegistryHandlerMap } from '../services/registry-handlers/types.js';
import type {
  CredentialVerificationResult,
  PresentationVerificationResult,
} from './result.js';

/**
 * Long-lived dependencies for a `Verifier`.
 *
 * All fields optional. Omitted fields are filled by lazy memoized
 * defaults internal to the package.
 */
export interface VerifierConfig {
  /** Unified HTTP GET service (handles caching, retry, etc). Defaults to a built-in one. */
  httpGetService?: HttpGetService;

  /** Domain cache service (registry lookups, etc). Defaults to an in-memory store. */
  cacheService?: CacheService;

  /**
   * Pluggable crypto verification services. Defaults to one
   * `DataIntegrityCryptoService` covering Ed25519Signature2020 and
   * EdDSA/RDFC 2022.
   */
  cryptoServices?: CryptoService[];

  /** Default issuer registries to consult. Per-call `registries` overrides this. */
  registries?: EntityIdentityRegistry[];

  /**
   * Per-type registry handler map. Lets callers add or replace
   * handlers (e.g. plug in a custom registry type). The verifier still
   * owns the orchestration (caching, short-circuit, threading itself
   * into `vc-recognition`).
   */
  registryHandlers?: RegistryHandlerMap;

  /**
   * Advanced override. Defaults to a loader derived from
   * `httpGetService`. Provide one only if you need custom JSON-LD
   * resolution semantics (e.g. a fixture map for offline tests).
   */
  documentLoader?: DocumentLoader;

  /**
   * Pluggable credential recognizers. The built-in
   * `recognitionSuite` iterates these in registration order and
   * surfaces the first applies-true match's normalized form on
   * {@link CredentialVerificationResult.normalizedVerifiableCredential}
   * + {@link CredentialVerificationResult.recognizedProfile}.
   *
   * Defaults to `[]` — recognition emits `'skipped'` and no
   * normalized form is produced. The `verifier-core` package stays
   * profile-agnostic by default; consumers wire OB recognition by
   * importing `obv3p0Recognizer` from
   * `@digitalcredentials/verifier-core/openbadges` and passing it
   * here.
   */
  recognizers?: RecognizerSpec[];
}

/** Per-call inputs for `verifyCredential`. */
export interface VerifyCredentialCall {
  /** The credential to verify (parsed internally via Zod). */
  credential: unknown;

  /** Additional verification suites to run after the defaults. */
  additionalSuites?: VerificationSuite[];

  /**
   * Override the constructor's `registries` for this single call.
   * `undefined` falls through to the constructor default. An empty
   * array `[]` explicitly disables the registry suite for this call —
   * used by the `vc-recognition` handler to break recursion.
   */
  registries?: EntityIdentityRegistry[];
}

/** Per-call inputs for `verifyPresentation`. */
export interface VerifyPresentationCall {
  /** The presentation to verify (parsed internally via Zod). */
  presentation: unknown;

  /** Expected challenge for authentication proof purpose. */
  challenge?: string | null;

  /** Whether to allow unsigned presentations (skip VP signature check). */
  unsignedPresentation?: boolean;

  /** Additional verification suites to run after the defaults. */
  additionalSuites?: VerificationSuite[];

  /** Override the constructor's `registries` for this single call. See {@link VerifyCredentialCall.registries}. */
  registries?: EntityIdentityRegistry[];
}

/**
 * A configured verifier instance.
 *
 * Built by `createVerifier(config)`. Holds long-lived dependencies and
 * shares them — including the cache — across all calls on this
 * instance.
 */
export interface Verifier {
  verifyCredential: (call: VerifyCredentialCall) => Promise<CredentialVerificationResult>;
  verifyPresentation: (call: VerifyPresentationCall) => Promise<PresentationVerificationResult>;
}
