/**
 * Primary public API — `verifyCredential` and `verifyPresentation`.
 *
 * These are the entry points that callers import from the package.
 * Each function follows the same pipeline: parse → build context →
 * run suites → assemble report.
 *
 * For credentials: runs all default suites plus any `additionalSuites`.
 * For presentations: verifies the VP signature, then extracts and verifies
 * each embedded credential individually.
 */

import { parseCredential, VerifiableCredential } from './schemas/credential.js';
import { parsePresentation } from './schemas/presentation.js';
import { runSuites } from './run-suites.js';
import { buildContext, defaultSuites } from './defaults.js';
import { VerificationSuite, CheckResult } from './types/check.js';
import { VerificationSubject } from './types/subject.js';
import { CredentialVerificationResult, PresentationVerificationResult } from './types/result.js';
import { VerifyCredentialOptions, VerifyPresentationOptions } from './types/options.js';
import { extractCredentialsFrom } from './extractCredentialsFrom.js';
import { ProblemDetail } from './types/problem-detail.js';

/**
 * Check if any check results have **fatal** failures.
 * Non-fatal failures (e.g., optional schema validation) do not affect
 * the overall `verified` status — they are recorded in results but don't
 * invalidate the credential.
 */
function hasFatalFailures(results: CheckResult[]): boolean {
  return results.some(r => r.fatal && r.outcome.status === 'failure');
}

/**
 * Create a parse error check result.
 * Parsing failures are always fatal - malformed credentials can't be verified.
 */
function createParseErrorResult(problem: ProblemDetail): CheckResult {
  return {
    suite: 'parsing',
    check: 'parsing.envelope',
    outcome: {
      status: 'failure',
      problems: [problem],
    },
    timestamp: new Date().toISOString(),
    fatal: true,
  };
}

/**
 * Verify a credential using the suite-based architecture.
 *
 * This function:
 * 1. Parses the credential using Zod schemas
 * 2. Runs all verification suites (core, proof, status, registry, schema)
 * 3. Returns structured results with `verified` boolean
 *
 * @param opts - Verification options including the credential
 * @returns CredentialVerificationResult with verified status and check results
 */
export async function verifyCredential(
  opts: VerifyCredentialOptions
): Promise<CredentialVerificationResult> {
  // Step 1: Parse credential with Zod
  const parseResult = parseCredential(opts.credential);

  if (!parseResult.success) {
    // Parse failed - return error result
    const problem: ProblemDetail = {
      type: 'https://www.w3.org/TR/vc-data-model#PARSING_ERROR',
      title: 'Credential Parsing Failed',
      detail: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    };

    return {
      verified: false,
      credential: opts.credential as VerifiableCredential,
      results: [createParseErrorResult(problem)],
    };
  }

  const parsedCredential = parseResult.data;

  // Step 2: Build context with overrides
  // Support both registries (new) and knownDIDRegistries (legacy) for backward compatibility
  const registries = opts.registries ?? opts.knownDIDRegistries;
  const context = buildContext({
    documentLoader: opts.documentLoader,
    fetchJson: opts.fetchJson,
    httpGetService: opts.httpGetService,
    cacheService: opts.cacheService,
    cryptoSuites: opts.cryptoSuites,
    cryptoServices: opts.cryptoServices,
    lookupIssuers: opts.lookupIssuers,
    registries,
  });

  // Step 3: Collect suites
  const suites: VerificationSuite[] = [
    ...(opts.verifyObv3Schema === false
      ? defaultSuites.filter(s => s.id !== 'schema.obv3')
      : defaultSuites),
    ...(opts.additionalSuites ?? []),
  ];

  // Step 4: Build subject
  const subject: VerificationSubject = {
    verifiableCredential: parsedCredential,
  };

  // Step 5: Run suites
  const results = await runSuites(suites, subject, context);

  // Step 6: Derive verified status (only fatal failures invalidate the credential)
  const verified = !hasFatalFailures(results);

  // Step 7: Return result
  return {
    verified,
    credential: parsedCredential,
    results,
  };
}

/**
 * Verify a presentation using the suite-based architecture.
 *
 * This function:
 * 1. Parses the presentation using Zod schemas
 * 2. Verifies the presentation signature (proof suite)
 * 3. Extracts and verifies each embedded credential
 * 4. Returns structured results with combined verification status
 *
 * @param opts - Verification options including the presentation
 * @returns PresentationVerificationResult with verified status and all check results
 */
export async function verifyPresentation(
  opts: VerifyPresentationOptions
): Promise<PresentationVerificationResult> {
  // Step 1: Parse presentation with Zod
  const parseResult = parsePresentation(opts.presentation);

  if (!parseResult.success) {
    // Parse failed - return error result
    const problem: ProblemDetail = {
      type: 'https://www.w3.org/TR/vc-data-model#PARSING_ERROR',
      title: 'Presentation Parsing Failed',
      detail: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    };

    return {
      verified: false,
      presentationResults: [createParseErrorResult(problem)],
      credentialResults: [],
      allResults: [createParseErrorResult(problem)],
    };
  }

  const parsedPresentation = parseResult.data;

  // Step 2: Build context with presentation-specific options
  // Support both registries (new) and knownDIDRegistries (legacy) for backward compatibility
  const registries = opts.registries ?? opts.knownDIDRegistries;
  const context = buildContext({
    documentLoader: opts.documentLoader,
    fetchJson: opts.fetchJson,
    httpGetService: opts.httpGetService,
    cacheService: opts.cacheService,
    cryptoSuites: opts.cryptoSuites,
    cryptoServices: opts.cryptoServices,
    lookupIssuers: opts.lookupIssuers,
    registries,
    challenge: opts.challenge ?? null,
    unsignedPresentation: opts.unsignedPresentation ?? false,
  });

  // Step 3: Run presentation-level suites
  const presentationSuites: VerificationSuite[] = [
    // Additional custom suites for presentation verification
    ...(opts.additionalSuites ?? []),
  ];

  const presentationSubject: VerificationSubject = {
    verifiablePresentation: parsedPresentation,
  };

  // Run proof verification on presentation
  const { proofSuite } = await import('./suites/proof/index.js');
  const presentationResults = await runSuites(
    [proofSuite, ...presentationSuites],
    presentationSubject,
    context
  );

  // Step 4: Extract and verify credentials
  const credentials = extractCredentialsFrom(parsedPresentation);
  const credentialResults: CredentialVerificationResult[] = [];

  if (credentials && credentials.length > 0) {
    for (const credential of credentials) {
      // Verify each credential using the same context (registries, etc.)
      const credResult = await verifyCredential({
        credential,
        registries,
        additionalSuites: opts.additionalSuites,
        verifyObv3Schema: opts.verifyObv3Schema,
        documentLoader: opts.documentLoader,
        fetchJson: opts.fetchJson,
        httpGetService: opts.httpGetService,
        cacheService: opts.cacheService,
        cryptoSuites: opts.cryptoSuites,
        cryptoServices: opts.cryptoServices,
        lookupIssuers: opts.lookupIssuers,
      });
      credentialResults.push(credResult);
    }
  }

  // Step 5: Combine results
  const allCredentialChecks = credentialResults.flatMap(cr => cr.results);
  const allResults = [...presentationResults, ...allCredentialChecks];

  // Step 6: Derive verified status (only fatal failures invalidate)
  const presentationVerified = !hasFatalFailures(presentationResults);
  const allCredentialsVerified = credentialResults.every(cr => cr.verified);
  const verified = presentationVerified && allCredentialsVerified;

  // Step 7: Return result
  return {
    verified,
    presentationResults,
    credentialResults,
    allResults,
  };
}
