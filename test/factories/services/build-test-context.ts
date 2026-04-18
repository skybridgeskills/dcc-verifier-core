/**
 * Test-only helper that assembles a {@link VerificationContext} with
 * sensible defaults — equivalent to the old `buildContext()` from
 * `src/defaults.ts` (deleted in P-A phase 4).
 *
 * Production code does not use this; the public path is
 * `createVerifier(...)`. Suite unit tests use it because they exercise
 * a single suite against a hand-built context, not the full pipeline.
 *
 * Mirrors the legacy precedence: explicit overrides win, otherwise
 * services derive from `httpGetService` if provided, otherwise process
 * defaults are used.
 */

import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalcredentials/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite';
import { securityLoader } from '@digitalcredentials/security-document-loader';
import { DataIntegrityCryptoService } from '../../../src/services/data-integrity-crypto.js';
import { createRegistryLookup } from '../../../src/services/registry-lookup.js';
import { BuiltinHttpGetService } from '../../../src/services/http-get-service/builtin-http-get-service.js';
import { InMemoryCacheService } from '../../../src/services/cache-service/in-memory-cache-service.js';
import { documentLoaderFromHttpGet } from '../../../src/util/document-loader-from-http-get.js';
import { fetchJsonFromHttpGet } from '../../../src/util/fetch-json-from-http-get.js';
import type { VerificationContext, FetchJson } from '../../../src/types/context.js';
import type { CryptoSuite } from '../../../src/types/crypto-suite.js';

const eddsaSuite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });
const ed25519Suite = new Ed25519Signature2020();

const defaultDocumentLoader = securityLoader({ fetchRemoteContexts: true }).build();

const defaultFetchJson: FetchJson = async (url: string) => {
  const httpGetService = BuiltinHttpGetService();
  const { body, status } = await httpGetService.get(url);
  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch ${url}: HTTP ${status}`);
  }
  return body;
};

const defaultCryptoSuites: CryptoSuite[] = [ed25519Suite, eddsaSuite];

/** Build a {@link VerificationContext} for tests, optionally overridden. */
export function buildTestContext(
  overrides?: Partial<VerificationContext>,
): VerificationContext {
  const cryptoSuites = overrides?.cryptoSuites ?? defaultCryptoSuites;
  const cryptoServices =
    overrides?.cryptoServices ?? [DataIntegrityCryptoService({ suites: cryptoSuites })];

  const effectiveHttpGetService = overrides?.httpGetService ?? BuiltinHttpGetService();
  const effectiveCacheService = overrides?.cacheService ?? InMemoryCacheService();

  const httpGetServiceOverride = overrides?.httpGetService;
  const documentLoader =
    overrides?.documentLoader ??
    (httpGetServiceOverride !== undefined
      ? documentLoaderFromHttpGet(httpGetServiceOverride)
      : defaultDocumentLoader);

  const fetchJson =
    overrides?.fetchJson ??
    (httpGetServiceOverride !== undefined
      ? fetchJsonFromHttpGet(httpGetServiceOverride)
      : defaultFetchJson);

  return {
    documentLoader,
    fetchJson,
    httpGetService: effectiveHttpGetService,
    cacheService: effectiveCacheService,
    cryptoSuites,
    cryptoServices,
    registries: overrides?.registries,
    lookupIssuers:
      overrides?.lookupIssuers ??
      createRegistryLookup(effectiveHttpGetService, effectiveCacheService),
    challenge: overrides?.challenge ?? null,
    unsignedPresentation: overrides?.unsignedPresentation ?? false,
    verifyBitstringStatusListCredential:
      overrides?.verifyBitstringStatusListCredential ?? true,
  };
}
