/**
 * `createVerifier(...)` — factory for a configured {@link Verifier}.
 *
 * A `Verifier` owns long-lived dependencies (HTTP, cache, crypto
 * services, registries, registry handlers, document loader) and
 * exposes per-call `verifyCredential` / `verifyPresentation` methods
 * that share those dependencies — most importantly the cache.
 *
 * Each verifier without an explicit `cacheService` gets its own fresh
 * `InMemoryCacheService`; cache contents are isolated from other
 * verifiers in the same process. To share cache state across verifiers
 * (e.g. a long-running service holding several pre-built verifiers),
 * construct one `InMemoryCacheService` (or any `CacheService` adapter)
 * and pass it via `createVerifier({ cacheService })`.
 *
 * Construct a single `Verifier` for any batch or repeated verification
 * work; reusing the instance lets issuer DID documents, status list
 * credentials, and JSON-LD contexts be fetched once and reused. The
 * standalone wrappers in `verify-suite.ts` create a fresh verifier per
 * call and are intended only for one-shot use.
 *
 * @example
 * ```ts
 * const verifier = createVerifier({ registries: myRegistries });
 * for (const credential of credentials) {
 *   const result = await verifier.verifyCredential({ credential });
 * }
 * ```
 */

import type {
  Verifier,
  VerifierConfig,
  VerifyCredentialCall,
  VerifyPresentationCall,
} from './types/verifier.js';
import type { VerificationContext } from './types/context.js';
import type { VerificationSuite, CheckResult } from './types/check.js';
import type { RecognitionResult, RecognizerSpec } from './types/recognition.js';
import type {
  CredentialVerificationResult,
  PresentationVerificationResult,
} from './types/result.js';
import { parseCredential, VerifiableCredential } from './schemas/credential.js';
import { parsePresentation, type VerifiablePresentation } from './schemas/presentation.js';
import { runSuites } from './run-suites.js';
import { extractCredentialsFrom } from './extract-credentials-from.js';
import { defaultSuites } from './default-suites.js';
import { proofSuite } from './suites/proof/index.js';
import {
  defaultHttpGetService,
  createDefaultCacheService,
  defaultCryptoServices,
  defaultCryptoSuites,
  defaultDocumentLoaderFor,
} from './default-services.js';
import { createRegistryLookup } from './services/registry-lookup.js';
import { fetchJsonFromHttpGet } from './util/fetch-json-from-http-get.js';
import type { ProblemDetail } from './types/problem-detail.js';
import type { EntityIdentityRegistry } from './types/registry.js';
import { ProblemTypes } from './problem-types.js';

export function createVerifier(config: VerifierConfig = {}): Verifier {
  const httpGetService = config.httpGetService ?? defaultHttpGetService();
  const cacheService = config.cacheService ?? createDefaultCacheService();
  const cryptoServices = config.cryptoServices ?? defaultCryptoServices();
  const documentLoader = config.documentLoader ?? defaultDocumentLoaderFor(httpGetService);
  const fetchJson = fetchJsonFromHttpGet(httpGetService);
  const constructorRegistries = config.registries;
  const recognizers = config.recognizers ?? [];

  // Forward-declared verifier reference. The lookupIssuers thunk closes
  // over this slot so handlers can recursively call back into the
  // parent verifier (used by vc-recognition to verify the recognition
  // VC). The slot is filled below, after the verifier object is built.
  const verifierRef: { current: Verifier | undefined } = { current: undefined };
  const lookupIssuers = createRegistryLookup(
    httpGetService,
    cacheService,
    config.registryHandlers,
    () => {
      if (verifierRef.current === undefined) {
        throw new Error('verifierRef accessed before createVerifier returned');
      }
      return verifierRef.current;
    },
  );

  const verifier: Verifier = {
    verifyCredential: async (call: VerifyCredentialCall) => {
      const parseResult = parseCredential(call.credential);
      if (!parseResult.success) {
        return parseFailureCredentialResult(call.credential, parseResult.error);
      }
      const parsedCredential = parseResult.data;

      const ctx = buildContext({
        httpGetService,
        cacheService,
        cryptoServices,
        documentLoader,
        fetchJson,
        lookupIssuers,
        registries: call.registries ?? constructorRegistries,
        recognizers,
      });

      const additionalSuites = call.additionalSuites ?? [];
      const suites: VerificationSuite[] = [
        ...defaultSuites,
        ...additionalSuites,
      ];
      const explicitSuiteIds = new Set(additionalSuites.map(s => s.id));
      const results = await runSuites(
        suites,
        { verifiableCredential: parsedCredential },
        ctx,
        { explicitSuiteIds },
      );

      const recognized = extractRecognition(results);
      return {
        verified: !hasFatalFailures(results),
        verifiableCredential: parsedCredential,
        normalizedVerifiableCredential: recognized?.normalized,
        recognizedProfile: recognized?.profile,
        results,
      };
    },

    verifyPresentation: async (call: VerifyPresentationCall) => {
      const parseResult = parsePresentation(call.presentation);
      if (!parseResult.success) {
        return parseFailurePresentationResult(call.presentation, parseResult.error);
      }
      const parsedPresentation = parseResult.data;

      const ctx = buildContext({
        httpGetService,
        cacheService,
        cryptoServices,
        documentLoader,
        fetchJson,
        lookupIssuers,
        registries: call.registries ?? constructorRegistries,
        recognizers,
        challenge: call.challenge ?? null,
        unsignedPresentation: call.unsignedPresentation ?? false,
      });

      const additionalSuites = call.additionalSuites ?? [];
      const presentationSuites: VerificationSuite[] = [
        proofSuite,
        ...additionalSuites,
      ];
      const explicitSuiteIds = new Set(additionalSuites.map(s => s.id));
      const presentationResults = await runSuites(
        presentationSuites,
        { verifiablePresentation: parsedPresentation },
        ctx,
        { explicitSuiteIds },
      );

      const credentials = extractCredentialsFrom(parsedPresentation);
      const credentialResults: CredentialVerificationResult[] = [];
      if (credentials && credentials.length > 0) {
        for (const credential of credentials) {
          credentialResults.push(
            await verifier.verifyCredential({
              credential,
              additionalSuites: call.additionalSuites,
              // Forward override only; if undefined, the constructor
              // default reapplies inside the recursive call.
              registries: call.registries,
            }),
          );
        }
      }

      const presentationVerified = !hasFatalFailures(presentationResults);
      const allCredentialsVerified = credentialResults.every(cr => cr.verified);

      return {
        verified: presentationVerified && allCredentialsVerified,
        verifiablePresentation: parsedPresentation,
        presentationResults,
        credentialResults,
      };
    },
  };

  verifierRef.current = verifier;
  return verifier;
}

