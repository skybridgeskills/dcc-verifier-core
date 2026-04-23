/**
 * Unit coverage for `foldCheckResults` and `computeId` — the
 * pure helpers in `src/fold-results.ts`. Keeps cases small and
 * inline; no service doubles needed since the helper has no I/O.
 */

import { expect } from 'chai';
import { computeId, foldCheckResults } from '../src/fold-results.js';
import type {
  CheckResult,
  SuitePhase,
  VerificationCheck,
  VerificationSuite,
} from '../src/types/check.js';
import type { ProblemDetail } from '../src/types/problem-detail.js';

const stubProblem: ProblemDetail = {
  type: 'urn:test:fail',
  title: 'Test failure',
  detail: 'fixture',
};

function mkCheck(
  id: string,
  outcome: 'success' | 'failure' | 'skipped',
  options: { fatal?: boolean } = {},
): VerificationCheck {
  return {
    id,
    name: id,
    fatal: options.fatal,
    execute: async () => {
      if (outcome === 'success') {
        return { status: 'success', message: 'ok' };
      }
      if (outcome === 'failure') {
        return { status: 'failure', problems: [stubProblem] };
      }
      return { status: 'skipped', reason: 'n/a' };
    },
  };
}

function mkSuite(
  id: string,
  checks: VerificationCheck[],
  options: { phase?: SuitePhase } = {},
): VerificationSuite {
  return { id, name: id, checks, phase: options.phase };
}

function mkResult(
  suite: string,
  check: string,
  status: 'success' | 'failure' | 'skipped',
  options: { fatal?: boolean; reason?: string } = {},
): CheckResult {
  if (status === 'success') {
    return {
      suite,
      check,
      outcome: { status: 'success', message: 'ok' },
      ...(options.fatal !== undefined ? { fatal: options.fatal } : {}),
    };
  }
  if (status === 'failure') {
    return {
      suite,
      check,
      outcome: { status: 'failure', problems: [stubProblem] },
      ...(options.fatal !== undefined ? { fatal: options.fatal } : {}),
    };
  }
  return {
    suite,
    check,
    outcome: { status: 'skipped', reason: options.reason ?? 'n/a' },
  };
}

