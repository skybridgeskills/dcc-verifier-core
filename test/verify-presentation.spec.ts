import { expect } from 'chai';
import { verifyPresentation } from '../src/index.js';
import { flattenPresentationResults } from '../src/flatten-presentation-results.js';
import { CredentialFactory } from './factories/data/credential-factory.js';
import { PresentationFactory } from './factories/data/presentation-factory.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';

// Existing tests in this file inspect every check in
// `result.results` / `result.presentationResults`. Use a verbose
// verifier to keep those assertions valid; folded-mode coverage
// lives in `describe('folded vs verbose shape', …)` below.
const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
  verbose: true,
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
      expect(result.verifiablePresentation).to.exist;
      expect(result.verifiablePresentation.type).to.include('VerifiablePresentation');
      expect(flattenPresentationResults(result)).to.be.an('array');
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
        expect(credResult.verifiableCredential).to.exist;
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

      const ids = result.credentialResults.map(cr => cr.verifiableCredential.id);
      expect(ids).to.include(id1);
      expect(ids).to.include(id2);
    });
  });

  describe('flattenPresentationResults aggregation', () => {
    it('includes both presentation and credential results', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      const presentationSuiteIds = result.presentationResults.map(r => r.suite);
      const flat = flattenPresentationResults(result);
      const allSuiteIds = flat.map(e => e.result.suite);

      for (const suiteId of presentationSuiteIds) {
        expect(allSuiteIds).to.include(suiteId);
      }
    });

    it('flattens all credential results via flattenPresentationResults', async () => {
      const presentation = PresentationFactory({
        verifiableCredential: [
          CredentialFactory({ version: 'v1', credential: {} }),
          CredentialFactory({ credential: {} }),
        ],
      });
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      expect(flattenPresentationResults(result).length).to.be.greaterThan(
        result.presentationResults.length,
      );
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
      expect(result).to.have.property('verifiablePresentation');
      expect(result).to.have.property('presentationResults');
      expect(result).to.have.property('credentialResults');

      expect(typeof result.verified).to.equal('boolean');
      expect(Array.isArray(result.presentationResults)).to.be.true;
      expect(Array.isArray(result.credentialResults)).to.be.true;
      expect(flattenPresentationResults(result)).to.be.an('array');
    });

    it('each credential result has correct structure', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...fakeVerified });

      for (const credResult of result.credentialResults) {
        expect(credResult).to.have.property('verified');
        expect(credResult).to.have.property('verifiableCredential');
        expect(credResult).to.have.property('results');

        expect(typeof credResult.verified).to.equal('boolean');
        expect(credResult.verifiableCredential).to.be.an('object');
        expect(Array.isArray(credResult.results)).to.be.true;
      }
    });
  });

  describe('folded vs verbose shape', () => {
    const cryptoOnly = {
      cryptoServices: [FakeCryptoService({ verified: true })],
    };

    it('default folded happy path: every credential summary green; results[] empty', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({ presentation, ...cryptoOnly });

      expect(result.verified).to.be.true;
      expect(result.presentationResults).to.deep.equal([]);
      expect(result.summary.length).to.be.greaterThan(0);
      expect(result.summary.every(s => s.verified)).to.be.true;

      expect(result.credentialResults).to.have.lengthOf(1);
      const cred = result.credentialResults[0];
      expect(cred.results).to.deep.equal([]);
      expect(cred.summary.length).to.be.greaterThan(0);
      expect(cred.summary.every(s => s.verified)).to.be.true;
    });

    it('verbose: presentation propagates verbose to embedded credentials', async () => {
      const presentation = PresentationFactory();
      const result = await verifyPresentation({
        presentation,
        ...cryptoOnly,
        verbose: true,
      });

      expect(result.presentationResults.length).to.be.greaterThan(0);
      const cred = result.credentialResults[0];
      expect(cred.results.length).to.be.greaterThan(0);
      expect(cred.results.every(r => r.id !== undefined)).to.be.true;
    });
  });

  describe('mixed-result fixture (UI use case)', () => {
    const cryptoOnly = {
      cryptoServices: [FakeCryptoService({ verified: true })],
    };

    function buildMixedResultPresentation(): Record<string, unknown> {
      const goodId = 'urn:uuid:11111111-1111-1111-1111-111111111111';
      const badId = 'urn:uuid:22222222-2222-2222-2222-222222222222';
      const good = CredentialFactory({ credential: { id: goodId } });
      const bad = CredentialFactory({ credential: { id: badId } });
      delete (bad as { proof?: unknown }).proof;
      return PresentationFactory({ verifiableCredential: [good, bad] });
    }

    it('reports overall verified=false with 1 of 2 credentials verified', async () => {
      const presentation = buildMixedResultPresentation();
      const result = await verifyPresentation({ presentation, ...cryptoOnly });

      expect(result.verified).to.be.false;
      expect(result.credentialResults).to.have.lengthOf(2);
      expect(result.credentialResults.filter(c => c.verified)).to.have.lengthOf(1);
    });

    it('VP-level summary entries are all green when the VP envelope is fine', async () => {
      const presentation = buildMixedResultPresentation();
      const result = await verifyPresentation({ presentation, ...cryptoOnly });

      expect(result.summary.length).to.be.greaterThan(0);
      expect(result.summary.every(s => s.verified)).to.be.true;
    });

    it('passing credential summary is all green; failing credential surfaces a failure entry', async () => {
      const presentation = buildMixedResultPresentation();
      const result = await verifyPresentation({ presentation, ...cryptoOnly });

      const passing = result.credentialResults.find(c => c.verified);
      const failing = result.credentialResults.find(c => !c.verified);
      expect(passing).to.exist;
      expect(failing).to.exist;

      expect(passing!.summary.every(s => s.verified)).to.be.true;
      expect(passing!.results).to.deep.equal([]);

      const failureSummaries = failing!.summary.filter(s => !s.verified);
      expect(failureSummaries.length).to.be.greaterThan(0);
      expect(failing!.results.length).to.be.greaterThan(0);
      expect(
        failing!.results.every(r => r.outcome.status === 'failure'),
      ).to.be.true;
    });

    it('failure detail rows can be located by id prefix from a failing summary entry', async () => {
      const presentation = buildMixedResultPresentation();
      const result = await verifyPresentation({ presentation, ...cryptoOnly });

      const failing = result.credentialResults.find(c => !c.verified)!;
      const failingSummary = failing.summary.find(s => !s.verified)!;
      const detail = failing.results.filter(r =>
        r.id?.startsWith(failingSummary.id + '.'),
      );
      expect(detail.length).to.be.greaterThan(0);
      expect(detail.every(r => r.outcome.status === 'failure')).to.be.true;
    });

    it('verbose mode preserves all checks; summary[] identical to folded mode', async () => {
      const presentation = buildMixedResultPresentation();
      const folded = await verifyPresentation({ presentation, ...cryptoOnly });
      const verbose = await verifyPresentation({
        presentation,
        ...cryptoOnly,
        verbose: true,
      });

      expect(verbose.verified).to.equal(folded.verified);
      expect(verbose.summary.map(s => s.id)).to.deep.equal(
        folded.summary.map(s => s.id),
      );
      expect(verbose.summary.map(s => s.status)).to.deep.equal(
        folded.summary.map(s => s.status),
      );

      for (let i = 0; i < verbose.credentialResults.length; i++) {
        const v = verbose.credentialResults[i];
        const f = folded.credentialResults[i];
        expect(v.summary.map(s => s.id)).to.deep.equal(f.summary.map(s => s.id));
        expect(v.summary.map(s => s.status)).to.deep.equal(
          f.summary.map(s => s.status),
        );
        expect(v.results.length).to.be.greaterThanOrEqual(f.results.length);
      }
    });
  });
});
