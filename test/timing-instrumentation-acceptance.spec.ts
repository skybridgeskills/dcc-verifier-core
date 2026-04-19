/**
 * End-to-end acceptance test for timing instrumentation.
 *
 * Exercises the realistic call shape — `createVerifier({
 * timing: true })` (default `RealTimeService`) verifying a
 * presentation containing embedded credentials — and asserts
 * the inclusive-rollup invariants documented in
 * `docs/api/timing.md`. Acts as the regression gate that
 * timing flows correctly through the default service stack.
 *
 * Per-component / deterministic coverage lives in
 * `timing-instrumentation.spec.ts`; this file deliberately
 * keeps assertions to the integration-level invariants.
 */

import { expect } from 'chai';
import { createVerifier } from '../src/verifier.js';
import { CredentialFactory } from './factories/data/credential-factory.js';
import { PresentationFactory } from './factories/data/presentation-factory.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';

describe('timing instrumentation (acceptance)', () => {
  it('happy path: default RealTimeService, timing: true populates every level and rollups hold', async () => {
    const verifier = createVerifier({
      cryptoServices: [FakeCryptoService({ verified: true })],
      timing: true,
      verbose: true,
    });
    const presentation = PresentationFactory({
      verifiableCredential: [
        CredentialFactory({ version: 'v1', credential: {} }),
        CredentialFactory({ credential: {} }),
      ],
    });

    const result = await verifier.verifyPresentation({ presentation });

    expect(result.timing).to.exist;
    expect(result.timing!.startedAt).to.be.a('string');
    expect(result.timing!.endedAt).to.be.a('string');
    expect(result.timing!.durationMs).to.be.at.least(0);

    expect(result.summary.length).to.be.greaterThan(0);
    for (const s of result.summary) {
      expect(s.timing, `presentation summary ${s.id} missing timing`).to.exist;
    }

    expect(result.credentialResults).to.have.lengthOf(2);
    for (const cr of result.credentialResults) {
      expect(cr.timing, 'credential result missing timing').to.exist;
      for (const s of cr.summary) {
        expect(s.timing, `credential summary ${s.id} missing timing`).to.exist;
      }
    }

    const allSummaries = [
      ...result.summary,
      ...result.credentialResults.flatMap(cr => cr.summary),
    ];
    const maxSummaryDuration = allSummaries
      .map(s => s.timing?.durationMs ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);

    expect(
      result.timing!.durationMs,
      'top-level timing must inclusively wrap every suite under presentation + credentials',
    ).to.be.at.least(maxSummaryDuration);

    for (const cr of result.credentialResults) {
      expect(
        result.timing!.durationMs,
        'top-level timing must inclusively wrap every embedded credential',
      ).to.be.at.least(cr.timing!.durationMs);
    }
  });

  it('default (timing: false): no timing field appears anywhere in the result tree', async () => {
    const verifier = createVerifier({
      cryptoServices: [FakeCryptoService({ verified: true })],
      verbose: true,
    });
    const presentation = PresentationFactory({
      verifiableCredential: [CredentialFactory({ credential: {} })],
    });

    const result = await verifier.verifyPresentation({ presentation });

    expect(result.timing).to.equal(undefined);
    for (const c of result.presentationResults) {
      expect(c.timing).to.equal(undefined);
    }
    for (const s of result.summary) expect(s.timing).to.equal(undefined);
    for (const cr of result.credentialResults) {
      expect(cr.timing).to.equal(undefined);
      for (const c of cr.results) expect(c.timing).to.equal(undefined);
      for (const s of cr.summary) expect(s.timing).to.equal(undefined);
    }
  });
});
