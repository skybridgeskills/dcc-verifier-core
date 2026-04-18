# Architecture

> Internal architecture guide for developers, agents, and downstream consumers.
> For the public API and usage examples, see the [README](../README.md).

## Library overview

`@digitalcredentials/verifier-core` verifies [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
(v1, v1.1, and v2) across Node.js, browsers, and React Native. It checks structure, cryptographic
signatures, revocation/suspension status, issuer trust, and schema conformance — then returns a
structured report that lets consumers decide what "valid" means for their use case.

The library has one entry point (`src/index.ts`), and two modes:

- **Standalone wrappers** — `verifyCredential` and `verifyPresentation` for one-shot use. Each
  call constructs a fresh verifier internally; convenient when you only need a single verification.
- **Factory** — `createVerifier(config)` returns a `Verifier` whose `verifyCredential` and
  `verifyPresentation` methods share long-lived dependencies (HTTP, cache, crypto, document loader,
  registries). Use this for batch or repeated verification so issuer DID documents, status list
  credentials, and JSON-LD contexts are fetched once and reused.

## Directory structure

```
src/
├── index.ts                         Public API barrel (all exports)
├── verifier.ts                      createVerifier(config) factory + internal context builder (composition root)
├── verify-suite.ts                  Standalone verifyCredential / verifyPresentation wrappers over createVerifier
├── default-suites.ts                Internal: defaultSuites array (core → proof → status → registry → schema.obv3)
├── default-services.ts              Internal: lazy-memoized factories for default httpGetService, cacheService, cryptoServices, documentLoader
├── run-suites.ts                    Suite orchestration engine
├── extractCredentialsFrom.ts        Normalize VP's embedded credentials to array
├── declarations.d.ts                Ambient type declarations for untyped DCC packages
├── schemas/                         Zod parsing schemas
│   ├── index.ts                     Re-exports parseCredential, parsePresentation
│   ├── credential.ts                VC schema (v1 + v2 union)
│   ├── presentation.ts              VP schema
│   ├── issuer.ts                    Issuer field schema
│   ├── proof.ts                     Proof field schema
│   └── jsonld-field.ts              @context field schema
├── services/                        Ports and adapters for injectable dependencies
│   ├── cache-service/               CacheService port + InMemoryCacheService adapter
│   ├── http-get-service/            HttpGetService port + BuiltinHttpGetService (fetch-based) adapter
│   ├── data-integrity-crypto.ts     Default CryptoService implementation (Data Integrity / Linked Data Proofs)
│   ├── registry-lookup.ts           createRegistryLookup factory: builds a LookupIssuers from handlers + cache
│   └── registry-handlers/           Per-type registry handlers behind a port
│       ├── types.ts                 RegistryHandler, RegistryHandlerMap, RegistryHandlerContext
│       ├── dcc-legacy-handler.ts    DCC legacy DID-list registry
│       ├── oidf-handler.ts          OpenID Federation entity-statement registry
│       ├── vc-recognition-handler.ts Recognition VC registry (recursively verified via the parent Verifier)
│       └── cache-ttl.ts             TTL helpers (Cache-Control, validUntil)
├── suites/                          Verification suite implementations
│   ├── core/                        Structure checks (context, VC context, credential id, proof exists)
│   ├── proof/                       Cryptographic signature verification (dispatches to CryptoService)
│   ├── status/                      BitstringStatusList revocation/suspension
│   ├── registry/                    Issuer DID lookup via context.lookupIssuers
│   └── schema/obv3/                 OBv3 JSON Schema and result-ref validation
├── types/                           TypeScript type definitions
│   ├── verifier.ts                  Verifier, VerifierConfig, VerifyCredentialCall, VerifyPresentationCall
│   ├── options.ts                   VerifyCredentialOptions / VerifyPresentationOptions = VerifierConfig & VerifyXCall (compat aliases)
│   ├── check.ts                     CheckOutcome, CheckResult, VerificationCheck, VerificationSuite
│   ├── context.ts                   VerificationContext, DocumentLoader, FetchJson
│   ├── crypto-service.ts            CryptoService port
│   ├── crypto-suite.ts              CryptoSuite types (legacy LDP / Data Integrity)
│   ├── result.ts                    Result types (current + legacy)
│   ├── http.ts                      HttpGetResult
│   ├── subject.ts                   VerificationSubject
│   ├── problem-detail.ts            ProblemDetail (RFC 9457-inspired)
│   └── registry.ts                  EntityIdentityRegistry, LookupIssuers, RegistryLookupResult
└── util/                            Internal helpers
    ├── document-loader-from-http-get.ts  Build a JSON-LD loader backed by an HttpGetService
    ├── did-web-driver-with-http-get.ts   did:web resolution via HttpGetService (cache-sharing)
    ├── fetch-json-from-http-get.ts       Wrap an HttpGetService as a FetchJson
    ├── registry-key-hash.ts              Stable hash of a registry list for cache keys
    └── jwt-payload-decode.ts             Minimal JWT payload decoder (OIDF handler)
```

```
test/
├── fixtures/                            Golden VC objects for smoke / select integration tests
├── verify-credential.spec.ts            End-to-end credential verification
├── verify-presentation.spec.ts          End-to-end presentation verification
├── verifier-cache-sharing.spec.ts       Pins the perf claim: one Verifier shares caches across calls
├── smoke.spec.ts                        Networked interop regression (npm run test:smoke)
├── run-suites.spec.ts                   Suite orchestration tests
├── types.spec.ts                        Type validation tests
├── schemas.spec.ts                      Zod schema tests
├── factories/
│   ├── data/                            CredentialFactory + helpers for synthesizing test VCs
│   └── services/                        Service test doubles (FakeCryptoService, FakeHttpGetService, …)
│       ├── build-test-context.ts        buildTestContext: assemble a VerificationContext for suite unit tests
│       ├── fake-verifier.ts             Verifier test double (vc-recognition recursion seam)
│       ├── fake-http-get-service.ts     HttpGetService test double; also counts fetches per URL
│       └── …                            other Fake* factories
├── services/registry-handlers/          Handler unit tests + registry-lookup spec
├── suites/                              Suite-by-suite unit tests
└── util/                                Util unit tests
```

## Verification pipeline

```
   ┌──────────────────────────────┐
   │    createVerifier(config)    │  builds httpGetService, cacheService, cryptoServices,
   │      (composition root)      │  documentLoader, lookupIssuers — all reused per call
   └──────────────┬───────────────┘
                  │ verifier.verifyCredential(call)
                  ▼
            ┌──────────┐
            │  Parse   │  Zod schema → VerifiableCredential | parse error
            └────┬─────┘
                 │
                 ▼
            ┌──────────────────┐
            │ Internal context │  per-call build merges long-lived deps + per-call inputs
            │  (per call)      │  (registries override, additionalSuites, challenge, …)
            └────┬─────────────┘
                 │
                 ▼
            ┌──────────┐
            │  Suites  │  runSuites() → CheckResult[]
            └────┬─────┘  core → proof → status → registry → schema.obv3 (+ additionalSuites)
                 │
                 ▼
            ┌──────────┐
            │  Report  │  { verified, credential, results: CheckResult[] }
            └──────────┘
```

**Compose.** `createVerifier(config)` runs once per `Verifier` instance. It resolves long-lived
dependencies — `httpGetService`, `cacheService`, `cryptoServices`, `documentLoader`, `registries`,
per-type `registryHandlers` — falling back to internal lazy-memoized factories from
`default-services.ts` when the caller omits them. It then builds a single `lookupIssuers` keyed
to those services, and returns a `Verifier` whose methods share all of the above.

**Parse.** Zod schemas (`schemas/credential.ts`) validate the input. A parse failure produces a
synthetic `parsing.envelope` check result with a `ProblemDetail` describing what went wrong.
The credential is `unknown` on entry — callers don't need to pre-validate.

**Context.** Each `verifyCredential` / `verifyPresentation` call builds an internal
`VerificationContext` from the verifier's long-lived services plus per-call inputs (the parsed
credential or presentation, optional `additionalSuites`, optional `registries` override, optional
`challenge` / `unsignedPresentation` for VPs). The context is the seam the suites consume; it is
not a public composition point. Because `documentLoader` and `cacheService` live on the verifier,
they're shared across every call on the same instance — this is what makes batch verification
reuse fetches.

