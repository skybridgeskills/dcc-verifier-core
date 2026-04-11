/**
 * Core verification primitives: suites, checks, and outcomes.
 *
 * These types form the plugin contract for the verification pipeline.
 * Each suite is a named group of checks; each check returns a discriminated
 * outcome (success / failure / skip). The orchestrator in `run-suites.ts`
 * iterates suites and assembles a flat `CheckResult[]` report.
 *
 * @see {@link ../run-suites.ts} for orchestration
 * @see {@link ../defaults.ts} for the default suite ordering
 */

import type { ProblemDetail } from './problem-detail.js';
import type { VerificationSubject } from './subject.js';
import type { VerificationContext } from './context.js';

/**
 * Discriminated outcome of a single verification check.
 *
 * - **success** — the check passed; `message` describes what was validated.
 * - **failure** — the check found a problem; `problems` carries one or more
 *   RFC 9457-style `ProblemDetail` entries.
 * - **skipped** — the check was irrelevant to this input (e.g. no
 *   `credentialStatus`); `reason` explains why.
 *
 * Checks never throw for verification failures — they return a failure outcome.
 * Throws are reserved for unexpected infrastructure errors.
 */
export type CheckOutcome =
  | { status: 'success'; message: string }
  | { status: 'failure'; problems: ProblemDetail[] }
  | { status: 'skipped'; reason: string };

/**
 * Tagged outcome emitted by the suite orchestrator.
 *
 * Wraps a `CheckOutcome` with metadata identifying which suite and check
 * produced it, plus a timestamp. The flat `CheckResult[]` array is the
 * primary report structure returned by `verifyCredential`.
 */
export interface CheckResult {
  /** Qualified check id, e.g. `"core.proof-exists"`. */
  check: string;
  /** Suite id this check belongs to, e.g. `"core"`. */
  suite: string;
  outcome: CheckOutcome;
  /** ISO 8601 timestamp when the check was executed. */
  timestamp: string;
  /**
   * Whether this check was marked fatal in its suite definition.
   * Fatal failures affect the overall `verified` status; non-fatal ones
   * are informational/warnings only.
   */
  fatal?: boolean;
}

/**
 * Subject types that a check can apply to.
 *
 * Used by `VerificationCheck.appliesTo` to limit a check to credentials,
 * presentations, or both. The orchestrator skips checks whose `appliesTo`
 * doesn't match the current subject.
 */
export type VerificationSubjectType = 'verifiableCredential' | 'verifiablePresentation';

/**
 * A single verification check — the smallest unit of verification logic.
 *
 * Checks are pure async functions: given a subject and context, they return
 * a `CheckOutcome`. They should not have side effects beyond reading from
 * the context's services (document loader, registries, etc.).
 */
export interface VerificationCheck {
  id: string;
  name: string;
  description?: string;
  /** Restricts this check to specific subject types. Unset = runs for all. */
  appliesTo?: readonly VerificationSubjectType[];
  /** If true, a failure stops remaining checks in this suite (later suites still run). */
  fatal?: boolean;
  execute: (
    subject: VerificationSubject,
    context: VerificationContext,
  ) => Promise<CheckOutcome>;
}

/**
 * A named, ordered collection of checks — the unit of verification configuration.
 *
 * Suites run sequentially. Within a suite, checks run in array order.
 * Callers can extend the default suites via `additionalSuites` in the
 * options object, or replace them entirely by calling `runSuites` directly.
 */
export interface VerificationSuite {
  id: string;
  name: string;
  description?: string;
  checks: VerificationCheck[];
}
