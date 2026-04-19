/**
 * Open Badges 3.0 recognizers.
 *
 * Pluggable {@link RecognizerSpec}s for the built-in
 * `recognitionSuite`. Wire them by passing them to
 * `createVerifier({ recognizers: [obv3p0Recognizer] })`.
 *
 * **Phase 1 ships with a stub `parse`** that echoes the credential
 * unchanged as the `normalized` value. Phase 2 of the
 * `2026-04-18-openbadges-recognizer-and-subchecks` plan replaces
 * the stub with a real envelope parse via
 * `parseObv3p0OpenBadgeCredential`.
 *
 * @see `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/00-design.md`
 */

import type { RecognizerSpec } from '../types/recognition.js';
import { isOpenBadgeCredential } from './recognize.js';

const OBV3P0_OPENBADGE_PROFILE = 'obv3p0.openbadge';

export const obv3p0Recognizer: RecognizerSpec = {
  id: OBV3P0_OPENBADGE_PROFILE,
  name: 'Open Badges 3.0',
  applies: subject => isOpenBadgeCredential(subject),
  parse: credential => ({
    status: 'recognized',
    profile: OBV3P0_OPENBADGE_PROFILE,
    normalized: credential,
  }),
};
