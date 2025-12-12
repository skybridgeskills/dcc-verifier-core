import chai from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { verifyCredential } from '../src/Verify.js'
import { Credential } from '../src/types/credential.js';
import { knownDIDRegistries } from '../src/test-fixtures/knownDidRegistries.js';

import { REVOCATION_STATUS_STEP_ID } from '../src/constants/verificationSteps.js';
import { STATUS_LIST_NOT_FOUND, STATUS_LIST_EXPIRED, STATUS_LIST_SIGNATURE_ERROR, STATUS_LIST_TYPE_ERROR, STATUS_LIST_NOT_YET_VALID_ERROR } from '../src/constants/errors.js';
import { getVCv2DoubleSigWithBadStatusUrl } from '../src/test-fixtures/vc.js';
import { getExpectedVerifiedResult } from '../src/test-fixtures/expectedResults.js';
import { STATUS_LIST_EXPIRED_MSG, STATUS_LIST_NOT_YET_VALID_MSG, STATUS_LIST_SIGNATURE_ERROR_MSG, STATUS_LIST_TYPE_ERROR_MSG } from '../src/constants/messages.js';

chai.use(deepEqualInAnyOrder);
const { expect } = chai;

/* 
Tests credential status list validation.
*/

describe('status checks', () => {

    describe('returns log error when status list', () => {
          it('url is unreachable', async () => {
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
    
        it('has expired', async () => {
            const credential = await fetchVC('https://digitalcredentials.github.io/vc-test-fixtures/verifiableCredentials/v2/ed25519/didKey/legacy-expiredStatus-noExpiry.json')
            const expectedResult = getExpectedVerifiedResult({ credential, withStatus: false })
            expectedResult.log?.push(
              {
                "id": REVOCATION_STATUS_STEP_ID,
                "error": {
                  "name": STATUS_LIST_EXPIRED,
                  "message": STATUS_LIST_EXPIRED_MSG
                }
              })
            const result = await verifyCredential({ credential, knownDIDRegistries })
            expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)
        })

        it('has been tampered with', async () => {
            const credential = await fetchVC('https://digitalcredentials.github.io/vc-test-fixtures/verifiableCredentials/v2/ed25519/didKey/legacy-tamperedStatus-noExpiry.json')
            const expectedResult = getExpectedVerifiedResult({ credential, withStatus: false })
            expectedResult.log?.push(
              {
                "id": REVOCATION_STATUS_STEP_ID,
                "error": {
                  "name": STATUS_LIST_SIGNATURE_ERROR,
                  "message": STATUS_LIST_SIGNATURE_ERROR_MSG
                }
              })
            const result = await verifyCredential({ credential, knownDIDRegistries })
            expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)
        })

        it('is missing BitstringStatusListCredential type', async () => {
            const credential = await fetchVC('https://digitalcredentials.github.io/vc-test-fixtures/verifiableCredentials/v2/ed25519/didKey/legacy-missingTypeStatus-noExpiry.json')
            const expectedResult = getExpectedVerifiedResult({ credential, withStatus: false })
            expectedResult.log?.push(
              {
                "id": REVOCATION_STATUS_STEP_ID,
                "error": {
                  "name": STATUS_LIST_TYPE_ERROR,
                  "message": STATUS_LIST_TYPE_ERROR_MSG
                }
              })
            const result = await verifyCredential({ credential, knownDIDRegistries })
            expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)
        })

        it('is not yet valid', async () => {
            const credential = await fetchVC('https://digitalcredentials.github.io/vc-test-fixtures/verifiableCredentials/v2/ed25519/didKey/legacy-notYetValidStatus-noExpiry.json')
            const expectedResult = getExpectedVerifiedResult({ credential, withStatus: false })
            expectedResult.log?.push(
              {
                "id": REVOCATION_STATUS_STEP_ID,
                "error": {
                  "name": STATUS_LIST_NOT_YET_VALID_ERROR,
                  "message": STATUS_LIST_NOT_YET_VALID_MSG
                }
              })
            const result = await verifyCredential({ credential, knownDIDRegistries })
            expect(result).to.have.property('log').that.deep.equalInAnyOrder(expectedResult.log);
            expect(result).to.have.property("credential").that.equals(credential)
        })

})

async function fetchVC(url: string): Promise<Credential> {
    const response = await fetch(url);
    const data = await response.json();
    return data as Credential
}