import { expect } from 'chai';
import { jwtDecodePayload } from '../../../src/services/registry-handlers/jwt-payload-decode.js';

describe('jwtDecodePayload', () => {
  it('decodes a minimal JWT payload', () => {
    const payload = { sub: 'user', n: 1 };
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const jwt = `eyJhbGciOiJub25lIn0.${b64}.sig`;
    expect(jwtDecodePayload(jwt)).to.deep.equal(payload);
  });

  it('throws on malformed JWT', () => {
    expect(() => jwtDecodePayload('not-a-jwt')).to.throw(/Invalid JWT/);
  });
});
