/**
 * Open Badges 3.0 recognizers.
 *
 * Pluggable {@link RecognizerSpec}s for the built-in
 * `recognitionSuite`. Wire them by passing them to
 * `createVerifier({ recognizers: [obv3p0Recognizer] })`.
 *
 * `obv3p0Recognizer` recognizes a credential whose `@context` /
 * `type` mark it as an OB 3.0 OpenBadgeCredential
 * (`isOpenBadgeCredential`) and parses it via
 * {@link parseObv3p0OpenBadgeCredential} — currently the
 * top-level envelope only; inner classes are filled in by Phases
 * 3–7 of the plan.
 *
 * @see `docs/plans/2026-04-18-openbadges-recognizer-and-subchecks/00-design.md`
 */

import type { RecognizerSpec } from '../types/recognition.js';
import { isOpenBadgeCredential } from './recognize.js';
import { parseObv3p0OpenBadgeCredential } from './schemas/openbadge-credential-v3p0.js';

export const obv3p0Recognizer: RecognizerSpec = {
  id: 'obv3p0.openbadge',
  name: 'Open Badges 3.0',
  applies: subject => isOpenBadgeCredential(subject),
  parse: parseObv3p0OpenBadgeCredential,
};
