import chai from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { verifyCredential } from '../src/Verify.js'
import { Credential } from '../src/types/credential.js';
import { knownDIDRegistries } from '../src/test-fixtures/knownDidRegistries.js';
import { SCHEMA_ENTRY_ID } from '../src/constants/verificationSteps.js';

import { EXPIRATION_STEP_ID, REVOCATION_STATUS_STEP_ID } from '../src/constants/verificationSteps.js';
import { DID_WEB_UNRESOLVED, INVALID_CREDENTIAL_ID, INVALID_SIGNATURE, NO_PROOF, STATUS_LIST_NOT_FOUND } from '../src/constants/errors.js';
import { getVCv2DoubleSigWithBadStatusUrl } from '../src/test-fixtures/vc.js';
import { getExpectedVerifiedResult } from '../src/test-fixtures/expectedResults.js';

chai.use(deepEqualInAnyOrder);
const { expect } = chai;

/* 

Tests credential status validation.

*/

describe('status checks', () => {

    describe('returns log error', () => {
          it('when statuslist url is unreachable', async () => {
            const credential: any = getVCv2DoubleSigWithBadStatusUrl()
            const expectedResult = getExpectedVerifiedResult({ credential, withStatus: false })
            expectedResult.log?.push(
              {
                "id": REVOCATION_STATUS_STEP_ID,
                "error": {
                  "name": STATUS_LIST_NOT_FOUND,
                  "message": "NotFoundError loading \"https://raw.githubusercontent.com/digitalcredentials/verifier-core/refs/heads/main/src/test-fixtures/status/e5VK8CbZ1GjycuPombrj\": Request failed with status code 404 Not Found: GET https://raw.githubusercontent.com/digitalcredentials/verifier-core/refs/heads/main/src/test-fixtures/status/e5VK8CbZ1GjycuPombrj"
                }
              })
            const result = await verifyCredential({ credential, knownDIDRegistries })
            expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)
          })

        })
    

    describe('verification with', () => {
        it.only('expired status list', async () => {
            const credential = await fetchVC('https://digitalcredentials.github.io/vc-test-fixtures/verifiableCredentials/v2/ed25519/didKey/legacy-expiredStatus-noExpiry.json')
            const result = await verifyCredential({ credential, knownDIDRegistries })
            console.log(result)
            // THIS SHOULD BE RETURNING AN ERROR FOR THE REVOCATION STEP!!!!!!
        //   expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)    })
    })

})

async function fetchVC(url: string): Promise<Credential> {
    const response = await fetch(url);
    const data = await response.json();
    return data as Credential
}