import { verifyCredential as vcVerifyCredential, verify as vcVerifyPresentation } from '@digitalcredentials/vc';
import jsonLdSignatures from '@digitalcredentials/jsonld-signatures';
import { VerificationCheck, CheckOutcome } from '../../types/check.js';
import type { ProofPurpose } from '../../types/crypto-suite.js';
import { ProblemDetail } from '../../types/problem-detail.js';
import { VerificationSubject } from '../../types/subject.js';
import { VerificationContext } from '../../types/context.js';

const { purposes } = jsonLdSignatures;

// Error type constants
const HTTP_ERROR = 'HTTPError';
const JSONLD_VALIDATION_ERROR = 'jsonld.ValidationError';

/**
 * Extract errors from a verification error response.
 */
function extractErrors(error: any): any[] {
  if (error?.errors && Array.isArray(error.errors)) {
    return error.errors;
  }
  return error ? [error] : [];
}

/**
 * Check if an error is an HTTP error.
 */
function isHttpError(errors: any[]): boolean {
  return errors.some(e => e.name === HTTP_ERROR || e.type === HTTP_ERROR);
}

/**
 * Check if an error is a JSON-LD validation error.
 */
function isJsonLdError(errors: any[]): boolean {
  return errors.some(e => e.name === JSONLD_VALIDATION_ERROR || e.type === JSONLD_VALIDATION_ERROR);
}

/**
 * Get the first HTTP error from the list.
 */
function getHttpError(errors: any[]): any | undefined {
  return errors.find(e => e.name === HTTP_ERROR || e.type === HTTP_ERROR);
}

/**
 * Check if a DID is a did:web.
 */
function isDidWeb(did: string): boolean {
  return did.toLowerCase().startsWith('did:web');
}

/**
 * Convert did:web to URL pattern for matching.
 */
function didWebToUrlPattern(did: string): string {
  // did:web:example.com:path -> example.com/path
  return did.slice(8).replaceAll(':', '/').toLowerCase();
}

/**
 * Classify signature verification errors into ProblemDetail.
 */
function classifySignatureError(
  error: any,
  credential: Record<string, unknown> | undefined
): ProblemDetail[] {
  const errors = extractErrors(error);

  // JSON-LD validation error
  if (isJsonLdError(errors)) {
    return errors.map((e: any) => ({
      type: 'https://www.w3.org/TR/vc-data-model#PARSING_ERROR',
      title: 'JSON-LD Validation Error',
      detail: e.message || 'Invalid JSON-LD document',
    }));
  }

  // HTTP error - check if it's a did:web resolution issue
  if (isHttpError(errors)) {
    const httpError = getHttpError(errors);
    const requestUrl = httpError?.requestUrl || httpError?.url || '';

    // Check if this is a did:web issuer
    if (credential) {
      const issuer = credential.issuer as string | { id: string } | undefined;
      const issuerDid = typeof issuer === 'string'
        ? issuer
        : (issuer?.id || '');

      if (isDidWeb(issuerDid)) {
        const didUrlPattern = didWebToUrlPattern(issuerDid);
        if (requestUrl.toLowerCase().includes(didUrlPattern)) {
          return [{
            type: 'https://www.w3.org/TR/vc-data-model#DID_WEB_UNRESOLVED',
            title: 'DID Web Unresolved',
            detail: `The signature could not be checked because the public signing key could not be retrieved from ${String(requestUrl)}`,
          }];
        }
      }
    }

    return [{
      type: 'https://www.w3.org/TR/vc-data-model#HTTP_ERROR',
      title: 'HTTP Error',
      detail: httpError?.message || 'An HTTP error prevented the signature check.',
    }];
  }

  // Default: invalid signature
  return [{
    type: 'https://www.w3.org/TR/vc-data-model#INVALID_SIGNATURE',
    title: 'Invalid Signature',
    detail: error?.message || 'The signature is not valid.',
  }];
}

