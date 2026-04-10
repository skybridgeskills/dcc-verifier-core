import { Ajv2019 } from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { VerificationCheck, CheckOutcome } from '../../../types/check.js';
import { ProblemDetail } from '../../../types/problem-detail.js';
import { VerificationSubject } from '../../../types/subject.js';
import { VerificationContext } from '../../../types/context.js';

// OBv3 context matcher
const OBV3_0_3_CONTEXT_MATCHER = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3';

// OBv3 schema URLs
const OBV3_SCHEMA_V1_ACHIEVEMENT = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json-ld/ob_v3p0_anyachievementcredential_schema.json';
const OBV3_SCHEMA_V1_ENDORSEMENT = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json-ld/ob_v3p0_anyendorsementcredential_schema.json';
const OBV3_SCHEMA_V2_ACHIEVEMENT = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json';
const OBV3_SCHEMA_V2_ENDORSEMENT = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_endorsementcredential_schema.json';

// VC context URLs
const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';

// AJV instance with schema loading
const ajv = new Ajv2019({ allErrors: true, loadSchema });
addFormats.default(ajv);

/**
 * Load schema from URL.
 */
async function loadSchema(url: string): Promise<object> {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

/**
 * Validate credential against a schema URL.
 */
async function validateAgainstSchema(schemaUrl: string, credential: Record<string, unknown>): Promise<{ valid: boolean; errors?: Array<{ message: string; instancePath: string }> }> {
  const validate = ajv.getSchema(schemaUrl) || await ajv.compileAsync({ $ref: schemaUrl });
  const valid = validate(credential) as boolean;
  const errors = validate.errors?.map(e => ({
    message: e.message || 'Validation error',
    instancePath: e.instancePath || '',
  }));
  return { valid, errors };
}

/**
 * Determine if credential is an OBv3 credential.
 */
function isObv3Credential(credential: Record<string, unknown>): boolean {
  const contexts = credential['@context'] as unknown[] | undefined;
  if (!Array.isArray(contexts)) {
    return false;
  }

  const stringContexts = contexts.filter((ctx): ctx is string => typeof ctx === 'string');
  return stringContexts.some(ctx => ctx.startsWith(OBV3_0_3_CONTEXT_MATCHER));
}

/**
 * Check if credential type includes specific OBv3 types.
 */
function hasObv3Type(credential: Record<string, unknown>, typeName: string): boolean {
  const types = credential.type as unknown[] | string | undefined;
  if (typeof types === 'string') {
    return types === typeName;
  }
  if (Array.isArray(types)) {
    return types.some(t => t === typeName);
  }
  return false;
}

/**
 * Determine VC version from contexts.
 */
function getVcVersion(credential: Record<string, unknown>): 'v1' | 'v2' | null {
  const contexts = credential['@context'] as unknown[] | undefined;
  if (!Array.isArray(contexts)) {
    return null;
  }

  const stringContexts = contexts.filter((ctx): ctx is string => typeof ctx === 'string');

  if (stringContexts.some(ctx => ctx.startsWith(VC_V2_CONTEXT))) {
    return 'v2';
  }
  if (stringContexts.some(ctx => ctx.startsWith(VC_V1_CONTEXT))) {
    return 'v1';
  }
  return null;
}

/**
 * Select the appropriate OBv3 schema URL.
 */
function selectObv3Schema(credential: Record<string, unknown>): { schema: string | null; obType: string; source: string } | null {
  const credentialSchema = credential.credentialSchema as Array<{ id: string }> | { id: string } | undefined;

  // If credentialSchema is specified, use those URLs directly
  if (credentialSchema) {
      const schemas = Array.isArray(credentialSchema) ? credentialSchema : [credentialSchema];
      if (schemas.length > 0 && schemas[0]?.id) {
        return {
          schema: schemas[0].id,
          obType: '',
          source: 'Schema was listed in the credentialSchema property of the VC',
        };
      }
    }
    // fall through - no valid credentialSchema found

  // No credentialSchema specified, try to infer from context and type
  if (!isObv3Credential(credential)) {
    return null;
  }

  const vcVersion = getVcVersion(credential);
  if (!vcVersion) {
    return null;
  }

  let schema: string | null = null;
  let obType = '';

  if (hasObv3Type(credential, 'OpenBadgeCredential')) {
    obType = 'OpenBadgeCredential';
    schema = vcVersion === 'v1' ? OBV3_SCHEMA_V1_ACHIEVEMENT : OBV3_SCHEMA_V2_ACHIEVEMENT;
  } else if (hasObv3Type(credential, 'EndorsementCredential')) {
    obType = 'EndorsementCredential';
    schema = vcVersion === 'v1' ? OBV3_SCHEMA_V1_ENDORSEMENT : OBV3_SCHEMA_V2_ENDORSEMENT;
  }

  if (!schema) {
    return null;
  }

  return {
    schema,
    obType,
    source: `Assumed based on vc.type: '${obType}' and vc version: '${vcVersion}'`,
  };
}

/**
 * OBv3 schema validation check.
 *
 * Validates OpenBadgeCredential and EndorsementCredential against
 * the appropriate OBv3 JSON Schema.
 *
 * Skipped when:
 * - Credential type doesn't include OpenBadgeCredential or EndorsementCredential
 * - Credential doesn't have OBv3 context
 */
export const obv3SchemaCheck: VerificationCheck = {
  id: 'schema.obv3.json',
  name: 'OBv3 JSON Schema Validation',
  description: 'Validates OBv3 credentials against published JSON Schema.',
  fatal: false,
  appliesTo: ['verifiableCredential'],
  execute: async (
    subject: VerificationSubject,
    _context: VerificationContext
  ): Promise<CheckOutcome> => {
    const credential = subject.verifiableCredential as Record<string, unknown> | undefined;

    if (!credential) {
      return {
        status: 'skipped',
        reason: 'No verifiable credential found in subject.',
      };
    }

    // Check if this is an OBv3 credential
    const schemaInfo = selectObv3Schema(credential);

    if (!schemaInfo?.schema) {
      return {
        status: 'skipped',
        reason: 'Credential does not appear to be an OBv3 credential (OpenBadgeCredential or EndorsementCredential).',
      };
    }

    try {
      const result = await validateAgainstSchema(schemaInfo.schema, credential);

      if (result.valid) {
        return {
          status: 'success',
          message: `OBv3 schema validation passed. Schema: ${schemaInfo.schema}. Source: ${schemaInfo.source}`,
        };
      }

      // Validation failed - format AJV errors
      const errorDetails = result.errors?.map(e =>
        e.instancePath ? `${e.instancePath}: ${e.message}` : e.message
      ).join('; ') || 'Unknown validation error';

      const problems: ProblemDetail[] = [{
        type: 'https://www.w3.org/TR/vc-data-model#SCHEMA_VALIDATION_FAILED',
        title: 'Schema Validation Failed',
        detail: `Schema validation failed for ${schemaInfo.schema}: ${errorDetails}`,
      }];

      return {
        status: 'failure',
        problems,
      };
    } catch (error) {
      // Error during validation (e.g., couldn't fetch schema)
      return {
        status: 'failure',
        problems: [{
          type: 'https://www.w3.org/TR/vc-data-model#SCHEMA_VALIDATION_ERROR',
          title: 'Schema Validation Error',
          detail: error instanceof Error ? error.message : 'An error occurred during schema validation.',
        }],
      };
    }
  },
};
