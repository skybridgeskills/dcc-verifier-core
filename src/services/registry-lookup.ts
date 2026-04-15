/**
 * Issuer registry lookup via bundled handlers (DCC legacy, OIDF, VC recognition).
 */

import type { EntityIdentityRegistry, LookupIssuers, RegistryLookupResult } from '../types/registry.js';
import type { CacheStore } from '../types/cache.js';
import type { HttpGet } from '../types/http.js';
import { inMemoryCacheStore } from '../util/in-memory-cache-store.js';
import { builtinHttpGet } from '../util/builtin-http-get.js';
import { lookupDccLegacy } from './registry-handlers/dcc-legacy-handler.js';
import { lookupOidf } from './registry-handlers/oidf-handler.js';
import { lookupVcRecognition } from './registry-handlers/vc-recognition-handler.js';
import type { RegistryHandlerMap } from './registry-handlers/types.js';

const defaultHandlers: RegistryHandlerMap = {
  'dcc-legacy': lookupDccLegacy,
  oidf: lookupOidf,
  'vc-recognition': lookupVcRecognition,
};

/**
 * Build a {@link LookupIssuers} using `httpGet`, `cache`, and optional per-type handlers.
 */
export function createRegistryLookup(
  httpGet: HttpGet,
  cache: CacheStore,
  handlers: RegistryHandlerMap = defaultHandlers,
): LookupIssuers {
  return async (did: string, registries: EntityIdentityRegistry[]): Promise<RegistryLookupResult> => {
    const matchingRegistries: string[] = [];
    const uncheckedRegistries: string[] = [];

    for (const registry of registries) {
      const outcome = await handlers[registry.type](did, registry, httpGet, cache);
      if (outcome.status === 'found') {
        matchingRegistries.push(outcome.registryName);
      } else if (outcome.status === 'unchecked') {
        uncheckedRegistries.push(outcome.registryName);
      }
    }

    return {
      found: matchingRegistries.length > 0,
      matchingRegistries,
      uncheckedRegistries,
    };
  };
}

/**
 * Fallback when {@link VerificationContext.lookupIssuers} is missing (e.g. hand-built
 * context). Uses {@link builtinHttpGet} and a fresh in-memory cache per call.
 */
export const defaultLookupIssuers: LookupIssuers = async (did, registries) => {
  const ephemeral = inMemoryCacheStore();
  return createRegistryLookup(builtinHttpGet, ephemeral)(did, registries);
};
