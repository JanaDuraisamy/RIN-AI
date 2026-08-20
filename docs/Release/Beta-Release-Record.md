# Beta Release Record — RIN AI

## Release Classification

- Product: RIN AI
- Release classification: BETA
- Scope: ratified seam-only Beta scope (Phase 8 Decision 4; Owner-approved U1-U10, R1-R3)
- Commit / HEAD: `eead405910044dc637a619c8731895a195d12d25` (main, pushed to origin)
- Record date: Phase 11 Beta Evidence + Declaration Gate

## Implemented Capabilities

- Core runtime: lifecycle, state machine, health, service registry, configuration, version, error recovery, request router
- Core restart seam: `RinCore.restart()` primitive + R3 guarded `restartSeam` (permission-gated, fail-closed, confirmation-required, content-free audit)
- Memory: CRUDQ repository, classification, authorization adapter
- Security: PermissionEvaluator sole authority, fail-closed, content-free audit, memory/persistence authorization adapters
- Persistence: AuditLog + RuntimeConfiguration only (Phase 5 boundary), MigrationRunner (versioned, transactional)
- AI Router: locked contract, implemented (routing only)
- Event Bus: publish/subscribe, implemented
- Agent Manager: seam-only (coordination boundary, no persistence, no registry)
- Upgrade Manager: read-only planning boundary + ApplyBoundary representation; no execution

## Explicitly Deferred Capabilities

- Voice / STT / TTS (U10)
- Upgrade Apply execution (BLOCKED)
- Application/deployment rollback and checkpoint (U7)
- Upgrade-state persistence (U9)
- Restart scheduling, queueing, rate limiting, concurrency semantics (NOT SPECIFIED)
- OS/process/supervisor restart (outside boundary)
- Event Bus upgrade events
- Agent Manager registration/discovery

## Explicitly Prohibited Capabilities

- Action Engine — BLOCKED — DO NOT IMPLEMENT (J2)
- Autonomous/uncontrolled self-modification (Volume-10/01)
- Autonomous restart
- Permission/audit bypass
- Contract mutation without authorization

## Test Result

- Baseline: 421/421 tests PASS, 32 test files
- pnpm verify PASS (lint, format, typecheck 9/9, build 9/9)
- Coverage reports generated for all 9 packages

## Build / Typecheck / Lint / Format Status

All PASS at HEAD `eead405`.

## Performance Evidence Result

In-process synthetic microbenchmark on the implemented boundaries (methodology, measurements, and limitations recorded in section "Performance Evidence" below). All measured boundaries operate at sub-millisecond per-operation latency except audit query, which performs a predictable linear full scan scaling with table size (no index on the query column). No documented numeric SLA exists in the repository; acceptance is an Owner decision based on the recorded evidence.

## Security Validation Result

Security validation PASS — all 15 locked security checks verified against existing tests (see Beta-Security-Validation.md). No security control weakened, no new capability added.

## Deployment / Package Interpretation

The repository itself is treated as the Beta deliverable at the final pushed commit (`eead405`). This is an explicit release-policy decision by the Owner; no Docker image, installer, registry package, or distribution artifact exists or is claimed.

## Rollback Interpretation

- Database migration rollback EXISTS: MigrationRunner per-migration transactional rollback (database-scoped).
- Application/deployment rollback is NOT implemented (deferred by U7).
- For the ratified seam-only Beta scope, migration-scoped rollback is accepted as the rollback preparedness within scope. This is a scoping decision; no application rollback mechanism is invented.

## Known Limitations

- Performance is measured in-process on one environment (Windows, Node v24.18.0); no load, stress, or endurance testing was performed.
- Audit query cost scales linearly with the audit-log table size (no index).
- No CI pipeline or automated deployment pipeline exists.
- Security validation is test-based; no penetration testing or external security audit was performed.
- No release notes other than this record exist.

## Performance Evidence

Methodology: in-process synthetic microbenchmark executed with the repository's existing vitest infrastructure against the same implementation the test suite runs. Each boundary was warmed up once before timing; per-operation cost is the mean over N iterations of a single invocation.

Environment: Windows, Node v24.18.0, x64, 8 logical CPUs.

| Boundary | N | Per-op | Throughput |
|---|---|---|---|
| Core startup (construct + initialize + start services) | 200 | 0.013 ms | 77,519 ops/s |
| Permission evaluation | 20,000 | 0.19 us | 5,198,856 ops/s |
| Restart seam, allowed (full guarded cycle incl. restart) | 30 | 0.031 ms | 31,908 ops/s |
| Restart seam, denied (fail-closed, no policy) | 5,000 | 1.69 us | 590,730 ops/s |
| Memory create | 1,000 | 0.032 ms | 31,556 ops/s |
| Memory query | 2,000 | 0.003 ms | 313,494 ops/s |
| Audit append (SQLite in-memory) | 2,000 | 23.83 us | 41,972 ops/s |
| Audit query (full scan over ~2,000 rows) | 200 | 2,961 us | 338 ops/s |
| Event Bus publish with 1 subscriber | 1,000 | 0.006 ms | 181,498 ops/s (1,001 deliveries) |
| Agent Manager seam | 10,000 | 0.65 us | 1,538,083 ops/s |
| Upgrade Manager planning boundary | 500 | 5.42 us | 184,597 ops/s |
| AI Router | 2,000 | 1.51 us | 663,218 ops/s |

Limitations: single environment; no load, stress, or endurance testing; no network or disk-backed persistence benchmark (SQLite used `:memory:`); audit query exhibits a predictable linear full-scan cost scaling with table size (no index on the query column). The repository documents performance success criteria qualitatively (Volume-07/05) and defines no numeric SLA; acceptance of the recorded evidence is an Owner decision.

## Owner / Beta Gate Decision

Per the Phase 11 Final Beta Evidence + Declaration Gate, the Owner resolves the evidence and scope decisions (B-1..B-6) as recorded in the Beta Readiness Gate Report. Final classification: PASS — RIN AI BETA READY for the ratified seam-only Beta scope.

## No-Fabrication Statement

This record claims only capabilities that are implemented and verified in the repository. Deferred and prohibited capabilities are explicitly listed as such. Performance measurements are recorded exactly as measured; no threshold is invented; the audit-query scaling limitation is disclosed.