/**
 * Default {@link CryptoService} for Linked Data Proofs and Data Integrity proofs
 * via `@digitalcredentials/vc`.
 */

import { verifyCredential as vcVerifyCredential, verify as vcVerifyPresentation } from '@digitalcredentials/vc';
import { checkStatus as bitstringCredentialStatusCheck } from '@digitalcredentials/vc-bitstring-status-list';
import jsonLdSignatures from '@digitalcredentials/jsonld-signatures';
import type { CryptoResult, CryptoService, CryptoVerifyOptions } from '../types/crypto-service.js';
import type { CryptoSuite, ProofPurpose } from '../types/crypto-suite.js';
import type { ProblemDetail } from '../types/problem-detail.js';
import type { VerificationSubject } from '../types/subject.js';

const { purposes } = jsonLdSignatures;

const HTTP_ERROR = 'HTTPError';
const JSONLD_VALIDATION_ERROR = 'jsonld.ValidationError';

function extractErrors(error: unknown): unknown[] {
  const err = error as { errors?: unknown[] } | undefined;
  if (err?.errors && Array.isArray(err.errors)) {
    return err.errors;
  }
  return error ? [error] : [];
}

function isHttpError(errors: unknown[]): boolean {
  return errors.some(e => {
    const x = e as { name?: string; type?: string };
    return x.name === HTTP_ERROR || x.type === HTTP_ERROR;
  });
}

function isJsonLdError(errors: unknown[]): boolean {
  return errors.some(e => {
    const x = e as { name?: string; type?: string };
    return x.name === JSONLD_VALIDATION_ERROR || x.type === JSONLD_VALIDATION_ERROR;
  });
}

function getHttpError(errors: unknown[]): unknown | undefined {
  return errors.find(e => {
    const x = e as { name?: string; type?: string };
    return x.name === HTTP_ERROR || x.type === HTTP_ERROR;
  });
}

function isDidWeb(did: string): boolean {
  return did.toLowerCase().startsWith('did:web');
}

function didWebToUrlPattern(did: string): string {
  return did.slice(8).replaceAll(':', '/').toLowerCase();
}

