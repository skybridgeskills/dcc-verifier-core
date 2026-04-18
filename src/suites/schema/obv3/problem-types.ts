/**
 * OBv3-specific problem-type URIs.
 *
 * Lives inside the OBv3 suite folder so that when P-B extracts the
 * OBv3 suite into its own package, this file moves with it and the
 * top-level `src/problem-types.ts` only needs to drop the inline
 * re-export of these entries.
 */

export const Obv3ProblemTypes = {
  /**
   * Synthesized — an OBv3 result references a missing or non-result
   * item in the credential's `result` array.
   */
  OBV3_INVALID_RESULT_REFERENCE:
    'https://www.w3.org/TR/vc-data-model#OBV3_INVALID_RESULT_REFERENCE',
} as const;

export type Obv3ProblemType =
  typeof Obv3ProblemTypes[keyof typeof Obv3ProblemTypes];
