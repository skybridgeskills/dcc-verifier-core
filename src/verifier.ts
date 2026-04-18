/**
 * `createVerifier(...)` — factory for a configured {@link Verifier}.
 *
 * A `Verifier` owns long-lived dependencies (HTTP, cache, crypto
 * services, registries, registry handlers, document loader) and
 * exposes per-call `verifyCredential` / `verifyPresentation` methods
 * that share those dependencies — most importantly the cache.
 *
 * Construct a single `Verifier` for any batch or repeated verification
 * work. The standalone wrappers in `verify-suite.ts` create a fresh
 * verifier per call and are intended only for one-shot use.
 *
 * @example
 * ```ts
 * const verifier = createVerifier({ registries: [/* ... *\/] });
 * for (const credential of credentials) {
 *   const result = await verifier.verifyCredential({ credential });
 * }
 * ```
 *
 * Phase 1 note: this is the skeleton. The methods throw at runtime;
 * phase 3 wires the real verification pipeline.
 */

import type {
  Verifier,
  VerifierConfig,
  VerifyCredentialCall,
  VerifyPresentationCall,
} from './types/verifier.js';

export function createVerifier(_config: VerifierConfig = {}): Verifier {
  return {
    async verifyCredential(_call: VerifyCredentialCall) {
      throw new Error('createVerifier.verifyCredential is not yet wired (phase 3)');
    },
    async verifyPresentation(_call: VerifyPresentationCall) {
      throw new Error('createVerifier.verifyPresentation is not yet wired (phase 3)');
    },
  };
}
