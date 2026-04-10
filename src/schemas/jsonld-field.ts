import { z } from 'zod';

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/** Accepts T or T[] and normalizes to T[] */
export function JsonLdField<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]).transform(v =>
    Array.isArray(v) ? v : [v]
  );
}

/** Like JsonLdField but allows empty array */
export function JsonLdFieldAllowEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]).transform(v =>
    Array.isArray(v) ? v : [v]
  );
}

/* eslint-enable @typescript-eslint/explicit-function-return-type */
