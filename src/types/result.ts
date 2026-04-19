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

  /**
   * Normalized view of the credential, produced by a recognizer.
   *
   * Present when the `recognition.profile` check (in the default
   * `recognitionSuite`) found a matching {@link RecognizerSpec}
   * and that recognizer's parse step succeeded. Cast to the
   * recognizer-specific shape based on {@link recognizedProfile}.
   *
   * @example
   *   if (result.recognizedProfile === 'obv3p0.openbadge') {
   *     const ob = result.normalizedVerifiableCredential as
   *       Obv3p0OpenBadgeCredential;
   *   }
   */
  normalizedVerifiableCredential?: unknown;

  /**
   * Stable id of the matched recognizer; mirrors
   * {@link RecognizerSpec.id}. Present iff
   * {@link normalizedVerifiableCredential} is.
   */
  recognizedProfile?: string;

  /** Flat array of results from all suites — every check that ran or was skipped. */
  results: CheckResult[];

  /**
   * `true` when this result was produced under a non-default
   * suite-phase filter (i.e. the consumer passed `phases: [...]` on
   * `VerifierConfig` or per-call). A partial result carries only
   * the subset of suites in the requested phases, plus any
   * untagged suites; consumers running a two-pass workflow union
   * the per-pass `results` arrays to reconstruct the full report.
   *
   * Unset for the default (all-phases) case so existing consumers
   * see no change in result shape.
   */
  partial?: boolean;
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

  /**
   * `true` when this result was produced under a non-default
   * suite-phase filter; mirrors
   * {@link CredentialVerificationResult.partial}.
   */
  partial?: boolean;
}
