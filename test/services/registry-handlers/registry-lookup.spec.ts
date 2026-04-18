import { expect } from 'chai';
import type { EntityIdentityRegistry } from '../../../src/types/registry.js';
import { createRegistryLookup } from '../../../src/services/registry-lookup.js';
import type { RegistryHandlerMap } from '../../../src/services/registry-handlers/types.js';
import { FakeCacheService } from '../../factories/services/fake-cache-service.js';
import { FakeHttpGetService, okJsonBody } from '../../factories/services/fake-http-get-service.js';

const dccRegistry: EntityIdentityRegistry = {
  name: 'Test Legacy',
  type: 'dcc-legacy',
  url: 'https://example.com/registry.json',
};

describe('createRegistryLookup', () => {
  it('aggregates found and not-found across registries', async () => {
    const handlers: RegistryHandlerMap = {
      'dcc-legacy': async (_did, registry) => ({
        status: 'found',
        registryName: registry.name,
      }),
      oidf: async () => ({ status: 'not-found' }),
      'vc-recognition': async () => ({ status: 'not-found' }),
    };
    const lookup = createRegistryLookup(
      FakeHttpGetService({ 'https://x.test/': okJsonBody({}) }),
      FakeCacheService(),
      handlers,
    );
    const result = await lookup('did:key:test', [dccRegistry]);
    expect(result.found).to.equal(true);
    expect(result.matchingRegistries).to.deep.equal(['Test Legacy']);
    expect(result.uncheckedRegistries).to.deep.equal([]);
  });

  it('collects unchecked registry names', async () => {
    const handlers: RegistryHandlerMap = {
      'dcc-legacy': async (_did, registry) => ({
        status: 'unchecked',
        registryName: registry.name,
      }),
      oidf: async () => ({ status: 'not-found' }),
      'vc-recognition': async () => ({ status: 'not-found' }),
    };
    const lookup = createRegistryLookup(
      FakeHttpGetService({ 'https://x.test/': okJsonBody({}) }),
      FakeCacheService(),
      handlers,
    );
    const result = await lookup('did:key:x', [dccRegistry]);
    expect(result.found).to.equal(false);
    expect(result.matchingRegistries).to.deep.equal([]);
    expect(result.uncheckedRegistries).to.deep.equal(['Test Legacy']);
  });

  it('iterates multiple registries with exhaustive mode', async () => {
    const second: EntityIdentityRegistry = {
      name: 'Other',
      type: 'dcc-legacy',
      url: 'https://example.com/other.json',
    };
    const handlers: RegistryHandlerMap = {
      'dcc-legacy': async (did, registry) =>
        did === 'did:key:a'
          ? { status: 'found', registryName: registry.name }
          : { status: 'not-found' },
      oidf: async () => ({ status: 'not-found' }),
      'vc-recognition': async () => ({ status: 'not-found' }),
    };
    const lookup = createRegistryLookup(
      FakeHttpGetService({ 'https://x.test/': okJsonBody({}) }),
      FakeCacheService(),
      handlers,
    );
    const result = await lookup('did:key:a', [dccRegistry, second], { exhaustive: true });
    expect(result.found).to.equal(true);
    expect(result.matchingRegistries).to.deep.equal(['Test Legacy', 'Other']);
  });

  describe('caching', () => {
    it('caches result for same DID and registries', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const cache = FakeCacheService();
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        cache,
        handlers,
      );

      // First lookup
      await lookup('did:key:test', [dccRegistry]);
      expect(handlerCallCount).to.equal(1);

      // Second lookup should hit cache
      await lookup('did:key:test', [dccRegistry]);
      expect(handlerCallCount).to.equal(1); // Not called again
    });

    it('different DID triggers new lookup', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        FakeCacheService(),
        handlers,
      );

      await lookup('did:key:first', [dccRegistry]);
      await lookup('did:key:second', [dccRegistry]);
      expect(handlerCallCount).to.equal(2);
    });

    it('different registries trigger new lookup', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        FakeCacheService(),
        handlers,
      );

      const registry1: EntityIdentityRegistry = { ...dccRegistry, url: 'https://a.com' };
      const registry2: EntityIdentityRegistry = { ...dccRegistry, url: 'https://b.com' };

      await lookup('did:key:same', [registry1]);
      await lookup('did:key:same', [registry2]);
      expect(handlerCallCount).to.equal(2);
    });

    it('same registries in different order share cache key', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const cache = FakeCacheService();
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        cache,
        handlers,
      );

      const reg1: EntityIdentityRegistry = { ...dccRegistry, name: 'Reg1', url: 'https://a.com' };
      const reg2: EntityIdentityRegistry = { ...dccRegistry, name: 'Reg2', url: 'https://b.com' };

      await lookup('did:key:same', [reg1, reg2]);
      await lookup('did:key:same', [reg2, reg1]); // Different order
      expect(handlerCallCount).to.equal(1); // Cache hit
    });
  });

  describe('short-circuit', () => {
    it('stops after first found by default', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        'vc-recognition': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
      };

      const registries: EntityIdentityRegistry[] = [
        { name: 'First', type: 'dcc-legacy', url: 'https://first.com' },
        { name: 'Second', type: 'oidf', trustAnchorEC: 'https://second.com' },
        { name: 'Third', type: 'vc-recognition', url: 'https://third.com', acceptedIssuers: [] },
      ];

      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        FakeCacheService(),
        handlers,
      );

      await lookup('did:key:test', registries);
      expect(handlerCallCount).to.equal(1); // Only first called
    });

    it('checks all registries when exhaustive: true', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        'vc-recognition': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
      };

      const registries: EntityIdentityRegistry[] = [
        { name: 'First', type: 'dcc-legacy', url: 'https://first.com' },
        { name: 'Second', type: 'oidf', trustAnchorEC: 'https://second.com' },
        { name: 'Third', type: 'vc-recognition', url: 'https://third.com', acceptedIssuers: [] },
      ];

      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        FakeCacheService(),
        handlers,
      );

      const result = await lookup('did:key:test', registries, { exhaustive: true });
      expect(handlerCallCount).to.equal(3); // All called
      expect(result.matchingRegistries).to.deep.equal(['First', 'Second', 'Third']);
    });
  });

  describe('fresh lookup', () => {
    it('bypasses cache when fresh: true', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const cache = FakeCacheService();
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        cache,
        handlers,
      );

      // First lookup (cache miss)
      await lookup('did:key:test', [dccRegistry]);
      expect(handlerCallCount).to.equal(1);

      // Second lookup without fresh (cache hit)
      await lookup('did:key:test', [dccRegistry]);
      expect(handlerCallCount).to.equal(1);

      // Third lookup with fresh (cache bypass)
      await lookup('did:key:test', [dccRegistry], { fresh: true });
      expect(handlerCallCount).to.equal(2);
    });

    it('caches result after fresh lookup', async () => {
      let handlerCallCount = 0;
      const handlers: RegistryHandlerMap = {
        'dcc-legacy': async (_did, registry) => {
          handlerCallCount++;
          return { status: 'found', registryName: registry.name };
        },
        oidf: async () => ({ status: 'not-found' }),
        'vc-recognition': async () => ({ status: 'not-found' }),
      };
      const cache = FakeCacheService();
      const lookup = createRegistryLookup(
        FakeHttpGetService({}),
        cache,
        handlers,
      );

      // Fresh lookup
      await lookup('did:key:test', [dccRegistry], { fresh: true });
      expect(handlerCallCount).to.equal(1);

      // Non-fresh should use cached result
      await lookup('did:key:test', [dccRegistry]);
      expect(handlerCallCount).to.equal(1);
    });
  });
});
