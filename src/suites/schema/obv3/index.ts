import { VerificationSuite } from '../../../types/check.js';
import { obv3SchemaCheck } from './obv3-schema-check.js';
import { obv3ResultRefCheck } from './obv3-result-ref-check.js';

/**
 * OBv3 Schema verification suite.
 *
 * JSON Schema validation and semantic checks for OpenBadgeCredential
 * and EndorsementCredential.
 *
 * The suite includes:
 * - JSON Schema validation against published OBv3 schemas
 * - Result→ResultDescription cross-reference validation
 *
 * Non-fatal - schema validation failures don't invalidate the credential,
 * they only indicate that the credential may not conform to OBv3 standards.
 */
export const obv3SchemaSuite: VerificationSuite = {
  id: 'schema.obv3',
  name: 'OBv3 Schema',
  description: 'JSON Schema validation and semantic checks for OpenBadgeCredential / EndorsementCredential.',
  checks: [obv3SchemaCheck, obv3ResultRefCheck],
};
