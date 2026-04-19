/**
 * Default verification suites used by `createVerifier`.
 *
 * Run in order for every credential:
 *
 * 1. **core** — structure validation (context, VC context URI, credential id, proof exists)
 * 2. **proof** — cryptographic signature verification
 * 3. **status** — revocation/suspension via BitstringStatusList
 * 4. **registry** — issuer DID lookup in known registries
 *
 * OpenBadges 3.0 verification (semantic checks and JSON Schema
 * validation) is opt-in and lives in the
 * `@digitalcredentials/verifier-core/openbadges` submodule. Add it
 * via `additionalSuites`:
 *
 * ```ts
 * import { createVerifier } from '@digitalcredentials/verifier-core';
 * import { openBadgesSuite } from '@digitalcredentials/verifier-core/openbadges';
 *
 * const verifier = createVerifier();
 * await verifier.verifyCredential({
 *   credential,
 *   additionalSuites: [openBadgesSuite],
 * });
 * ```
 *
 * `proofSuite` is statically imported here so the verifier has no
 * dynamic-import sites in its hot path.
 */

import { VerificationSuite } from './types/check.js';
import { coreSuite } from './suites/core/index.js';
import { proofSuite } from './suites/proof/index.js';
import { statusSuite } from './suites/status/index.js';
import { registrySuite } from './suites/registry/index.js';

export const defaultSuites: VerificationSuite[] = [
  coreSuite,
  proofSuite,
  statusSuite,
  registrySuite,
];
