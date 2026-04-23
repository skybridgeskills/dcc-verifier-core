import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { recognitionSuite } from '../../src/suites/recognition/index.js';
import type { VerificationContext } from '../../src/types/context.js';
import type { VerificationSubject } from '../../src/types/subject.js';
import type {
  RecognitionResult,
  RecognizerSpec,
} from '../../src/types/recognition.js';

const baseContext = (
  overrides: Partial<VerificationContext> = {},
): VerificationContext => ({
  documentLoader: async () => ({}),
  fetchJson: async () => ({}),
  cryptoSuites: [],
  cryptoServices: [],
  challenge: null,
  unsignedPresentation: false,
  ...overrides,
});

const subject: VerificationSubject = { verifiableCredential: { foo: 'bar' } };

describe('recognitionSuite', () => {
  it('emits a single skipped result when no recognizers are configured', async () => {
    const results = await runSuites([recognitionSuite], subject, baseContext());

    expect(results).to.have.lengthOf(1);
    expect(results[0].suite).to.equal('recognition');
    expect(results[0].check).to.equal('recognition.profile');
    expect(results[0].outcome.status).to.equal('skipped');
    if (results[0].outcome.status === 'skipped') {
      expect(results[0].outcome.reason).to.equal('no recognizer matched');
    }
  });

  it('skips when no recognizer applies', async () => {
    const recognizer: RecognizerSpec = {
      id: 'never',
      name: 'Never Matches',
      applies: () => false,
      parse: () => ({ status: 'recognized', profile: 'never', normalized: {} }),
    };
    const results = await runSuites(
      [recognitionSuite],
      subject,
      baseContext({ recognizers: [recognizer] }),
    );

    expect(results[0].outcome.status).to.equal('skipped');
  });

  it('returns success with the recognition payload when a recognizer matches', async () => {
    const normalized = { id: 'normalized-form' };
    const recognizer: RecognizerSpec = {
      id: 'always',
      name: 'Always Matches',
      applies: () => true,
      parse: () => ({
        status: 'recognized',
        profile: 'always',
        normalized,
      }),
    };
    const results = await runSuites(
      [recognitionSuite],
      subject,
      baseContext({ recognizers: [recognizer] }),
    );

    expect(results).to.have.lengthOf(1);
    const outcome = results[0].outcome;
    expect(outcome.status).to.equal('success');
    if (outcome.status === 'success') {
      expect(outcome.message).to.equal('recognized as always');
      const payload = outcome.payload as RecognitionResult;
      expect(payload.status).to.equal('recognized');
      if (payload.status === 'recognized') {
        expect(payload.profile).to.equal('always');
        expect(payload.normalized).to.equal(normalized);
      }
    }
  });

  it('selects the first applies-true recognizer (registration order)', async () => {
    const calls: string[] = [];
    const a: RecognizerSpec = {
      id: 'a',
      name: 'A',
      applies: () => {
        calls.push('a');
        return true;
      },
      parse: () => ({ status: 'recognized', profile: 'a', normalized: 'A' }),
    };
    const b: RecognizerSpec = {
      id: 'b',
      name: 'B',
      applies: () => {
        calls.push('b');
        return true;
      },
      parse: () => ({ status: 'recognized', profile: 'b', normalized: 'B' }),
    };
    const results = await runSuites(
      [recognitionSuite],
      subject,
      baseContext({ recognizers: [a, b] }),
    );

    expect(calls).to.deep.equal(['a']);
    const outcome = results[0].outcome;
    if (outcome.status === 'success') {
      const payload = outcome.payload as RecognitionResult;
      if (payload.status === 'recognized') {
        expect(payload.profile).to.equal('a');
      }
    }
  });

  it('surfaces malformed parse results as a non-fatal failure', async () => {
    const recognizer: RecognizerSpec = {
      id: 'bad',
      name: 'Bad',
      applies: () => true,
      parse: () => ({
        status: 'malformed',
        profile: 'bad',
        problems: [
          {
            type: 'urn:test:bad',
            title: 'Bad',
            detail: 'malformed envelope',
            instance: '/credentialSubject',
          },
        ],
      }),
    };
    const results = await runSuites(
      [recognitionSuite],
      subject,
      baseContext({ recognizers: [recognizer] }),
    );

    expect(results).to.have.lengthOf(1);
    const outcome = results[0].outcome;
    expect(outcome.status).to.equal('failure');
    if (outcome.status === 'failure') {
      expect(outcome.problems).to.have.lengthOf(1);
      expect(outcome.problems[0].instance).to.equal('/credentialSubject');
    }
    expect(results[0].fatal).to.not.equal(true);
  });

  it('does not run for presentation-only subjects (appliesTo gating)', async () => {
    const recognizer: RecognizerSpec = {
      id: 'always',
      name: 'Always',
      applies: () => true,
      parse: () => ({ status: 'recognized', profile: 'always', normalized: {} }),
    };
    const results = await runSuites(
      [recognitionSuite],
      { verifiablePresentation: {} },
      baseContext({ recognizers: [recognizer] }),
    );

    expect(results).to.have.lengthOf(0);
  });
});
