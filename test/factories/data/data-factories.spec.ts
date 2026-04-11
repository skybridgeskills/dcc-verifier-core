import { expect } from 'chai';
import { decodeList } from '@digitalcredentials/vc-bitstring-status-list';
import { compose } from './compose.js';
import { CredentialFactory } from './credential-factory.js';
import { DidDocumentFactory } from './did-document-factory.js';
import { PresentationFactory } from './presentation-factory.js';
import { StatusListCredentialFactory } from './status-list-factory.js';
import { addResults } from './transforms.js';

describe('data factories', () => {
  it('CredentialFactory() produces a v2-shaped OpenBadge credential', () => {
    const cred = CredentialFactory();
    expect(cred['@context']).to.include('https://www.w3.org/ns/credentials/v2');
    expect(cred.type).to.deep.equal(['VerifiableCredential', 'OpenBadgeCredential']);
    expect(cred).to.have.property('validFrom');
    expect(cred).to.not.have.property('issuanceDate');
    expect(cred.proof).to.be.an('object');
    expect((cred.proof as { type?: string }).type).to.equal('Ed25519Signature2020');
  });

  it("CredentialFactory({ version: 'v1' }) uses issuanceDate", () => {
    const cred = CredentialFactory({ version: 'v1' });
    expect(cred['@context']).to.include('https://www.w3.org/2018/credentials/v1');
    expect(cred).to.have.property('issuanceDate');
    expect(cred).to.not.have.property('validFrom');
  });

  it('compose + addResults cross-references results and descriptions', () => {
    const cred = compose(CredentialFactory(), addResults({ count: 3 }));
    const cs = cred.credentialSubject as Record<string, unknown>;
    const achievement = cs.achievement as Record<string, unknown>;
    const results = cs.result as Array<{ resultDescription?: string }>;
    const descs = achievement.resultDescription as Array<{ id: string }>;

    expect(results).to.have.lengthOf(3);
    expect(descs).to.have.lengthOf(3);
    for (let i = 0; i < 3; i++) {
      expect(results[i].resultDescription).to.equal(descs[i].id);
    }
  });

  it('PresentationFactory() produces a VP-shaped object', () => {
    const vp = PresentationFactory();
    expect(vp.type).to.deep.equal(['VerifiablePresentation']);
    expect(vp.verifiableCredential).to.be.an('array');
    expect((vp.verifiableCredential as unknown[])).to.have.lengthOf(1);
    expect(vp.proof).to.be.an('object');
  });

  it('DidDocumentFactory() includes verificationMethod and references', () => {
    const doc = DidDocumentFactory();
    expect(doc.verificationMethod).to.be.an('array');
    expect((doc.verificationMethod as unknown[]).length).to.be.at.least(1);
    expect(doc.authentication).to.be.an('array');
    expect(doc.assertionMethod).to.be.an('array');
  });

  it('StatusListCredentialFactory sets revoked bits', async () => {
    const sl = await StatusListCredentialFactory({ revokedIndexes: [3] });
    const subject = sl.credentialSubject as { encodedList: string };
    const list = await decodeList({ encodedList: subject.encodedList });
    expect(list.getStatus(3)).to.equal(true);
    expect(list.getStatus(0)).to.equal(false);
  });
});