**Suites.** `runSuites()` in `run-suites.ts` iterates suites in order, running each check
sequentially. The default suite order is: **core → proof → status → registry → schema.obv3**.
Callers can append custom suites via `additionalSuites`.

**Report.** The result is a `CredentialVerificationResult`: a `verified` boolean (true if no
fatal failures) plus a flat `CheckResult[]` array. Every check that ran (or was skipped) appears
in the array, so the report is always complete.

### Presentation flow

`verifyPresentation` follows the same pipeline with two additions:

1. The VP itself is verified for its signature (proof suite with presentation-specific proof purpose).
2. Each embedded credential is extracted (`extractCredentialsFrom`) and verified individually by
   recursing into the **same `Verifier` instance** (`this.verifyCredential(...)`), so the cache,
   document loader, crypto services, and registries are automatically shared across every embedded
   VC.

The result is a `PresentationVerificationResult` with `presentationResults`, `credentialResults`,
and `allResults`.

## The Verifier factory

`createVerifier(config)` returns a `Verifier` with two methods. The split between configuration
and per-call inputs is the core of the design:

| Lives on the verifier (`VerifierConfig`)         | Per call (`VerifyCredentialCall` / `VerifyPresentationCall`)              |
|--------------------------------------------------|---------------------------------------------------------------------------|
| `httpGetService`, `cacheService`, `cryptoServices` | `credential` (or `presentation`)                                        |
| `documentLoader`, `registries`, `registryHandlers` | `additionalSuites`, `registries` (per-call override), `challenge`, `unsignedPresentation` |

