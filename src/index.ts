/*!
 * Copyright (c) 2022 Digital Credentials Consortium. All rights reserved.
 */

// ==================== Main Public API ====================

export { verifyCredential, verifyPresentation } from './verify-suite.js';
export type { CredentialVerificationResult, PresentationVerificationResult } from './types/result.js';
export type { VerifyCredentialOptions, VerifyPresentationOptions } from './types/options.js';
export type {
  EntityIdentityRegistry,
  RegistryLookupResult,
  LookupIssuers,
} from './types/registry.js';

// ==================== Core Types ====================

export type { CheckResult, CheckOutcome, VerificationCheck, VerificationSuite, VerificationSubjectType } from './types/check.js';
export type { ProblemDetail } from './types/problem-detail.js';
export type { VerificationContext, DocumentLoader, FetchJson } from './types/context.js';
export type { CryptoService, CryptoResult, CryptoVerifyOptions } from './types/crypto-service.js';
export type { CryptoSuite, LinkedDataSuite, DataIntegritySuite, ProofPurpose } from './types/crypto-suite.js';
export type { VerificationSubject } from './types/subject.js';

// ==================== Schema Types and Parsing ====================

export type { VerifiableCredential } from './schemas/credential.js';
export type { VerifiablePresentation } from './schemas/presentation.js';
export { parseCredential, parsePresentation } from './schemas/index.js';

// ==================== Verification Suites ====================

export { coreSuite } from './suites/core/index.js';
export { proofSuite } from './suites/proof/index.js';
export { statusSuite } from './suites/status/index.js';
export { registrySuite } from './suites/registry/index.js';
export { obv3SchemaSuite } from './suites/schema/index.js';

// ==================== Utilities ====================

export { runSuites } from './run-suites.js';
export {
  buildContext,
  defaultSuites,
  defaultDocumentLoader,
  defaultFetchJson,
  defaultCryptoSuites,
  defaultCryptoServices,
} from './defaults.js';
export { DataIntegrityCryptoService } from './services/data-integrity-crypto.js';
export type { DataIntegrityCryptoConfig } from './services/data-integrity-crypto.js';
export { extractCredentialsFrom } from './extractCredentialsFrom.js';
