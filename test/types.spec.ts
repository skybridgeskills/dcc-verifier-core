import { expect } from 'chai';
import type { ProblemDetail } from '../src/types/problem-detail.js';
import type {
  CheckOutcome,
  CheckResult,
  VerificationCheck,
  VerificationSuite,
} from '../src/types/check.js';
import type { VerificationContext } from '../src/types/context.js';
import type { VerificationSubject } from '../src/types/subject.js';

describe('Foundation types', () => {
  describe('ProblemDetail', () => {
    it('constructs with type, title, detail', () => {
      const pd: ProblemDetail = {
        type: 'urn:vc-verify:invalid-signature',
        title: 'Invalid Signature',
        detail: 'The proof value does not match the credential content.',
      };
      expect(pd.type).to.equal('urn:vc-verify:invalid-signature');
      expect(pd.title).to.equal('Invalid Signature');
      expect(pd.detail).to.contain('proof value');
    });
  });

  describe('CheckOutcome', () => {
    it('narrows success variant', () => {
      const outcome: CheckOutcome = { status: 'success', message: 'Signature verified.' };
      expect(outcome.status).to.equal('success');
      if (outcome.status === 'success') {
        expect(outcome.message).to.equal('Signature verified.');
      }
    });

    it('narrows failure variant', () => {
      const outcome: CheckOutcome = {
        status: 'failure',
        problems: [{
          type: 'urn:vc-verify:no-proof',
          title: 'No Proof',
          detail: 'Credential is missing a proof.',
        }],
      };
      expect(outcome.status).to.equal('failure');
      if (outcome.status === 'failure') {
        expect(outcome.problems).to.have.length(1);
        expect(outcome.problems[0].type).to.equal('urn:vc-verify:no-proof');
      }
    });

    it('narrows skipped variant', () => {
      const outcome: CheckOutcome = { status: 'skipped', reason: 'No credentialStatus field.' };
      expect(outcome.status).to.equal('skipped');
      if (outcome.status === 'skipped') {
        expect(outcome.reason).to.equal('No credentialStatus field.');
      }
    });
  });

  describe('CheckResult', () => {
    it('tags outcome with suite and check ids', () => {
      const result: CheckResult = {
        check: 'core.proof-exists',
        suite: 'core',
        outcome: { status: 'success', message: 'Proof exists.' },
        timestamp: new Date().toISOString(),
      };
      expect(result.suite).to.equal('core');
      expect(result.check).to.equal('core.proof-exists');
      expect(result.outcome.status).to.equal('success');
      expect(result.timestamp).to.be.a('string');
    });
  });

  describe('VerificationSuite', () => {
    it('assembles a suite with mock checks', async () => {
      const successCheck: VerificationCheck = {
        id: 'test.pass',
        name: 'Always Pass',
        fatal: false,
        async execute() {
          return { status: 'success', message: 'Passed.' };
        },
      };

      const failCheck: VerificationCheck = {
        id: 'test.fail',
        name: 'Always Fail',
        fatal: true,
        async execute() {
          return {
            status: 'failure',
            problems: [{
              type: 'urn:test:always-fails',
              title: 'Always Fails',
              detail: 'This check always fails.',
            }],
          };
        },
      };

      const skipCheck: VerificationCheck = {
        id: 'test.skip',
        name: 'Always Skip',
        appliesTo: ['verifiablePresentation'],
        async execute() {
          return { status: 'skipped', reason: 'Not applicable.' };
        },
      };

      const suite: VerificationSuite = {
        id: 'test',
        name: 'Test Suite',
        description: 'A suite for testing type construction.',
        checks: [successCheck, failCheck, skipCheck],
      };

      expect(suite.id).to.equal('test');
      expect(suite.checks).to.have.length(3);

      const subject: VerificationSubject = { verifiableCredential: {} };
      const context: VerificationContext = {
        documentLoader: async () => ({}),
        fetchJson: async () => ({}),
        cryptoSuites: [],
        cryptoServices: [],
      };

      const outcomes = await Promise.all(
        suite.checks.map((c) => c.execute(subject, context))
      );
      expect(outcomes[0].status).to.equal('success');
      expect(outcomes[1].status).to.equal('failure');
      expect(outcomes[2].status).to.equal('skipped');
    });
  });
});
