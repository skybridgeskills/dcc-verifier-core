import type { ProblemDetail } from './problem-detail.js';
import type { VerificationSubject } from './subject.js';
import type { VerificationContext } from './context.js';

export type CheckOutcome =
  | { status: 'success'; message: string }
  | { status: 'failure'; problems: ProblemDetail[] }
  | { status: 'skipped'; reason: string };

/** Tagged outcome from the suite orchestrator. */
export interface CheckResult {
  /** Check id, e.g. "core.proof-exists" */
  check: string;
  /** Suite id, e.g. "core" */
  suite: string;
  outcome: CheckOutcome;
}

/** A single verification check with metadata. */
export interface VerificationCheck {
  id: string;
  name: string;
  description?: string;
  appliesTo?: Array<'verifiableCredential' | 'verifiablePresentation'>;
  /** If true, a failure stops remaining checks in this suite. */
  fatal?: boolean;
  execute: (
    subject: VerificationSubject,
    context: VerificationContext,
  ) => Promise<CheckOutcome>;
}

/** A named, ordered collection of checks. */
export interface VerificationSuite {
  id: string;
  name: string;
  description?: string;
  checks: VerificationCheck[];
}
