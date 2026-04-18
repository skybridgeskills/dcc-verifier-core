import { expect } from 'chai';
import type { EntityIdentityRegistry } from '../../../src/types/registry.js';
import type { VerifiableCredential } from '../../../src/schemas/credential.js';
import type { VerifyCredentialOptions } from '../../../src/types/options.js';
import type { CredentialVerificationResult } from '../../../src/types/result.js';
import {
  lookupVcRecognition,
  vcRecognitionVerifyCredentialOverride,
} from '../../../src/services/registry-handlers/vc-recognition-handler.js';
import { FakeCacheService } from '../../factories/services/fake-cache-service.js';
import { FakeHttpGetService, okJsonBody } from '../../factories/services/fake-http-get-service.js';

const listUrl = 'https://example.com/recognition.json';

const buildVc = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential', 'VerifiableRecognitionCredential'],
  issuer: 'did:web:learning-commission.example',
  validFrom: '2025-01-01T00:00:00Z',
  validUntil: '2030-01-01T00:00:00Z',
  credentialSubject: [
    {
      id: 'did:web:university.example',
      type: 'RecognizedEntity',
      name: 'Example Tech',
    },
  ],
  ...overrides,
});

const registry: EntityIdentityRegistry = {
  name: 'Recognition List',
  type: 'vc-recognition',
  url: listUrl,
  acceptedIssuers: ['did:web:learning-commission.example'],
};

const stubCredential = {} as unknown as VerifiableCredential;

const okVerify = async (
  _opts: VerifyCredentialOptions,
): Promise<CredentialVerificationResult> => ({
  verified: true,
  credential: stubCredential,
  results: [],
});

describe('lookupVcRecognition', () => {
  afterEach(() => {
    vcRecognitionVerifyCredentialOverride.fn = null;
  });

  it('returns found when DID appears in credentialSubject array', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const vc = buildVc();
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition(
      'did:web:university.example',
      registry,
      httpGetService,
      FakeCacheService(),
    );
    expect(result).to.deep.equal({ status: 'found', registryName: 'Recognition List' });
  });

  it('returns found when credentialSubject is a single object', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const vc = buildVc({
      credentialSubject: {
        id: 'did:key:single',
        type: 'RecognizedEntity',
      },
    });
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition('did:key:single', registry, httpGetService, FakeCacheService());
    expect(result).to.deep.equal({ status: 'found', registryName: 'Recognition List' });
  });

  it('returns not-found when DID is absent', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const vc = buildVc();
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition('did:key:missing', registry, httpGetService, FakeCacheService());
    expect(result).to.deep.equal({ status: 'not-found' });
  });

  it('returns unchecked when issuer is not in acceptedIssuers', async () => {
    vcRecognitionVerifyCredentialOverride.fn = async () => {
      throw new Error('verifyCredential should not run');
    };
    const vc = buildVc({ issuer: 'did:web:untrusted.example' });
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition(
      'did:web:university.example',
      registry,
      httpGetService,
      FakeCacheService(),
    );
    expect(result).to.deep.equal({
      status: 'unchecked',
      registryName: 'Recognition List',
    });
  });

  it('matches issuer object id against acceptedIssuers', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const vc = buildVc({
      issuer: { id: 'did:web:learning-commission.example', type: 'RecognizedIssuer' },
    });
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition(
      'did:web:university.example',
      registry,
      httpGetService,
      FakeCacheService(),
    );
    expect(result.status).to.equal('found');
  });

  it('returns unchecked when verifyCredential reports not verified', async () => {
    vcRecognitionVerifyCredentialOverride.fn = async () => ({
      verified: false,
      credential: stubCredential,
      results: [],
    });
    const vc = buildVc();
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const result = await lookupVcRecognition(
      'did:web:university.example',
      registry,
      httpGetService,
      FakeCacheService(),
    );
    expect(result).to.deep.equal({
      status: 'unchecked',
      registryName: 'Recognition List',
    });
  });

  it('calls verifyCredential only once when response is cached', async () => {
    let verifyCalls = 0;
    vcRecognitionVerifyCredentialOverride.fn = async opts => {
      verifyCalls++;
      return okVerify(opts);
    };
    const vc = buildVc();
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const cache = FakeCacheService();
    await lookupVcRecognition('did:web:university.example', registry, httpGetService, cache);
    await lookupVcRecognition('did:web:university.example', registry, httpGetService, cache);
    expect(verifyCalls).to.equal(1);
  });

  it('uses validUntil for cache TTL', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const future = new Date(Date.now() + 7200_000).toISOString();
    const vc = buildVc({ validUntil: future });
    const httpGetService = FakeHttpGetService({ [listUrl]: okJsonBody(vc) });
    const base = FakeCacheService();
    const sets: Array<{ ttl?: number }> = [];
    const cache = {
      get: base.get.bind(base),
      set: async (key: string, value: unknown, ttl?: number) => {
        sets.push({ ttl });
        return base.set(key, value, ttl);
      },
    };
    await lookupVcRecognition('did:web:university.example', registry, httpGetService, cache);
    const ttlArg = sets[0]?.ttl as number;
    expect(ttlArg).to.be.greaterThan(7000_000);
    expect(ttlArg).to.be.at.most(7200_000);
  });

  it('returns unchecked on fetch failure', async () => {
    vcRecognitionVerifyCredentialOverride.fn = okVerify;
    const httpGetService = {
      async get() {
        throw new Error('network');
      },
    };
    const result = await lookupVcRecognition(
      'did:web:university.example',
      registry,
      httpGetService,
      FakeCacheService(),
    );
    expect(result).to.deep.equal({
      status: 'unchecked',
      registryName: 'Recognition List',
    });
  });

  it('returns unchecked when registry type is not vc-recognition', async () => {
    const dcc: EntityIdentityRegistry = {
      name: 'Legacy',
      type: 'dcc-legacy',
      url: 'https://example.com/r.json',
    };
    let calls = 0;
    const httpGetService = {
      async get() {
        calls++;
        return okJsonBody({});
      },
    };
    const result = await lookupVcRecognition('did:key:x', dcc, httpGetService, FakeCacheService());
    expect(result).to.deep.equal({ status: 'unchecked', registryName: 'Legacy' });
    expect(calls).to.equal(0);
  });
});
