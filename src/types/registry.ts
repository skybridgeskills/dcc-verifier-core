/**
 * Issuer / entity identity registry configuration.
 *
 * Registries are lists of trusted issuer DIDs. During verification, the
 * registry suite checks whether the credential's issuer appears in any
 * configured registry. Two registry types are supported.
 *
 * Shape matches `@digitalcredentials/issuer-registry-client`.
 */

export interface BaseEntityIdentityRegistry {
  name: string;
  type: 'oidf' | 'dcc-legacy';
}

/**
 * OpenID Federation registry — uses a trust anchor entity configuration
 * endpoint to resolve trusted issuers.
 */
export interface OidfEntityIdentityRegistry extends BaseEntityIdentityRegistry {
  type: 'oidf';
  trustAnchorEC: string;
}

/**
 * DCC legacy registry — a static JSON file listing trusted issuer DIDs,
 * fetched from a URL.
 */
export interface DccLegacyEntityIdentityRegistry extends BaseEntityIdentityRegistry {
  type: 'dcc-legacy';
  url: string;
}

/** Discriminated union of supported registry types. */
export type EntityIdentityRegistry =
  | OidfEntityIdentityRegistry
  | DccLegacyEntityIdentityRegistry;
