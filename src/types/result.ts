/**
 * Verification result types.
 *
 * This module exports two sets of types:
 *
 * **Current** — `CredentialVerificationResult` and `PresentationVerificationResult`.
 * These use the suite-based `CheckResult[]` model and are what `verifyCredential`
 * and `verifyPresentation` actually return.
 *
 * **Legacy** — `VerificationResponse`, `PresentationVerificationResponse`, etc.
 * These use the older `log[]` / `errors[]` shape and are still exported for
 * backward compatibility with downstream consumers that haven't migrated.
 * They are not produced by the current verification functions.
 */

import { CheckResult } from './check.js';
import { VerifiableCredential } from '../schemas/credential.js';

// ==================== Current Suite-Based Result Types ====================

/**
 * Result of credential verification.
 *
 * `verified` is derived from the check results: true when no check has a
 * `failure` outcome. Skipped checks don't affect `verified`.
 */
export interface CredentialVerificationResult {
  /** True if no check returned a failure outcome. */
  verified: boolean;

  /** The Zod-parsed credential that was verified. */
  credential: VerifiableCredential;

  /** Flat array of results from all suites — every check that ran or was skipped. */
  results: CheckResult[];
}

/**
 * Result of presentation verification.
 *
 * Combines presentation-level checks (VP signature) with per-credential
 * results. `verified` is true only if both the presentation and all
 * embedded credentials passed.
 */
export interface PresentationVerificationResult {
  /** True if no failures in presentation checks or any credential checks. */
  verified: boolean;

  /** Check results from presentation-level verification (VP signature). */
  presentationResults: CheckResult[];

  /** Individual credential verification results, one per embedded VC. */
  credentialResults: CredentialVerificationResult[];

  /** All results flattened (presentation + all credential checks). */
  allResults: CheckResult[];
}

// ==================== Legacy Types (for backward compatibility) ====================

export interface VerificationError {
  message: string;
  name?: string;
  details?: object;
  stackTrace?: unknown;
}

export interface VerificationStep {
  id: string;
  valid?: boolean;
  foundInRegistries?: string[];
  registriesNotLoaded?: RegistriesNotLoaded[];
  error?: VerificationError;
}

export interface SchemaCheck {
  schema: string;
  result: { valid: boolean; errors?: object[] };
  source: string;
}

export interface AdditionalInformationEntry {
  id: string;
  results: SchemaCheck[];
}

export interface VerificationResponse {
  additionalInformation?: AdditionalInformationEntry[];
  credential?: object;
  errors?: VerificationError[];
  log?: VerificationStep[];
}

const signatureOptions = ['valid', 'invalid', 'unsigned'] as const;
export type PresentationSignatureResult = (typeof signatureOptions)[number]; // i.e., 'valid', 'invalid', 'unsigned'

export interface PresentationResult {
  signature: PresentationSignatureResult;
  error?: unknown;
}

export interface PresentationVerificationResponse {
  credentialResults?: VerificationResponse[];
  presentationResult?: PresentationResult;
  errors?: VerificationError[];
}

export interface RegistryListResult {
  foundInRegistries: string[];
  registriesNotLoaded: RegistriesNotLoaded[];
}

export interface RegistriesNotLoaded {
  name: string;
  url: string;
}