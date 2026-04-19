/**
 * Phase-1 spec for `obv3p0Recognizer`.
 *
 * The Phase-1 implementation is intentionally a stub that echoes
 * the credential as the `normalized` value when the credential
 * matches `isOpenBadgeCredential`. Phase 2 swaps the parse for a
 * real envelope schema and this spec will be extended.
 */

import { expect } from 'chai';
import { obv3p0Recognizer } from '../../src/openbadges/recognizers.js';
import type { VerificationContext } from '../../src/types/context.js';
import { sampleAchievementCredential } from './fixtures/sample-achievement-credential.js';

const ctx: VerificationContext = {
  documentLoader: async () => ({}),
  fetchJson: async () => ({}),
  cryptoSuites: [],
  cryptoServices: [],
  challenge: null,
  unsignedPresentation: false,
};

describe('obv3p0Recognizer', () => {
  it('exposes a stable id and human-readable name', () => {
    expect(obv3p0Recognizer.id).to.equal('obv3p0.openbadge');
    expect(obv3p0Recognizer.name).to.equal('Open Badges 3.0');
  });

  it('applies() is true for an OB v3 OpenBadgeCredential', () => {
    expect(obv3p0Recognizer.applies(sampleAchievementCredential, ctx)).to.be
      .true;
  });

  it('applies() is false for a credential without the OB v3 context', () => {
    const notOb = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiableCredential'],
    };
    expect(obv3p0Recognizer.applies(notOb, ctx)).to.be.false;
  });

  it('applies() is false for an EndorsementCredential', () => {
    const endorsement = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      ],
      type: ['VerifiableCredential', 'EndorsementCredential'],
    };
    expect(obv3p0Recognizer.applies(endorsement, ctx)).to.be.false;
  });

  it('parse() returns recognized with the credential as normalized (Phase 1 stub)', () => {
    const result = obv3p0Recognizer.parse(sampleAchievementCredential);
    expect(result.status).to.equal('recognized');
    if (result.status === 'recognized') {
      expect(result.profile).to.equal('obv3p0.openbadge');
      expect(result.normalized).to.equal(sampleAchievementCredential);
    }
  });
});
