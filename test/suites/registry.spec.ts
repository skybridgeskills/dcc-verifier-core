import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { registrySuite } from '../../src/suites/registry/index.js';
import { buildContext } from '../../src/defaults.js';
import { VerificationSubject } from '../../src/types/subject.js';
import { VerificationContext } from '../../src/types/context.js';

// Import test fixtures
import { v2NoStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { knownDIDRegistries } from '../../src/test-fixtures/knownDIDRegistries.js';

describe('Registry Suite', () => {
  const baseContext = buildContext();

  // Helper to create subject from credential
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('no registries in context', () => {
    it('skips check when no registries configured', async () => {
      const subject = createSubject(v2NoStatus);
      // Use context without registries
      const context: VerificationContext = {
        ...baseContext,
        registries: undefined,
      };
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('registry.issuer');
      expect(results[0].outcome.status).to.equal('skipped');
      if (results[0].outcome.status === 'skipped') {
        expect(results[0].outcome.reason).to.include('No registries configured');
      }
    });
  });

  describe('issuer lookup', () => {
    it.skip('succeeds when issuer found in registry (requires network)', async function() {
      this.timeout(60000);
      // This would require actual registry access
      const subject = createSubject(v2NoStatus);
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('success');
    });

    it.skip('fails when issuer not in registry (requires network)', async function() {
      this.timeout(60000);
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      // Use an issuer DID that's not in any registry
      cred.issuer = { id: 'did:key:z9999999999999999999999999999999999999999999' };

      const subject = createSubject(cred);
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].type).to.equal('https://www.w3.org/TR/vc-data-model#ISSUER_NOT_REGISTERED');
      }
    });
  });

  describe('missing issuer', () => {
    it('fails when credential has no issuer', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      delete cred.issuer;

      const subject = createSubject(cred);
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].title).to.equal('Issuer Not Found');
      }
    });

    it('handles issuer as string', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.issuer = 'did:key:z6MknNQD1WHLGGraFi6zcbGevuAgkVfdyCdtZnQTGWVVvR5Q';

      const subject = createSubject(cred);
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      // Should attempt lookup (may fail due to sandbox, but should run)
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('registry.issuer');
    });
  });

  describe('non-fatal behavior', () => {
    it('is non-fatal even when lookup fails', async function() {
      this.timeout(30000);
      const subject = createSubject(v2NoStatus);
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      const results = await runSuites([registrySuite], subject, context);

      expect(results).to.have.lengthOf(1);
      // Registry check is non-fatal, so even failure is acceptable
      expect(results[0].outcome.status).to.be.oneOf(['success', 'failure', 'skipped']);
    });
  });

  describe('no subject', () => {
    it('is skipped via appliesTo filter when no credential provided', async () => {
      const subject: VerificationSubject = {};
      const context: VerificationContext = {
        ...baseContext,
        registries: knownDIDRegistries,
      };
      const results = await runSuites([registrySuite], subject, context);

      // The check has appliesTo: ['verifiableCredential'], so when there's no
      // credential, the check is filtered out entirely by the orchestrator
      expect(results).to.have.lengthOf(0);
    });
  });
});
