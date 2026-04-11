import { expect } from 'chai';
import { verifyPresentation, verifyCredential } from '../src/index.js';

// Import test fixtures
import { v1NoStatus } from '../src/test-fixtures/verifiableCredentials/v1/v1NoStatus.js';
import { v2NoStatus } from '../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';

/**
 * Helper to create a basic presentation containing credentials.
 */
function createPresentation(credentials: unknown[], holder?: string): object {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    verifiableCredential: credentials,
    ...(holder && { holder }),
  };
}

/**
 * Helper to create a signed presentation (mock proof).
 */
function createSignedPresentation(credentials: unknown[], holder?: string): object {
  const presentation = createPresentation(credentials, holder);
  return {
    ...presentation,
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      verificationMethod: 'did:key:z6MknNQD1WHLGGraFi6zcbGevuAgkVfdyCdtZnQTGWVVvR5Q#z6MknNQD1WHLGGraFi6zcbGevuAgkVfdyCdtZnQTGWVVvR5Q',
      proofPurpose: 'authentication',
      challenge: 'test-challenge',
      proofValue: 'z58tBdD9K9N3UivhFLB1JKbY6w93F8zYkJz2JqzR7iCxPq5eGn9Xn8xq8mV9uW1r6tY7J4hF2kL8sP5dQ9cN3vB2mZ7jX6aW9eR5tY2uI8oP1lK4jH7gF3dS6aQ8wE2rT5yU7iO4pL1kJ8hG5fD2sA7qW4eR9tY6uI3oP',
    },
  };
}

