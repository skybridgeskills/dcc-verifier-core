/**
 * Suite orchestration engine.
 *
 * `runSuites` is the core loop of the verification pipeline: it iterates
 * suites in order, runs each check, respects `appliesTo` filtering and
 * `fatal` short-circuiting, and returns a flat `CheckResult[]` report.
 *
 * This module is pure orchestration — it has no knowledge of what any
 * check actually does.
 */

import { VerificationSuite, VerificationCheck, CheckResult, CheckOutcome } from './types/check.js';
import { VerificationContext } from './types/context.js';
import { VerificationSubject } from './types/subject.js';

/**
 * Check if a verification check applies to the given subject.
 * If check.appliesTo is defined, the subject must have at least one
 * of the specified properties (verifiableCredential or verifiablePresentation).
 */
function appliesToSubject(check: VerificationCheck, subject: VerificationSubject): boolean {
  if (!check.appliesTo || check.appliesTo.length === 0) {
    return true; // No restriction = applies to everything
  }

  return check.appliesTo.some(prop => {
    if (prop === 'verifiableCredential') {
      return subject.verifiableCredential !== undefined;
    }
    if (prop === 'verifiablePresentation') {
      return subject.verifiablePresentation !== undefined;
    }
    return false;
  });
}

/**
 * Run a list of verification suites sequentially against a subject.
 *
 * - Checks are executed in order within each suite
 * - Checks with `appliesTo` restrictions are skipped if they don't match the subject
 * - Fatal failures stop remaining checks in that suite only (other suites continue)
 * - Returns a flat array of all check results
 */
export async function runSuites(
  suites: VerificationSuite[],
  subject: VerificationSubject,
  context: VerificationContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const suite of suites) {
    for (const check of suite.checks) {
      // Skip checks that don't apply to this subject type
      if (check.appliesTo && !appliesToSubject(check, subject)) {
        continue;
      }

      const outcome: CheckOutcome = await check.execute(subject, context);
      results.push({
        check: check.id,
        suite: suite.id,
        outcome,
        timestamp: new Date().toISOString(),
      });

      // Fatal failure stops remaining checks in this suite only
      if (check.fatal && outcome.status === 'failure') {
        break;
      }
    }
  }

  return results;
}
