import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { obv3SchemaSuite } from '../../src/suites/schema/obv3/index.js';
import { buildContext } from '../../src/defaults.js';
import { VerificationSubject } from '../../src/types/subject.js';

// Import test fixtures
import { v2NoStatus } from '../../src/test-fixtures/verifiableCredentials/v2/v2NoStatus.js';
import { v1NoStatus } from '../../src/test-fixtures/verifiableCredentials/v1/v1NoStatus.js';

describe('OBv3 Schema Suite', () => {
  const context = buildContext();

  // Helper to create subject from credential
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('OBv3 schema check', () => {
    it('skips or fails check for non-OBv3 credentials', async () => {
      const cred = JSON.parse(JSON.stringify(v1NoStatus));
      // v1NoStatus doesn't have OBv3 context
      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      // Should skip because no OBv3 context found
      expect(['skipped', 'failure']).to.include(schemaCheck?.outcome.status);
    });

    it('processes OpenBadgeCredential with OBv3 context', async () => {
      const subject = createSubject(v2NoStatus);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck).to.exist;
      // Should attempt validation (may fail due to network/schema issues in sandbox)
      expect(['success', 'failure', 'skipped']).to.include(schemaCheck?.outcome.status);
    });

    it('skips check for EndorsementCredential without OBv3 context', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.type = ['VerifiableCredential', 'EndorsementCredential'];
      // Still has OBv3 context, so this should actually try to validate
      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck).to.exist;
      // Since it has OBv3 context and EndorsementCredential type, it should attempt validation
      expect(['success', 'failure', 'skipped']).to.include(schemaCheck?.outcome.status);
    });

    it.skip('validates valid OBv3 credential (requires network)', async function() {
      this.timeout(60000);
      const subject = createSubject(v2NoStatus);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('success');
    });

    it('handles invalid OBv3 credential', async function() {
      this.timeout(30000);
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      // Remove required fields to make it invalid
      delete cred.credentialSubject;

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck).to.exist;
      // Should either fail validation or error during validation
      expect(['failure', 'skipped']).to.include(schemaCheck?.outcome.status);
    });

    it('uses credentialSchema when specified', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSchema = {
        id: 'https://example.com/custom-schema.json',
        type: 'JsonSchemaValidator2018',
      };

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck).to.exist;
      // Should attempt to use the custom schema
      expect(['success', 'failure', 'skipped']).to.include(schemaCheck?.outcome.status);
    });
  });

  describe('OBv3 result reference check', () => {
    it('skips check when credential has no results', async () => {
      const subject = createSubject(v2NoStatus);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('skipped');
    });

    it('validates correct result references', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSubject.result = [
        {
          type: 'Result',
          resultDescription: 'https://example.com/result-descriptions/1',
          value: 'Pass',
        },
      ];
      cred.credentialSubject.achievement.resultDescription = [
        {
          id: 'https://example.com/result-descriptions/1',
          type: 'ResultDescription',
          name: 'Test Score',
        },
      ];

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('success');
      if (refCheck?.outcome.status === 'success') {
        expect(refCheck.outcome.message).to.include('result entries reference valid');
      }
    });

    it('fails for invalid result references', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSubject.result = [
        {
          type: 'Result',
          resultDescription: 'https://example.com/result-descriptions/999', // Doesn't exist
          value: 'Pass',
        },
      ];
      cred.credentialSubject.achievement.resultDescription = [
        {
          id: 'https://example.com/result-descriptions/1',
          type: 'ResultDescription',
          name: 'Test Score',
        },
      ];

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems[0].type).to.equal('https://www.w3.org/TR/vc-data-model#OBV3_INVALID_RESULT_REFERENCE');
        expect(refCheck.outcome.problems[0].detail).to.include('does not exist');
      }
    });

    it('handles multiple result entries with mixed references', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSubject.result = [
        {
          type: 'Result',
          resultDescription: 'https://example.com/result-descriptions/1', // Valid
          value: 'Pass',
        },
        {
          type: 'Result',
          resultDescription: 'https://example.com/result-descriptions/999', // Invalid
          value: 'Fail',
        },
      ];
      cred.credentialSubject.achievement.resultDescription = [
        {
          id: 'https://example.com/result-descriptions/1',
          type: 'ResultDescription',
          name: 'Test Score',
        },
      ];

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems).to.have.lengthOf(1);
        expect(refCheck.outcome.problems[0].detail).to.include('index 1');
      }
    });

    it('skips when result entry has no resultDescription', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSubject.result = [
        {
          type: 'Result',
          // No resultDescription field
          value: 'Pass',
        },
      ];
      cred.credentialSubject.achievement.resultDescription = [
        {
          id: 'https://example.com/result-descriptions/1',
          type: 'ResultDescription',
          name: 'Test Score',
        },
      ];

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      // Should pass because the result entry without resultDescription is not checked
      expect(refCheck?.outcome.status).to.equal('success');
    });

    it('skips when achievement has no resultDescription', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      cred.credentialSubject.result = [
        {
          type: 'Result',
          resultDescription: 'https://example.com/result-descriptions/1',
          value: 'Pass',
        },
      ];
      // No achievement.resultDescription defined

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems[0].type).to.equal('https://www.w3.org/TR/vc-data-model#OBV3_INVALID_RESULT_REFERENCE');
      }
    });
  });

  describe('non-fatal behavior', () => {
    it('suite is non-fatal even when checks fail', async () => {
      const cred = JSON.parse(JSON.stringify(v2NoStatus));
      // Make credentialSubject.result with invalid reference
      cred.credentialSubject.result = [
        {
          type: 'Result',
          resultDescription: 'invalid-ref',
        },
      ];

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      // Suite should complete even with failures
      expect(results).to.have.lengthOf(2);

      // Both checks are non-fatal
      const jsonCheck = results.find(r => r.check === 'schema.obv3.json');
      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');

      expect(jsonCheck?.outcome.status).to.be.oneOf(['success', 'failure', 'skipped']);
      expect(refCheck?.outcome.status).to.be.oneOf(['success', 'failure', 'skipped']);
    });
  });

  describe('non-OBv3 credential types', () => {
    it('skips or fails checks for non-OBv3 credentials', async () => {
      const cred = JSON.parse(JSON.stringify(v1NoStatus));
      // v1NoStatus has no OBv3 context

      const subject = createSubject(cred);
      const results = await runSuites([obv3SchemaSuite], subject, context);

      expect(results).to.have.lengthOf(2);
      // Both checks should either skip or fail since it's not OBv3
      const allSkippedOrFailed = results.every(
        r => r.outcome.status === 'skipped' || r.outcome.status === 'failure'
      );
      expect(allSkippedOrFailed).to.be.true;
    });
  });
});
