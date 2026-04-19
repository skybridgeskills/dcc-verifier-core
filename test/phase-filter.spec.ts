/**
 * Spec for the suite-phase filter (Phase 10 of the
 * 2026-04-18-openbadges-recognizer-and-subchecks plan).
 *
 * Coverage:
 *
 * - Default (no `phases:`) — every default suite produces results;
 *   `partial` is unset on the result object so existing consumers
 *   see no shape change.
 * - Per-phase isolation — `cryptographic`, `trust`, `recognition`,
 *   and `semantic` each yield only the suites they tag.
 * - Auto-include — `phases: ['semantic']` triggers `recognition`.
 * - No double-include — `phases: ['recognition', 'semantic']`
 *   doesn't run anything twice.
 * - Untagged-suite bypass — a suite added via `additionalSuites`
 *   without a `phase` tag still runs under any phase filter.
 * - Two-pass acceptance scenario — full first pass + a second
 *   `phases: ['semantic']` pass union to the same set of suite ids
 *   that a single full pass produces (no missing categories, no
 *   duplicates of the cryptographic work).
 * - Per-call vs constructor — per-call `phases` overrides the
 *   constructor default.
 * - Verifier surface — `expandPhases` is exercised via the
 *   `'semantic'` auto-include test; the helper itself is internal.
 */

import { expect } from 'chai';
import { runSuites } from '../src/run-suites.js';
import { createVerifier } from '../src/verifier.js';
import { defaultSuites } from '../src/default-suites.js';
import type {
  CheckOutcome,
  SuitePhase,
  VerificationCheck,
  VerificationSuite,
} from '../src/types/check.js';
import type { VerificationContext } from '../src/types/context.js';
import type { VerificationSubject } from '../src/types/subject.js';
import { obv3p0Recognizer } from '../src/openbadges/recognizers.js';
import { openBadgesSuite } from '../src/openbadges/openbadges-suite.js';
import { sampleAchievementCredential } from './openbadges/fixtures/sample-achievement-credential.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';

// Phase-filter integration tests inspect every suite that ran via
// `result.results.map(r => r.suite)`. Use a verbose verifier so
// successful suites still appear in `results[]`; folded mode would
// hide them.
const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
  verbose: true,
};

const fakeCtx: VerificationContext = {
  documentLoader: async () => ({}),
  fetchJson: async () => ({}),
  cryptoSuites: [],
  cryptoServices: [],
  challenge: null,
  unsignedPresentation: false,
};

const cloneCred = (): Record<string, unknown> =>
  structuredClone(sampleAchievementCredential);

function alwaysSuccess(id: string): VerificationCheck {
  return {
    id,
    name: id,
    fatal: false,
    execute: async (): Promise<CheckOutcome> => ({
      status: 'success',
      message: `${id} ran`,
    }),
  };
}

function suiteIdsIn(results: { suite: string }[]): string[] {
  return Array.from(new Set(results.map(r => r.suite)));
}

describe('built-in suite phase tags', () => {
  it('every default suite is tagged', () => {
    for (const suite of defaultSuites) {
      expect(
        suite.phase,
        `${suite.id} is missing a phase tag`,
      ).to.not.equal(undefined);
    }
  });

  it('openBadgesSuite (and its bundle siblings) are tagged semantic', () => {
    expect(openBadgesSuite.phase).to.equal('semantic');
  });
});

describe('runSuites phase filter', () => {
  const subject: VerificationSubject = { verifiableCredential: { foo: 1 } };

  it('passes every suite through when phases is undefined', async () => {
    const a: VerificationSuite = {
      id: 'a',
      name: 'a',
      phase: 'cryptographic',
      checks: [alwaysSuccess('a.x')],
    };
    const b: VerificationSuite = {
      id: 'b',
      name: 'b',
      phase: 'semantic',
      checks: [alwaysSuccess('b.x')],
    };
    const results = await runSuites([a, b], subject, fakeCtx);
    expect(suiteIdsIn(results)).to.deep.equal(['a', 'b']);
  });

  it('runs only suites whose phase matches the request', async () => {
    const c: VerificationSuite = {
      id: 'c',
      name: 'c',
      phase: 'cryptographic',
      checks: [alwaysSuccess('c.x')],
    };
    const t: VerificationSuite = {
      id: 't',
      name: 't',
      phase: 'trust',
      checks: [alwaysSuccess('t.x')],
    };
    const s: VerificationSuite = {
      id: 's',
      name: 's',
      phase: 'semantic',
      checks: [alwaysSuccess('s.x')],
    };

    const cryptoOnly = await runSuites([c, t, s], subject, fakeCtx, {
      phases: ['cryptographic'],
    });
    expect(suiteIdsIn(cryptoOnly)).to.deep.equal(['c']);

    const trustOnly = await runSuites([c, t, s], subject, fakeCtx, {
      phases: ['trust'],
    });
    expect(suiteIdsIn(trustOnly)).to.deep.equal(['t']);
  });

  it('lets untagged suites bypass the phase filter', async () => {
    const tagged: VerificationSuite = {
      id: 'tagged',
      name: 'tagged',
      phase: 'cryptographic',
      checks: [alwaysSuccess('tagged.x')],
    };
    const untagged: VerificationSuite = {
      id: 'untagged',
      name: 'untagged',
      checks: [alwaysSuccess('untagged.x')],
    };

    const results = await runSuites([tagged, untagged], subject, fakeCtx, {
      phases: ['semantic'],
    });

    expect(suiteIdsIn(results)).to.deep.equal(['untagged']);
  });

  it('does not emit synthetic applies-skipped results when a phase excludes the suite', async () => {
    const excluded: VerificationSuite = {
      id: 'excluded',
      name: 'excluded',
      phase: 'cryptographic',
      applies: () => false,
      checks: [alwaysSuccess('excluded.x')],
    };
    const results = await runSuites([excluded], subject, fakeCtx, {
      phases: ['semantic'],
      explicitSuiteIds: new Set(['excluded']),
    });
    expect(results).to.deep.equal([]);
  });
});

