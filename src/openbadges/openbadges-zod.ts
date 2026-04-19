/**
 * Internal Zod shapes for OpenBadges 3.0 credential structures.
 *
 * These are the parsing primitives used by the OpenBadges submodule's
 * checks. They are intentionally **tolerant**:
 *
 * - Every field is `.optional()` and every object is `.passthrough()`.
 *   OBv3 credentials carry many spec-defined and extension fields we
 *   neither need nor want to strip or reject. Per-check logic is
 *   responsible for asserting which subset of fields it requires.
 * - `id` (and other normally-required fields) is modeled as
 *   `.string().optional()` so a single non-conforming entry inside an
 *   array (e.g. one `resultDescription` missing `id`) does not cause
 *   `safeParse` to fail the whole credential and silently skip the
 *   check. Callers filter at the point of use.
 *
 * These shapes are **not** exported from the submodule barrel in this
 * plan — they are an internal implementation detail of the checks. A
 * future P-C plan can promote them (or a curated subset) to public
 * surface if useful for consumer business logic.
 *
 * Shape coverage tracks what every check planned in the
 * 2026-04-18-openbadges-module plan needs to read:
 *
 * - `Obv3ResultShape`            — `result-ref`, `achieved-level`,
 *                                  `missing-result-status`
 * - `Obv3ResultDescriptionShape` — `result-ref`, `achieved-level`
 * - `Obv3AchievementShape`       — `result-ref`, `achieved-level`,
 *                                  `unknown-achievement-type`
 * - `Obv3CredentialSubjectShape` — top-level entry shape used by all
 *                                  checks via
 *                                  `safeParse(credential.credentialSubject)`.
 */

import { z } from 'zod';

const RubricCriterionLevelShape = z
  .object({
    id: z.string().optional(),
  })
  .passthrough();

export const Obv3ResultDescriptionShape = z
  .object({
    id: z.string().optional(),
    resultType: z.string().optional(),
    rubricCriterionLevel: z.array(RubricCriterionLevelShape).optional(),
  })
  .passthrough();

export const Obv3ResultShape = z
  .object({
    resultDescription: z.string().optional(),
    achievedLevel: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const Obv3AchievementShape = z
  .object({
    /**
     * Spec shape is `string | string[]`, but we model as `unknown`
     * for tolerance — the unknown-achievement-type check ignores
     * non-string entries by design (shape validity is a separate
     * concern), and modeling strictly here would cause one bad
     * entry to fail the entire `safeParse` and silently skip the
     * whole check.
     */
    achievementType: z.unknown(),
    resultDescription: z.array(Obv3ResultDescriptionShape).optional(),
  })
  .passthrough();

export const Obv3CredentialSubjectShape = z
  .object({
    achievement: Obv3AchievementShape.optional(),
    result: z.array(Obv3ResultShape).optional(),
  })
  .passthrough();

export type Obv3ResultDescriptionShape = z.infer<typeof Obv3ResultDescriptionShape>;
export type Obv3ResultShape = z.infer<typeof Obv3ResultShape>;
export type Obv3AchievementShape = z.infer<typeof Obv3AchievementShape>;
export type Obv3CredentialSubjectShape = z.infer<typeof Obv3CredentialSubjectShape>;
