/**
 * Reusable Zod field builders for the strict OB 3.0 envelope schema.
 *
 * - **Context constants** for VCDM v1, VCDM v2, and the OB 3.0
 *   context prefix (matched with `startsWith` so patch versions
 *   like `context-3.0.3.json` and any future `context-3.0.4.json`
 *   are accepted without code change).
 * - **`IriString`** — minimal scheme-prefixed IRI matcher; accepts
 *   `urn:uuid:...`, `did:example:...`, `https://...`, etc.
 *   Z's built-in `z.string().url()` rejects URN forms common in
 *   OB credentials, so we use a tiny permissive regex instead.
 *   Strict format validation is the JSON Schema check's job.
 * - **`JsonLdTypeField(requiredTypes)`** — normalizes `string |
 *   string[]` to `string[]` and refines that every value in
 *   `requiredTypes` is present.
 *
 * Class-coupled field builders (`ImageField`, `ProfileRefField`)
 * live alongside their schemas in `classes-v3p0.ts` to avoid an
 * ESM circular import (the schemas use `JsonLdTypeField` at
 * module-evaluation time).
 */

import { z } from 'zod';

export const VCDM_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';
export const VCDM_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
/** Matches `context-3.0.X.json` URLs across patch versions. */
export const OB_3_0_CONTEXT_PREFIX =
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3';

/**
 * Permissive IRI matcher: `scheme:rest`. Accepts `urn:uuid:...`,
 * `did:web:...`, `https://...`, etc.
 */
export const IriString = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:.+/, 'Expected an IRI (scheme:rest)');

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/**
 * JSON-LD `type` field. Accepts `string | string[]`, normalizes to
 * `string[]`, and refines that every value in `requiredTypes` is
 * present.
 */
export function JsonLdTypeField(requiredTypes: readonly string[]) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform(v => (Array.isArray(v) ? v : [v]))
    .superRefine((arr, ctx) => {
      for (const required of requiredTypes) {
        if (!arr.includes(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `type must include '${required}'`,
            path: [],
          });
        }
      }
    });
}

/* eslint-enable @typescript-eslint/explicit-function-return-type */
