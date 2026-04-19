/**
 * Strict Zod schema for the OB 3.0 OpenBadgeCredential envelope.
 *
 * Phase-2 scope: top-level envelope only. Inner classes
 * (`AchievementSubject`, `Achievement`, `Profile`, `Image`,
 * `Result`, etc.) stay `passthrough` and are filled in by Phases
 * 3–7. The cross-field VCDM v1/v2 date discriminator
 * (`issuanceDate` vs `validFrom`) lives here.
 *
 * @see `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/02-envelope-and-date-discriminator.md`
 */

import { z } from 'zod';
import {
  IriString,
  JsonLdTypeField,
  OB_3_0_CONTEXT_PREFIX,
  VCDM_V1_CONTEXT,
  VCDM_V2_CONTEXT,
} from './fields-v3p0.js';
import {
  ImageField,
  Obv3p0AchievementSubjectSchema,
  ProfileRefField,
} from './classes-v3p0.js';
import type { ProblemDetail } from '../../types/problem-detail.js';
import type { RecognitionResult } from '../../types/recognition.js';
import { formatJsonPointer } from '../../util/json-pointer.js';

const OBV3P0_OPENBADGE_PROFILE = 'obv3p0.openbadge';

const ContextArray = z
  .array(z.string())
  .min(1, '@context must be a non-empty array')
  .refine(
    arr => arr[0] === VCDM_V1_CONTEXT || arr[0] === VCDM_V2_CONTEXT,
    { message: '@context[0] must be a VCDM context (v1 or v2)' },
  )
  .refine(
    arr => arr.some(c => c.startsWith(OB_3_0_CONTEXT_PREFIX)),
    { message: `@context must include the OB 3.0 context (${OB_3_0_CONTEXT_PREFIX}*)` },
  );

const TypeField = JsonLdTypeField(['VerifiableCredential']).superRefine(
  (arr, ctx) => {
    if (
      !arr.includes('AchievementCredential') &&
      !arr.includes('OpenBadgeCredential')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "type must include 'AchievementCredential' or 'OpenBadgeCredential'",
        path: [],
      });
    }
  },
);

export const Obv3p0OpenBadgeCredentialSchema = z
  .object({
    '@context': ContextArray,
    id: IriString,
    type: TypeField,
    issuer: ProfileRefField(),
    issuanceDate: z.string().datetime({ offset: true }).optional(),
    validFrom: z.string().datetime({ offset: true }).optional(),
    validUntil: z.string().datetime({ offset: true }).optional(),
    image: ImageField().optional(),
    credentialSubject: Obv3p0AchievementSubjectSchema,
  })
  .passthrough()
  .superRefine((cred, ctx) => {
    const ctxArr = cred['@context'];
    const head = ctxArr[0];
    if (head === VCDM_V1_CONTEXT && cred.issuanceDate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issuanceDate'],
        message: 'issuanceDate is required for VCDM v1 credentials',
      });
    }
    if (head === VCDM_V2_CONTEXT && cred.validFrom === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validFrom'],
        message: 'validFrom is required for VCDM v2 credentials',
      });
    }
  });

export type Obv3p0OpenBadgeCredential = z.infer<
  typeof Obv3p0OpenBadgeCredentialSchema
>;

/**
 * Parse an unknown into an `Obv3p0OpenBadgeCredential`. Returns a
 * {@link RecognitionResult} suitable for direct use as a
 * `RecognizerSpec.parse` implementation.
 */
export function parseObv3p0OpenBadgeCredential(
  credential: unknown,
): RecognitionResult {
  const parsed = Obv3p0OpenBadgeCredentialSchema.safeParse(credential);
  if (parsed.success) {
    return {
      status: 'recognized',
      profile: OBV3P0_OPENBADGE_PROFILE,
      normalized: parsed.data,
    };
  }
  return {
    status: 'malformed',
    profile: OBV3P0_OPENBADGE_PROFILE,
    problems: zodErrorToProblems(parsed.error),
  };
}

const OB_MALFORMED_ENVELOPE_TYPE =
  'urn:dcc-verifier:openbadges:malformed-envelope';

function zodErrorToProblems(error: z.ZodError): ProblemDetail[] {
  return error.issues.map(issue => {
    const detail: ProblemDetail = {
      type: OB_MALFORMED_ENVELOPE_TYPE,
      title: 'Malformed Open Badges 3.0 Envelope',
      detail: issue.message,
    };
    if (issue.path.length > 0) {
      detail.instance = formatJsonPointer(issue.path);
    }
    return detail;
  });
}
