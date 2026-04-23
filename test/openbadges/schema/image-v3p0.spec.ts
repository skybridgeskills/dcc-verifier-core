/**
 * Spec for the Phase-3 OB 3.0 `Image` class schema and the
 * `ImageField()` builder, plus its backfill into the top-level
 * credential `image` slot.
 *
 * Asserts the contract documented in
 * `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/03-image.md`.
 */

import { expect } from 'chai';
import { Obv3p0ImageSchema } from '../../../src/openbadges/schemas/classes-v3p0.js';
import { parseObv3p0OpenBadgeCredential } from '../../../src/openbadges/schemas/openbadge-credential-v3p0.js';
import type { RecognitionResult } from '../../../src/types/recognition.js';
import { obv3p0OpenBadgeSpecConforming } from '../fixtures/obv3p0-openbadge-spec-conforming.js';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function assertMalformedAt(
  result: RecognitionResult,
  expectedInstance: string,
): void {
  expect(result.status).to.equal('malformed');
  if (result.status === 'malformed') {
    const matched = result.problems.find(p => p.instance === expectedInstance);
    expect(
      matched,
      `expected a problem at ${expectedInstance}, got ${JSON.stringify(
        result.problems.map(p => p.instance),
      )}`,
    ).to.exist;
  }
}

describe('Obv3p0ImageSchema (standalone)', () => {
  it('parses a valid Image object with caption', () => {
    const parsed = Obv3p0ImageSchema.safeParse({
      id: 'https://example.test/badge.png',
      type: ['Image'],
      caption: 'A badge',
    });

    expect(parsed.success).to.be.true;
    if (parsed.success) {
      expect(parsed.data.id).to.equal('https://example.test/badge.png');
      expect(parsed.data.type).to.deep.equal(['Image']);
      expect(parsed.data.caption).to.equal('A badge');
    }
  });

  it('rejects an Image whose type is wrong', () => {
    const parsed = Obv3p0ImageSchema.safeParse({
      id: 'https://example.test/badge.png',
      type: ['Profile'],
    });

    expect(parsed.success).to.be.false;
  });

  it('rejects an Image whose id is not an IRI', () => {
    const parsed = Obv3p0ImageSchema.safeParse({
      id: 'not-an-iri',
      type: ['Image'],
    });

    expect(parsed.success).to.be.false;
  });

  it('accepts a data: URI as id', () => {
    const parsed = Obv3p0ImageSchema.safeParse({
      id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=',
      type: ['Image'],
    });

    expect(parsed.success).to.be.true;
  });
});

describe('credential.image (backfilled ImageField)', () => {
  it('round-trips an object-form image on the spec-conforming fixture', () => {
    const result = parseObv3p0OpenBadgeCredential(
      obv3p0OpenBadgeSpecConforming,
    );

    expect(result.status).to.equal('recognized');
    if (result.status === 'recognized') {
      const normalized = result.normalized as {
        image: { id: string; type: string[]; caption?: string };
      };
      expect(normalized.image).to.deep.include({
        id: 'https://example.test/badge.png',
        caption: 'Spec-conforming badge image',
      });
      expect(normalized.image.type).to.deep.equal(['Image']);
    }
  });

  it('normalizes a string-form image to { id, type: ["Image"] }', () => {
    const cred = clone(obv3p0OpenBadgeSpecConforming);
    cred.image = 'https://example.test/string-form.png';

    const result = parseObv3p0OpenBadgeCredential(cred);

    expect(result.status).to.equal('recognized');
    if (result.status === 'recognized') {
      const normalized = result.normalized as {
        image: { id: string; type: string[] };
      };
      expect(normalized.image).to.deep.equal({
        id: 'https://example.test/string-form.png',
        type: ['Image'],
      });
    }
  });

  it('accepts an absent image (image is optional)', () => {
    const cred = clone(obv3p0OpenBadgeSpecConforming);
    delete cred.image;

    const result = parseObv3p0OpenBadgeCredential(cred);
    expect(result.status).to.equal('recognized');
  });

  it('rejects an image object with the wrong type', () => {
    const cred = clone(obv3p0OpenBadgeSpecConforming);
    cred.image = {
      id: 'https://example.test/badge.png',
      type: ['Profile'],
    };

    const result = parseObv3p0OpenBadgeCredential(cred);
    assertMalformedAt(result, '/image/type');
  });

  it('rejects an image object with a non-IRI id', () => {
    const cred = clone(obv3p0OpenBadgeSpecConforming);
    cred.image = { id: 'not-an-iri', type: ['Image'] };

    const result = parseObv3p0OpenBadgeCredential(cred);
    assertMalformedAt(result, '/image/id');
  });
});
