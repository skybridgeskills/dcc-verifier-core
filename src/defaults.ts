/**
 * Default configuration and context builder.
 *
 * This module is the adapter composition point — it wires concrete
 * implementations (document loader, crypto suites) into the
 * `VerificationContext` that the core pipeline consumes.
 *
 * Callers can override any default via `buildContext()`.
 */

import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalcredentials/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite';
import { securityLoader } from '@digitalcredentials/security-document-loader';
import { DataIntegrityCryptoService } from './services/data-integrity-crypto.js';
import { CryptoSuite } from './types/crypto-suite.js';
import { VerificationContext, FetchJson } from './types/context.js';
import { VerificationSuite } from './types/check.js';
import type { CryptoService } from './types/crypto-service.js';

import { coreSuite } from './suites/core/index.js';
import { proofSuite } from './suites/proof/index.js';
import { statusSuite } from './suites/status/index.js';
import { registrySuite } from './suites/registry/index.js';
import { obv3SchemaSuite } from './suites/schema/index.js';

const eddsaSuite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });
const ed25519Suite = new Ed25519Signature2020();

/**
 * Default JSON-LD document loader.
 *
 * Uses `@digitalcredentials/security-document-loader` with remote context
 * fetching enabled. Common contexts (VC v1/v2, security suites, OBv3) are
 * bundled and cached; unknown contexts are fetched from the network.
 */
export const defaultDocumentLoader = securityLoader({ fetchRemoteContexts: true }).build();

/**
 * Default plain-JSON fetcher (AJV schema load, future OIDF/OIDC/JWKS).
 *
 * Uses the global `fetch` API. Not used for JSON-LD — see {@link defaultDocumentLoader}.
 */
export const defaultFetchJson: FetchJson = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
};

/**
 * Default crypto suites for signature verification.
 *
 * Both are included because credentials in the wild use either:
 * - Ed25519Signature2020 (older Linked Data Proof)
 * - EdDSA/RDFC 2022 (newer Data Integrity Proof)
 */
export const defaultCryptoSuites: CryptoSuite[] = [ed25519Suite, eddsaSuite];

/**
 * Default {@link CryptoService} stack — one Data Integrity adapter using {@link defaultCryptoSuites}.
 */
export const defaultCryptoServices: CryptoService[] = [
  DataIntegrityCryptoService({ suites: defaultCryptoSuites }),
];

/**
 * Default verification suites, run in order for every credential:
 *
 * 1. **core** — structure validation (context, VC context URI, credential id, proof exists)
 * 2. **proof** — cryptographic signature verification
 * 3. **status** — revocation/suspension via BitstringStatusList
 * 4. **registry** — issuer DID lookup in known registries
 * 5. **schema.obv3** — OBv3 JSON Schema conformance (non-fatal)
 */
export const defaultSuites: VerificationSuite[] = [
  coreSuite,
  proofSuite,
  statusSuite,
  registrySuite,
  obv3SchemaSuite,
];

/**
 * Build a `VerificationContext` with defaults, optionally overridden.
 *
 * This is the composition point where caller-provided adapters (or defaults)
 * are assembled into the context that every check receives.
 *
 * @example
 * ```ts
 * const ctx = buildContext({ registries: myRegistries });
 * ```
 */
export function buildContext(overrides?: Partial<VerificationContext>): VerificationContext {
  const cryptoSuites = overrides?.cryptoSuites ?? defaultCryptoSuites;
  const cryptoServices =
    overrides?.cryptoServices ?? [DataIntegrityCryptoService({ suites: cryptoSuites })];

  return {
    documentLoader: overrides?.documentLoader ?? defaultDocumentLoader,
    fetchJson: overrides?.fetchJson ?? defaultFetchJson,
    cryptoSuites,
    cryptoServices,
    registries: overrides?.registries,
    lookupIssuers: overrides?.lookupIssuers,
    challenge: overrides?.challenge ?? null,
    unsignedPresentation: overrides?.unsignedPresentation ?? false,
  };
}
