import { expect } from 'chai';
import { runSuites } from '../../src/run-suites.js';
import { obv3SchemaSuite } from '../../src/suites/schema/obv3/index.js';
import { buildTestContext } from '../factories/services/build-test-context.js';
import { VerificationSubject } from '../../src/types/subject.js';
import { CredentialFactory } from '../factories/data/credential-factory.js';
import { compose } from '../factories/data/compose.js';
import { addResults } from '../factories/data/transforms.js';
import { FakeFetchJson } from '../factories/services/fake-fetch-json.js';

const OBV3_V2_ACHIEVEMENT_SCHEMA_URL =
  'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json';

const OBV3_V2_ENDORSEMENT_SCHEMA_URL =
  'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_endorsementcredential_schema.json';

function minimalSchema($id: string): Record<string, unknown> {
  return {
    $id,
    $schema: 'https://json-schema.org/draft/2019-09/schema',
    type: 'object',
    required: ['@context', 'type', 'issuer', 'credentialSubject'],
    additionalProperties: true,
    properties: {
      '@context': {},
      type: {},
      issuer: {},
      credentialSubject: {},
    },
  };
}

describe('OBv3 Schema Suite', () => {
  const createSubject = (credential: unknown): VerificationSubject => ({
    verifiableCredential: credential,
  });

  describe('OBv3 schema check', () => {
    it('skips when credential is not OBv3-shaped', async () => {
      const cred = CredentialFactory({
        version: 'v1',
        credential: {
          type: ['VerifiableCredential'],
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1',
          ],
        },
      });
      const context = buildTestContext({
        fetchJson: FakeFetchJson({}),
      });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('skipped');
    });

    it('validates OpenBadgeCredential when schema is served locally', async () => {
      const cred = CredentialFactory({ version: 'v2', credential: {} });
      const fetchJson = FakeFetchJson({
        [OBV3_V2_ACHIEVEMENT_SCHEMA_URL]: minimalSchema(OBV3_V2_ACHIEVEMENT_SCHEMA_URL),
      });
      const context = buildTestContext({ fetchJson });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('success');
    });

    it('validates EndorsementCredential when schema is served locally', async () => {
      const cred = CredentialFactory({
        version: 'v2',
        credential: { type: ['VerifiableCredential', 'EndorsementCredential'] },
      });
      const fetchJson = FakeFetchJson({
        [OBV3_V2_ENDORSEMENT_SCHEMA_URL]: minimalSchema(OBV3_V2_ENDORSEMENT_SCHEMA_URL),
      });
      const context = buildTestContext({ fetchJson });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('success');
    });

    it('fails AJV validation when credential is missing required fields', async () => {
      const cred = CredentialFactory({ version: 'v2', credential: {} });
      delete (cred as { credentialSubject?: unknown }).credentialSubject;

      const fetchJson = FakeFetchJson({
        [OBV3_V2_ACHIEVEMENT_SCHEMA_URL]: minimalSchema(OBV3_V2_ACHIEVEMENT_SCHEMA_URL),
      });
      const context = buildTestContext({ fetchJson });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('failure');
      if (schemaCheck?.outcome.status === 'failure') {
        expect(schemaCheck.outcome.problems[0].type).to.equal(
          'https://www.w3.org/TR/vc-data-model#SCHEMA_VALIDATION_FAILED',
        );
      }
    });

    it('uses credentialSchema id when specified', async () => {
      const customUrl = 'https://factory.test/custom-credential-schema.json';
      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialSchema: {
            id: customUrl,
            type: 'JsonSchemaValidator2018',
          },
        },
      });
      const fetchJson = FakeFetchJson({
        [customUrl]: minimalSchema(customUrl),
      });
      const context = buildTestContext({ fetchJson });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('success');
    });

    it('uses first credentialSchema entry when property is an array', async () => {
      const customUrl = 'https://factory.test/array-first-schema.json';
      const cred = CredentialFactory({
        version: 'v2',
        credential: {
          credentialSchema: [
            { id: customUrl, type: 'JsonSchemaValidator2018' },
            { id: 'https://factory.test/ignored.json', type: 'JsonSchemaValidator2018' },
          ],
        },
      });
      const fetchJson = FakeFetchJson({
        [customUrl]: minimalSchema(customUrl),
      });
      const context = buildTestContext({ fetchJson });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('success');
    });

    it('fails when schema URL cannot be fetched', async () => {
      const cred = CredentialFactory({ version: 'v2', credential: {} });
      const context = buildTestContext({
        fetchJson: FakeFetchJson({}),
      });
      const results = await runSuites([obv3SchemaSuite], createSubject(cred), context);

      const schemaCheck = results.find(r => r.check === 'schema.obv3.json');
      expect(schemaCheck?.outcome.status).to.equal('failure');
      if (schemaCheck?.outcome.status === 'failure') {
        expect(schemaCheck.outcome.problems[0].type).to.equal(
          'https://www.w3.org/TR/vc-data-model#SCHEMA_VALIDATION_ERROR',
        );
        expect(schemaCheck.outcome.problems[0].detail).to.include('No fake response');
      }
    });
  });

  describe('OBv3 result reference check', () => {
    it('skips check when credential has no results', async () => {
      const cred = CredentialFactory({ version: 'v2', credential: {} });
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('skipped');
    });

    it('validates correct result references', async () => {
      const cred = compose(
        CredentialFactory({ version: 'v2', credential: {} }),
        addResults({
          results: [
            {
              type: 'Result',
              resultDescription: 'https://example.test/result-descriptions/1',
              value: 'Pass',
            },
          ],
          resultDescriptions: [
            {
              id: 'https://example.test/result-descriptions/1',
              type: 'ResultDescription',
              name: 'Test Score',
            },
          ],
        }),
      );
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('success');
      if (refCheck?.outcome.status === 'success') {
        expect(refCheck.outcome.message).to.include('result entries reference valid');
      }
    });

    it('validates compose-generated cross references', async () => {
      const cred = compose(CredentialFactory({ version: 'v2' }), addResults({ count: 3 }));
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('success');
    });

    it('fails for invalid result references', async () => {
      const cred = compose(
        CredentialFactory({ version: 'v2', credential: {} }),
        addResults({
          results: [
            {
              type: 'Result',
              resultDescription: 'https://example.test/result-descriptions/999',
              value: 'Pass',
            },
          ],
          resultDescriptions: [
            {
              id: 'https://example.test/result-descriptions/1',
              type: 'ResultDescription',
              name: 'Test Score',
            },
          ],
        }),
      );
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems[0].type).to.equal(
          'https://www.w3.org/TR/vc-data-model#OB_INVALID_RESULT_REFERENCE',
        );
        expect(refCheck.outcome.problems[0].detail).to.include('does not exist');
      }
    });

    it('handles multiple result entries with mixed references', async () => {
      const cred = compose(
        CredentialFactory({ version: 'v2', credential: {} }),
        addResults({
          results: [
            {
              type: 'Result',
              resultDescription: 'https://example.test/result-descriptions/1',
              value: 'Pass',
            },
            {
              type: 'Result',
              resultDescription: 'https://example.test/result-descriptions/999',
              value: 'Fail',
            },
          ],
          resultDescriptions: [
            {
              id: 'https://example.test/result-descriptions/1',
              type: 'ResultDescription',
              name: 'Test Score',
            },
          ],
        }),
      );
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems).to.have.lengthOf(1);
        expect(refCheck.outcome.problems[0].detail).to.include('index 1');
      }
    });

    it('skips when result entry has no resultDescription', async () => {
      const cred = compose(
        CredentialFactory({ version: 'v2', credential: {} }),
        addResults({
          results: [{ type: 'Result', value: 'Pass' }],
          resultDescriptions: [
            {
              id: 'https://example.test/result-descriptions/1',
              type: 'ResultDescription',
              name: 'Test Score',
            },
          ],
        }),
      );
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('success');
    });

    it('fails when achievement has no resultDescription for referenced id', async () => {
      const cred = compose(
        CredentialFactory({ version: 'v2', credential: {} }),
        addResults({
          results: [
            {
              type: 'Result',
              resultDescription: 'https://example.test/result-descriptions/1',
              value: 'Pass',
            },
          ],
          resultDescriptions: [],
        }),
      );
      const cs = cred.credentialSubject as Record<string, unknown>;
      const achievement = cs.achievement as Record<string, unknown>;
      achievement.resultDescription = [];

      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      const refCheck = results.find(r => r.check === 'schema.obv3.result-ref');
      expect(refCheck?.outcome.status).to.equal('failure');
      if (refCheck?.outcome.status === 'failure') {
        expect(refCheck.outcome.problems[0].type).to.equal(
          'https://www.w3.org/TR/vc-data-model#OB_INVALID_RESULT_REFERENCE',
        );
      }
    });
  });

  describe('non-OBv3 credential types', () => {
    it('skips both checks for plain VC without OBv3 context', async () => {
      const cred = CredentialFactory({
        version: 'v1',
        credential: {
          type: ['VerifiableCredential'],
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1',
          ],
        },
      });
      const results = await runSuites(
        [obv3SchemaSuite],
        createSubject(cred),
        buildTestContext(),
      );

      expect(results).to.have.lengthOf(2);
      expect(results.every(r => r.outcome.status === 'skipped')).to.be.true;
    });
  });
});
