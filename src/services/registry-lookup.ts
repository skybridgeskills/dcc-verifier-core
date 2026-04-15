/**
 * Default issuer-registry lookup adapter (`RegistryClient` + global fetch).
 */

import { RegistryClient } from '@digitalcredentials/issuer-registry-client';
import type { EntityIdentityRegistry, LookupIssuers, RegistryLookupResult } from '../types/registry.js';

/** Registry types handled by `@digitalcredentials/issuer-registry-client`. */
const SUPPORTED_TYPES = new Set<string>(['oidf', 'dcc-legacy']);

/**
 * Resolves an issuer DID against configured registries using
 * `@digitalcredentials/issuer-registry-client`.
 *
 * Registry types not supported by the upstream client (e.g. `vc-recognition`)
 * are reported as unchecked. Callers who need those types should provide a
 * custom `lookupIssuers` implementation.
 */
export const defaultLookupIssuers: LookupIssuers = async (
  did: string,
  registries: EntityIdentityRegistry[]
): Promise<RegistryLookupResult> => {
  const supported = registries.filter(r => SUPPORTED_TYPES.has(r.type));
  const unsupported = registries.filter(r => !SUPPORTED_TYPES.has(r.type));

  const client = new RegistryClient();
  client.use({ registries: supported });
  const result = await client.lookupIssuersFor(did);
  return {
    found: result.matchingIssuers.length > 0,
    matchingRegistries: result.matchingIssuers.map(m => m.registry.name),
    uncheckedRegistries: [
      ...result.uncheckedRegistries.map(r => r.name),
      ...unsupported.map(r => r.name),
    ],
  };
};
