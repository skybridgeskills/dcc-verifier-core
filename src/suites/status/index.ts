import { VerificationSuite } from '../../types/check.js';
import { bitstringStatusCheck } from './bitstring-status-check.js';

/**
 * Credential status verification suite.
 *
 * Checks revocation and suspension status via BitstringStatusList.
 * This suite is non-fatal - status check failures don't invalidate the credential,
 * they only provide additional information about the credential's current state.
 *
 * Skipped when:
 * - Credential has no credentialStatus
 * - Status type is a legacy type (StatusList2021Entry, 1EdTechRevocationList)
 */
export const statusSuite: VerificationSuite = {
  id: 'status',
  name: 'Credential Status',
  description: 'Checks revocation and suspension status via BitstringStatusList.',
  phase: 'cryptographic',
  checks: [bitstringStatusCheck],
};
