import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { DataIntegrityProof } from '@digitalcredentials/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalcredentials/eddsa-rdfc-2022-cryptosuite';
import { securityLoader } from '@digitalcredentials/security-document-loader';
import { VerificationContext } from './types/context.js';
import { VerificationSuite } from './types/check.js';

const eddsaSuite = new DataIntegrityProof({ cryptosuite: eddsaRdfc2022CryptoSuite });
const ed25519Suite = new Ed25519Signature2020();

export const defaultDocumentLoader = securityLoader({ fetchRemoteContexts: true }).build();
export const defaultCryptoSuites = [ed25519Suite, eddsaSuite];

/** Placeholder — populated as suites are created in phases 4–7 */
export const defaultSuites: VerificationSuite[] = [];

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