Hold a `Verifier` whenever you'll perform more than one verification. The cache reuse covers
issuer DID documents (via the `CachedResolver` baked into the document loader), DCC-legacy
registry payloads, OIDF entity statements, and any data the registry handlers store under
`cacheService`.

```ts
import { createVerifier } from '@digitalcredentials/verifier-core';

const verifier = createVerifier({ registries: myRegistries });
for (const credential of batch) {
  const result = await verifier.verifyCredential({ credential });
  // ... handle ...
}
```

### Recursion through the verifier

The `vc-recognition` registry handler needs to recursively verify the recognition credential it
fetches — and it must do so through the *same* `Verifier` so the recursive call shares caches.
That creates a chicken-and-egg between `createVerifier` (which needs `lookupIssuers` to build
its context) and `createRegistryLookup` (which wants the verifier to thread into handlers).

The fix: `createVerifier` forward-declares the verifier reference, then passes
`createRegistryLookup` a `getVerifier` thunk that closes over a mutable slot. After the verifier
object is built, the slot is filled. Handlers receive the verifier through
`RegistryHandlerContext`, and `vc-recognition` passes `registries: []` to its recursive
`verifier.verifyCredential(...)` as a recursion guard.

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

| Suite              | ID            | Checks                                                                         | Fatal | Purpose                                                          |
|--------------------|---------------|--------------------------------------------------------------------------------|-------|------------------------------------------------------------------|
| Core Structure     | `core`        | `core.context-exists`, `core.vc-context`, `core.credential-id`, `core.proof-exists` | Yes  | Validates basic VC structure before crypto                       |
| Proof Verification | `proof`       | `proof.signature`                                                              | Yes   | Cryptographic signature verification dispatched via `CryptoService` |
| Credential Status  | `status`      | `status.bitstring`                                                             | No    | Revocation/suspension via BitstringStatusList                     |
| Issuer Registry    | `registry`    | `registry.issuer`                                                              | No    | Lookup issuer DID in known registries via `context.lookupIssuers` |
| OBv3 Schema        | `schema.obv3` | `schema.obv3-schema`, `schema.obv3-result-ref`                                 | No    | JSON Schema conformance for OpenBadgeCredential                  |

