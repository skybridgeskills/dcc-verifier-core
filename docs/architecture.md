# Architecture

> Internal architecture guide for developers, agents, and downstream consumers.
> For the public API and usage examples, see the [README](../README.md).

## Library overview

`@digitalcredentials/verifier-core` verifies [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
(v1, v1.1, and v2) across Node.js, browsers, and React Native. It checks structure, cryptographic
signatures, revocation/suspension status, issuer trust, and schema conformance — then returns a
structured report that lets consumers decide what "valid" means for their use case.

The library is consumed as a single npm package with one export entry point. Callers invoke
`verifyCredential` or `verifyPresentation` with an options object and receive a typed result.

## Directory structure

```
src/
├── index.ts                  Public API barrel (all exports)
├── verify-suite.ts           verifyCredential / verifyPresentation entry points
├── run-suites.ts             Suite orchestration engine
├── defaults.ts               Default suites, document loader, crypto suites, buildContext
├── extractCredentialsFrom.ts Normalize VP's embedded credentials to array
├── declarations.d.ts         Ambient type declarations for untyped DCC packages
├── schemas/                  Zod parsing schemas
│   ├── index.ts              Re-exports parseCredential, parsePresentation
│   ├── credential.ts         VC schema (v1 + v2 union)
│   ├── presentation.ts       VP schema
│   ├── issuer.ts             Issuer field schema
│   ├── proof.ts              Proof field schema
│   └── jsonld-field.ts       @context field schema
├── suites/                   Verification suite implementations
│   ├── core/                 Structure checks (context, VC context, credential id, proof exists)
│   ├── proof/                Cryptographic signature verification
│   ├── status/               BitstringStatusList revocation/suspension
│   ├── registry/             Issuer DID registry lookup
│   └── schema/obv3/          OBv3 JSON Schema and result-ref validation
├── types/                    TypeScript type definitions
│   ├── check.ts              CheckOutcome, CheckResult, VerificationCheck, VerificationSuite
│   ├── context.ts            VerificationContext, DocumentLoader
│   ├── options.ts            VerifyCredentialOptions, VerifyPresentationOptions
│   ├── result.ts             Result types (current + legacy)
│   ├── subject.ts            VerificationSubject
│   ├── problem-detail.ts     ProblemDetail (RFC 9457-inspired)
│   └── registry.ts           EntityIdentityRegistry (OIDF + DCC legacy)
```

```
test/
├── fixtures/                   Golden VC objects for smoke / select integration tests (inline)
├── verify-credential.spec.ts   End-to-end credential verification
├── verify-presentation.spec.ts End-to-end presentation verification
├── smoke.spec.ts               Networked interop regression (npm run test:smoke)
├── run-suites.spec.ts           Suite orchestration tests
├── types.spec.ts                Type validation tests
├── schemas.spec.ts              Zod schema tests
└── suites/
    ├── core.spec.ts             Core structure checks
    ├── proof.spec.ts            Signature verification
    ├── status.spec.ts           Status list checks
    ├── registry.spec.ts         Registry lookup checks
    └── schema-obv3.spec.ts      OBv3 schema validation
```

## Verification pipeline

```
  credential (unknown)
       │
       ▼
  ┌──────────┐
  │  Parse   │  Zod schema → VerifiableCredential | parse error
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │ Context  │  buildContext() → VerificationContext
  └────┬─────┘  (documentLoader, cryptoSuites, registries, ...)
       │
       ▼
  ┌──────────┐
  │  Suites  │  runSuites() → CheckResult[]
  └────┬─────┘  core → proof → status → registry → schema (+ additionalSuites)
       │
       ▼
  ┌──────────┐
  │  Report  │  { verified, credential, results: CheckResult[] }
  └──────────┘
```

**Parse.** Zod schemas (`schemas/credential.ts`) validate the input. A parse failure produces a
synthetic `parsing.envelope` check result with a `ProblemDetail` describing what went wrong.
The credential is `unknown` on entry — callers don't need to pre-validate.

**Context.** `buildContext()` in `defaults.ts` assembles a `VerificationContext` from sensible
defaults (security-document-loader, Ed25519 + EdDSA crypto suites) merged with caller overrides.
The context carries everything checks need: document loader, crypto suites, registries, challenge, etc.

**Suites.** `runSuites()` in `run-suites.ts` iterates suites in order, running each check
sequentially. The default suite order is: **core → proof → status → registry → schema**.
Callers can append custom suites via `additionalSuites`.

**Report.** The result is a `CredentialVerificationResult`: a `verified` boolean (true if no
failures) plus a flat `CheckResult[]` array. Every check that ran (or was skipped) appears in the
array, so the report is always complete.

### Presentation flow

`verifyPresentation` follows the same pipeline with two additions:
1. The VP itself is verified for its signature (proof suite with presentation-specific proof purpose).
2. Each embedded credential is extracted (`extractCredentialsFrom`) and verified individually via
   `verifyCredential`, reusing the same registries and loader configuration.

The result is a `PresentationVerificationResult` with `presentationResults`, `credentialResults`,
and `allResults`.

## Suites and checks

A **suite** is a named, ordered collection of **checks**. A **check** is an async function that
receives a `VerificationSubject` and `VerificationContext` and returns a `CheckOutcome`.

```
VerificationCheck.execute(subject, context)
       │
       ▼
CheckOutcome
  ├── { status: 'success', message }
  ├── { status: 'failure', problems: ProblemDetail[] }
  └── { status: 'skipped', reason }
       │
       ▼
CheckResult: { suite, check, outcome, timestamp }
```

### Key behaviors

- **`appliesTo`** limits a check to credential-only or presentation-only subjects. If unset, the
  check runs for both.
- **`fatal`** on a check means a failure stops remaining checks *in that suite only*. Later suites
  still run. This ensures the report is always complete.
- **Failures** carry `ProblemDetail[]` — RFC 9457-inspired structured errors with `type` (URI),
  `title`, and `detail`.
- **Skips** carry a `reason` string explaining why (e.g. "Credential has no credentialStatus").

### Default suites

| Suite | ID | Checks | Fatal | Purpose |
|-------|----|--------|-------|---------|
| Core Structure | `core` | `core.context-exists`, `core.vc-context`, `core.credential-id`, `core.proof-exists` | Yes | Validates basic VC structure before crypto |
| Proof Verification | `proof` | `proof.signature` | Yes | Cryptographic signature verification via `@digitalcredentials/vc` |
| Credential Status | `status` | `status.bitstring` | No | Revocation/suspension via BitstringStatusList |
| Issuer Registry | `registry` | `registry.issuer` | No | Lookup issuer DID in known registries |
| OBv3 Schema | `schema.obv3` | `schema.obv3-schema`, `schema.obv3-result-ref` | No | JSON Schema conformance for OpenBadgeCredential |

### Adding a custom suite

```typescript
import { verifyCredential, VerificationSuite } from '@digitalcredentials/verifier-core';

const myCustomSuite: VerificationSuite = {
  id: 'custom',
  name: 'My Custom Checks',
  checks: [{
    id: 'custom.my-check',
    name: 'My Check',
    fatal: false,
    execute: async (subject, context) => {
      // ... your logic ...
      return { status: 'success', message: 'Check passed.' };
    },
  }],
};

const result = await verifyCredential({
  credential,
  additionalSuites: [myCustomSuite],
});
```

## Type system

The key types and how they connect:

```
VerifyCredentialOptions          (caller input — credential, registries, suites, loader, crypto)
  → buildContext()
    → VerificationContext         (injected services — documentLoader, cryptoSuites, registries)
  → VerificationSubject          ({ verifiableCredential? | verifiablePresentation? })
  → VerificationSuite[]
    → VerificationCheck.execute(subject, context)
      → CheckOutcome             (success | failure | skip)
        → CheckResult            (tagged: suite, check, outcome, timestamp)
  → CredentialVerificationResult ({ verified, credential, results: CheckResult[] })
```

**`ProblemDetail`** is the structured error shape, inspired by RFC 9457 but without `status`
(this is not an HTTP context). Every failure carries one or more `ProblemDetail` entries with a
`type` URI, `title`, and `detail`.

**`EntityIdentityRegistry`** is a discriminated union (`oidf` | `dcc-legacy`) configuring which
issuer registries to check. The `oidf` variant uses OpenID Federation trust anchors; `dcc-legacy`
uses the older URL-based DCC registry format.

## Result models

The codebase has two result shapes:

**Current** (`CredentialVerificationResult` / `PresentationVerificationResult`):
Suite-based, using `CheckResult[]` with typed `CheckOutcome` discriminated unions. This is what
`verifyCredential` and `verifyPresentation` return.

**Legacy** (`VerificationResponse` / `PresentationVerificationResponse`):
Older `log[]` / `errors[]` shape with `valid` booleans per step. Still exported from `types/result.ts`
for backward compatibility but not produced by the current verification functions.

When reading tests or downstream code, look for which result shape is in use. The `CheckResult[]`
model is the current and intended shape going forward.

## Dependencies

### Runtime

| Package | Role |
|---------|------|
| `@digitalcredentials/vc` | Core VC/VP signature verification |
| `@digitalcredentials/jsonld-signatures` | Linked Data Proof verification and proof purposes |
| `@digitalcredentials/ed25519-signature-2020` | Ed25519Signature2020 crypto suite |
| `@digitalcredentials/eddsa-rdfc-2022-cryptosuite` | EdDSA/RDFC 2022 Data Integrity crypto suite |
| `@digitalcredentials/data-integrity` | DataIntegrityProof wrapper |
| `@digitalcredentials/security-document-loader` | Cached JSON-LD context resolution |
| `@digitalcredentials/vc-bitstring-status-list` | BitstringStatusList status checking |
| `@digitalcredentials/issuer-registry-client` | Issuer DID registry lookups (OIDF + legacy) |
| `zod` | Input parsing and structural validation |
| `ajv` / `ajv-formats` | JSON Schema validation for OBv3 schema checks |

### Test

Mocha + Chai for tests, c8 for coverage, Karma + Chrome for browser testing.

## Testing

**Runner.** Mocha with Chai assertions, compiled via `tsconfig.test.json` into `dist/test/`.
Run with `npm test` (lint + coverage via c8). Browser tests available via `npm run test-karma`.

**Structure.** Top-level specs test the public API end-to-end (`verify-credential.spec.ts`,
`verify-presentation.spec.ts`). Suite-focused specs in `test/suites/` test individual checks
in isolation.

**Fixtures.** `test/fixtures/` holds curated golden credentials for `smoke.spec.ts` and a few
integration cases. Suite tests use composable factories under `test/factories/` with fake crypto
and loaders so the default unit run stays offline.

## Architectural direction

The codebase is moving toward a [hexagonal architecture](https://alistaiarcockburn.com/hexagonal-architecture/)
(ports and adapters). The goal is a library that is environment-agnostic, thoroughly testable without
network dependencies, and composable — consumers wire in exactly the behavior they need.

### What's already hexagonal

- **Suites are plugins** with a uniform `VerificationCheck` interface. Adding a new check or suite
  requires no changes to the core orchestration.
- **`VerificationContext` carries injected services** (document loader, crypto suites, registries).
  Callers can override any default.
- **`buildContext()` is a composition point** where external adapters meet core logic.
- **`CheckOutcome` is a clean discriminated union** (success | failure | skip) — no exceptions for
  verification failures.

### What's not yet hexagonal

- **Proof suite** imports `@digitalcredentials/vc` directly rather than going through a port
  interface like `CryptoService`.
- **Status suite** calls `@digitalcredentials/vc-bitstring-status-list` directly — not injected.
- **Registry suite** instantiates `RegistryClient` at module scope — a concrete dependency.
- **No `HttpService` or `Clock` ports** — HTTP calls are embedded in adapters, and time comes from
  `new Date()`.
- **Tests use real crypto** with pre-signed fixtures instead of injecting a mock `CryptoService`.

### Direction

- Extract remaining concrete dependencies behind port interfaces (`HttpService`, `CryptoService`,
  `Clock`, `TrustedIssuerRegistry`).
- Make `VerificationContext` the single seam carrying all adapters.
- Enable fixture-based testing without real crypto via injected services.
- Keep suites as independently testable units with the Pass | Fail | Skip contract.

This is a direction, not a mandate. Progress is incremental — each change that moves a concrete
dependency behind an interface moves the library closer to the target architecture.
