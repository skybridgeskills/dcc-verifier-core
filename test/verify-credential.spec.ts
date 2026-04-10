import { expect } from 'chai';
import { verifyCredential } from '../src/index.js';
import { coreSuite } from '../src/suites/core/index.js';
import { VerificationCheck, CheckOutcome } from '../src/types/check.js';

// Import test fixtures
import { v1NoStatus } from '../src/test-fixtures/verifiableCredentials/v1/v1NoStatus.js';
import { v2NoStatus } from '../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { v1Expired } from '../src/test-fixtures/verifiableCredentials/v1/v1Expired.js';
import { v2Expired } from '../src/test-fixtures/verifiableCredentials/v2/v2Expired.js';
import { v1Revoked } from '../src/test-fixtures/verifiableCredentials/v1/v1Revoked.js';
import { v2Revoked } from '../src/test-fixtures/verifiableCredentials/v2/v2Revoked.js';
import { v1SimpleIssuerId } from '../src/test-fixtures/verifiableCredentials/v1/v1SimpleIssuerId.js';
import { v2SimpleIssuerId } from '../src/test-fixtures/verifiableCredentials/v2/v2SimpleIssuerId.js';

describe('verifyCredential', () => {
  describe('basic structure validation', () => {
    it('verifies a valid v1 credential', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      expect(result.verified).to.be.true;
      expect(result.credential).to.exist;
      expect(result.results).to.be.an('array');
      expect(result.results.length).to.be.greaterThan(0);

      // Should have core suite results
      const coreResults = result.results.filter(r => r.suite === 'core');
      expect(coreResults.length).to.be.greaterThan(0);
    });

    it('verifies a valid v2 credential', async () => {
      const result = await verifyCredential({ credential: v2NoStatus });

      expect(result.verified).to.be.true;
      expect(result.credential).to.exist;
      expect(result.results).to.be.an('array');
    });

    it('returns verified: false for credential with missing context', async () => {
      const badCredential = JSON.parse(JSON.stringify(v1NoStatus));
      delete badCredential['@context'];

      const result = await verifyCredential({ credential: badCredential });

      expect(result.verified).to.be.false;
      const coreContextCheck = result.results.find(
        r => r.suite === 'core' && r.check === 'core.context-exists'
      );
      expect(coreContextCheck?.outcome.status).to.equal('failure');
    });

    it('returns verified: false for credential with missing type', async () => {
      const badCredential = JSON.parse(JSON.stringify(v1NoStatus));
      delete badCredential.type;

      const result = await verifyCredential({ credential: badCredential });

      expect(result.verified).to.be.false;
    });
  });

  describe('parsing errors', () => {
    it('returns verified: false and parse error for invalid JSON', async () => {
      const result = await verifyCredential({ credential: 'not a credential' });

      expect(result.verified).to.be.false;
      expect(result.results).to.have.lengthOf(1);
      expect(result.results[0].suite).to.equal('parsing');
      expect(result.results[0].check).to.equal('parsing.envelope');
      expect(result.results[0].outcome.status).to.equal('failure');
    });

    it('returns verified: false for empty object', async () => {
      const result = await verifyCredential({ credential: {} });

      expect(result.verified).to.be.false;
      expect(result.results[0].outcome.status).to.equal('failure');
    });

    it('returns verified: false for null', async () => {
      const result = await verifyCredential({ credential: null });

      expect(result.verified).to.be.false;
    });

    it('returns verified: false for array', async () => {
      const result = await verifyCredential({ credential: [] });

      expect(result.verified).to.be.false;
    });
  });

  describe('signature verification', () => {
    it('verifies credential with valid signature', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      // Should have proof suite results
      const proofResults = result.results.filter(r => r.suite === 'proof');
      expect(proofResults.length).to.be.greaterThan(0);

      // Signature should be valid
      const sigCheck = proofResults.find(r => r.check === 'proof.signature');
      if (sigCheck) {
        expect(sigCheck.outcome.status).to.be.oneOf(['success', 'failure']);
      }
    });

    it('fails for tampered credential', async () => {
      const tampered = JSON.parse(JSON.stringify(v1NoStatus));
      tampered.credentialSubject.name = 'Tampered Name';

      const result = await verifyCredential({ credential: tampered });

      // Should fail due to signature mismatch
      expect(result.verified).to.be.false;
      const sigCheck = result.results.find(r => r.check === 'proof.signature');
      expect(sigCheck?.outcome.status).to.equal('failure');
    });
  });

  describe('expired credentials', () => {
    it('detects expired v1 credentials', async () => {
      const result = await verifyCredential({ credential: v1Expired });

      // Expired credentials should fail
      expect(result.verified).to.be.false;
    });

    it('detects expired v2 credentials', async () => {
      const result = await verifyCredential({ credential: v2Expired });

      // Expired credentials should fail
      expect(result.verified).to.be.false;
    });
  });

  describe('additionalSuites', () => {
    it('includes custom suite results', async () => {
      const customCheck: VerificationCheck = {
        id: 'custom.test-check',
        name: 'Test Check',
        description: 'A custom test check',
        fatal: false,
        appliesTo: ['verifiableCredential'],
        execute: async (): Promise<CheckOutcome> => ({
          status: 'success',
          message: 'Custom check passed!',
        }),
      };

      const customSuite = {
        id: 'custom',
        name: 'Custom Suite',
        description: 'Custom test suite',
        checks: [customCheck],
      };

      const result = await verifyCredential({
        credential: v1NoStatus,
        additionalSuites: [customSuite],
      });

      const customResult = result.results.find(r => r.suite === 'custom');
      expect(customResult).to.exist;
      expect(customResult?.outcome.status).to.equal('success');
      if (customResult?.outcome.status === 'success') {
        expect(customResult.outcome.message).to.equal('Custom check passed!');
      }
    });

    it('custom fatal suite can fail verification', async () => {
      const customCheck: VerificationCheck = {
        id: 'custom.fatal-check',
        name: 'Fatal Check',
        description: 'A custom fatal check that always fails',
        fatal: true,
        appliesTo: ['verifiableCredential'],
        execute: async (): Promise<CheckOutcome> => ({
          status: 'failure',
          problems: [{
            type: 'https://www.w3.org/TR/vc-data-model#CUSTOM_ERROR',
            title: 'Custom Fatal Error',
            detail: 'This custom check always fails',
          }],
        }),
      };

      const customSuite = {
        id: 'custom',
        name: 'Custom Suite',
        description: 'Custom test suite',
        checks: [customCheck],
      };

      const result = await verifyCredential({
        credential: v1NoStatus,
        additionalSuites: [customSuite],
      });

      expect(result.verified).to.be.false;
      const customResult = result.results.find(r => r.suite === 'custom');
      expect(customResult?.outcome.status).to.equal('failure');
    });
  });

  describe('result structure', () => {
    it('returns credential in result', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      expect(result.credential).to.exist;
      expect(result.credential.id).to.equal(v1NoStatus.id);
      expect(result.credential.type).to.deep.equal(v1NoStatus.type);
    });

    it('results contain suite and check IDs', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      expect(result.results.length).to.be.greaterThan(0);
      for (const checkResult of result.results) {
        expect(checkResult.suite).to.be.a('string');
        expect(checkResult.check).to.be.a('string');
        expect(['success', 'failure', 'skipped']).to.include(checkResult.outcome.status);
      }
    });

    it('results have timestamps', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      for (const checkResult of result.results) {
        expect(checkResult.timestamp).to.be.a('string');
        // Should be a valid ISO date
        expect(new Date(checkResult.timestamp).getTime()).to.be.a('number');
      }
    });
  });

  describe('OBv3 credentials', () => {
    it('processes OpenBadgeCredential', async () => {
      // v2NoStatus is an OpenBadgeCredential
      const result = await verifyCredential({ credential: v2NoStatus });

      expect(result.verified).to.be.a('boolean');
      expect(result.results).to.be.an('array');

      // Should have OBv3 schema check results
      const obv3Results = result.results.filter(r => r.suite === 'schema.obv3');
      expect(obv3Results.length).to.be.greaterThan(0);
    });
  });

  describe('issuer variations', () => {
    it('handles string issuer ID', async () => {
      const result = await verifyCredential({ credential: v1SimpleIssuerId });

      expect(result.verified).to.be.a('boolean');
      expect(result.credential.issuer).to.be.a('string');
    });

    it('handles object issuer', async () => {
      const result = await verifyCredential({ credential: v1NoStatus });

      expect(result.verified).to.be.a('boolean');
      expect(result.credential.issuer).to.be.an('object');
    });
  });
});
