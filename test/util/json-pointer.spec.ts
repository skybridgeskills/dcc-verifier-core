import { expect } from 'chai';
import { formatJsonPointer } from '../../src/util/json-pointer.js';

describe('formatJsonPointer', () => {
  it('returns empty string for an empty segment list', () => {
    expect(formatJsonPointer([])).to.equal('');
  });

  it('joins string and number segments with leading slash', () => {
    expect(
      formatJsonPointer(['credentialSubject', 'result', 0, 'resultDescription']),
    ).to.equal('/credentialSubject/result/0/resultDescription');
  });

  it('escapes "~" as "~0" before "/" as "~1" (RFC 6901 §4)', () => {
    // The order matters: escape "~" first, then "/", otherwise the "/"
    // we just escaped to "~1" gets re-touched.
    expect(formatJsonPointer(['weird/key~with~chars'])).to.equal(
      '/weird~1key~0with~0chars',
    );
  });

  it('handles a single numeric segment', () => {
    expect(formatJsonPointer([5])).to.equal('/5');
  });

  it('handles a single empty-string segment (per RFC 6901)', () => {
    expect(formatJsonPointer([''])).to.equal('/');
  });
});
