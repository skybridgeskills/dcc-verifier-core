import { CheckResult } from './check.js';
import { VerifiableCredential } from '../schemas/credential.js';

// ==================== New Suite-Based Architecture Types ====================

/**
 * Result of credential verification using the new suite-based architecture.
 */
export interface CredentialVerificationResult {
  /** Overall verification status - true if no failures */
  verified: boolean;

  /** The parsed credential that was verified */
  credential: VerifiableCredential;

  /** Individual check results from all suites */
  results: CheckResult[];
}

/**
 * Result of presentation verification using the new suite-based architecture.
 */
export interface PresentationVerificationResult {
  /** Overall verification status - true if no failures in presentation or credentials */
  verified: boolean;

  /** Check results from presentation-level verification */
  presentationResults: CheckResult[];

  /** Individual credential verification results */
  credentialResults: CredentialVerificationResult[];

  /** All results flattened (presentation + all credential checks) */
  allResults: CheckResult[];
}

// ==================== Legacy Types (for backward compatibility) ====================

export interface VerificationError {
  message: string;
  name?: string;
  details?: object;
  stackTrace?: unknown;
}

export interface VerificationStep {
  id: string;
  valid?: boolean;
  foundInRegistries?: string[];
  registriesNotLoaded?: RegistriesNotLoaded[];
  error?: VerificationError;
}

export interface SchemaCheck {
  schema: string;
  result: { valid: boolean; errors?: object[] };
  source: string;
}

export interface AdditionalInformationEntry {
  id: string;
  results: SchemaCheck[];
}

export interface VerificationResponse {
  additionalInformation?: AdditionalInformationEntry[];
  credential?: object;
  errors?: VerificationError[];
  log?: VerificationStep[];
}

const signatureOptions = ['valid', 'invalid', 'unsigned'] as const;
export type PresentationSignatureResult = (typeof signatureOptions)[number]; // i.e., 'valid', 'invalid', 'unsigned'

export interface PresentationResult {
  signature: PresentationSignatureResult;
  error?: unknown;
}

export interface PresentationVerificationResponse {
  credentialResults?: VerificationResponse[];
  presentationResult?: PresentationResult;
  errors?: VerificationError[];
}

export interface RegistryListResult {
  foundInRegistries: string[];
  registriesNotLoaded: RegistriesNotLoaded[];
}

export interface RegistriesNotLoaded {
  name: string;
  url: string;
}