/**
 * Get the proof purpose for presentation verification.
 */
function getPresentationPurpose(presentation: Record<string, unknown>, challenge: string | null | undefined): ProofPurpose {
  const proof = presentation.proof as Record<string, unknown> | Array<Record<string, unknown>> | undefined;

  // Get proofPurpose from proof (could be single proof or array)
  let proofPurpose: string | undefined;
  if (Array.isArray(proof)) {
    // Use the first proof's purpose
    proofPurpose = proof[0]?.proofPurpose as string | undefined;
  } else if (proof && typeof proof === 'object') {
    proofPurpose = proof.proofPurpose as string | undefined;
  }

  // Use AuthenticationProofPurpose for authentication purposes
  const useAuthenticationPurpose = proofPurpose === 'authentication' || proofPurpose === 'authenticationMethod';

  if (useAuthenticationPurpose) {
    return new purposes.AuthenticationProofPurpose({ challenge: challenge ?? 'meaningless' });
  }

  return new purposes.AssertionProofPurpose();
}

/**
 * Signature verification check for credentials and presentations.
 *
 * This check verifies the cryptographic signature using the DCC vc library.
 * It handles both credential signatures and presentation signatures (with appropriate
 * proof purpose selection).
 *
 * Error classification:
 * - HTTP errors (including did:web resolution failures)
 * - JSON-LD validation errors
 * - Invalid signature errors
 */
export const signatureCheck: VerificationCheck = {
  id: 'proof.signature',
  name: 'Signature Verification',
  description: 'Verifies the cryptographic signature of the credential or presentation.',
  fatal: true,
  appliesTo: ['verifiableCredential', 'verifiablePresentation'],
  execute: async (
    subject: VerificationSubject,
    context: VerificationContext
  ): Promise<CheckOutcome> => {
    const credential = subject.verifiableCredential as Record<string, unknown> | undefined;
    const presentation = subject.verifiablePresentation as Record<string, unknown> | undefined;

    // Neither credential nor presentation
    if (!credential && !presentation) {
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
          title: 'No Verifiable Content',
          detail: 'No verifiable credential or presentation found in subject.',
        }],
      };
    }

    try {
      let verified: boolean;
      let error: any;

      if (presentation) {
        // Presentation verification
        const purpose = getPresentationPurpose(presentation, context.challenge);

        const result = await vcVerifyPresentation({
          presentation,
          presentationPurpose: purpose,
          suite: context.cryptoSuites,
          documentLoader: context.documentLoader,
          unsignedPresentation: context.unsignedPresentation ?? false,
          checkStatus: null, // Status is handled by status suite
          challenge: context.challenge ?? 'meaningless',
          verifyMatchingIssuers: false,
        });

        verified = result.verified ?? false;
        // Check for errors in presentation result or credential results
        if (!verified && result.error) {
          error = result.error;
        } else if (!verified && result.credentialResults) {
          // Find first error in credential results
          const failedCredential = result.credentialResults.find((r: any) => !r.verified && r.error);
          if (failedCredential?.error) {
            error = failedCredential.error;
          }
        }
      } else {
        // Credential verification
        const result = await vcVerifyCredential({
          credential,
          suite: context.cryptoSuites,
          documentLoader: context.documentLoader,
          checkStatus: null, // Status is handled by status suite
          verifyMatchingIssuers: false,
        });

        verified = result.verified ?? false;
        error = result.error;
      }

      if (verified) {
        return {
          status: 'success',
          message: 'Signature verified successfully.',
        };
      }

      // Not verified - classify the error
      const problems = classifySignatureError(error, credential);
      return {
        status: 'failure',
        problems,
      };
    } catch (e) {
      // Unexpected error during verification
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
          title: 'Verification Error',
          detail: e instanceof Error ? e.message : 'An unexpected error occurred during signature verification.',
        }],
      };
    }
  },
};
