import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { statusSuite } from '../../src/suites/status/index.js';
import { buildContext } from '../../src/defaults.js';
import { VerificationSubject } from '../../src/types/subject.js';
import { VerificationContext } from '../../src/types/context.js';

// Import test fixtures
import { v2NoStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { v2WithValidStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2WithValidStatus.js';

describe('Status Suite', () => {
  const context = buildContext();

  // Helper to create subject from credential
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('credential with no credentialStatus', () => {
    it('skips check when credential has no status', async () => {
      const subject = createSubject(v2NoStatus);
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
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialStatus = {
        id: 'https://example.com/status#1',
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListIndex: '1',
        statusListCredential: 'https://example.com/status',
      };
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('Legacy status type');
      }
    });

    it('skips check for 1EdTechRevocationList status type', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialStatus = {
        id: 'https://example.com/status#1',
        type: '1EdTechRevocationList',
        statusPurpose: 'revocation',
        statusListIndex: '1',
        statusListCredential: 'https://example.com/status',
      };
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
    });
  });

  describe('credential with BitstringStatusListEntry', () => {
    it.skip('checks valid status list entry (requires network)', async function() {
      this.timeout(60000);
      // Skip in sandbox - requires network for status list fetch
      const subject = createSubject(v2WithValidStatus);
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('success');
    });
  });

  describe('non-fatal behavior', () => {
    it('is non-fatal even when status check fails', async function() {
      this.timeout(30000);
      const cred = JSON.parse(JSON.stringify(v2WithValidStatus));
      // Modify to cause a status check error
      cred.credentialStatus.statusListCredential = 'https://invalid-url-that-wont-resolve.example.com/status';

      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      // Should fail but check is non-fatal
      expect(results[0].outcome.status).to.be.oneOf(['success', 'failure', 'skipped']);
    });
  });

  describe('unknown status types', () => {
    it('skips check for unknown status type', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialStatus = {
        id: 'https://example.com/status#1',
        type: 'UnknownStatusType',
        statusPurpose: 'revocation',
      };
      const subject = createSubject(cred);
      const results = await runSuites([statusSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('UnknownStatusType');
      }
    });
  });
});
