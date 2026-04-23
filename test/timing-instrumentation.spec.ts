/**
 * Deterministic coverage for the `timing` flag.
 *
 * Uses {@link FakeTimeService} so every `TaskTiming` field is
 * exact-value-assertable: counter-based wall clock for
 * `startedAt` / `endedAt` and counter-based monotonic clock
 * for `durationMs`. Higher-level presence/absence coverage
 * lives in `test/verify-credential.spec.ts` and
 * `test/verify-presentation.spec.ts`.
 */

import { expect } from 'chai';
import { createVerifier } from '../src/verifier.js';
import { FakeTimeService } from '../src/services/time-service/fake-time-service.js';
import { CredentialFactory } from './factories/data/credential-factory.js';
import { PresentationFactory } from './factories/data/presentation-factory.js';
import { FakeCryptoService } from './factories/services/fake-crypto-service.js';

const BASE_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

const fakeVerified = {
  cryptoServices: [FakeCryptoService({ verified: true })],
  verbose: true,
};

describe('timing instrumentation', () => {
  describe('CheckResult.timing', () => {
    it('is absent when timing is left at its default (false)', async () => {
      const verifier = createVerifier({ ...fakeVerified });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      expect(result.timing).to.equal(undefined);
      for (const c of result.results) expect(c.timing).to.equal(undefined);
      for (const s of result.summary) expect(s.timing).to.equal(undefined);
    });

    it('is present on every CheckResult when timing: true', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      expect(result.results.length).to.be.greaterThan(0);
      for (const c of result.results) {
        expect(c.timing, `${c.id ?? c.check} missing timing`).to.exist;
      }
    });

    it('uses TimeService for wall-clock fields', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService({ baseDateMs: BASE_DATE_MS }),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });

      for (const c of result.results) {
        const startedMs = new Date(c.timing!.startedAt).getTime();
        const endedMs = new Date(c.timing!.endedAt).getTime();
        expect(startedMs - BASE_DATE_MS).to.be.greaterThan(0);
        expect(endedMs - BASE_DATE_MS).to.be.greaterThan(0);
        expect(endedMs).to.be.at.least(startedMs);
      }
    });

    it('endedAt >= startedAt and ISO-parses for every check', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      for (const c of result.results) {
        const s = new Date(c.timing!.startedAt).getTime();
        const e = new Date(c.timing!.endedAt).getTime();
        expect(Number.isNaN(s), `bad startedAt for ${c.id}`).to.equal(false);
        expect(Number.isNaN(e), `bad endedAt for ${c.id}`).to.equal(false);
        expect(e).to.be.at.least(s);
      }
    });

    it('durationMs equals exactly 1 per check with default tick (one perf read each side)', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      for (const c of result.results) {
        expect(c.timing!.durationMs).to.equal(1);
      }
    });
  });

  describe('SuiteSummary.timing rollup', () => {
    it('startedAt is the earliest child startedAt; endedAt is the latest', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });

      const childrenBySuite = new Map<string, typeof result.results>();
      for (const c of result.results) {
        const arr = childrenBySuite.get(c.suite) ?? [];
        arr.push(c);
        childrenBySuite.set(c.suite, arr);
      }
      for (const s of result.summary) {
        const children = childrenBySuite.get(s.suite);
        if (!children || children.length === 0) continue;
        expect(s.timing).to.exist;
        const minStart = children
          .map(c => c.timing!.startedAt)
          .reduce((a, b) => (a < b ? a : b));
        const maxEnd = children
          .map(c => c.timing!.endedAt)
          .reduce((a, b) => (a > b ? a : b));
        expect(s.timing!.startedAt).to.equal(minStart);
        expect(s.timing!.endedAt).to.equal(maxEnd);
      }
    });

    it('durationMs equals the sum of child durationMs', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });

      const childrenBySuite = new Map<string, typeof result.results>();
      for (const c of result.results) {
        const arr = childrenBySuite.get(c.suite) ?? [];
        arr.push(c);
        childrenBySuite.set(c.suite, arr);
      }
      for (const s of result.summary) {
        const children = childrenBySuite.get(s.suite) ?? [];
        if (children.length === 0) continue;
        const sum = children.reduce((acc, c) => acc + c.timing!.durationMs, 0);
        expect(s.timing!.durationMs).to.equal(sum);
      }
    });

    it('survives non-verbose folding (suite timing present even when results[] is empty)', async () => {
      const verifier = createVerifier({
        cryptoServices: [FakeCryptoService({ verified: true })],
        timing: true,
        timeService: FakeTimeService(),
        // verbose: false (default)
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      expect(result.results).to.deep.equal([]);
      expect(result.summary.length).to.be.greaterThan(0);
      for (const s of result.summary) expect(s.timing).to.exist;
    });
  });

  describe('top-level result.timing', () => {
    it('is present when timing: true', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      expect(result.timing).to.exist;
      const s = new Date(result.timing!.startedAt).getTime();
      const e = new Date(result.timing!.endedAt).getTime();
      expect(e).to.be.at.least(s);
    });

    it('absent when timing: false (default)', async () => {
      const verifier = createVerifier({ ...fakeVerified });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      expect(result.timing).to.equal(undefined);
    });

    it('top-level durationMs >= max suite durationMs (inclusive)', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential });
      const maxSuite = result.summary
        .map(s => s.timing?.durationMs ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      expect(result.timing!.durationMs).to.be.at.least(maxSuite);
    });

    it('verifyPresentation top-level timing >= each embedded credential timing', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const presentation = PresentationFactory({
        verifiableCredential: [
          CredentialFactory({ version: 'v1', credential: {} }),
          CredentialFactory({ credential: {} }),
        ],
      });
      const result = await verifier.verifyPresentation({ presentation });
      expect(result.timing).to.exist;
      expect(result.credentialResults).to.have.lengthOf(2);
      for (const cr of result.credentialResults) {
        expect(cr.timing).to.exist;
        expect(result.timing!.durationMs).to.be.at.least(cr.timing!.durationMs);
      }
    });
  });

  describe('parse-failure short-circuit', () => {
    it('emits timing on the synthetic parsing.envelope check when timing: true', async () => {
      const verifier = createVerifier({
        timing: true,
        timeService: FakeTimeService(),
      });
      const result = await verifier.verifyCredential({
        credential: 'not a credential',
      });
      expect(result.timing).to.exist;
      expect(result.results).to.have.lengthOf(1);
      const only = result.results[0];
      expect(only.suite).to.equal('parsing');
      expect(only.timing).to.exist;
      expect(only.timing!.durationMs).to.equal(1);
      expect(result.summary).to.have.lengthOf(1);
      expect(result.summary[0].timing).to.exist;
      expect(result.summary[0].timing!.durationMs).to.equal(1);
    });

    it('omits timing on parse failure when timing: false', async () => {
      const verifier = createVerifier({});
      const result = await verifier.verifyCredential({
        credential: 'not a credential',
      });
      expect(result.timing).to.equal(undefined);
      expect(result.results[0].timing).to.equal(undefined);
      expect(result.summary[0].timing).to.equal(undefined);
    });
  });

  describe('per-call override of constructor timing', () => {
    it('per-call timing: false overrides constructor timing: true', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential, timing: false });
      expect(result.timing).to.equal(undefined);
      for (const c of result.results) expect(c.timing).to.equal(undefined);
    });

    it('per-call timing: true overrides constructor timing: false', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timeService: FakeTimeService(),
      });
      const credential = CredentialFactory({ version: 'v1', credential: {} });
      const result = await verifier.verifyCredential({ credential, timing: true });
      expect(result.timing).to.exist;
      for (const c of result.results) expect(c.timing).to.exist;
    });
  });

  describe('propagation into embedded credential calls', () => {
    it('verifyPresentation propagates per-call timing to embedded verifyCredential', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timeService: FakeTimeService(),
      });
      const presentation = PresentationFactory({
        verifiableCredential: [CredentialFactory({ credential: {} })],
      });
      const result = await verifier.verifyPresentation({ presentation, timing: true });
      expect(result.timing).to.exist;
      for (const cr of result.credentialResults) {
        expect(cr.timing).to.exist;
        for (const c of cr.results) expect(c.timing).to.exist;
      }
    });

    it('verifyPresentation per-call timing: false suppresses embedded timing even when constructor enabled it', async () => {
      const verifier = createVerifier({
        ...fakeVerified,
        timing: true,
        timeService: FakeTimeService(),
      });
      const presentation = PresentationFactory({
        verifiableCredential: [CredentialFactory({ credential: {} })],
      });
      const result = await verifier.verifyPresentation({
        presentation,
        timing: false,
      });
      expect(result.timing).to.equal(undefined);
      for (const cr of result.credentialResults) {
        expect(cr.timing).to.equal(undefined);
        for (const c of cr.results) expect(c.timing).to.equal(undefined);
      }
    });
  });
});
