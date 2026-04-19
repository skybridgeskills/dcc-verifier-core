import { expect } from 'chai';
import { verifyCredential } from '../src/index.js';
import { openBadgesSchemaSuite } from '../src/openbadges/index.js';
import { runSuites } from '../src/run-suites.js';
import { defaultSuites } from '../src/default-suites.js';
import { VerificationCheck, CheckOutcome } from '../src/types/check.js';
import {
  BitstringStatusEntry,
  CredentialFactory,
  DEFAULT_TEST_ISSUER_DID,
  StatusListCredentialFactory,
} from './factories/data/index.js';
import { buildTestContext } from './factories/services/build-test-context.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';
import { FakeDocumentLoader } from './factories/services/fake-document-loader.js';
import { v1Expired } from './fixtures/v1-expired.js';
import { v2Expired } from './fixtures/v2-expired.js';

const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
};

describe('verifyCredential', () => {
  describe('basic structure validation', () => {
    it('verifies a valid v1 credential', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.verified).to.be.true;
      expect(result.verifiableCredential).to.exist;
      expect(result.results).to.be.an('array');
      expect(result.results.length).to.be.greaterThan(0);

      const coreResults = result.results.filter(r => r.suite === 'core');
      expect(coreResults.length).to.be.greaterThan(0);
    });

    it('verifies a valid v2 credential', async () => {
      const credential = CredentialFactory({ credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.verified).to.be.true;
      expect(result.verifiableCredential).to.exist;
      expect(result.results).to.be.an('array');
    });

    it('returns verified: false for credential with missing context', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const badCredential = { ...credential };
      delete (badCredential as { '@context'?: unknown })['@context'];

      const result = await verifyCredential({ credential: badCredential, ...fakeVerified });

      expect(result.verified).to.be.false;
      expect(result.results.length).to.be.greaterThan(0);
      expect(result.results[0].suite).to.equal('parsing');
      expect(result.results[0].outcome.status).to.equal('failure');
    });

    it('returns verified: false for credential with missing type', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const badCredential = { ...credential };
      delete (badCredential as { type?: unknown }).type;

      const result = await verifyCredential({ credential: badCredential, ...fakeVerified });

      expect(result.verified).to.be.false;
    });
  });

  describe('parsing errors', () => {
    it('returns verified: false and parse error for invalid JSON', async () => {
      const result = await verifyCredential({
        credential: 'not a credential',
        ...fakeVerified,
      });

      expect(result.verified).to.be.false;
      expect(result.results).to.have.lengthOf(1);
      expect(result.results[0].suite).to.equal('parsing');
      expect(result.results[0].check).to.equal('parsing.envelope');
      expect(result.results[0].outcome.status).to.equal('failure');
    });

    it('returns verified: false for empty object', async () => {
      const result = await verifyCredential({ credential: {}, ...fakeVerified });

      expect(result.verified).to.be.false;
      expect(result.results[0].outcome.status).to.equal('failure');
    });

    it('returns verified: false for null', async () => {
      const result = await verifyCredential({ credential: null, ...fakeVerified });

      expect(result.verified).to.be.false;
    });

    it('returns verified: false for array', async () => {
      const result = await verifyCredential({ credential: [], ...fakeVerified });

      expect(result.verified).to.be.false;
    });
  });

  describe('signature verification', () => {
    it('verifies credential when crypto service accepts proof', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      const proofResults = result.results.filter(r => r.suite === 'proof');
      expect(proofResults.length).to.be.greaterThan(0);

      const sigCheck = proofResults.find(r => r.check === 'proof.signature');
      if (sigCheck) {
        expect(sigCheck.outcome.status).to.equal('success');
      }
    });

    it('fails when crypto service rejects proof', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({
        credential,
        cryptoServices: [FakeCryptoService({ verified: false })],
      });

      expect(result.verified).to.be.false;
      const sigCheck = result.results.find(r => r.check === 'proof.signature');
      expect(sigCheck?.outcome.status).to.equal('failure');
    });
  });

  describe('expired credentials', () => {
    it('detects expired v1 credentials', async () => {
      const result = await verifyCredential({ credential: v1Expired });

      expect(result.verified).to.be.false;
    });

    it('detects expired v2 credentials', async () => {
      const result = await verifyCredential({ credential: v2Expired });

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

      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({
        credential,
        additionalSuites: [customSuite],
        ...fakeVerified,
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

      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({
        credential,
        additionalSuites: [customSuite],
        ...fakeVerified,
      });

      expect(result.verified).to.be.false;
      const customResult = result.results.find(r => r.suite === 'custom');
      expect(customResult?.outcome.status).to.equal('failure');
    });
  });

  describe('result structure', () => {
    it('returns credential in result', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.verifiableCredential).to.exist;
      expect(result.verifiableCredential.id).to.equal(credential.id);
      expect(result.verifiableCredential.type).to.deep.equal(credential.type);
    });

    it('results contain suite and check IDs', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.results.length).to.be.greaterThan(0);
      for (const checkResult of result.results) {
        expect(checkResult.suite).to.be.a('string');
        expect(checkResult.check).to.be.a('string');
        const st = checkResult.outcome.status;
        if (st !== 'success' && st !== 'failure' && st !== 'skipped') {
          throw new Error(
            `Unexpected outcome status for ${checkResult.suite}/${checkResult.check}: ${String(st)}`,
          );
        }
      }
    });

    it('results have timestamps', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      for (const checkResult of result.results) {
        expect(checkResult.timestamp).to.be.a('string');
        expect(new Date(checkResult.timestamp).getTime()).to.be.a('number');
      }
    });
  });

  describe('OBv3 credentials', () => {
    it('does not run OpenBadges checks by default (opt-in)', async () => {
      const credential = CredentialFactory({ credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      const obResults = result.results.filter(
        r => r.suite === 'schema.obv3' || r.suite.startsWith('openbadges'),
      );
      expect(obResults).to.have.lengthOf(0);
    });

    it('processes OpenBadgeCredential when openBadgesSchemaSuite is opted in', async () => {
      const credential = CredentialFactory({ credential: {} });
      const result = await verifyCredential({
        credential,
        additionalSuites: [openBadgesSchemaSuite],
        ...fakeVerified,
      });

      expect(result.verified).to.be.a('boolean');
      expect(result.results).to.be.an('array');

      const obSchemaResults = result.results.filter(r => r.suite === 'openbadges.schema');
      expect(obSchemaResults.length).to.be.greaterThan(0);
    });
  });

  // P-E regression: revoked credentials must fail with the failure
  // sourced from the status suite, not the proof suite. We exercise this
  // through the same code path createVerifier uses (defaultSuites +
  // runSuites + hasFatalFailures), but skip status-list signature
  // verification because that internal flag is not exposed via
  // VerifierConfig (slated for removal in P-H). The contract being
  // pinned is the aggregation, not the wiring.
  describe('revoked credential sourcing (P-E)', () => {
    it('flips verified to false via status.bitstring (not proof.signature) when status list marks the index revoked', async () => {
      const listUrl = 'https://factory.test/status/list-revoked-pe';
      const slCred = await StatusListCredentialFactory({
        id: listUrl,
        issuer: DEFAULT_TEST_ISSUER_DID,
        revokedIndexes: [3],
        listLength: 32,
      });
      const documentLoader = FakeDocumentLoader({ [listUrl]: slCred });
      const ctx = buildTestContext({
        documentLoader,
        cryptoServices: [FakeCryptoService({ verified: true })],
        verifyBitstringStatusListCredential: false,
      });

      const credential = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: BitstringStatusEntry({
            statusListCredential: listUrl,
            statusListIndex: '3',
          }),
        },
      });

      const results = await runSuites(
        defaultSuites,
        { verifiableCredential: credential },
        ctx,
      );

      const verified = !results.some(
        r => r.fatal && r.outcome.status === 'failure',
      );
      expect(verified).to.equal(false);

      const statusResult = results.find(r => r.check === 'status.bitstring');
      expect(statusResult, 'status.bitstring result present').to.exist;
      expect(statusResult?.outcome.status).to.equal('failure');
      expect(statusResult?.fatal).to.equal(true);

      const proofResult = results.find(r => r.check === 'proof.signature');
      expect(proofResult?.outcome.status).to.equal('success');
    });
  });

  describe('issuer variations', () => {
    it('handles string issuer ID', async () => {
      const credential = CredentialFactory({
        version: 'v1',
        credential: { issuer: DEFAULT_TEST_ISSUER_DID },
      });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.verified).to.be.a('boolean');
      expect(result.verifiableCredential.issuer).to.be.a('string');
    });

    it('handles object issuer', async () => {
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifyCredential({ credential, ...fakeVerified });

      expect(result.verified).to.be.a('boolean');
      expect(result.verifiableCredential.issuer).to.be.an('object');
    });
  });
});
