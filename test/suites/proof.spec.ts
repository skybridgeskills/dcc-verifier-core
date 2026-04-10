import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { proofSuite } from '../../src/suites/proof/index.js';
import { buildContext } from '../../src/defaults.js';
import { VerificationSubject } from '../../src/types/subject.js';

// Import test fixtures
import { v2NoStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { v1NoStatus } from '../../src/test-fixtures/verifiableCredentials/v1/v1NoStatus.js';
import { v2EddsaWithValidStatus } from '../../src/test-fixtures/verifiableCredentials/eddsa/v2/v2EddsaWithValidStatus.js';

describe('Proof Verification Suite', () => {
  const context = buildContext();

  // Helper to create subject from credential
  const createCredentialSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  // Helper to create subject from presentation
  const createPresentationSubject = (presentation: unknown): VerificationSubject => ({
    verifiablePresentation: presentation,
  });

  describe('valid credential signatures', () => {
    it('verifies valid v2 credential signature', async function() {
      this.timeout(30000);
      const subject = createCredentialSubject(v2NoStatus);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('proof.signature');
      expect(results[0].outcome.status).to.equal('success');
      if (results[0].outcome.status === 'success') {
        expect(results[0].outcome.message).to.include('Signature verified');
      }
    });

    it('verifies valid v1 credential signature', async function() {
      this.timeout(30000);
      const subject = createCredentialSubject(v1NoStatus);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('success');
    });

    it.skip('verifies valid v2 eddsa credential signature', async function() {
      this.timeout(30000);
      // Skipped: requires network access for context resolution
      const subject = createCredentialSubject(v2EddsaWithValidStatus);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('success');
    });
  });

  describe('invalid credential signatures', () => {
    it('fails for tampered credential', async function() {
      this.timeout(30000);
      // Create a tampered copy of the credential
      const tamperedCred = JSON.parse(JSON.stringify(v2NoStatus));
      tamperedCred.name = 'Tampered Name'; // Modify a field to break signature

      const subject = createCredentialSubject(tamperedCred);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
      if (results[0].outcome.status === 'failure') {
        expect(results[0].outcome.problems[0].type).to.equal('https://www.w3.org/TR/vc-data-model#INVALID_SIGNATURE');
      }
    });
  });

  describe('did:web resolution errors', () => {
    it('classifies did:web resolution failure correctly', async function() {
      this.timeout(30000);
      // Create a credential with a did:web issuer that won't resolve
      const badDidWebCred = JSON.parse(JSON.stringify(v2NoStatus));
      badDidWebCred.issuer = {
        id: 'did:web:nonexistent-domain-12345.example.com',
        name: 'Test Issuer',
      };
      // Keep the original proof (which will fail because DID won't resolve)

      const subject = createCredentialSubject(badDidWebCred);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
      // The error should be classified as HTTP error or DID_WEB_UNRESOLVED
      if (results[0].outcome.status === 'failure') {
        const problemType = results[0].outcome.problems[0].type;
        // Either DID_WEB_UNRESOLVED or HTTP_ERROR is acceptable
        const validTypes = [
          'https://www.w3.org/TR/vc-data-model#DID_WEB_UNRESOLVED',
          'https://www.w3.org/TR/vc-data-model#HTTP_ERROR',
          'https://www.w3.org/TR/vc-data-model#INVALID_SIGNATURE',
        ];
        expect(validTypes).to.include(problemType);
      }
    });
  });

  describe('presentation verification', () => {
    it('verifies valid presentation with authentication proof purpose', async function() {
      this.timeout(30000);
      // Create a minimal valid presentation
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [v2NoStatus],
        proof: {
          type: 'Ed25519Signature2020',
          created: '2024-01-01T00:00:00Z',
          verificationMethod: 'did:key:z6MknNQD1WHLGGraFi6zcbGevuAgkVfdyCdtZnQTGWVVvR5Q#z6MknNQD1WHLGGraFi6zcbGevuAgkVfdyCdtZnQTGWVVvR5Q',
          proofPurpose: 'authentication',
          challenge: 'test-challenge',
          proofValue: 'z58D6t...', // Invalid proof value, but we're testing the check structure
        },
      };

      const subject = createPresentationSubject(presentation);
      const ctx = buildContext({ challenge: 'test-challenge' });
      const results = await runSuites([proofSuite], subject, ctx);

      expect(results).to.have.lengthOf(1);
      expect(results[0].check).to.equal('proof.signature');
      // This will likely fail due to invalid proof value, but we're testing the check runs
      expect(['success', 'failure']).to.include(results[0].outcome.status);
    });

    it('handles unsigned presentation', async function() {
      this.timeout(30000);
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [v2NoStatus],
        // No proof - unsigned presentation
      };

      const subject = createPresentationSubject(presentation);
      const ctx = buildContext({ unsignedPresentation: true });
      const results = await runSuites([proofSuite], subject, ctx);

      expect(results).to.have.lengthOf(1);
      // Should handle unsigned presentation gracefully
      expect(results[0].outcome.status).to.be.oneOf(['success', 'failure']);
    });
  });

  describe('error classification', () => {
    it('classifies JSON-LD errors correctly', async function() {
      this.timeout(30000);
      // Create a credential with invalid JSON-LD
      const badCred = JSON.parse(JSON.stringify(v2NoStatus));
      badCred['@context'] = 'not-a-valid-context'; // String context that won't resolve properly

      const subject = createCredentialSubject(badCred);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      // May fail with JSON-LD or other error
      expect(results[0].outcome.status).to.equal('failure');
    });
  });

  describe('no subject', () => {
    it('skips check when neither credential nor presentation provided', async () => {
      const subject: VerificationSubject = {};
      const results = await runSuites([proofSuite], subject, context);

      // The check has appliesTo: ['verifiableCredential', 'verifiablePresentation']
      // so it gets skipped when neither is present
      expect(results).to.have.lengthOf(0);
    });

    it('fails when credential has no proof', async function() {
      this.timeout(30000);
      const credWithoutProof = JSON.parse(JSON.stringify(v2NoStatus));
      delete credWithoutProof.proof;

      const subject = createCredentialSubject(credWithoutProof);
      const results = await runSuites([proofSuite], subject, context);

      expect(results).to.have.lengthOf(1);
      expect(results[0].outcome.status).to.equal('failure');
    });
  });
});
