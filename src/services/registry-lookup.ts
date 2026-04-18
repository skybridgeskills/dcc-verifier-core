/**
 * Issuer registry lookup via bundled handlers (DCC legacy, OIDF, VC recognition).
 * Includes DID-level result caching with short-circuit and fresh-lookup options.
 */

import type {
  EntityIdentityRegistry,
  LookupIssuers,
  LookupIssuersOptions,
  RegistryLookupResult,
} from '../types/registry.js';
import type { CacheService } from './cache-service/cache-service.js';
import type { HttpGetService } from './http-get-service/http-get-service.js';
import { InMemoryCacheService } from './cache-service/in-memory-cache-service.js';
import { BuiltinHttpGetService } from './http-get-service/builtin-http-get-service.js';
import { lookupDccLegacy } from './registry-handlers/dcc-legacy-handler.js';
import { lookupOidf } from './registry-handlers/oidf-handler.js';
import { lookupVcRecognition } from './registry-handlers/vc-recognition-handler.js';
import type { RegistryHandlerMap } from './registry-handlers/types.js';
import { registryKeyHash } from '../util/registry-key-hash.js';
import { DEFAULT_TTL_MS } from './registry-handlers/cache-ttl.js';

const defaultHandlers: RegistryHandlerMap = {
  'dcc-legacy': lookupDccLegacy,
  oidf: lookupOidf,
  'vc-recognition': lookupVcRecognition,
};

/**
 * Build a {@link LookupIssuers} using `httpGetService`, `cacheService`, and optional per-type handlers.
 *
 * The returned function caches lookup results at the DID level, using a cache key
 * that incorporates the DID and a canonicalized hash of the registries array.
 *
 * Options:
 * - `fresh: true` — bypass the DID-level result cache (but underlying data caches still apply)
 * - `exhaustive: true` — check all registries even after finding a match (default: short-circuit on first found)
 */
export function createRegistryLookup(
  httpGetService: HttpGetService,
  cacheService: CacheService,
  handlers: RegistryHandlerMap = defaultHandlers,
): LookupIssuers {
  return async (
    did: string,
    registries: EntityIdentityRegistry[],
    options?: LookupIssuersOptions,
  ): Promise<RegistryLookupResult> => {
    // Compute cache key for DID-level result caching
    const cacheKey = `reg-result:${did}:${registryKeyHash(registries)}`;

    // Check cache unless fresh lookup requested
    if (!options?.fresh) {
      const cached = (await cacheService.get(cacheKey)) as RegistryLookupResult | undefined;
      if (cached) {
        return cached;
      }
    }

    // Perform lookup
    const matchingRegistries: string[] = [];
    const uncheckedRegistries: string[] = [];

    for (const registry of registries) {
      const outcome = await handlers[registry.type](did, registry, httpGetService, cacheService);
      if (outcome.status === 'found') {
        matchingRegistries.push(outcome.registryName);
        // Short-circuit unless exhaustive mode
        if (!options?.exhaustive) {
          break;
        }
      } else if (outcome.status === 'unchecked') {
        uncheckedRegistries.push(outcome.registryName);
      }
    }

    const result: RegistryLookupResult = {
      found: matchingRegistries.length > 0,
      matchingRegistries,
      uncheckedRegistries,
    };

    // Cache the result (unless this was a fresh lookup that explicitly wants to skip cache)
    // Actually, we should still cache the result for next time — fresh just means "don't use cache for read"
    await cacheService.set(cacheKey, result, DEFAULT_TTL_MS);

    return result;
  };
}

// Shared service instances for default lookup
const sharedCacheService = InMemoryCacheService();
const sharedHttpGetService = BuiltinHttpGetService();

/**
 * Fallback when {@link VerificationContext.lookupIssuers} is missing (e.g. hand-built
 * context). Uses {@link BuiltinHttpGetService} and a shared in-memory cache.
 *
 * The shared cache enables cross-call caching for the default case.
 */
export const defaultLookupIssuers: LookupIssuers = async (did, registries, options) => {
  return createRegistryLookup(sharedHttpGetService, sharedCacheService)(did, registries, options);
};
