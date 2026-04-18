import type { CacheService } from '../cache-service/cache-service.js';
import type { EntityIdentityRegistry } from '../../types/registry.js';
import type { HttpGetService } from '../http-get-service/http-get-service.js';

/** Outcome of looking up one issuer DID in a single registry entry. */
export type HandlerResult =
  | { status: 'found'; registryName: string }
  | { status: 'not-found' }
  | { status: 'unchecked'; registryName: string };

/**
 * Looks up a DID in one registry (fetch via {@link HttpGetService}, cache, parse — type-specific).
 */
export type RegistryHandler = (
  did: string,
  registry: EntityIdentityRegistry,
  httpGetService: HttpGetService,
  cacheService: CacheService,
) => Promise<HandlerResult>;

/** Per-type handlers used by `createRegistryLookup`. */
export type RegistryHandlerMap = Record<EntityIdentityRegistry['type'], RegistryHandler>;
