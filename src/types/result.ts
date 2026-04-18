import { CheckResult } from './check.js';
import { VerifiableCredential } from '../schemas/credential.js';
import { VerifiablePresentation } from '../schemas/presentation.js';

export interface CredentialVerificationResult {
  /** True if no check returned a failure outcome. */
  verified: boolean;

  /**
   * The Zod-parsed credential that was verified.
   *
   * Field name matches the W3C / VCALM property name so the
   * verification result can be spread directly into a VCALM
   * exchange's per-step variables and accessed via the documented
   * JSONata path:
   *   `results.<step>.credentialResults[i].verifiableCredential.…`
   */
  verifiableCredential: VerifiableCredential;

  /** Flat array of results from all suites — every check that ran or was skipped. */
  results: CheckResult[];
}

export interface PresentationVerificationResult {
  /** True if no failures in presentation checks or any credential checks. */
  verified: boolean;

  /**
   * The Zod-parsed presentation that was verified.
   *
   * Mirror of {@link CredentialVerificationResult.verifiableCredential}.
   * Allows VCALM consumers to reach the parsed VP via the documented
   * `results.<step>.verifiablePresentation.…` JSONata path without
   * carrying the original input separately.
   */
  verifiablePresentation: VerifiablePresentation;

  /** Check results from presentation-level verification (VP signature). */
  presentationResults: CheckResult[];

  /** Individual credential verification results, one per embedded VC. */
  credentialResults: CredentialVerificationResult[];
}
