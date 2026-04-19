/**
 * Open Badges 3.0 inner-class schemas.
 *
 * Phase 3 seeds this file with the `Image` class (§B.1.13).
 * Later phases (4–7) append `Profile`, `Alignment`, `Achievement`,
 * `AchievementSubject`, and the `Result` family.
 *
 * **Colocation note**: the per-class `*Field()` builders live in
 * this file alongside their schemas (rather than in
 * `fields-v3p0.ts`) to avoid an ESM circular-import deadlock —
 * the schemas use `JsonLdTypeField` at module-evaluation time, so
 * splitting them across files would put `JsonLdTypeField` in TDZ
 * when `classes-v3p0.ts` first runs. The `fields-v3p0.ts` file
 * stays focused on field builders that don't depend on a class
 * schema (constants, `IriString`, `JsonLdTypeField`,
 * `ProfileRefField`).
 *
 * @see `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/03-image.md`
 */

import { z } from 'zod';
import { IriString, JsonLdTypeField } from './fields-v3p0.js';

/**
 * Open Badges 3.0 §B.1.13 — Image class.
 *
 * Required: `id` (IRI; data URIs allowed), `type` (must include
 * `'Image'`).
 * Optional: `caption`.
 *
 * `id` uses {@link IriString} rather than `z.string().url()` so
 * `data:image/png;base64,...` URIs (allowed by the spec) and
 * other non-URL IRIs are accepted. Strict format validation is
 * the AJV JSON Schema check's job.
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const Obv3p0ImageSchema = z
  .object({
    id: IriString,
    type: JsonLdTypeField(['Image']),
    caption: z.string().optional(),
  })
  .passthrough();

export type Obv3p0Image = z.infer<typeof Obv3p0ImageSchema>;

/**
 * Field builder for Image-valued slots.
 *
 * OB 3.0 permits an Image-typed property to be either:
 * - a string IRI (an image URL or data URI), or
 * - a full Image object.
 *
 * This builder normalizes the string form to
 * `{ id, type: ['Image'] }` so consumers can always treat the
 * field as a normalized object.
 */
export function ImageField() {
  return z.union([
    IriString.transform(id => ({ id, type: ['Image'] })),
    Obv3p0ImageSchema,
  ]);
}
/* eslint-enable @typescript-eslint/explicit-function-return-type */
