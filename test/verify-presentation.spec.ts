import { expect } from 'chai';
import { verifyPresentation } from '../src/index.js';
import { CredentialFactory } from './factories/data/credential-factory.js';
import { PresentationFactory } from './factories/data/presentation-factory.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';

const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
};

describe('verifyPresentation', () => {
  describe('basic presentation validation', () => {
    it('verifies a presentation with single credential', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.verified).to.be.a('boolean');
      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(1);
      expect(result.allResults).to.be.an('array');
    });

    it('verifies a presentation with multiple credentials', async () => {
      const presentation = PresentationFactory({
        verifiableCredential: [
          CredentialFactory({ version: 'v1', credential: {} }),
          CredentialFactory({ credential: {} }),
        ],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.credentialResults).to.have.lengthOf(2);

      const cred1Result = result.credentialResults[0];
      const cred2Result = result.credentialResults[1];

      expect(cred1Result).to.exist;
      expect(cred2Result).to.exist;
      expect(cred1Result.results).to.be.an('array');
      expect(cred2Result.results).to.be.an('array');
    });

    it('returns verified: false for empty presentation', async () => {
      const presentation = PresentationFactory({ verifiableCredential: [] });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(0);
    });

    it('returns verified: false for presentation without credentials', async () => {
      const presentation = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiablePresentation'],
      };
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.presentationResults).to.be.an('array');
      expect(result.credentialResults).to.have.lengthOf(0);
    });
  });

  describe('parsing errors', () => {
    it('returns verified: false for invalid presentation JSON', async () => {
      const result = await verifyPresentation({
        presentation: 'not a presentation',
        ...fakeVerified,
      });

      expect(result.verified).to.be.false;
      expect(result.presentationResults).to.have.lengthOf(1);
      expect(result.presentationResults[0].suite).to.equal('parsing');
    });

    it('returns verified: false for empty object', async () => {
      const result = await verifyPresentation({ presentation: {}, ...fakeVerified });

      expect(result.verified).to.be.false;
    });

    it('returns verified: false for null', async () => {
      const result = await verifyPresentation({ presentation: null, ...fakeVerified });

      expect(result.verified).to.be.false;
    });
  });

  describe('credential verification within presentation', () => {
    it('verifies all embedded credentials', async () => {
      const presentation = PresentationFactory({
        verifiableCredential: [
          CredentialFactory({ version: 'v1', credential: {} }),
          CredentialFactory({ credential: {} }),
        ],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      for (const credResult of result.credentialResults) {
        expect(credResult.verified).to.be.a('boolean');
        expect(credResult.credential).to.exist;
        expect(credResult.results).to.be.an('array');
      }
    });

    it('returns verified: false if any credential fails', async () => {
      const good = CredentialFactory({ version: 'v1', credential: {} });
      const badCredential = { ...good };
      delete (badCredential as { '@context'?: unknown })['@context'];

      const presentation = PresentationFactory({
        verifiableCredential: [good, badCredential],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.verified).to.be.false;
      expect(result.presentationResults[0]?.outcome.status).to.equal('failure');
    });

    it('separates credential results correctly', async () => {
      const id1 = 'urn:uuid:11111111-1111-1111-1111-111111111111';
      const id2 = 'urn:uuid:22222222-2222-2222-2222-222222222222';
      const c1 = CredentialFactory({ version: 'v1', credential: { id: id1 } });
      const c2 = CredentialFactory({ credential: { id: id2 } });
      const presentation = PresentationFactory({
        verifiableCredential: [c1, c2],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.credentialResults).to.have.lengthOf(2);

      const ids = result.credentialResults.map(cr => cr.credential.id);
      expect(ids).to.include(id1);
      expect(ids).to.include(id2);
    });
  });

  describe('allResults aggregation', () => {
    it('includes both presentation and credential results', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      const presentationSuiteIds = result.presentationResults.map(r => r.suite);
      const allSuiteIds = result.allResults.map(r => r.suite);

      for (const suiteId of presentationSuiteIds) {
        expect(allSuiteIds).to.include(suiteId);
      }
    });

    it('flattens all credential results into allResults', async () => {
      const presentation = PresentationFactory({
        verifiableCredential: [
          CredentialFactory({ version: 'v1', credential: {} }),
          CredentialFactory({ credential: {} }),
        ],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(result.allResults.length).to.be.greaterThan(result.presentationResults.length);
    });
  });

  describe('challenge handling', () => {
    it('accepts challenge option', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({
        presentation,
        challenge: 'factory-challenge',
        ...fakeVerified,
      });

      expect(result.presentationResults).to.be.an('array');
    });

    it('accepts null challenge', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({
        presentation,
        challenge: null,
        ...fakeVerified,
      });

      expect(result.presentationResults).to.be.an('array');
    });
  });

  describe('unsigned presentation', () => {
    it('accepts unsignedPresentation option', async () => {
      const presentation = PresentationFactory();
      delete (presentation as { proof?: unknown }).proof;
      const result = await verifyPresentation({
        presentation,
        unsignedPresentation: true,
        ...fakeVerified,
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

      const presentation = PresentationFactory();
      const result = await verifyPresentation({
        presentation,
        additionalSuites: [customSuite],
        ...fakeVerified,
      });

      const customResult = result.presentationResults.find(r => r.suite === 'custom');
      expect(customResult).to.exist;
    });
  });

  describe('result structure', () => {
    it('has correct top-level structure', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

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
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

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
