/**
 * Default verification suites used by `createVerifier`.
 *
 * Run in order for every credential:
 *
 * 1. **core** — structure validation (context, VC context URI, credential id, proof exists)
 * 2. **proof** — cryptographic signature verification
 * 3. **status** — revocation/suspension via BitstringStatusList
 * 4. **registry** — issuer DID lookup in known registries
 * 5. **schema.obv3** — OBv3 JSON Schema conformance (non-fatal)
 *
 * `proofSuite` is statically imported here so the verifier has no
 * dynamic-import sites in its hot path.
 */

import { VerificationSuite } from './types/check.js';
import { coreSuite } from './suites/core/index.js';
import { proofSuite } from './suites/proof/index.js';
import { statusSuite } from './suites/status/index.js';
import { registrySuite } from './suites/registry/index.js';
import { obv3SchemaSuite } from './suites/schema/index.js';

export const defaultSuites: VerificationSuite[] = [
  coreSuite,
  proofSuite,
  statusSuite,
  registrySuite,
  obv3SchemaSuite,
];
