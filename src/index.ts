/*!
 * Copyright (c) 2022 Digital Credentials Consortium. All rights reserved.
 */

// ==================== Main Public API (Legacy - for backward compatibility) ====================
// These exports maintain backward compatibility with existing code

export { verifyCredential, verifyPresentation } from './Verify.js';
export type { VerificationResponse, PresentationVerificationResponse, VerificationError, VerificationStep } from './types/result.js';

// ==================== New Suite-Based Architecture (Experimental) ====================
// These exports are for the new suite-based verification architecture
// They are prefixed with 'suite' to avoid naming conflicts during transition

export { verifyCredential as suiteVerifyCredential, verifyPresentation as suiteVerifyPresentation } from './verify-suite.js';
export type { CredentialVerificationResult, PresentationVerificationResult } from './types/result.js';
export type { VerifyCredentialOptions, VerifyPresentationOptions } from './types/options.js';

// ==================== Core Types ====================

export type { CheckResult, CheckOutcome, VerificationCheck, VerificationSuite, VerificationSubjectType } from './types/check.js';
export type { ProblemDetail } from './types/problem-detail.js';
export type { VerificationContext, DocumentLoader } from './types/context.js';
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
export { buildContext, defaultSuites, defaultDocumentLoader, defaultCryptoSuites } from './defaults.js';
export { extractCredentialsFrom } from './extractCredentialsFrom.js';
