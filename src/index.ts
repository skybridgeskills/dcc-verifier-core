/*!
 * Copyright (c) 2022 Digital Credentials Consortium. All rights reserved.
 */

// ==================== Main Public API ====================

export { verifyCredential, verifyPresentation } from './verify-suite.js';
export type { CredentialVerificationResult, PresentationVerificationResult } from './types/result.js';
export type { VerifyCredentialOptions, VerifyPresentationOptions } from './types/options.js';
export type {
  EntityIdentityRegistry,
  OidfEntityIdentityRegistry,
  DccLegacyEntityIdentityRegistry,
  VcRecognitionEntityIdentityRegistry,
  RegistryLookupResult,
  LookupIssuers,
  LookupIssuersOptions,
} from './types/registry.js';

// ==================== Core Types ====================

export type { CheckResult, CheckOutcome, VerificationCheck, VerificationSuite, VerificationSubjectType } from './types/check.js';
export type { ProblemDetail } from './types/problem-detail.js';
export type { VerificationContext, DocumentLoader, FetchJson } from './types/context.js';
export type { HttpGetResult } from './types/http.js';
export type { CryptoService, CryptoResult, CryptoVerifyOptions } from './types/crypto-service.js';
export type { CryptoSuite, LinkedDataSuite, DataIntegritySuite, ProofPurpose } from './types/crypto-suite.js';
export type { VerificationSubject } from './types/subject.js';

// ==================== Service Interfaces ====================

export type { CacheService } from './services/cache-service/cache-service.js';
export { InMemoryCacheService } from './services/cache-service/in-memory-cache-service.js';
export type { HttpGetService } from './services/http-get-service/http-get-service.js';
export { BuiltinHttpGetService } from './services/http-get-service/builtin-http-get-service.js';

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
  defaultHttpGetService,
  defaultCacheService,
  defaultLookupIssuers,
  defaultCryptoSuites,
  defaultCryptoServices,
} from './defaults.js';
export { createRegistryLookup } from './services/registry-lookup.js';
export {
  DEFAULT_TTL_MS,
  parseCacheControlMaxAge,
  resolveTtl,
  ttlFromValidUntil,
} from './services/registry-handlers/cache-ttl.js';
export { documentLoaderFromHttpGet } from './util/document-loader-from-http-get.js';
export { fetchJsonFromHttpGet } from './util/fetch-json-from-http-get.js';
export { DataIntegrityCryptoService } from './services/data-integrity-crypto.js';
export type { DataIntegrityCryptoConfig } from './services/data-integrity-crypto.js';
export { extractCredentialsFrom } from './extractCredentialsFrom.js';
export { registryKeyHash } from './util/registry-key-hash.js';
