/**
 * Three opt-in OpenBadges verification suite bundles.
 *
 * Consumers compose verifier configurations by passing one (or more)
 * of these to a verify call's `additionalSuites`:
 *
 * - {@link openBadgesSemanticSuite} — fast, in-process Zod-based
 *   cross-field semantic checks. **No network access required.**
 *   Safe to enable in latency-sensitive contexts.
 * - {@link openBadgesSchemaSuite} — AJV-backed JSON Schema validation
 *   against the published OBv3 schemas. Requires fetching the schema
 *   document at first use; subsequent runs reuse the AJV instance's
 *   in-memory cache.
 * - {@link openBadgesSuite} — the union of the two above. Convenience
 *   for consumers who want full OB coverage and accept the schema
 *   suite's network cost.
 *
 * None of these are part of the verifier's default suite set; the
 * 2026-04-18 plan ([Q2](../../docs/plans/2026-04-18-openbadges-module/00-questions.md#q2-default-path-behavior))
 * makes OpenBadges verification fully opt-in. To enable:
 *
 * @example
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
 */

import { VerificationSuite } from '../types/check.js';
import { obv3ResultRefCheck } from './result-ref-check.js';
import { obv3AchievedLevelCheck } from './achieved-level-check.js';
import { obv3MissingResultStatusCheck } from './missing-result-status-check.js';
import { obv3UnknownAchievementTypeCheck } from './unknown-achievement-type-check.js';
import { obv3SchemaCheck } from '../suites/schema/obv3/obv3-schema-check.js';

export const openBadgesSemanticSuite: VerificationSuite = {
  id: 'openbadges.semantic',
  name: 'OpenBadges Semantic',
  description:
    'OpenBadges 3.0 cross-field semantic checks (no JSON Schema fetch).',
  checks: [
    obv3ResultRefCheck,
    obv3AchievedLevelCheck,
    obv3MissingResultStatusCheck,
    obv3UnknownAchievementTypeCheck,
  ],
};

export const openBadgesSchemaSuite: VerificationSuite = {
  id: 'openbadges.schema',
  name: 'OpenBadges JSON Schema',
  description:
    'AJV-backed validation against the published OBv3 JSON Schemas.',
  checks: [obv3SchemaCheck],
};

export const openBadgesSuite: VerificationSuite = {
  id: 'openbadges',
  name: 'OpenBadges',
  description:
    'OpenBadges 3.0 verification: semantic checks plus JSON Schema validation.',
  checks: [
    ...openBadgesSemanticSuite.checks,
    ...openBadgesSchemaSuite.checks,
  ],
};