describe('foldCheckResults', () => {
  it('1. all-pass: folds 4 successes into one summary, no results entries', () => {
    const suite = mkSuite(
      'core',
      [
        mkCheck('core.a', 'success'),
        mkCheck('core.b', 'success'),
        mkCheck('core.c', 'success'),
        mkCheck('core.d', 'success'),
      ],
      { phase: 'cryptographic' },
    );
    const checks: CheckResult[] = [
      mkResult('core', 'core.a', 'success'),
      mkResult('core', 'core.b', 'success'),
      mkResult('core', 'core.c', 'success'),
      mkResult('core', 'core.d', 'success'),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite]);

    expect(results).to.have.length(0);
    expect(summaries).to.have.length(1);
    expect(summaries[0].status).to.equal('success');
    expect(summaries[0].verified).to.be.true;
    expect(summaries[0].counts).to.deep.equal({ passed: 4, failed: 0, skipped: 0 });
    expect(summaries[0].message).to.equal('4 of 4 checks passed');
    expect(summaries[0].id).to.equal('cryptographic.core');
    expect(summaries[0].phase).to.equal('cryptographic');
  });

  it('2. all-fail: surfaces every failure in results, summary status="failure"', () => {
    const suite = mkSuite(
      'proof',
      [mkCheck('proof.sig', 'failure'), mkCheck('proof.kid', 'failure')],
      { phase: 'cryptographic' },
    );
    const checks: CheckResult[] = [
      mkResult('proof', 'proof.sig', 'failure'),
      mkResult('proof', 'proof.kid', 'failure'),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite]);

    expect(results).to.have.length(2);
    expect(summaries[0].status).to.equal('failure');
    expect(summaries[0].verified).to.be.false;
    expect(summaries[0].counts).to.deep.equal({ passed: 0, failed: 2, skipped: 0 });
    expect(summaries[0].message).to.equal('2 of 2 checks failed');
  });

  it('3. mixed: 1 fail + 3 pass surfaces 1 failure, summary status="mixed"', () => {
    const suite = mkSuite(
      'core',
      [
        mkCheck('core.a', 'success'),
        mkCheck('core.b', 'failure'),
        mkCheck('core.c', 'success'),
        mkCheck('core.d', 'success'),
      ],
      { phase: 'cryptographic' },
    );
    const checks: CheckResult[] = [
      mkResult('core', 'core.a', 'success'),
      mkResult('core', 'core.b', 'failure'),
      mkResult('core', 'core.c', 'success'),
      mkResult('core', 'core.d', 'success'),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite]);

    expect(results).to.have.length(1);
    expect(results[0].check).to.equal('core.b');
    expect(summaries[0].status).to.equal('mixed');
    expect(summaries[0].verified).to.be.false;
    expect(summaries[0].counts).to.deep.equal({ passed: 3, failed: 1, skipped: 0 });
    expect(summaries[0].message).to.equal('1 of 4 checks failed (3 passed)');
  });

  it('4. all-skipped: explicit `<suite>.applies` skip kept, summary status="skipped"', () => {
    const suite = mkSuite(
      'extra',
      [mkCheck('extra.x', 'success')],
      { phase: 'semantic' },
    );
    const checks: CheckResult[] = [
      mkResult('extra', 'extra.applies', 'skipped', {
        reason: 'suite predicate returned false',
      }),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite]);

    expect(results).to.have.length(1);
    expect(results[0].check).to.equal('extra.applies');
    expect(summaries[0].status).to.equal('skipped');
    expect(summaries[0].verified).to.be.true;
    expect(summaries[0].counts).to.deep.equal({ passed: 0, failed: 0, skipped: 1 });
    expect(summaries[0].message).to.equal(
      'extra not applicable: suite predicate returned false',
    );
  });

  it('5. fatal short-circuit: 1 pass + 1 fatal fail + 2 not-run', () => {
    const suite = mkSuite(
      'proof',
      [
        mkCheck('proof.a', 'success'),
        mkCheck('proof.b', 'failure', { fatal: true }),
        mkCheck('proof.c', 'success'),
        mkCheck('proof.d', 'success'),
      ],
      { phase: 'cryptographic' },
    );
    const checks: CheckResult[] = [
      mkResult('proof', 'proof.a', 'success'),
      mkResult('proof', 'proof.b', 'failure', { fatal: true }),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite]);

    expect(results).to.have.length(1);
    expect(results[0].check).to.equal('proof.b');
    expect(summaries[0].status).to.equal('mixed');
    expect(summaries[0].verified).to.be.false;
    expect(summaries[0].counts).to.deep.equal({ passed: 1, failed: 1, skipped: 0 });
    expect(summaries[0].fatalFailureAt).to.equal('cryptographic.proof.b');
    expect(summaries[0].message).to.equal(
      '1 of 4 checks failed (1 passed, 2 not run after fatal)',
    );
  });

  it('6. phase derivation: tagged suite carries through to summary', () => {
    const suite = mkSuite('registry', [mkCheck('registry.lookup', 'success')], {
      phase: 'trust',
    });
    const checks: CheckResult[] = [
      mkResult('registry', 'registry.lookup', 'success'),
    ];

    const { summaries } = foldCheckResults(checks, [suite]);

    expect(summaries[0].phase).to.equal('trust');
    expect(summaries[0].id).to.equal('trust.registry');
  });

  it('7. phase derivation: untagged suite → "unknown"', () => {
    const suite = mkSuite('custom', [mkCheck('custom.x', 'success')]);
    const checks: CheckResult[] = [
      mkResult('custom', 'custom.x', 'success'),
    ];

    const { summaries } = foldCheckResults(checks, [suite]);

    expect(summaries[0].phase).to.equal('unknown');
    expect(summaries[0].id).to.equal('unknown.custom');
  });

  it('8. phase-equals-suite collapse: recognition.recognition → recognition', () => {
    const suite = mkSuite(
      'recognition',
      [mkCheck('recognition.profile', 'success')],
      { phase: 'recognition' },
    );
    const checks: CheckResult[] = [
      mkResult('recognition', 'recognition.profile', 'success'),
    ];

    const { summaries } = foldCheckResults(checks, [suite]);

    expect(summaries[0].id).to.equal('recognition');
  });

  it('9. id computation: suite-prefix dedupe (core.proof-exists, suite=core)', () => {
    expect(computeId('cryptographic', 'core', 'core.proof-exists')).to.equal(
      'cryptographic.core.proof-exists',
    );
  });

  it('10. verbose pass-through: results[] carries every check, ids populated lazily', () => {
    const suite = mkSuite(
      'core',
      [
        mkCheck('core.a', 'success'),
        mkCheck('core.b', 'failure'),
        mkCheck('core.c', 'success'),
        mkCheck('core.d', 'success'),
      ],
      { phase: 'cryptographic' },
    );
    const checks: CheckResult[] = [
      mkResult('core', 'core.a', 'success'),
      mkResult('core', 'core.b', 'failure'),
      mkResult('core', 'core.c', 'success'),
      mkResult('core', 'core.d', 'success'),
    ];

    const { results, summaries } = foldCheckResults(checks, [suite], {
      verbose: true,
    });

    expect(results).to.have.length(4);
    expect(summaries[0].status).to.equal('mixed');
  });

  it('emits one summary per suite that produced results, in input order', () => {
    const a = mkSuite('alpha', [mkCheck('alpha.x', 'success')], {
      phase: 'cryptographic',
    });
    const b = mkSuite('beta', [mkCheck('beta.x', 'failure')], {
      phase: 'semantic',
    });
    const checks: CheckResult[] = [
      mkResult('alpha', 'alpha.x', 'success'),
      mkResult('beta', 'beta.x', 'failure'),
    ];

    const { summaries } = foldCheckResults(checks, [a, b]);

    expect(summaries.map(s => s.id)).to.deep.equal([
      'cryptographic.alpha',
      'semantic.beta',
    ]);
  });

  it('returns empty result for empty input', () => {
    const out = foldCheckResults([], []);
    expect(out.results).to.deep.equal([]);
    expect(out.summaries).to.deep.equal([]);
  });
});

describe('computeId', () => {
  it('joins phase, suite, and stripped local part', () => {
    expect(computeId('cryptographic', 'core', 'core.proof-exists')).to.equal(
      'cryptographic.core.proof-exists',
    );
  });

  it('collapses phase===suite to a single phase segment', () => {
    expect(computeId('recognition', 'recognition', 'recognition.profile')).to.equal(
      'recognition.profile',
    );
  });

  it('uses "unknown" when phase is undefined', () => {
    expect(computeId(undefined, 'foo', 'foo.bar')).to.equal('unknown.foo.bar');
  });

  it('drops trailing segment when localCheckId is empty (summary id)', () => {
    expect(computeId('cryptographic', 'core', '')).to.equal('cryptographic.core');
    expect(computeId('recognition', 'recognition', '')).to.equal('recognition');
  });

  it('does not strip prefix when localCheckId lacks the suite prefix', () => {
    expect(computeId('semantic', 'openbadges', 'result-ref')).to.equal(
      'semantic.openbadges.result-ref',
    );
  });
});