### Adding a custom suite

```typescript
import { createVerifier, VerificationSuite } from '@digitalcredentials/verifier-core';

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

const verifier = createVerifier();
const result = await verifier.verifyCredential({
  credential,
  additionalSuites: [myCustomSuite],
});
```

## Type system

How the public types connect:

```
VerifierConfig                       (long-lived deps: http, cache, crypto, registries, handlers, loader)
  → createVerifier()
    → Verifier
      → verifyCredential(VerifyCredentialCall)         (per-call: credential, additionalSuites, registries override)
        → internal VerificationContext                  (built per call, not exposed)
          → VerificationSubject ({ verifiableCredential })
          → VerificationSuite[]
            → VerificationCheck.execute(subject, context)
              → CheckOutcome (success | failure | skip)
                → CheckResult (suite, check, outcome, timestamp)
        → CredentialVerificationResult                  ({ verified, credential, results })
```

`verifyPresentation(VerifyPresentationCall)` follows the same shape, returning a
`PresentationVerificationResult`. Standalone `verifyCredential(opts)` /
`verifyPresentation(opts)` accept `VerifyCredentialOptions` / `VerifyPresentationOptions`, which
are simple type aliases for `VerifierConfig & VerifyXCall`.

**`ProblemDetail`** is the structured error shape, inspired by RFC 9457 but without `status`
(this is not an HTTP context). Every failure carries one or more `ProblemDetail` entries with a
`type` URI, `title`, and `detail`.

**`EntityIdentityRegistry`** is a discriminated union (`oidf` | `dcc-legacy` | `vc-recognition`)
configuring which issuer registries to check. The `oidf` variant uses OpenID Federation trust
anchors; `dcc-legacy` uses the older URL-based DCC registry format; `vc-recognition` consumes a
recognition VC issued by a trust authority.

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

| Package                                              | Role                                                                |
|------------------------------------------------------|---------------------------------------------------------------------|
| `@digitalcredentials/vc`                             | Core VC/VP signature verification (used inside `DataIntegrityCryptoService`) |
| `@digitalcredentials/jsonld-signatures`              | Linked Data Proof verification and proof purposes                    |
| `@digitalcredentials/ed25519-signature-2020`         | Ed25519Signature2020 crypto suite                                    |
| `@digitalcredentials/eddsa-rdfc-2022-cryptosuite`    | EdDSA/RDFC 2022 Data Integrity crypto suite                          |
| `@digitalcredentials/data-integrity`                 | DataIntegrityProof wrapper                                           |
| `@digitalcredentials/security-document-loader`       | Bundled JSON-LD context resolution + `CachedResolver`                |
| `@digitalcredentials/did-method-key`, `did-method-web` | DID resolution drivers used by the document loader                  |
| `@digitalcredentials/vc-bitstring-status-list`       | BitstringStatusList status checking                                   |
| `zod`                                                | Input parsing and structural validation                              |
| `ajv` / `ajv-formats`                                | JSON Schema validation for OBv3 schema checks                        |

### Test

Mocha + Chai for tests, c8 for coverage, Karma + Chrome for browser testing.

## Testing

**Runner.** Mocha with Chai assertions, compiled via `tsconfig.test.json` into `dist/test/`.
Run with `npm test` (lint + coverage via c8). Browser tests available via `npm run test-karma`.

