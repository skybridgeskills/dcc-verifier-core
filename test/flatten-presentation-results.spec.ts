import { expect } from 'chai';
import { flattenPresentationResults } from '../src/flatten-presentation-results.js';
import type { CheckResult } from '../src/types/check.js';
import type {
  CredentialVerificationResult,
  PresentationVerificationResult,
} from '../src/types/result.js';
import type { VerifiableCredential } from '../src/schemas/credential.js';
import type { VerifiablePresentation } from '../src/schemas/presentation.js';

function mkCheck(suite: string, checkId: string): CheckResult {
  return {
    suite,
    check: checkId,
    outcome: { status: 'success', message: 'ok' },
    timestamp: '2026-04-18T12:00:00.000Z',
  };
}

describe('flattenPresentationResults', () => {
  it('presentation-only VP: output matches presentation results, all presentation-tagged', () => {
    const presentationResults = [mkCheck('proof', 'p-a'), mkCheck('proof', 'p-b')];
    const result: PresentationVerificationResult = {
      verified: true,
      verifiablePresentation: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: 'VerifiablePresentation',
      } as VerifiablePresentation,
      presentationResults,
      credentialResults: [],
    };

    const flat = flattenPresentationResults(result);

    expect(flat).to.have.lengthOf(2);
    expect(flat.every(x => x.source === 'presentation')).to.be.true;
    expect(flat.map(x => x.result)).to.deep.equal(presentationResults);
  });

  it('orders presentation first, then credentials in array order preserving cr.results order', () => {
    const stubVc = {} as VerifiableCredential;
    const c0: CredentialVerificationResult = {
      verified: true,
      verifiableCredential: stubVc,
      results: [mkCheck('core', 'c0-0'), mkCheck('core', 'c0-1')],
    };
    const c1: CredentialVerificationResult = {
      verified: true,
      verifiableCredential: stubVc,
      results: [mkCheck('core', 'c1-0'), mkCheck('status', 'c1-1'), mkCheck('core', 'c1-2')],
    };
    const c2: CredentialVerificationResult = {
      verified: true,
      verifiableCredential: stubVc,
      results: [mkCheck('registry', 'c2-0')],
    };
    const presentationResults = [mkCheck('proof', 'vp-0')];
    const result: PresentationVerificationResult = {
      verified: true,
      verifiablePresentation: {} as VerifiablePresentation,
      presentationResults,
      credentialResults: [c0, c1, c2],
    };

    const flat = flattenPresentationResults(result);

    expect(flat.map(x => x.source)).to.deep.equal([
      'presentation',
      'credential',
      'credential',
      'credential',
      'credential',
      'credential',
      'credential',
    ]);
    expect(flat[0]).to.deep.equal({
      source: 'presentation',
      result: presentationResults[0],
    });
    expect(flat.slice(1, 3).map(e => (e as { credentialIndex: number }).credentialIndex)).to.deep.equal([
      0, 0,
    ]);
    expect(flat.slice(3, 6).map(e => (e as { credentialIndex: number }).credentialIndex)).to.deep.equal([
      1, 1, 1,
    ]);
    expect(flat.slice(6).map(e => (e as { credentialIndex: number }).credentialIndex)).to.deep.equal([2]);
    expect(flat.slice(1, 3).map(e => e.result.check)).to.deep.equal(['c0-0', 'c0-1']);
    expect(flat.slice(3, 6).map(e => e.result.check)).to.deep.equal(['c1-0', 'c1-1', 'c1-2']);
    expect(flat[6].result.check).to.equal('c2-0');
  });

  it('credentialIndex i matches credentialResults[i].results in order (index stability)', () => {
    const stubVc = {} as VerifiableCredential;
    const result: PresentationVerificationResult = {
      verified: false,
      verifiablePresentation: {} as VerifiablePresentation,
      presentationResults: [mkCheck('proof', 'only-vp')],
      credentialResults: [
        {
          verified: true,
          verifiableCredential: stubVc,
          results: [mkCheck('a', '0-0'), mkCheck('a', '0-1')],
        },
        {
          verified: true,
          verifiableCredential: stubVc,
          results: [mkCheck('b', '1-0')],
        },
        {
          verified: true,
          verifiableCredential: stubVc,
          results: [mkCheck('c', '2-0'), mkCheck('c', '2-1'), mkCheck('c', '2-2')],
        },
      ],
    };

    const flat = flattenPresentationResults(result);

    for (let i = 0; i < result.credentialResults.length; i++) {
      const fromFlat = flat
        .filter(x => x.source === 'credential' && x.credentialIndex === i)
        .map(x => x.result);
      expect(fromFlat).to.deep.equal(result.credentialResults[i].results);
    }
  });
});
