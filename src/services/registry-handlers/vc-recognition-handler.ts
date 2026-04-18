import type { VerifyCredentialOptions } from '../../types/options.js';
import type { CredentialVerificationResult } from '../../types/result.js';
import type { VcRecognitionEntityIdentityRegistry } from '../../types/registry.js';
import type { CacheService } from '../cache-service/cache-service.js';
import type { HttpGetService } from '../http-get-service/http-get-service.js';
import { resolveTtl, ttlFromValidUntil } from './cache-ttl.js';
import type { HandlerResult, RegistryHandler } from './types.js';

/**
 * Test seam: when set, {@link lookupVcRecognition} uses this instead of
 * `verifyCredential` (avoids crypto in unit tests).
 */
export const vcRecognitionVerifyCredentialOverride: {
  fn: ((opts: VerifyCredentialOptions) => Promise<CredentialVerificationResult>) | null;
} = { fn: null };

/**
 * VerifiableRecognitionCredential registry: fetch VC, verify issuer + proof,
 * cache until `validUntil`, then check `credentialSubject` for the DID.
 *
 * Uses dynamic import of `verifyCredential` to avoid a circular module dependency with
 * `verify-suite` → `defaults` → registry wiring.
 *
 * @see https://w3c.github.io/vc-recognition/
 */
export const lookupVcRecognition: RegistryHandler = async (did, registry, httpGetService, cacheService) => {
  if (registry.type !== 'vc-recognition') {
    return { status: 'unchecked', registryName: registry.name };
  }
  return lookupVcRecognitionForRegistry(did, registry, httpGetService, cacheService);
};

async function lookupVcRecognitionForRegistry(
  did: string,
  registry: VcRecognitionEntityIdentityRegistry,
  httpGetService: HttpGetService,
  cacheService: CacheService,
): Promise<HandlerResult> {
  const key = cacheKeyForVcRecognitionUrl(registry.url);
  let credential = (await cacheService.get(key)) as Record<string, unknown> | undefined;

  if (!credential) {
    const loaded = await fetchRecognitionCredentialJson(registry.url, httpGetService);
    if (!loaded) {
      return { status: 'unchecked', registryName: registry.name };
    }

    const issuerId = getIssuerId(loaded);
    if (!issuerId || !registry.acceptedIssuers.includes(issuerId)) {
      return { status: 'unchecked', registryName: registry.name };
    }

    const verify =
      vcRecognitionVerifyCredentialOverride.fn ??
      (await import('../../verify-suite.js')).verifyCredential;
    const verification = await verify({
      credential: loaded,
      httpGetService,
      cacheService,
    });

    if (!verification.verified) {
      return { status: 'unchecked', registryName: registry.name };
    }

    const validUntil = typeof loaded.validUntil === 'string' ? loaded.validUntil : undefined;
    const ttlMs = resolveTtl(ttlFromValidUntil(validUntil ?? ''));
    await cacheService.set(key, loaded, ttlMs);
    credential = loaded;
  }

  if (!subjectContainsDid(credential, did)) {
    return { status: 'not-found' };
  }
  return { status: 'found', registryName: registry.name };
}

function cacheKeyForVcRecognitionUrl(url: string): string {
  return `vc-recognition:${url}`;
}

async function fetchRecognitionCredentialJson(
  url: string,
  httpGetService: HttpGetService,
): Promise<Record<string, unknown> | null> {
  let result;
  try {
    result = await httpGetService.get(url);
  } catch {
    return null;
  }
  if (result.status < 200 || result.status >= 300) {
    return null;
  }
  const json = result.body;
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }
  return json as Record<string, unknown>;
}

function getIssuerId(credential: Record<string, unknown>): string | undefined {
  const issuer = credential.issuer;
  if (typeof issuer === 'string') {
    return issuer;
  }
  if (issuer && typeof issuer === 'object' && 'id' in issuer) {
    const id = (issuer as { id: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function subjectContainsDid(credential: Record<string, unknown>, did: string): boolean {
  const subject = credential.credentialSubject;
  if (subject === undefined || subject === null) {
    return false;
  }
  if (Array.isArray(subject)) {
    return subject.some(
      entry =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { id?: unknown }).id === did,
    );
  }
  if (typeof subject === 'object') {
    return (subject as { id?: unknown }).id === did;
  }
  return false;
}
