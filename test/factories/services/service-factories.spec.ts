import { expect } from 'chai';
import { buildContext } from '../../../src/defaults.js';
import { FakeCryptoService, hasDataIntegrityProof } from './fake-crypto-service.js';
import { FakeDocumentLoader } from './fake-document-loader.js';
import { FakeCacheService } from './fake-cache-service.js';
import { FakeFetchJson } from './fake-fetch-json.js';
import { FakeHttpGetService, okJsonBody } from './fake-http-get-service.js';
import { FakeRegistryLookup } from './fake-registry-lookup.js';

describe('service factories', () => {
  describe('FakeCryptoService', () => {
    it('returns success for any credential when verified: true', async () => {
      const svc = FakeCryptoService({ verified: true });
      const result = await svc.verifyCredential(
        { proof: { type: 'Ed25519Signature2020' } },
        { documentLoader: async () => ({}) },
      );
      expect(result.verified).to.equal(true);
      if (result.verified) {
        expect(result.message).to.equal('Fake verification passed.');
      }
    });

    it('returns failure with problems when verified: false', async () => {
      const problems = [
        {
          type: 'urn:test:bad',
          title: 'Bad',
          detail: 'Expected failure',
        },
      ];
      const svc = FakeCryptoService({ verified: false, problems });
      const result = await svc.verifyCredential({}, { documentLoader: async () => ({}) });
      expect(result.verified).to.equal(false);
      if (!result.verified) {
        expect(result.problems).to.deep.equal(problems);
      }
    });

    it('rejects verifyCredential when throwInVerify is set', async () => {
      const svc = FakeCryptoService({
        throwInVerify: new Error('injected fault'),
      });
      try {
        await svc.verifyCredential({}, { documentLoader: async () => ({}) });
        expect.fail('expected throw');
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('injected fault');
      }
    });

    it('uses custom canVerify (Data Integrity only)', () => {
      const svc = FakeCryptoService({
        canVerify: hasDataIntegrityProof,
        verified: true,
      });
      expect(
        svc.canVerify({
          verifiableCredential: {
            proof: { type: 'DataIntegrityProof', cryptosuite: 'ecdsa-rdfc-2019' },
          },
        }),
      ).to.equal(true);
      expect(
        svc.canVerify({
          verifiableCredential: { proof: { type: 'Ed25519Signature2020' } },
        }),
      ).to.equal(false);
    });
  });

  describe('FakeDocumentLoader', () => {
    it('returns mapped documents in JSON-LD loader envelope', async () => {
      const document = { '@context': ['https://example.test/ctx'], id: 'urn:x' };
      const loader = FakeDocumentLoader({ 'https://example.test/doc': document });
      const out = (await loader('https://example.test/doc')) as {
        contextUrl: null;
        document: unknown;
        documentUrl: string;
      };
      expect(out.contextUrl).to.equal(null);
      expect(out.documentUrl).to.equal('https://example.test/doc');
      expect(out.document).to.deep.equal(document);
    });

    it('throws for unmapped URLs', async () => {
      const loader = FakeDocumentLoader({});
      try {
        await loader('https://unknown.test/nope');
        expect.fail('expected throw');
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('Document not found: https://unknown.test/nope');
      }
    });

    it('delegates unmapped URLs to fallback loader', async () => {
      const loader = FakeDocumentLoader(
        { 'https://mapped/1': { only: 'mapped' } },
        {
          fallback: async (url: string) => ({
            contextUrl: null,
            document: { viaFallback: url },
            documentUrl: url,
          }),
        },
      );
      const out = (await loader('https://fallback-target/x')) as {
        document: { viaFallback: string };
      };
      expect(out.document.viaFallback).to.equal('https://fallback-target/x');
    });
  });

  describe('FakeFetchJson', () => {
    it('returns mapped JSON with no envelope', async () => {
      const payload = { $schema: 'https://example.test/schema' };
      const fetchJson = FakeFetchJson({ 'https://example.test/schema.json': payload });
      const out = await fetchJson('https://example.test/schema.json');
      expect(out).to.deep.equal(payload);
    });

    it('throws for unmapped URLs', async () => {
      const fetchJson = FakeFetchJson({});
      try {
        await fetchJson('https://missing.test/x');
        expect.fail('expected throw');
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('No fake response for URL: https://missing.test/x');
      }
    });
  });

  describe('FakeRegistryLookup', () => {
    it('returns expected shape when found: true', async () => {
      const lookup = FakeRegistryLookup({
        found: true,
        matchingRegistries: ['Test Registry'],
      });
      const result = await lookup('did:key:abc', []);
      expect(result).to.deep.equal({
        found: true,
        matchingRegistries: ['Test Registry'],
        uncheckedRegistries: [],
      });
    });

    it('throws when error is set', async () => {
      const lookup = FakeRegistryLookup({ error: new Error('Network failure') });
      try {
        await lookup('did:key:abc', []);
        expect.fail('expected throw');
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('Network failure');
      }
    });

    it('returns empty matchingRegistries when found: false', async () => {
      const lookup = FakeRegistryLookup({ found: false });
      const result = await lookup('did:key:abc', []);
      expect(result).to.deep.equal({
        found: false,
        matchingRegistries: [],
        uncheckedRegistries: [],
      });
    });
  });

  it('buildContext accepts fake crypto and fetchJson', async () => {
    const ctx = buildContext({
      cryptoServices: [FakeCryptoService({ verified: true })],
      fetchJson: FakeFetchJson({ 'https://factory.test/json': { ok: true } }),
    });
    expect(ctx.cryptoServices).to.have.lengthOf(1);
    const json = await ctx.fetchJson('https://factory.test/json');
    expect(json).to.deep.equal({ ok: true });
  });

  describe('FakeHttpGetService', () => {
    it('returns mapped HttpGetResult', async () => {
      const httpGetService = FakeHttpGetService({
        'https://example.test/x': okJsonBody({ hello: 'world' }),
      });
      const out = await httpGetService.get('https://example.test/x');
      expect(out.status).to.equal(200);
      expect(out.body).to.deep.equal({ hello: 'world' });
    });

    it('throws for unmapped URLs without fallback', async () => {
      const httpGetService = FakeHttpGetService({});
      try {
        await httpGetService.get('https://missing.test/x');
        expect.fail('expected throw');
      } catch (e) {
        expect((e as Error).message).to.include('No fake HttpGetService');
      }
    });
  });

  describe('FakeCacheService', () => {
    it('round-trips get/set', async () => {
      const cache = FakeCacheService();
      await cache.set('k', { a: 1 });
      expect(await cache.get('k')).to.deep.equal({ a: 1 });
    });
  });

  describe('buildContext with httpGetService', () => {
    it('derives fetchJson from httpGetService', async () => {
      const httpGetService = FakeHttpGetService({
        'https://factory.test/json': okJsonBody({ derived: true }),
      });
      const ctx = buildContext({ httpGetService });
      const json = await ctx.fetchJson('https://factory.test/json');
      expect(json).to.deep.equal({ derived: true });
    });

    it('keeps explicit fetchJson when httpGetService is also set', async () => {
      const httpGetService = FakeHttpGetService({
        'https://factory.test/json': okJsonBody({ fromHttp: true }),
      });
      const ctx = buildContext({
        httpGetService,
        fetchJson: FakeFetchJson({ 'https://factory.test/json': { fromExplicit: true } }),
      });
      const json = await ctx.fetchJson('https://factory.test/json');
      expect(json).to.deep.equal({ fromExplicit: true });
    });

    it('keeps explicit documentLoader when httpGetService is also set', async () => {
      const doc = { '@context': ['https://example.test/ctx'], id: 'urn:explicit' };
      const httpGetService = FakeHttpGetService({
        'https://example.test/remote': okJsonBody({ wrong: true }),
      });
      const ctx = buildContext({
        httpGetService,
        documentLoader: FakeDocumentLoader({ 'https://example.test/remote': doc }),
      });
      const out = (await ctx.documentLoader('https://example.test/remote')) as {
        document: unknown;
      };
      expect(out.document).to.deep.equal(doc);
    });

    it('passes cacheService through on context', () => {
      const cacheService = FakeCacheService();
      const ctx = buildContext({ cacheService });
      expect(ctx.cacheService).to.equal(cacheService);
    });

    it('sets effective httpGetService on context when caller omits it', () => {
      const ctx = buildContext({});
      expect(ctx.httpGetService).to.be.an('object');
      expect(typeof ctx.httpGetService?.get).to.equal('function');
    });
  });
});
