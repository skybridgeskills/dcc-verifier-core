import { VerificationCheck, CheckOutcome } from '../../../types/check.js';
import { ProblemDetail } from '../../../types/problem-detail.js';
import { VerificationSubject } from '../../../types/subject.js';
import { VerificationContext } from '../../../types/context.js';
import { Obv3ProblemTypes } from '../../../openbadges/problem-types.js';

/**
 * Result entry with resultDescription reference.
 */
interface ResultEntry {
  resultDescription?: string;
}

/**
 * ResultDescription entry from achievement.
 */
interface ResultDescriptionEntry {
  id: string;
}

/**
 * Check if the credential has OBv3 result entries.
 */
function hasResultEntries(credential: Record<string, unknown>): boolean {
  const credentialSubject = credential.credentialSubject as Record<string, unknown> | undefined;
  if (!credentialSubject) {
    return false;
  }

  const result = credentialSubject.result as unknown[] | undefined;
  return Array.isArray(result) && result.length > 0;
}

/**
 * Get all ResultDescription IDs from the credential.
 */
function getResultDescriptionIds(credential: Record<string, unknown>): string[] {
  const credentialSubject = credential.credentialSubject as Record<string, unknown> | undefined;
  if (!credentialSubject) {
    return [];
  }

  const achievement = credentialSubject.achievement as Record<string, unknown> | undefined;
  if (!achievement) {
    return [];
  }

  const resultDescription = achievement.resultDescription as ResultDescriptionEntry[] | undefined;
  if (!Array.isArray(resultDescription)) {
    return [];
  }

  return resultDescription
    .filter((desc): desc is ResultDescriptionEntry => desc && typeof desc.id === 'string')
    .map(desc => desc.id);
}

/**
 * Get result entries with their resultDescription references.
 */
function getResultEntries(credential: Record<string, unknown>): ResultEntry[] {
  const credentialSubject = credential.credentialSubject as Record<string, unknown> | undefined;
  if (!credentialSubject) {
    return [];
  }

  const result = credentialSubject.result as ResultEntry[] | undefined;
  if (!Array.isArray(result)) {
    return [];
  }

  return result.filter((r): r is ResultEntry => r && typeof r === 'object');
}

/**
 * OBv3 Result→ResultDescription reference check.
 *
 * Validates that credentialSubject.result entries reference valid
 * ResultDescription IDs in the achievement.
 *
 * Skipped when:
 * - Credential has no credentialSubject.result field
 */
export const obv3ResultRefCheck: VerificationCheck = {
  id: 'schema.obv3.result-ref',
  name: 'OBv3 Result Reference Check',
  description: 'Validates that result entries reference valid ResultDescription IDs.',
  fatal: false,
  appliesTo: ['verifiableCredential'],
  execute: async (
    subject: VerificationSubject,
    _context: VerificationContext
  ): Promise<CheckOutcome> => {
    const credential = subject.verifiableCredential as Record<string, unknown> | undefined;

    if (!credential) {
      return {
        status: 'skipped',
        reason: 'No verifiable credential found in subject.',
      };
    }

    // Check if credential has result entries
    if (!hasResultEntries(credential)) {
      return {
        status: 'skipped',
        reason: 'Credential has no credentialSubject.result field.',
      };
    }

    // Get available ResultDescription IDs
    const resultDescriptionIds = getResultDescriptionIds(credential);

    // Get result entries with their references
    const resultEntries = getResultEntries(credential);

    // Check each result entry for valid references
    const invalidRefs: Array<{ index: number; ref: string }> = [];

    for (let i = 0; i < resultEntries.length; i++) {
      const entry = resultEntries[i];
      if (entry.resultDescription !== undefined) {
        if (!resultDescriptionIds.includes(entry.resultDescription)) {
          invalidRefs.push({ index: i, ref: entry.resultDescription });
        }
      }
    }

    if (invalidRefs.length > 0) {
      const problems: ProblemDetail[] = invalidRefs.map(({ index, ref }) => ({
        type: Obv3ProblemTypes.OB_INVALID_RESULT_REFERENCE,
        title: 'Invalid Result Reference',
        detail: `Result entry at index ${index} references ResultDescription id "${ref}" which does not exist in achievement.resultDescription`,
      }));

      return {
        status: 'failure',
        problems,
      };
    }

    // All references are valid
    return {
      status: 'success',
      message: `All ${resultEntries.length} result entries reference valid ResultDescription IDs.`,
    };
  },
};