function classifySignatureError(
  error: unknown,
  credential: Record<string, unknown> | undefined
): ProblemDetail[] {
  const errors = extractErrors(error);

  if (isJsonLdError(errors)) {
    return errors.map((e: unknown) => {
      const x = e as { message?: string };
      return {
        type: 'https://www.w3.org/TR/vc-data-model#PARSING_ERROR',
        title: 'JSON-LD Validation Error',
        detail: x.message || 'Invalid JSON-LD document',
      };
    });
  }

  if (isHttpError(errors)) {
    const httpError = getHttpError(errors) as {
      requestUrl?: string;
      url?: string;
      message?: string;
    } | undefined;
    const requestUrl = httpError?.requestUrl || httpError?.url || '';

    if (credential) {
      const issuer = credential.issuer as string | { id: string } | undefined;
      const issuerDid = typeof issuer === 'string' ? issuer : (issuer?.id || '');

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

  const err = error as { message?: string } | undefined;
  return [{
    type: 'https://www.w3.org/TR/vc-data-model#INVALID_SIGNATURE',
    title: 'Invalid Signature',
    detail: err?.message || 'The signature is not valid.',
  }];
}

function getPresentationPurpose(
  presentation: Record<string, unknown>,
  challenge: string | null | undefined
): ProofPurpose {
  const proof = presentation.proof as Record<string, unknown> | Array<Record<string, unknown>> | undefined;

  let proofPurpose: string | undefined;
  if (Array.isArray(proof)) {
    proofPurpose = proof[0]?.proofPurpose as string | undefined;
  } else if (proof && typeof proof === 'object') {
    proofPurpose = proof.proofPurpose as string | undefined;
  }

  const useAuthenticationPurpose = proofPurpose === 'authentication' || proofPurpose === 'authenticationMethod';

  if (useAuthenticationPurpose) {
    return new purposes.AuthenticationProofPurpose({ challenge: challenge ?? 'meaningless' });
  }

  return new purposes.AssertionProofPurpose();
}

function documentHasProof(doc: Record<string, unknown> | undefined): boolean {
  if (!doc) return false;
  const proof = doc.proof;
  if (proof === undefined || proof === null) return false;
  if (Array.isArray(proof)) {
    return proof.length > 0 && typeof proof[0] === 'object' && proof[0] !== null;
  }
  return typeof proof === 'object';
}

export interface DataIntegrityCryptoConfig {
  suites: CryptoSuite[];
}

function bitstringCheckStatusForVc(suites: CryptoSuite[]) {
  return async (vcOptions: Record<string, unknown>) =>
    bitstringCredentialStatusCheck({
      credential: vcOptions.credential,
      documentLoader: vcOptions.documentLoader,
      suite: suites,
      verifyBitstringStatusListCredential: true,
      // Match `verifyMatchingIssuers: false` on the vc call — hosted status lists
      // may not share the VC issuer id (e.g. did:web + GitHub-hosted list).
      verifyMatchingIssuers: false,
    });
}

/**
 * Builds a {@link CryptoService} that verifies via `@digitalcredentials/vc` using the
 * given proof suites (e.g. Ed25519Signature2020 + DataIntegrityProof).
 */
export function DataIntegrityCryptoService(config: DataIntegrityCryptoConfig): CryptoService {
  const { suites } = config;
  const checkStatus = bitstringCheckStatusForVc(suites);

  return {
    canVerify: (subject: VerificationSubject): boolean => {
      if (subject.verifiablePresentation) {
        return documentHasProof(subject.verifiablePresentation as Record<string, unknown>);
      }
      if (subject.verifiableCredential) {
        return documentHasProof(subject.verifiableCredential as Record<string, unknown>);
      }
      return false;
    },

    verifyCredential: async (
      credential: unknown,
      options: CryptoVerifyOptions
    ): Promise<CryptoResult> => {
      try {
        const result = await vcVerifyCredential({
          credential,
          suite: suites,
          documentLoader: options.documentLoader,
          checkStatus,
          verifyMatchingIssuers: false,
        });

        const verified = result.verified ?? false;
        if (verified) {
          return { verified: true, message: 'Signature verified successfully.' };
        }

        return {
          verified: false,
          problems: classifySignatureError(result.error, credential as Record<string, unknown> | undefined),
        };
      } catch (e) {
        return {
          verified: false,
          problems: [{
            type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
            title: 'Verification Error',
            detail: e instanceof Error ? e.message : 'An unexpected error occurred during signature verification.',
          }],
        };
      }
    },

    verifyPresentation: async (
      presentation: unknown,
      options: CryptoVerifyOptions
    ): Promise<CryptoResult> => {
      try {
        const purpose = getPresentationPurpose(
          presentation as Record<string, unknown>,
          options.challenge
        );

        const result = await vcVerifyPresentation({
          presentation,
          presentationPurpose: purpose,
          suite: suites,
          documentLoader: options.documentLoader,
          unsignedPresentation: options.unsignedPresentation ?? false,
          checkStatus,
          challenge: options.challenge ?? 'meaningless',
          verifyMatchingIssuers: false,
        });

        const verified = result.verified ?? false;
        if (verified) {
          return { verified: true, message: 'Signature verified successfully.' };
        }

        let error: unknown = result.error;
        if (!error && result.credentialResults) {
          const failedCredential = result.credentialResults.find(
            (r: { verified?: boolean; error?: unknown }) => !r.verified && r.error
          );
          if (failedCredential?.error) {
            error = failedCredential.error;
          }
        }

        return {
          verified: false,
          problems: classifySignatureError(
            error,
            undefined
          ),
        };
      } catch (e) {
        return {
          verified: false,
          problems: [{
            type: 'https://www.w3.org/TR/vc-data-model#PROOF_VERIFICATION_ERROR',
            title: 'Verification Error',
            detail: e instanceof Error ? e.message : 'An unexpected error occurred during signature verification.',
          }],
        };
      }
    },
  };
}
