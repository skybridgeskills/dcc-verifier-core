import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { statusSuite } from '../../src/suites/status/index.js';
import { buildTestContext } from '../factories/services/build-test-context.js';
import { VerificationSubject } from '../../src/types/subject.js';
import {
  BitstringStatusEntry,
  CredentialFactory,
  DEFAULT_TEST_ISSUER_DID,
  StatusListCredentialFactory,
} from '../factories/data/index.js';
import { FakeDocumentLoader } from '../factories/services/fake-document-loader.js';

describe('Status Suite', () => {
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('credential with no credentialStatus', () => {
    it('skips check when credential has no status', async () => {
      const context = buildTestContext();
      const subject = createSubject(CredentialFactory({ version: 'v2', credential: {} }));
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('status.bitstring');
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('no credentialStatus');
      }
    });
  });

  describe('credential with legacy status types', () => {
    it('skips check for StatusList2021Entry status type', async () => {
      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: {
            id: 'https://example.com/status#1',
            type: 'StatusList2021Entry',
            statusPurpose: 'revocation',
            statusListIndex: '1',
            statusListCredential: 'https://example.com/status',
          },
        },
      });
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, buildTestContext());

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('Legacy status type');
      }
    });

    it('skips check for 1EdTechRevocationList status type', async () => {
      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: {
            id: 'https://example.com/status#1',
            type: '1EdTechRevocationList',
            statusPurpose: 'revocation',
            statusListIndex: '1',
            statusListCredential: 'https://example.com/status',
          },
        },
      });
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, buildTestContext());

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
    });
  });

  describe('credential with BitstringStatusListEntry', () => {
    it('succeeds when index is not revoked (unsigned list credential)', async () => {
      const listUrl = 'https://factory.test/status/list-ok';
      const slCred = await StatusListCredentialFactory({
        id: listUrl,
        issuer: DEFAULT_TEST_ISSUER_DID,
        revokedIndexes: [],
        listLength: 32,
      });
      const documentLoader = FakeDocumentLoader({ [listUrl]: slCred });
      const context = buildTestContext({
        documentLoader,
        verifyBitstringStatusListCredential: false,
      });

      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: BitstringStatusEntry({
            statusListCredential: listUrl,
            statusListIndex: '0',
          }),
        },
      });
      const results = await runSuites([statusSuite], createSubject(cred), context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('success');
      if (results[0].outcome.status === 'success') {
        expect(results[0].outcome.message).to.include('not revoked');
      }
    });

    it('fails when index is revoked', async () => {
      const listUrl = 'https://factory.test/status/list-revoked';
      const slCred = await StatusListCredentialFactory({
        id: listUrl,
        issuer: DEFAULT_TEST_ISSUER_DID,
        revokedIndexes: [2],
        listLength: 32,
      });
      const documentLoader = FakeDocumentLoader({ [listUrl]: slCred });
      const context = buildTestContext({
        documentLoader,
        verifyBitstringStatusListCredential: false,
      });

      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: BitstringStatusEntry({
            statusListCredential: listUrl,
            statusListIndex: '2',
          }),
        },
      });
      const results = await runSuites([statusSuite], createSubject(cred), context);

      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].type).to.equal(
          'https://www.w3.org/TR/vc-data-model#CREDENTIAL_REVOKED_OR_SUSPENDED',
        );
      }
    });
  });

  describe('status list load failures', () => {
    it('fails when status list credential URL cannot be loaded', async function () {
      this.timeout(15000);
      const listUrl = 'https://factory.test/status/missing';
      const documentLoader = FakeDocumentLoader({});
      const context = buildTestContext({
        documentLoader,
        verifyBitstringStatusListCredential: false,
      });

      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: BitstringStatusEntry({
            statusListCredential: listUrl,
            statusListIndex: '0',
          }),
        },
      });
      const results = await runSuites([statusSuite], createSubject(cred), context);

      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].detail).to.match(
          /Could not load|Document not found|NotFoundError/i,
        );
      }
    });
  });

  describe('unknown status types', () => {
    it('skips check for unknown status type', async () => {
      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialStatus: {
            id: 'https://example.com/status#1',
            type: 'UnknownStatusType',
            statusPurpose: 'revocation',
          },
        },
      });
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, buildTestContext());

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('UnknownStatusType');
      }
    });
  });
});
