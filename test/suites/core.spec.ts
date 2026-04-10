import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { coreSuite } from '../../src/suites/core/index.js';
import { buildContext } from '../../src/defaults.js';
import { VerificationSubject } from '../../src/types/subject.js';

// Import test fixtures
import { v2NoStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { v1NoStatus } from '../../src/test-fixtures/verifiableCredentials/v1/v1NoStatus.js';

describe('Core Structure Suite', () => {
  const context = buildContext();

  // Helper to create subject from credential
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('valid credentials', () => {
    it('passes all checks for valid v2 credential', async () => {
      const subject = createSubject(v2NoStatus);
      const results = await runSuites([coreSuite], subject, context);

      expect(results).to.have.lengthOf(4);
      expect(results.every(r => r.outcome.status === 'success')).to.be.true;

      const checkIds = results.map(r => r.check);
      expect(checkIds).to.deep.equal([
        'core.context-exists',
        'core.vc-context',
        'core.credential-id',
        'core.proof-exists',
      ]);
    });

    it('passes all checks for valid v1 credential', async () => {
      const subject = createSubject(v1NoStatus);
      const results = await runSuites([coreSuite], subject, context);

      expect(results).to.have.lengthOf(4);
      expect(results.every(r => r.outcome.status === 'success')).to.be.true;
    });

    it('passes when credential has no ID (optional field)', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      delete cred.id;
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      const idCheck = results.find(r => r.check === 'core.credential-id');
      expect(idCheck?.outcome.status).to.equal('success');
    });
  });

  describe('missing @context', () => {
    it('fails context check and skips remaining checks (fatal)', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      delete cred['@context'];
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      // Only the first check should run and fail
      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('core.context-exists');
      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].type).to.equal('urn:vc-verify:invalid-jsonld');
      }
    });
  });

  describe('empty @context', () => {
    it('fails context check with empty array', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = [];
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('core.context-exists');
      expect(results[0].outcome.status).to.equal('failure');
    });

    it('fails context check with empty string', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = '';
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
    });
  });

  describe('no VC context URI', () => {
    it('fails vc-context check when no valid VC context', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = ['https://example.com/custom-context'];
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      // First check passes (context exists), second fails
      expect(results).to.have.lengthOf(2);
      expect(results[0].check).to.equal('core.context-exists');
      expect(results[0].outcome.status).to.equal('success');
      expect(results[1].check).to.equal('core.vc-context');
      expect(results[1].outcome.status).to.equal('failure');
      if (results[1].outcome.status === 'failure') {
        expect(results[1].outcome.problems[0].type).to.equal('urn:vc-verify:no-vc-context');
      }
    });
  });

  describe('invalid credential ID', () => {
    it('fails credential-id check for non-URL ID', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.id = 'not-a-valid-url';
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      // First two checks pass, third fails
      expect(results).to.have.lengthOf(3);
      expect(results[0].outcome.status).to.equal('success');
      expect(results[1].outcome.status).to.equal('success');
      expect(results[2].check).to.equal('core.credential-id');
      expect(results[2].outcome.status).to.equal('failure');
      if (results[2].outcome.status === 'failure') {
        expect(results[2].outcome.problems[0].type).to.equal('urn:vc-verify:invalid-credential-id');
      }
    });

    it('fails credential-id check for non-string ID', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.id = 12345;
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results).to.have.lengthOf(3);
      expect(results[2].check).to.equal('core.credential-id');
      expect(results[2].outcome.status).to.equal('failure');
    });
  });

  describe('missing proof', () => {
    it('fails proof-exists check', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      delete cred.proof;
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      // First three checks pass, fourth fails
      expect(results).to.have.lengthOf(4);
      expect(results[0].outcome.status).to.equal('success');
      expect(results[1].outcome.status).to.equal('success');
      expect(results[2].outcome.status).to.equal('success');
      expect(results[3].check).to.equal('core.proof-exists');
      expect(results[3].outcome.status).to.equal('failure');
      if (results[3].outcome.status === 'failure') {
        expect(results[3].outcome.problems[0].type).to.equal('urn:vc-verify:no-proof');
      }
    });

    it('fails proof-exists check for null proof', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.proof = null;
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results[3].check).to.equal('core.proof-exists');
      expect(results[3].outcome.status).to.equal('failure');
    });
  });

  describe('VC context variations', () => {
    it('accepts v1 context URI', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = [
        'https://www.w3.org/2018/credentials/v1',
        'https://example.com/extension',
      ];
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results[1].check).to.equal('core.vc-context');
      expect(results[1].outcome.status).to.equal('success');
    });

    it('accepts v2 context URI', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = [
        'https://www.w3.org/ns/credentials/v2',
        'https://example.com/extension',
      ];
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results[1].check).to.equal('core.vc-context');
      expect(results[1].outcome.status).to.equal('success');
    });

    it('accepts single string context', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred['@context'] = 'https://www.w3.org/ns/credentials/v2';
      const subject = createSubject(cred);
      const results = await runSuites([coreSuite], subject, context);

      expect(results[0].outcome.status).to.equal('success');
      expect(results[1].outcome.status).to.equal('success');
    });
  });
});
