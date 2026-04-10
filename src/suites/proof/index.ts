import { VerificationSuite } from '../../types/check.js';
import { signatureCheck } from './signature-check.js';

/**
 * Proof verification suite.
 *
 * Cryptographic signature verification using the DCC vc library.
 * Handles both credential signatures and presentation signatures
 * with appropriate proof purpose selection.
 *
 * The signature check:
 * - Verifies cryptographic signatures using configured crypto suites
 * - Handles AuthenticationProofPurpose vs AssertionProofPurpose for presentations
 * - Classifies errors: HTTP errors, did:web resolution failures, JSON-LD errors, invalid signatures
 */
export const proofSuite: VerificationSuite = {
  id: 'proof',
  name: 'Proof Verification',
  description: 'Cryptographic signature verification.',
  checks: [signatureCheck],
};
