/**
 * End-to-end spec for the recognition pipeline through `createVerifier`.
 *
 * Asserts the contract documented in
 * `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/00-design.md`:
 *
 * - With no `recognizers` configured, `recognition.profile` emits
 *   skipped and the result has no `normalizedVerifiableCredential`
 *   / `recognizedProfile`.
 * - With recognizers configured, the verifier surfaces the matching
 *   recognizer's normalized form on the result, and a
 *   corresponding success result is in `results`.
 */

import { expect } from 'chai';
import { createVerifier } from '../src/verifier.js';
import type { RecognizerSpec } from '../src/types/recognition.js';
import { obv3p0Recognizer } from '../src/openbadges/recognizers.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';
import { sampleAchievementCredential } from './openbadges/fixtures/sample-achievement-credential.js';

const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
};

describe('verifier recognition pipeline', () => {
  it('emits a skipped recognition.profile result when no recognizers are configured', async () => {
    const verifier = createVerifier(fakeVerified);
    const result = await verifier.verifyCredential({
      credential: sampleAchievementCredential,
    });

    const recognition = result.results.find(
      r => r.check === 'recognition.profile',
    );
    expect(recognition?.outcome.status).to.equal('skipped');
    expect(result.normalizedVerifiableCredential).to.equal(undefined);
    expect(result.recognizedProfile).to.equal(undefined);
  });

  it('surfaces normalizedVerifiableCredential + recognizedProfile when obv3p0Recognizer matches', async () => {
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [obv3p0Recognizer],
    });
    const result = await verifier.verifyCredential({
      credential: sampleAchievementCredential,
    });

    expect(result.recognizedProfile).to.equal('obv3p0.openbadge');
    expect(result.normalizedVerifiableCredential).to.exist;

    const recognition = result.results.find(
      r => r.check === 'recognition.profile',
    );
    expect(recognition?.outcome.status).to.equal('success');
  });

  it('skips recognition cleanly when no configured recognizer matches', async () => {
    const neverMatches: RecognizerSpec = {
      id: 'never',
      name: 'Never',
      applies: () => false,
      parse: () => ({
        status: 'recognized',
        profile: 'never',
        normalized: {},
      }),
    };
    const verifier = createVerifier({
      ...fakeVerified,
      recognizers: [neverMatches],
    });
    const result = await verifier.verifyCredential({
      credential: sampleAchievementCredential,
    });

    expect(result.recognizedProfile).to.equal(undefined);
    expect(result.normalizedVerifiableCredential).to.equal(undefined);
    const recognition = result.results.find(
      r => r.check === 'recognition.profile',
    );
    expect(recognition?.outcome.status).to.equal('skipped');
  });
});
