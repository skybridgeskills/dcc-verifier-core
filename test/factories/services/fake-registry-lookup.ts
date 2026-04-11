import type { LookupIssuers, RegistryLookupResult } from '../../../src/types/registry.js';

export type FakeRegistryLookupOptions = {
  found?: boolean;
  matchingRegistries?: string[];
  uncheckedRegistries?: string[];
  error?: Error;
};

/**
 * Stub {@link LookupIssuers} with a fixed result or a thrown error.
 */
export function FakeRegistryLookup(
  options: FakeRegistryLookupOptions = {},
): LookupIssuers {
  const {
    found = true,
    matchingRegistries = found ? ['Test Registry'] : [],
    uncheckedRegistries = [],
    error,
  } = options;

  return async (_did, _registries): Promise<RegistryLookupResult> => {
    if (error !== undefined) {
      throw error;
    }
    return {
      found,
      matchingRegistries,
      uncheckedRegistries,
    };
  };
}
