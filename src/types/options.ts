import { VerificationSuite } from './check.js';
import { DocumentLoader } from './context.js';

/**
 * Options for verifying a credential.
 */
export interface VerifyCredentialOptions {
  /** The credential to verify (unknown type, will be parsed) */
  credential: unknown;

  /** Optional issuer registries for registry checks (alias: knownDIDRegistries) */
  registries?: object;
  /** @deprecated Use registries instead */
  knownDIDRegistries?: object;

  /** Additional custom verification suites to run */
  additionalSuites?: VerificationSuite[];

  /** Custom document loader (defaults to securityLoader) */
  documentLoader?: DocumentLoader;

  /** Custom crypto suites for signature verification */
  cryptoSuites?: object[];
}

/**
 * Options for verifying a presentation.
 */
export interface VerifyPresentationOptions {
  /** The presentation to verify (unknown type, will be parsed) */
  presentation: unknown;

  /** Expected challenge for authentication proof purpose */
  challenge?: string | null;

  /** Whether to allow unsigned presentations */
  unsignedPresentation?: boolean;

  /** Optional issuer registries for registry checks (alias: knownDIDRegistries) */
  registries?: object;
  /** @deprecated Use registries instead */
  knownDIDRegistries?: object;

  /** Additional custom verification suites to run */
  additionalSuites?: VerificationSuite[];

  /** Custom document loader (defaults to securityLoader) */
  documentLoader?: DocumentLoader;

  /** Custom crypto suites for signature verification */
  cryptoSuites?: object[];
}
