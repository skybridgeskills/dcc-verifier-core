/**
 * Verification result types returned by `verifyCredential` and
 * `verifyPresentation` (and their `Verifier` instance equivalents).
 *
 * Both types use the suite-based `CheckResult[]` model. Each check
 * result carries a discriminated `outcome` (success / failure /
 * skipped) plus provenance (suite, check id, fatal flag, timestamp).
 */

import { CheckResult } from './check.js';
import { VerifiableCredential } from '../schemas/credential.js';

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
