import { expect } from 'chai';
import {
  DEFAULT_TTL_MS,
  parseCacheControlMaxAge,
  resolveTtl,
  ttlFromValidUntil,
} from '../../../src/services/registry-handlers/cache-ttl.js';

describe('parseCacheControlMaxAge', () => {
  it('returns undefined when header missing', () => {
    expect(parseCacheControlMaxAge(new Headers())).to.be.undefined;
  });

  it('parses max-age in seconds to ms', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=3600' });
    expect(parseCacheControlMaxAge(headers)).to.equal(3600 * 1000);
  });

  it('is case insensitive', () => {
    const headers = new Headers({ 'cache-control': 'Max-Age=60' });
    expect(parseCacheControlMaxAge(headers)).to.equal(60 * 1000);
  });

  it('returns undefined for invalid max-age', () => {
    const headers = new Headers({ 'cache-control': 'max-age=abc' });
    expect(parseCacheControlMaxAge(headers)).to.be.undefined;
  });
});

describe('ttlFromValidUntil', () => {
  it('returns ms until future instant', () => {
    const future = new Date(Date.now() + 5000).toISOString();
    const ttl = ttlFromValidUntil(future);
    expect(ttl).to.be.greaterThan(4000);
    expect(ttl).to.be.at.most(5000);
  });

  it('returns undefined for past instant', () => {
    expect(ttlFromValidUntil('2000-01-01T00:00:00Z')).to.be.undefined;
  });

  it('returns undefined for invalid string', () => {
    expect(ttlFromValidUntil('not-a-date')).to.be.undefined;
  });
});

describe('resolveTtl', () => {
  it('uses first positive finite value', () => {
    expect(resolveTtl(undefined, 100, 200)).to.equal(100);
  });

  it('skips non-positive values', () => {
    expect(resolveTtl(0, -1, 500)).to.equal(500);
  });

  it('falls back to DEFAULT_TTL_MS', () => {
    expect(resolveTtl(undefined, undefined)).to.equal(DEFAULT_TTL_MS);
  });
});