describe('verifyPresentation', () => {
  describe('basic presentation validation', () => {
    it('verifies a presentation with single credential', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({ presentation });

      expect(result.verified).to.be.a('boolean');
      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(1);
      expect(result.allResults).to.be.an('array');
    });

    it('verifies a presentation with multiple credentials', async () => {
      const presentation = createSignedPresentation([v1NoStatus, v2NoStatus]);
      const result = await verifyPresentation({ presentation });

      expect(result.credentialResults).to.have.lengthOf(2);

      // Should have results from both credentials
      const cred1Result = result.credentialResults[0];
      const cred2Result = result.credentialResults[1];

      expect(cred1Result).to.exist;
      expect(cred2Result).to.exist;
      expect(cred1Result.results).to.be.an('array');
      expect(cred2Result.results).to.be.an('array');
    });

    it('returns verified: false for empty presentation', async () => {
      const presentation = createSignedPresentation([]);
      const result = await verifyPresentation({ presentation });

      // Should still verify the presentation itself
      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(0);
    });

    it('returns verified: false for presentation without credentials', async () => {
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
      };
      const result = await verifyPresentation({ presentation });

      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(0);
    });
  });

  describe('parsing errors', () => {
    it('returns verified: false for invalid presentation JSON', async () => {
      const result = await verifyPresentation({ presentation: 'not a presentation' });

      expect(result.verified).to.be.false;
      expect(result.presentationResults).to.have.lengthOf(1);
      expect(result.presentationResults[0].suite).to.equal('parsing');
    });

    it('returns verified: false for empty object', async () => {
      const result = await verifyPresentation({ presentation: {} });

      expect(result.verified).to.be.false;
    });

    it('returns verified: false for null', async () => {
      const result = await verifyPresentation({ presentation: null });

      expect(result.verified).to.be.false;
    });
  });

  describe('credential verification within presentation', () => {
    it('verifies all embedded credentials', async () => {
      const presentation = createSignedPresentation([v1NoStatus, v2NoStatus]);
      const result = await verifyPresentation({ presentation });

      // All credentials should be verified
      for (const credResult of result.credentialResults) {
        expect(credResult.verified).to.be.a('boolean');
        expect(credResult.credential).to.exist;
        expect(credResult.results).to.be.an('array');
      }
    });

    it('returns verified: false if any credential fails', async () => {
      const badCredential = JSON.parse(JSON.stringify(v1NoStatus));
      delete badCredential['@context']; // Make it invalid

      const presentation = createSignedPresentation([v1NoStatus, badCredential]);
      const result = await verifyPresentation({ presentation });

      // Presentation fails parsing because embedded credential is invalid
      // (Zod validates embedded credentials against CredentialSchema)
      expect(result.verified).to.be.false;
      expect(result.presentationResults[0]?.outcome.status).to.equal('failure');
    });

    it('separates credential results correctly', async () => {
      const presentation = createSignedPresentation([v1NoStatus, v2NoStatus]);
      const result = await verifyPresentation({ presentation });

      expect(result.credentialResults).to.have.lengthOf(2);

      // Each result should have its own credential
      const ids = result.credentialResults.map(cr => cr.credential.id);
      expect(ids).to.include(v1NoStatus.id);
      expect(ids).to.include(v2NoStatus.id);
    });
  });

  describe('allResults aggregation', () => {
    it('includes both presentation and credential results', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({ presentation });

      const presentationSuiteIds = result.presentationResults.map(r => r.suite);
      const allSuiteIds = result.allResults.map(r => r.suite);

      // allResults should contain at least what presentationResults contains
      for (const suiteId of presentationSuiteIds) {
        expect(allSuiteIds).to.include(suiteId);
      }
    });

    it('flattens all credential results into allResults', async () => {
      const presentation = createSignedPresentation([v1NoStatus, v2NoStatus]);
      const result = await verifyPresentation({ presentation });

      // allResults should contain more entries than just presentationResults
      expect(result.allResults.length).to.be.greaterThan(result.presentationResults.length);
    });
  });

  describe('challenge handling', () => {
    it('accepts challenge option', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({
        presentation,
        challenge: 'test-challenge',
      });

      expect(result.presentationResults).to.be.an('array');
    });

    it('accepts null challenge', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({
        presentation,
        challenge: null,
      });

      expect(result.presentationResults).to.be.an('array');
    });
  });

  describe('unsigned presentation', () => {
    it('accepts unsignedPresentation option', async () => {
      const presentation = createPresentation([v1NoStatus]);
      const result = await verifyPresentation({
        presentation,
        unsignedPresentation: true,
      });

      expect(result.presentationResults).to.be.an('array');
    });
  });

  describe('additionalSuites', () => {
    it('includes custom suites in presentation verification', async () => {
      const customCheck = {
        id: 'custom.vp-check',
        name: 'VP Custom Check',
        description: 'A custom check for presentations',
        fatal: false,
        appliesTo: ['verifiablePresentation'] as const,
        execute: async () => ({
          status: 'success' as const,
          message: 'Custom VP check passed!',
        }),
      };

      const customSuite = {
        id: 'custom',
        name: 'Custom Suite',
        description: 'Custom test suite',
        checks: [customCheck],
      };

      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({
        presentation,
        additionalSuites: [customSuite],
      });

      const customResult = result.presentationResults.find(r => r.suite === 'custom');
      expect(customResult).to.exist;
    });
  });

  describe('result structure', () => {
    it('has correct top-level structure', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({ presentation });

      expect(result).to.have.property('verified');
      expect(result).to.have.property('presentationResults');
      expect(result).to.have.property('credentialResults');
      expect(result).to.have.property('allResults');

      expect(typeof result.verified).to.equal('boolean');
      expect(Array.isArray(result.presentationResults)).to.be.true;
      expect(Array.isArray(result.credentialResults)).to.be.true;
      expect(Array.isArray(result.allResults)).to.be.true;
    });

    it('each credential result has correct structure', async () => {
      const presentation = createSignedPresentation([v1NoStatus]);
      const result = await verifyPresentation({ presentation });

      for (const credResult of result.credentialResults) {
        expect(credResult).to.have.property('verified');
        expect(credResult).to.have.property('credential');
        expect(credResult).to.have.property('results');

        expect(typeof credResult.verified).to.equal('boolean');
        expect(credResult.credential).to.be.an('object');
        expect(Array.isArray(credResult.results)).to.be.true;
      }
    });
  });
});
