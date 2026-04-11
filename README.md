# verifier-core _(@digitalcredentials/verifier-core)_

[![Build status](https://img.shields.io/github/actions/workflow/status/digitalcredentials/verifier-core/main.yml?branch=main)](https://github.com/digitalcredentials/verifier-core/actions?query=workflow%3A%22Node.js+CI%22)
[![Coverage Status](https://coveralls.io/repos/github/digitalcredentials/verifier-core/badge.svg?branch=main)](https://coveralls.io/github/digitalcredentials/verifier-core?branch=main)

> Verifies W3C Verifiable Credentials in the browser, Node.js, and React Native.

## Table of Contents

- [Overview](#overview)
- [API](#api)
  - [verifyCredential](#verifycredential)
  - [verifyPresentation](#verifypresentation)
- [Custom Suites](#custom-suites)
- [Architecture](#architecture)
- [Install](#install)
- [Contribute](#contribute)
- [License](#license)

## Overview

Verifies the following versions of W3C Verifiable Credentials:

* [1.0](https://www.w3.org/TR/2019/REC-vc-data-model-20191119/)
* [1.1](https://www.w3.org/TR/2022/REC-vc-data-model-20220303/)
* [2.0](https://www.w3.org/TR/vc-data-model-2.0/)

Supports both [eddsa-rdfc-2022 Data Integrity Proof](https://github.com/digitalbazaar/eddsa-rdfc-2022-cryptosuite) and [ed25519-signature-2020 Linked Data Proof](https://github.com/digitalbazaar/ed25519-signature-2020) cryptosuites.

Verification runs an ordered pipeline of **suites**, each containing one or more **checks**:

| Suite | What it checks | Fatal? |
|-------|---------------|--------|
| **Core** | `@context` exists, VC context URI present, credential ID valid, proof exists | Yes |
| **Proof** | Cryptographic signature verification | Yes |
| **Status** | Revocation/suspension via BitstringStatusList | No |
| **Registry** | Issuer DID lookup in known trust registries | No |
| **Schema** | OBv3 JSON Schema conformance | No |

The result doesn't make a single "valid/invalid" judgment. It returns the outcome of every check, letting consumers decide what matters for their use case. A credential with an expired status might still be useful as a historical record; an unregistered issuer might simply mean the registry hasn't been updated yet.

### Trust Registries

Registry checks look up the credential's issuer DID in known registries. The DCC publishes a list of known registries:

```
https://digitalcredentials.github.io/dcc-known-registries/known-did-registries.json
```

Fetch and pass it to verification:

```typescript
const response = await fetch(
  "https://digitalcredentials.github.io/dcc-known-registries/known-did-registries.json"
);
const registries = await response.json();

const result = await verifyCredential({ credential, registries });
```

> [!CAUTION]
> The DCC registry list does not make claims about the registries it contains. It is a list of registries that the DCC knows about — it says nothing about the quality, meaning, or value of credentials issued by anyone in those registries.

## API

### verifyCredential

```typescript
import { verifyCredential } from '@digitalcredentials/verifier-core';

const result = await verifyCredential({
  credential,    // The VC to verify (any version, passed as unknown)
  registries,    // Optional: issuer trust registries
});
```

#### Options

```typescript
interface VerifyCredentialOptions {
  credential: unknown;
  registries?: EntityIdentityRegistry[];
  additionalSuites?: VerificationSuite[];
  documentLoader?: DocumentLoader;
  cryptoSuites?: object[];
}
```

Only `credential` is required. All other fields override sensible defaults (security-document-loader, Ed25519 + EdDSA crypto suites).

#### Result

```typescript
interface CredentialVerificationResult {
  verified: boolean;
  credential: VerifiableCredential;
  results: CheckResult[];
}
```

`verified` is `true` when no check returned a failure. Every check that ran (or was skipped) appears in `results`, so the report is always complete.

Each `CheckResult` contains a discriminated `CheckOutcome`:

```typescript
type CheckOutcome =
  | { status: 'success'; message: string }
  | { status: 'failure'; problems: ProblemDetail[] }
  | { status: 'skipped'; reason: string };
```

Failures carry one or more `ProblemDetail` entries (inspired by [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)):

```typescript
interface ProblemDetail {
  type: string;   // URI identifying the problem
  title: string;  // Short human-readable summary
  detail: string; // Specific explanation of this occurrence
}
```

#### Example: Successful verification

```json
{
  "verified": true,
  "credential": { "...parsed credential..." },
  "results": [
    { "suite": "core",   "check": "core.context-exists", "outcome": { "status": "success", "message": "Credential has a valid @context property." } },
    { "suite": "core",   "check": "core.vc-context",     "outcome": { "status": "success", "message": "..." } },
    { "suite": "core",   "check": "core.credential-id",  "outcome": { "status": "success", "message": "..." } },
    { "suite": "core",   "check": "core.proof-exists",   "outcome": { "status": "success", "message": "..." } },
    { "suite": "proof",  "check": "proof.signature",     "outcome": { "status": "success", "message": "Signature verified successfully." } },
    { "suite": "status", "check": "status.bitstring",    "outcome": { "status": "success", "message": "Credential status is valid (not revoked or suspended)." } },
    { "suite": "registry", "check": "registry.issuer",   "outcome": { "status": "success", "message": "Issuer found in registry: DCC Sandbox Registry" } },
    { "suite": "schema.obv3", "check": "...",            "outcome": { "status": "success", "message": "..." } }
  ]
}
```

#### Example: Invalid signature (fatal)

An invalid signature is fatal — it means any part of the credential could have been tampered with, so subsequent checks within the proof suite stop. Other suites still run.

```json
{
  "verified": false,
  "results": [
    { "suite": "core",  "check": "core.context-exists", "outcome": { "status": "success", "message": "..." } },
    { "suite": "core",  "check": "core.proof-exists",   "outcome": { "status": "success", "message": "..." } },
    { "suite": "proof", "check": "proof.signature", "outcome": {
      "status": "failure",
      "problems": [{
        "type": "https://www.w3.org/TR/vc-data-model#INVALID_SIGNATURE",
        "title": "Invalid Signature",
        "detail": "The signature is not valid."
      }]
    }},
    { "suite": "status", "check": "status.bitstring", "outcome": { "status": "skipped", "reason": "..." } }
  ]
}
```

#### Example: Check skipped

Checks skip when they're irrelevant to the input. For instance, a credential with no `credentialStatus` skips the status check:

```json
{
  "suite": "status",
  "check": "status.bitstring",
  "outcome": {
    "status": "skipped",
    "reason": "Credential has no credentialStatus."
  }
}
```

#### Error taxonomy

All failures use `ProblemDetail` with a `type` URI. Common error types:

| Type URI | Title | When |
|----------|-------|------|
| `...#PARSING_ERROR` | Invalid JSON-LD / No VC Context / Invalid Credential ID / No Proof | Structural problems |
| `...#INVALID_SIGNATURE` | Invalid Signature | Signature doesn't match content |
| `...#DID_WEB_UNRESOLVED` | DID Web Unresolved | `did:web` document couldn't be fetched |
| `...#HTTP_ERROR` | HTTP Error | Network error during signature check |
| `...#CREDENTIAL_REVOKED_OR_SUSPENDED` | Credential Revoked or Suspended | Status list indicates revocation |
| `...#STATUS_LIST_NOT_FOUND` | Status List Not Found | Status list URL unreachable |
| `...#STATUS_LIST_EXPIRED` | Status List Expired | Status list VC has expired |
| `...#STATUS_LIST_SIGNATURE_ERROR` | Status List Signature Error | Status list VC signature invalid |
| `...#ISSUER_NOT_REGISTERED` | Issuer Not Registered | Issuer DID not in any registry |
| `...#REGISTRY_UNCHECKED` | Registry Unchecked | Some registries couldn't be reached |

### verifyPresentation

```typescript
import { verifyPresentation } from '@digitalcredentials/verifier-core';

const result = await verifyPresentation({
  presentation,           // The VP to verify
  challenge: 'abc123',    // Optional: expected challenge
  unsignedPresentation: false,  // Optional: allow unsigned VP
  registries,             // Optional: issuer trust registries
});
```

#### Options

```typescript
interface VerifyPresentationOptions {
  presentation: unknown;
  challenge?: string | null;
  unsignedPresentation?: boolean;
  registries?: EntityIdentityRegistry[];
  additionalSuites?: VerificationSuite[];
  documentLoader?: DocumentLoader;
  cryptoSuites?: object[];
}
```

#### Result

```typescript
interface PresentationVerificationResult {
  verified: boolean;
  presentationResults: CheckResult[];
  credentialResults: CredentialVerificationResult[];
  allResults: CheckResult[];
}
```

Presentation verification does two things:

1. **Verifies the VP itself** — checks the presentation's signature (or skips if `unsignedPresentation: true`). Results go in `presentationResults`.
2. **Verifies each embedded credential** — extracts credentials from the VP and runs `verifyCredential` on each. Results go in `credentialResults`.

`verified` is `true` only if both the presentation and all embedded credentials pass. `allResults` flattens everything into a single array.

A VP needn't be signed — it can simply package credentials together. Set `unsignedPresentation: true` to skip the VP signature check.

## Custom Suites

Extend the default pipeline with custom verification logic:

```typescript
import { verifyCredential, VerificationSuite } from '@digitalcredentials/verifier-core';

const myCustomSuite: VerificationSuite = {
  id: 'custom.expiry-policy',
  name: 'Expiry Policy',
  checks: [{
    id: 'custom.expiry-policy.grace-period',
    name: 'Grace Period Check',
    fatal: false,
    execute: async (subject, context) => {
      const credential = subject.verifiableCredential as any;
      // Custom logic: allow 30-day grace period after expiration
      return { status: 'success', message: 'Within grace period.' };
    },
  }],
};

const result = await verifyCredential({
  credential,
  additionalSuites: [myCustomSuite],
});

// result.results includes checks from both default and custom suites
```

Custom suites run after the default suites. Each check receives the same `VerificationSubject` and `VerificationContext` as built-in checks.

## Architecture

For internal architecture details — verification pipeline, suite model, type system, dependencies, and architectural direction — see [`docs/architecture.md`](docs/architecture.md).

## Install

Node.js 18+ is required.

### NPM

```
npm install @digitalcredentials/verifier-core
```

### Development

```
git clone https://github.com/digitalcredentials/verifier-core.git
cd verifier-core
npm install
npm test
```

## Contribute

PRs accepted.

## License

[MIT License](LICENSE.md) © 2025 Digital Credentials Consortium.