describe('createVerifier — phase filter integration', () => {
  it('produces no `partial` flag and runs every default suite when phases is unset', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });
    const result = await verifier.verifyCredential({
      credential: cloneCred(),
    });

    expect(result.partial).to.equal(undefined);
    const suiteIds = suiteIdsIn(result.results);
    expect(suiteIds).to.include.members([
      'core',
      'recognition',
      'proof',
      'status',
    ]);
  });

  it('cryptographic-only run excludes recognition and registry', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });
    const result = await verifier.verifyCredential({
      credential: cloneCred(),
      phases: ['cryptographic'],
    });

    expect(result.partial).to.equal(true);
    const suiteIds = suiteIdsIn(result.results);
    expect(suiteIds).to.not.include('recognition');
    expect(suiteIds).to.not.include('registry');
    expect(suiteIds).to.include.members(['core', 'proof', 'status']);
    expect(result.recognizedProfile).to.equal(undefined);
  });

  it('semantic phase auto-includes recognition', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });
    const result = await verifier.verifyCredential({
      credential: cloneCred(),
      additionalSuites: [openBadgesSuite],
      phases: ['semantic'],
    });

    expect(result.partial).to.equal(true);
    const suiteIds = suiteIdsIn(result.results);
    expect(suiteIds).to.include.members(['recognition', 'openbadges']);
    expect(suiteIds).to.not.include('core');
    expect(suiteIds).to.not.include('proof');
    expect(suiteIds).to.not.include('status');
    expect(result.recognizedProfile).to.equal('obv3p0.openbadge');
  });

  it('recognition + semantic does not double-include recognition', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });
    const result = await verifier.verifyCredential({
      credential: cloneCred(),
      additionalSuites: [openBadgesSuite],
      phases: ['recognition', 'semantic'],
    });

    const recognitionResults = result.results.filter(
      r => r.check === 'recognition.profile',
    );
    expect(recognitionResults).to.have.lengthOf(1);
  });

  it('per-call phases overrides the constructor default', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
      phases: ['cryptographic'],
    });

    const cryptoResult = await verifier.verifyCredential({
      credential: cloneCred(),
    });
    expect(suiteIdsIn(cryptoResult.results)).to.not.include('recognition');

    const semanticResult = await verifier.verifyCredential({
      credential: cloneCred(),
      additionalSuites: [openBadgesSuite],
      phases: ['semantic'],
    });
    expect(suiteIdsIn(semanticResult.results)).to.include.members([
      'recognition',
      'openbadges',
    ]);
    expect(suiteIdsIn(semanticResult.results)).to.not.include('core');
  });

  it('two-pass workflow: crypto + trust pass, then semantic pass — union covers a full pass', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });

    const fullPassPhases: SuitePhase[] = [
      'cryptographic',
      'trust',
      'recognition',
      'semantic',
    ];
    const fullPass = await verifier.verifyCredential({
      credential: cloneCred(),
      additionalSuites: [openBadgesSuite],
      phases: fullPassPhases,
    });
    const fullPassSuites = new Set(fullPass.results.map(r => r.suite));

    const cryptoPass = await verifier.verifyCredential({
      credential: cloneCred(),
      phases: ['cryptographic', 'trust'],
    });
    const semanticPass = await verifier.verifyCredential({
      credential: cloneCred(),
      additionalSuites: [openBadgesSuite],
      phases: ['semantic'],
    });

    const twoPassUnion = new Set([
      ...cryptoPass.results.map(r => r.suite),
      ...semanticPass.results.map(r => r.suite),
    ]);

    expect(Array.from(twoPassUnion).sort()).to.deep.equal(
      Array.from(fullPassSuites).sort(),
    );
    expect(cryptoPass.partial).to.equal(true);
    expect(semanticPass.partial).to.equal(true);

    const cryptoSuiteIds = cryptoPass.results.map(r => r.suite);
    expect(cryptoSuiteIds).to.not.include('proof.duplicate');
    const semanticOnlyHasNoCrypto = semanticPass.results.every(
      r => r.suite !== 'proof' && r.suite !== 'core' && r.suite !== 'status',
    );
    expect(semanticOnlyHasNoCrypto).to.equal(true);
  });
});
