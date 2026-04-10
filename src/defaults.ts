import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalcredentials/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite';
import { securityLoader } from '@digitalcredentials/security-document-loader';
import { VerificationContext } from './types/context.js';
import { VerificationSuite } from './types/check.js';

import { coreSuite } from './suites/core/index.js';
import { proofSuite } from './suites/proof/index.js';
import { statusSuite } from './suites/status/index.js';
import { registrySuite } from './suites/registry/index.js';
import { obv3SchemaSuite } from './suites/schema/index.js';

const eddsaSuite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });
const ed25519Suite = new Ed25519Signature2020();

export const defaultDocumentLoader = securityLoader({ fetchRemoteContexts: true }).build();
export const defaultCryptoSuites = [ed25519Suite, eddsaSuite];

/**
 * Default verification suites.
 *
 * These are run in order for every credential verification:
 * 1. coreSuite - Basic structure validation (context, type, proof exists)
 * 2. proofSuite - Cryptographic signature verification
 * 3. statusSuite - Credential status checks (revocation, suspension)
 * 4. registrySuite - Issuer registry lookup
 * 5. obv3SchemaSuite - OBv3 JSON Schema validation (non-fatal)
 */
export const defaultSuites: VerificationSuite[] = [
  coreSuite,
  proofSuite,
  statusSuite,
  registrySuite,
  obv3SchemaSuite,
];

/**
 * Build a VerificationContext with defaults, optionally overridden.
 */
export function buildContext(overrides?: Partial<VerificationContext>): VerificationContext {
  return {
    documentLoader: overrides?.documentLoader ?? defaultDocumentLoader,
    cryptoSuites: overrides?.cryptoSuites ?? defaultCryptoSuites,
    registries: overrides?.registries,
    challenge: overrides?.challenge ?? null,
    unsignedPresentation: overrides?.unsignedPresentation ?? false,
  };
}
