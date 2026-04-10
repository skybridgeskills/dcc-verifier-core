import { VerificationCheck, CheckOutcome } from '../../types/check.js';
import { VerificationSubject } from '../../types/subject.js';
import { VerificationContext } from '../../types/context.js';

/**
 * Check that a proof property exists on the credential.
 * This is a fatal check - we cannot verify without a proof.
 */
export const proofExistsCheck: VerificationCheck = {
  id: 'core.proof-exists',
  name: 'Proof Exists',
  description: 'Verifies that the credential has a proof property.',
  fatal: true,
  appliesTo: ['verifiableCredential'],
  execute: async (
    subject: VerificationSubject,
    _context: VerificationContext
  ): Promise<CheckOutcome> => {
    const credential = subject.verifiableCredential as Record<string, unknown> | undefined;

    if (!credential) {
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
          title: 'No Proof',
          detail: 'No verifiable credential found in subject.',
        }],
      };
    }

    const proof = credential.proof;

    if (!proof) {
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
          title: 'No Proof',
          detail: 'Credential is missing required proof property.',
        }],
      };
    }

    // Proof can be a single object or an array of objects
    const isValidProof = typeof proof === 'object' && proof !== null;
    const isValidProofArray = Array.isArray(proof) && proof.length > 0 && proof.every(
      p => typeof p === 'object' && p !== null
    );

    if (!isValidProof && !isValidProofArray) {
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
          title: 'No Proof',
          detail: 'Credential proof property is invalid.',
        }],
      };
    }

    return {
      status: 'success',
      message: 'Credential has a valid proof property.',
    };
  },
};