interface BuildContextInput {
  httpGetService: VerificationContext['httpGetService'];
  cacheService: VerificationContext['cacheService'];
  cryptoServices: VerificationContext['cryptoServices'];
  documentLoader: VerificationContext['documentLoader'];
  fetchJson: VerificationContext['fetchJson'];
  lookupIssuers: VerificationContext['lookupIssuers'];
  registries?: EntityIdentityRegistry[];
  recognizers?: RecognizerSpec[];
  challenge?: string | null;
  unsignedPresentation?: boolean;
}

/**
 * Internal context builder for `createVerifier`. Populates the legacy
 * `cryptoSuites` field from {@link defaultCryptoSuites} so
 * `bitstring-status-check` (which still consumes the concrete suite
 * instances) keeps working. That field is slated for removal in a
 * follow-up phase that refactors `bitstring-status-check`.
 */
function buildContext(input: BuildContextInput): VerificationContext {
  return {
    documentLoader: input.documentLoader,
    fetchJson: input.fetchJson,
    httpGetService: input.httpGetService,
    cacheService: input.cacheService,
    cryptoServices: input.cryptoServices,
    cryptoSuites: defaultCryptoSuites(),
    registries: input.registries,
    recognizers: input.recognizers,
    lookupIssuers: input.lookupIssuers,
    challenge: input.challenge ?? null,
    unsignedPresentation: input.unsignedPresentation ?? false,
  };
}

function hasFatalFailures(results: CheckResult[]): boolean {
  return results.some(r => r.fatal && r.outcome.status === 'failure');
}

/**
 * Locate the `recognition.profile` success outcome in the result
 * stream and lift its `payload` into the typed `RecognitionResult`
 * the verifier surfaces as
 * {@link CredentialVerificationResult.normalizedVerifiableCredential}.
 *
 * Returns `undefined` if recognition was skipped, failed, or the
 * payload didn't materialize as expected (defensive against
 * downstream check shape drift).
 */
function extractRecognition(
  results: CheckResult[],
): { profile: string; normalized: unknown } | undefined {
  const result = results.find(r => r.check === 'recognition.profile');
  if (!result || result.outcome.status !== 'success') return undefined;
  const payload = result.outcome.payload as RecognitionResult | undefined;
  if (!payload || payload.status !== 'recognized') return undefined;
  return { profile: payload.profile, normalized: payload.normalized };
}

function parseErrorResult(problem: ProblemDetail): CheckResult {
  return {
    suite: 'parsing',
    check: 'parsing.envelope',
    outcome: { status: 'failure', problems: [problem] },
    timestamp: new Date().toISOString(),
    fatal: true,
  };
}

function parseFailureCredentialResult(
  credential: unknown,
  error: { errors: Array<{ path: Array<string | number>; message: string }> },
): CredentialVerificationResult {
  const problem: ProblemDetail = {
    type: ProblemTypes.PARSING_ERROR,
    title: 'Credential Parsing Failed',
    detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
  };
  return {
    verified: false,
    verifiableCredential: credential as VerifiableCredential,
    results: [parseErrorResult(problem)],
  };
}

function parseFailurePresentationResult(
  presentation: unknown,
  error: { errors: Array<{ path: Array<string | number>; message: string }> },
): PresentationVerificationResult {
  const problem: ProblemDetail = {
    type: ProblemTypes.PARSING_ERROR,
    title: 'Presentation Parsing Failed',
    detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
  };
  const result = parseErrorResult(problem);
  return {
    verified: false,
    verifiablePresentation: presentation as VerifiablePresentation,
    presentationResults: [result],
    credentialResults: [],
  };
}