**Structure.** Top-level specs test the public API end-to-end (`verify-credential.spec.ts`,
`verify-presentation.spec.ts`, `verifier-cache-sharing.spec.ts`). Suite-focused specs in
`test/suites/` test individual checks in isolation against a hand-built context via
`buildTestContext` (test-only helper at `test/factories/services/build-test-context.ts`).

**Fixtures.** `test/fixtures/` holds curated golden credentials for `smoke.spec.ts` and a few
integration cases. Suite tests use composable factories under `test/factories/` with fake crypto
and loaders so the default unit run stays offline.

## Architectural direction

The codebase is built around a [hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/)
(ports and adapters). The goal is a library that is environment-agnostic, thoroughly testable
without network dependencies, and composable — consumers wire in exactly the behavior they need.

### What's already hexagonal

- **`createVerifier(...)` is the composition root.** All concrete adapters
  (`HttpGetService`, `CacheService`, `CryptoService[]`, `DocumentLoader`, `RegistryHandlerMap`)
  are injectable on `VerifierConfig`; defaults live in internal lazy factories
  (`default-services.ts`) and are not exported.
- **Suites are plugins** with a uniform `VerificationCheck` interface. Adding a new check or suite
  requires no changes to the core orchestration; callers append via `additionalSuites`.
- **`VerificationContext` carries injected services** (document loader, crypto services, cache,
  registries, `lookupIssuers`). Built per call by the verifier; not a public composition point.
- **`CheckOutcome` is a clean discriminated union** (success | failure | skip) — no exceptions for
  verification failures.
- **`lookupIssuers` is built per-`Verifier`** and threaded into handlers via
  `RegistryHandlerContext`, including the verifier itself (via a thunk) so `vc-recognition` can
  recursively verify the recognition VC through the same instance with a `registries: []`
  recursion guard.
- **`RegistryHandler` is a port.** Callers can override or extend the per-type handler map by
  passing `registryHandlers` on `VerifierConfig`.
- **No dynamic imports in `src/`.** The proof suite is statically wired; recursion through the
  verifier replaced the old dynamic-import seam from `vc-recognition-handler` into `verify-suite`.

### What's not yet hexagonal

- **Proof suite** dispatches via `CryptoService.canVerify(...)` (a port), but the default
  implementation embeds `@digitalcredentials/vc` directly inside `DataIntegrityCryptoService`.
  Replacing the default crypto service requires understanding the LD-Proofs / Data Integrity
  internals.
- **Status suite** consumes `@digitalcredentials/vc-bitstring-status-list` directly and reads
  the legacy `cryptoSuites` and `verifyBitstringStatusListCredential` fields off
  `VerificationContext`. Both context fields are marked `@internal` and slated for removal once
  `bitstring-status-check` is refactored to recursively verify the status list credential through
  `Verifier.verifyCredential` instead.
- **Registry handlers** (`dcc-legacy`, `oidf`, `vc-recognition`) consume third-party clients and
  parsing libraries inline rather than through narrower ports — though they do share the verifier's
  `httpGetService` and `cacheService`, so caching and HTTP behavior are uniform.
- **OBv3 schema check** uses AJV directly. A `JsonSchemaValidator` port would let consumers swap
  in a different validator or share a single validator across calls.
- **No `Clock` port.** TTL math reads from `new Date()` / `Date.now()` directly, which makes
  time-dependent behavior awkward to test.

### Direction

With `HttpGetService`, `CacheService`, `CryptoService`, and `RegistryHandler` ports in place,
the remaining hexagonal work is:

1. Route the bitstring-status check through `Verifier.verifyCredential` (drop the direct
   `cryptoSuites` dependency on `VerificationContext`).
2. Wrap AJV behind a `JsonSchemaValidator` port (and lift the OBv3 schema check into a separate
   vertical so callers who don't care about Open Badges can drop it).
3. Introduce a `Clock` port for testable TTL behavior.

This is a direction, not a mandate. Progress is incremental — each change that moves a concrete
dependency behind an interface moves the library closer to the target architecture.
