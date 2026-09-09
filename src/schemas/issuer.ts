import { z } from 'zod';

/**
 * Issuer image. `.passthrough()` is load-bearing, not stylistic.
 *
 * `.passthrough()` on a parent object does NOT extend into nested object
 * schemas, so a bare `z.object({ id, type })` here silently deletes every
 * other key — including `caption`, which Open Badges 3.0 §B.1.13 defines on
 * `Image` and which real issuers populate. Dropping a signed key changes the
 * canonicalized N-Quads and the proof then fails as `INVALID_SIGNATURE`, so
 * an issuer-supplied caption was enough to make a perfectly valid credential
 * unverifiable.
 *
 * `type` accepts a string or an array because JSON-LD permits both; the
 * union previously rejected `type: ['Image']`, which fails the whole
 * credential parse rather than just this node.
 */
const IssuerImageObjectSchema = z
  .object({
    id: z.string(),
    type: z.union([z.string(), z.array(z.string())])
  })
  .passthrough();

export const IssuerObjectSchema = z
  .object({
    id: z.string(),
    type: z.union([z.string(), z.array(z.string())]).optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    image: z.union([z.string(), IssuerImageObjectSchema]).optional()
  })
  .passthrough();

export const IssuerSchema = z.union([z.string(), IssuerObjectSchema]);
export type Issuer = z.infer<typeof IssuerSchema>;
