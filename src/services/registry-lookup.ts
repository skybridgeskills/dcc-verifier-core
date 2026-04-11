/**
 * Default issuer-registry lookup adapter (`RegistryClient` + global fetch).
 */

import { RegistryClient } from '@digitalcredentials/issuer-registry-client';
import type { EntityIdentityRegistry, LookupIssuers, RegistryLookupResult } from '../types/registry.js';

/**
 * Resolves an issuer DID against configured registries using
 * `@digitalcredentials/issuer-registry-client`.
 */
export const defaultLookupIssuers: LookupIssuers = async (
  did: string,
  registries: EntityIdentityRegistry[]
): Promise<RegistryLookupResult> => {
  const client = new RegistryClient();
  client.use({ registries });
  const result = await client.lookupIssuersFor(did);
  return {
    found: result.matchingIssuers.length > 0,
    matchingRegistries: result.matchingIssuers.map(m => m.registry.name),
    uncheckedRegistries: result.uncheckedRegistries.map(r => r.name),
  };
};
