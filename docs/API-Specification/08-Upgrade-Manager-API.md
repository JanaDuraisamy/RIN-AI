# Upgrade Manager API

## Introduction

The Upgrade Manager API defines the official engineering contract boundary for the subsystem responsible for orchestrating controlled, owner-authorized upgrades of the RIN runtime.

The RIN ecosystem evolves through planned, validated, and traceable software updates (Volume-09/08 Update Management, preserved intact).

This specification documents ONLY the minimal boundary contract derived from Phase 9 Steps 1-4 study evidence and the Owner-approved Phase 9 Step 3 decisions U1-U10. It was formally locked under Phase 9 Step 8 contract lock. Contract authoring and contract lock do not authorize implementation.

---

# Purpose

The purpose of the Upgrade Manager API is to provide a documented, versioned, and maintainable boundary contract for owner-requested upgrades:

- Upgrade request representation
- Upgrade target and release metadata representation
- Compatibility inspection
- Permission-aware and confirmation-required planning
- Boundary statements for apply, restart, verification, and rollback

This contract binds the documented Update Management boundary without inventing execution, distribution, or self-modification semantics.

---

# Responsibilities

Documented responsibilities (Volume-09/08 Update Management chapter, preserved intact):

- Version Management
- Update Planning
- Compatibility Validation
- Migration Management
- Rollback Coordination
- Release Documentation
- Update Verification
- Lifecycle Maintenance

Classification: DOCUMENTED (narrative).

---

# API Categories

Proposed contract surfaces (Section #UpgradeRequest Boundary through #Self-Modification Safety below):

1. UpgradeRequest
2. UpgradeTarget / ReleaseMetadata
3. CompatibilityCheck
4. Permission
5. Confirmation
6. UpgradePlan
7. Preflight
8. Backup / Checkpoint
9. Apply
10. Migration Integration
11. Verification
12. Restart
13. Health
14. Rollback / Recovery
15. Audit

Each surface is classified individually below. No surface is authorized for implementation by this document.

---

# Request / Response Principles

Documented request principles (03-Agent-API.md request principles and RouterRequest precedent, when applicable): request identifier, timestamp, calling component, authentication context, input, trace identifier, target version reference.

Documented response principles (CoreApiResponse pattern, when applicable): status, result, error information, execution time, version information.

Classification: DOCUMENTED (narrative) / DERIVED (envelope patterns).

---

# Upgrade Authority

LOCKED ARCHITECTURE DIRECTION (Phase 9 Step 3 Decision U1; ratified at Phase 9 Step 8 contract lock):

- A future dedicated Upgrade/Update Manager owns end-to-end upgrade orchestration.
- Core owns:
  - runtime lifecycle (RuntimeLifecycle, @rin/core)
  - runtime version reporting (VersionService, @rin/core)
  - restart (Core API Runtime Lifecycle responsibility, 01-Core-API.md)
  - lifecycle / re-initialization primitives
- The AI Router remains request-routing only. No upgrade orchestration in the Router.
- The Agent Manager remains unchanged and has no upgrade responsibility.
- Security remains PermissionEvaluator authority with fail-closed authorization.

Classification: LOCKED ARCHITECTURE DIRECTION (ratified Phase 9 Step 8). Does NOT authorize Upgrade Manager implementation.

---

# UpgradeRequest Boundary

The request envelope follows the evidence-backed RouterRequest pattern (locked @rin/types contract):

| Member | Source | Classification |
|---|---|---|
| requestId | RouterRequest | DERIVED (locked envelope) |
| timestamp | RouterRequest | DERIVED |
| callingComponent | RouterRequest | DERIVED |
| authContext | RouterRequest | DERIVED (opaque) |
| input | RouterRequest | DERIVED (opaque) |
| traceId | RouterRequest | DERIVED (where available) |
| target version reference | Proposed | PROPOSED (upgrade-specific reference; shape NOT SPECIFIED) |

No detailed execution payloads are defined. No task, package, file, or distribution payload fields exist.

Classification: DERIVED (envelope) / PROPOSED (upgrade-specific reference).

---

# UpgradeTarget / ReleaseMetadata

Represents the Owner-approved U6 direction and repository-supported release concepts:

| Member | Source | Classification |
|---|---|---|
| target semantic version | Volume-03/01 semantic versioning; U6 | OWNER-APPROVED CONTRACT DIRECTION |
| release stage | Volume-09/09 release taxonomy (Alpha/Beta/RC/Stable) | DOCUMENTED (taxonomy) / PROPOSED (field) |
| compatibility information | VersionService CompatibilityInfo pattern | DERIVED (pattern) / PROPOSED (field) |
| required migration information | MigrationRunner versioned migrations | DERIVED (pattern) / PROPOSED (field) |
| release notes / reference | Volume-09/08 release content list | DOCUMENTED (narrative) / PROPOSED (field) |
| integrity information | none | UNRESOLVED (mechanism and format NOT SPECIFIED) |
| rollback source / reference | Volume-08/11, Database-Specification/05 backup policy | DOCUMENTED (policy basis) / PROPOSED (field); format UNRESOLVED |

No cryptographic signing algorithm, registry, package repository, update server, distribution protocol, or download mechanism is chosen or invented.

Classification: LOCKED CONTRACT DIRECTION (U6, ratified Phase 9 Step 8; fields PROPOSED; integrity and rollback-source formats UNRESOLVED).

---

# Version Compatibility

The conceptual boundary derives from VersionService (locked @rin/core implementation):

- current runtime/application version
- current API version
- minimum API compatibility
- target compatibility
- migration requirements

Version concepts remain separate (Owner Decision U4):

1. RIN runtime/application version — semantic version
2. API version — compatibility version
3. Package versions — package-level versions
4. Database schema version — migration version

The compatibility relationship between these concepts must be described by this contract's future revision; no universal version number exists and none is invented.

Classification: LOCKED (VersionService primitives) / LOCKED (U4 separation, ratified Phase 9 Step 8) / PROPOSED (target compatibility boundary).

---

# Permission Boundary

- Every protected operation shall pass through the PermissionEvaluator before execution (locked mechanism).
- Behavior remains fail-closed: no policy means denied.
- Denied: no execution, reject safely.
- Confirmation-required: no execution without explicit approval.
- Restricted: no execution.
- Permission-unavailable: no execution.

LOCKED taxonomy (Phase 9 Step 3 Decision U2; formally ratified at Phase 9 Step 8 contract lock):

- action: upgrade:plan
- action: upgrade:apply
- resource: upgrade

No additional upgrade action or resource strings exist. The taxonomy is LOCKED. It does not authorize arbitrary upgrade execution.

Classification: DOCUMENTED (mechanism and fail-closed behavior) / LOCKED (taxonomy, ratified Phase 9 Step 8).

---

# Confirmation Boundary

LOCKED CONFIRMATION POLICY (Phase 9 Step 3 Decision U3; ratified at Phase 9 Step 8 contract lock):

- Version inspection requires no confirmation.
- Compatibility inspection requires no confirmation.
- Pure planning requires no confirmation.
- Actual upgrade application is a confirmation-required high-impact operation requiring explicit Owner confirmation immediately before execution.
- A voice request does NOT automatically count as final confirmation for a high-impact upgrade unless a future contract explicitly changes this policy.

The confirmation-required permission category is a locked PermissionEvaluator category (Volume-08/03 Authorization-Permission System: operations requiring explicit approval before execution).

Classification: LOCKED (category mechanism) / LOCKED (policy, ratified Phase 9 Step 8).

---

# Upgrade Plan

Represents the documented Update Management lifecycle at boundary level:

REQUEST → CLASSIFY → PERMISSION → CONFIRMATION → PLAN → PRECHECK → BACKUP → APPLY → MIGRATE → VERIFY → RESTART → HEALTH → SUCCESS / ROLLBACK

Evidence: Volume-09/08 Update Lifecycle Stages 1-8 (Improvement Identified, Engineering Planning, Implementation, Testing & Validation, Compatibility Verification, Deployment, Post-Update Monitoring, Engineering Review) and the Owner-approved U10 conceptual flow.

No implementation algorithms, ordering guarantees beyond documented evidence, concurrency, retries, timeouts, cancellation, or execution semantics are defined.

Classification: DOCUMENTED (narrative lifecycle) / LOCKED (U10 flow, ratified Phase 9 Step 8) / PROPOSED (boundary).

---

# Preflight Checks

Documented Update Management stage (Volume-09/08 Update Lifecycle: Compatibility Verification and pre-deployment validation).

- Compatibility checks: DOCUMENTED (narrative).
- Migration requirements: DERIVED (MigrationRunner versioning pattern).
- Package/dependency checks: NOT SPECIFIED (no package-management contract exists).
- Integrity checks: NOT SPECIFIED (integrity mechanism unresolved).

Classification: DOCUMENTED (narrative) / PROPOSED (boundary).

---

# Backup / Checkpoint Boundary

- Backup policy: DOCUMENTED (Volume-08/11 Backup-Recovery; Database-Specification/05, including schema-version-aware backups).
- Database restore policy: DOCUMENTED (Database-Specification/05 disaster recovery).
- Checkpoint: NOT SPECIFIED (no checkpoint concept exists in repository evidence).
- Application-level rollback: NOT SPECIFIED as a contract (policy law only; Volume-09/04, Volume-09/08).

Important distinction (Owner Decision U7):

- Database migration rollback is NOT application-level upgrade rollback.
- MigrationRunner rollback remains database-scoped.

Classification: DOCUMENTED (backup/restore policy) / LOCKED (U7 distinction, ratified Phase 9 Step 8) / NOT SPECIFIED (checkpoint) / DEFERRED (application-level rollback contract).

---

# Apply Boundary

This section is a boundary statement only.

- Execution is: OWNER-APPROVED DIRECTION (U5 controlled-upgrade exception path), BLOCKED / NOT IMPLEMENTABLE (Action Engine chapter truncated, Volume-06/06; no execution mechanism exists), and PROHIBITED for uncontrolled self-modification (Volume-10/01: "Artificial Intelligence shall improve through engineering validation rather than uncontrolled self-modification").

No executor, updater, downloader, installer, package manager, or registry client is defined.

Classification: OWNER-APPROVED DIRECTION (U5, ratified Phase 9 Step 8) / BLOCKED (execution) / PROHIBITED (uncontrolled self-modification).

---

# Migration Integration

- The database migration mechanism is the locked MigrationRunner (persistence/src/migrations.ts): versioned, ordered, idempotent, transactional per migration, database-scoped rollback on failure, audited per migration.
- MigrationRunner is NOT modified by this contract.
- Application-version-to-schema-version mapping: NOT SPECIFIED — described as a future contract requirement (Owner Decision U4).

Classification: LOCKED (mechanism) / NOT SPECIFIED (version linkage).

---

# Verification

- Release validation: DOCUMENTED (Volume-07/10 Release Validation taxonomy: Alpha/Beta/RC/Stable with success criteria).
- Runtime checklist (startup, shutdown, recovery, monitoring, logging): DOCUMENTED (Volume-07/10).
- Verification result boundary: PROPOSED (derived from CoreApiResponse envelope pattern).

Classification: DOCUMENTED (policy) / DERIVED (envelope) / PROPOSED (result boundary).

---

# Restart Boundary

LOCKED ARCHITECTURE DIRECTION (Phase 9 Step 3 Decision U8; ratified at Phase 9 Step 8 contract lock):

- Core owns runtime restart.
- Future conceptual semantics: graceful shutdown → runtime re-initialization.
- Existing shutdown safety principles preserved (Volume-06/02 Graceful Shutdown: stop new requests, finish active tasks, save runtime state, flush logs, close resources, shutdown Core).

Current state: "Restart Runtime" is documented as a Core API Runtime Lifecycle responsibility (01-Core-API.md) but is NOT implemented in RuntimeLifecycle (graceful-shutdown is terminal; reset() re-initializes the lifecycle object only).

Classification: LOCKED (direction, ratified Phase 9 Step 8) / NOT IMPLEMENTED / DEFERRED (restart implementation).

---

# Health Check

- Health monitoring: DOCUMENTED and implemented (Volume-06/13; @rin/core health monitoring; locked HealthState and RuntimeState types).
- Post-upgrade health check: DERIVED (locked health types) / PROPOSED (upgrade-specific boundary).

Classification: LOCKED (health primitives) / PROPOSED (post-upgrade boundary).

---

# Success / Failure / Result Envelope

The result envelope follows the established CoreApiResponse-compatible pattern:

| Member | Source | Classification |
|---|---|---|
| status | success or error outcome | DERIVED (CoreApiResponse) |
| result | Result content | DERIVED — shape NOT SPECIFIED, deferred |
| error | Error envelope or null | DERIVED ({ code, message, traceId } locked CoreApiError pattern) |
| execution time | Execution duration | DERIVED (CoreApiResponse) |
| version | API version | DERIVED (CoreApiResponse) |

Upgrade-specific error codes are PROPOSED / DEFERRED and are not locked in this specification. Error messages shall not leak internal policy, credentials, secrets, or release payload details.

Classification: DERIVED (envelope patterns).

---

# Rollback / Recovery

- Database migration rollback: LOCKED (MigrationRunner per-migration transaction rollback).
- Database backup and restore: DOCUMENTED policy.
- Application-level upgrade rollback: NOT SPECIFIED as a contract; DEFERRED (Owner Decision U7).
- Runtime checkpoint: NOT SPECIFIED.
- Failed-upgrade recovery: NOT SPECIFIED (Error Recovery chapter Volume-06/14 truncated; ErrorCoordinator supports retry/recover/safe-mode only — no restore strategy).

Database rollback is not application rollback. Rollback implementation is not authorized.

Classification: LOCKED (migration rollback) / DOCUMENTED (policy) / DEFERRED (application rollback contract) / NOT SPECIFIED (checkpoint, failed-upgrade recovery).

---

# Audit Boundary

- Audit behavior follows the locked content-free AuditSink and AuditEntry contracts.
- Audit entries shall not contain task content, memory content, credentials, secrets, source-code contents, release payloads, or internal policy details.
- Single audit entry per request follows the AI Router implementation precedent.
- requestId = traceId where available follows the AI Router precedent.

Upgrade-specific audit actor/action/resource mapping follows the LOCKED U2 taxonomy (action upgrade:plan / upgrade:apply, resource upgrade), ratified at Phase 9 Step 8 contract lock. No additional audit strings exist.

Classification: DOCUMENTED (content-free contract) / DERIVED (single-entry and requestId patterns) / LOCKED (upgrade mapping, ratified Phase 9 Step 8).

---

# Shared Context

- The Upgrade Manager reuses the locked RouterContext boundary for any context received from the AI Router (07-AI-Router-API.md Agent Manager Boundary precedent, extended by Owner Decision U1).
- No new context fields are added.

Classification: DERIVED FROM LOCKED CONTRACT (RouterContext reuse).

---

# AI Router Boundary

- The AI Router is request-routing only (Owner Decision U1).
- An upgrade request may enter the architecture as opaque RouterRequest input through the existing directional seam.
- No upgrade orchestration in the Router.
- No new Router fields are introduced beyond the existing RouterRequest envelope.

Classification: LOCKED (RouterRequest envelope and routing boundary) / LOCKED (routing-only direction, U1, ratified Phase 9 Step 8).

---

# Persistence Boundary

- The Phase 5 persistence boundary remains unchanged: AuditLog and RuntimeConfiguration only.
- Upgrade-state persistence is DEFERRED (Owner Decision U9): no upgrade-state tables, upgrade history tables, checkpoint tables, rollback metadata tables, new persistence fields, or new migrations.
- Backup metadata may be considered in a future contract; no persistence expansion is authorized now.

Classification: LOCKED (Phase 5 boundary) / LOCKED DEFERMENT (U9, ratified Phase 9 Step 8).

---

# Event Bus Boundary

- The generic Event Bus mechanism is locked (EventBus publish/subscribe contract, @rin/types).
- No upgrade event names, event payloads, publishers, or subscriptions are defined by this specification.

Classification: LOCKED (mechanism) / NOT SPECIFIED / DEFERRED (upgrade events).

---

# Self-Modification Safety

- Autonomous/uncontrolled self-modification remains PROHIBITED (Volume-10/01: "Artificial Intelligence shall improve through engineering validation rather than uncontrolled self-modification"; Volume-06/09: "No plugin shall modify the RIN Core directly").
- A controlled upgrade is permitted only through an explicitly authorized mechanism that is (Owner Decision U5): owner-authorized, permission-gated, confirmation-required for apply, contract-bounded, preflighted, backed up, verified, restarted through Core, health-checked, and rollback-capable.

Still prohibited:

- autonomous source rewriting
- uncontrolled dependency installation
- arbitrary package replacement
- security bypass
- audit bypass
- contract mutation without authorization
- autonomous upgrades

Classification: PROHIBITED (autonomous self-modification) / LOCKED POLICY DIRECTION (controlled upgrade exception path, ratified Phase 9 Step 8).

---

# Engineering Principles

The original Upgrade Manager Engineering Principles are not recoverable as a dedicated section from repository evidence.

The Update Management narrative principles (planned, validated, traceable updates; compatibility preservation; engineering responsibility rather than software replacement; disciplined evolution rather than uncontrolled updates, Blueprint 15-BP-011) are recorded in Volume-09/08 and Blueprint material. They remain narrative and are NOT elevated to contract principle without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Engineering Laws

The original Upgrade Manager Engineering Laws are not recoverable as a dedicated section from repository evidence.

The Update Management narrative laws (Volume-09/08 Engineering Laws, lines 208-238) and deployment rollback law (Volume-09/04: "Rollback capability shall remain available") remain narrative and are NOT elevated to contract law without owner authority.

Classification: UNRESOLVED AUTHORITY / NOT AUTHORIZED AS LAW.

---

# Best Practices

The original Best Practices section is not recoverable from repository evidence.

The Update Management narrative best practices (maintain semantic versioning, preserve compatibility, document migration procedures) remain narrative references only.

Classification: UNRESOLVED (narrative reference only).

---

# Anti-Patterns

The original Anti-Patterns section is not recoverable from repository evidence.

The Update Management narrative anti-patterns (ignoring rollback planning; uncontrolled updates) remain narrative references only.

Classification: UNRESOLVED (narrative reference only).

---

# Engineering Checklist

The original Engineering Checklist section is not recoverable from repository evidence.

The Volume-07/10 Release Validation runtime checklist (startup, shutdown, recovery, monitoring, logging verified) provides narrative checklist content only.

Classification: UNRESOLVED (narrative reference only).

---

# Future Evolution

The original Future Evolution section is not recoverable as a dedicated section from repository evidence.

The Update Management narrative future evolution (intelligent update recommendations, differential updates, automated compatibility analysis, predictive update risk assessment, autonomous update validation — Volume-09/08) remains narrative. Autonomous update validation remains future vision, NOT authorized behavior.

Classification: UNRESOLVED (narrative reference only) / DEFERRED (autonomous evolution).

---

# Owner Decision Boundary

The following decisions were resolved by the Primary Owner during Phase 9 Step 3 Owner Decision Resolution and formally ratified (locked) during Phase 9 Step 8 contract lock:

## Decision U1: Upgrade Authority

Resolution: HYBRID ARCHITECTURE. A future dedicated Upgrade/Update Manager owns end-to-end upgrade orchestration. Core owns runtime lifecycle, runtime version reporting, restart, and lifecycle/re-initialization primitives. AI Router remains request-routing only. Agent Manager remains unchanged. Security remains PermissionEvaluator authority with fail-closed authorization.

Evidence: Core VersionService and RuntimeLifecycle implemented; Core API Runtime Lifecycle and Version API documented; Volume-09/08 Update Management responsibilities; Phase 9 Step 1/2 authority analysis.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (architecture direction; does not authorize implementation).

## Decision U2: Upgrade Permission Taxonomy

Resolution: minimal dedicated taxonomy approved as proposed beta defaults: action upgrade:plan; action upgrade:apply; resource upgrade. No additional upgrade action/resource strings. Values remain PROPOSED until formal contract-lock ratification. PermissionEvaluator remains the sole authority; fail-closed unchanged.

Status: LOCKED — FORMALLY RATIFIED PHASE 9 STEP 8 (exact strings: action upgrade:plan; action upgrade:apply; resource upgrade).

## Decision U3: Confirmation Policy

Resolution: Upgrade APPLY is a confirmation-required high-impact operation. Inspection and pure planning require no confirmation. Actual application requires explicit Owner confirmation immediately before execution. A voice request does not automatically count as final confirmation.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (confirmation policy).

## Decision U4: Version Model

Resolution: version concepts remain separate: runtime/application version (semantic), API version (compatibility), package versions, database schema migration version. The future contract must describe compatibility relationships. No universal version number.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (version model separation).

## Decision U5: Self-Modification Policy

Resolution: autonomous/uncontrolled self-modification remains PROHIBITED. A controlled upgrade is permitted only through an explicitly authorized mechanism that is owner-authorized, permission-gated, confirmation-required for apply, contract-bounded, preflighted, backed up, verified, restarted through Core, health-checked, and rollback-capable. Autonomous source rewriting, uncontrolled dependency installation, arbitrary package replacement, security bypass, audit bypass, contract mutation without authorization, and autonomous upgrades remain prohibited.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (self-modification boundary).

## Decision U6: Target Release Metadata + Integrity

Resolution: a future upgrade target contract must minimally represent target semantic version, release stage, compatibility information, required migration information, release notes/reference, integrity information, and rollback source/reference. No cryptographic signing algorithm, registry, package repository, update server, distribution protocol, or download mechanism is chosen. Integrity mechanism remains a future contract decision.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (target metadata direction; integrity mechanism and rollback source format remain UNRESOLVED / future contract decisions).

## Decision U7: Rollback / Checkpoint

Resolution: future upgrade safety requires a backup/checkpoint boundary and application-level rollback capability. Database migration rollback is not application-level upgrade rollback. MigrationRunner rollback remains database-scoped. Application-level rollback must be separately defined. No checkpoint storage, application rollback, restore execution, new persistence tables, or new migrations.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (rollback distinction; application-level rollback and checkpoint implementation DEFERRED / NOT SPECIFIED).

## Decision U8: Restart

Resolution: Core owns runtime restart. Future semantics: graceful shutdown to runtime re-initialization. Existing shutdown safety principles preserved. Restart not implemented in this step; no lifecycle states or transitions added.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (Core restart ownership and semantics direction; restart implementation DEFERRED / NOT IMPLEMENTED; RuntimeLifecycle.reset() is NOT a full runtime restart).

## Decision U9: Upgrade State Persistence

Resolution: DEFER. No upgrade-state, upgrade history, checkpoint, or rollback metadata tables; no new persistence fields; no new migrations. Phase 5 persistence boundary unchanged. Backup metadata may be considered in a future contract.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (persistence deferment; Phase 5 persistence boundary unchanged: AuditLog and RuntimeConfiguration only).

## Decision U10: Voice / Hands-Free UX

Resolution: future conceptual flow: voice request → classify → permission → explain/prepare → explicit Owner confirmation → plan → preflight → backup → apply → migrate → verify → restart → health check → success or rollback. The voice request is not automatically final confirmation. No Voice API, STT/TTS contract, voice intent schema, or device-control implementation is created.

Status: LOCKED — RATIFIED PHASE 9 STEP 8 (product / UX direction; implementation DEFERRED).

---

# Contract Lock Table

| Area | State | Classification | Evidence | Owner Approval |
|---|---|---|---|---|
| Upgrade authority | Direction | LOCKED ARCHITECTURE DIRECTION (U1) | U1; Core lifecycle/version; Volume-09/08 | Ratified Phase 9 Step 8 |
| Request envelope | Locked precedent | DERIVED (LOCKED) | RouterRequest | Existing |
| Response envelope | Locked precedent | DERIVED (LOCKED) | CoreApiResponse | Existing |
| Error envelope | Locked precedent | DERIVED (LOCKED) | CoreApiError | Existing |
| Permission mechanism | Locked | DOCUMENTED (LOCKED) | PermissionEvaluator, fail-closed | Existing |
| Permission strings | Locked | LOCKED — FORMALLY RATIFIED (U2) | U2 (upgrade:plan; upgrade:apply; upgrade) | Ratified Phase 9 Step 8 |
| Confirmation policy | Locked | LOCKED (U3) | U3; confirmation-required category | Ratified Phase 9 Step 8 |
| Version model separation | Locked | LOCKED (U4) | U4; VersionService | Ratified Phase 9 Step 8 |
| Version compatibility relationship | Open | NOT SPECIFIED | none | Not applicable |
| Self-modification policy | Locked | LOCKED (U5) | U5; Volume-10/01 prohibition | Ratified Phase 9 Step 8 |
| Target metadata direction | Direction | LOCKED (U6) | U6; Volume-09/08 release content list | Ratified Phase 9 Step 8 |
| Integrity mechanism | Open | UNRESOLVED / NOT SPECIFIED | none | Future contract decision |
| Rollback source format | Open | UNRESOLVED / NOT SPECIFIED | backup policy basis only | Future contract decision |
| Migration mechanism | Locked | DOCUMENTED (LOCKED) | MigrationRunner | Existing |
| App-version to schema-version linkage | Open | NOT SPECIFIED | none | Future contract requirement |
| Restart semantics | Direction | LOCKED (U8; Core-owned); implementation DEFERRED / NOT IMPLEMENTED | U8; 01-Core-API.md Restart Runtime | Ratified Phase 9 Step 8 |
| Apply execution | Closed | BLOCKED / PROHIBITED (uncontrolled) | Volume-06/06 truncated; Volume-10/01 | Not applicable |
| Application rollback | Open | DEFERRED / NOT SPECIFIED | rollback policy law only | Ratified Phase 9 Step 8 (U7 direction) |
| Checkpoint | Open | NOT SPECIFIED | none | Not applicable |
| Upgrade-state persistence | Deferred | LOCKED DEFERMENT (U9) | U9; Phase 5 lock | Ratified Phase 9 Step 8 |
| Event Bus integration | Open | DEFERRED | directional statement only | Not applicable |
| Voice / hands-free flow | Direction | LOCKED PRODUCT / UX DIRECTION (U10); implementation DEFERRED | U10; Volume-06/05 narrative | Ratified Phase 9 Step 8 |
| Action Engine contract | Closed | BLOCKED | Volume-06/06 truncated | Not applicable |
| Implementation lock | Locked | RATIFIED (Phase 9 Step 14) | Phase 9 Step 13 review PASS | Ratified Phase 9 Step 14 |

Distinction convention: LOCKED = contract/policy locked (Phase 9 Step 8 or previously); DEFERRED = implementation deferred; NOT SPECIFIED = mechanism unspecified; BLOCKED = subsystem blocked.

---

# Implementation Gate

Contract authoring does not authorize implementation.

Contract locking does not authorize implementation.

Phase 9 Step 7 contract review: PASS.
Phase 9 Step 8 contract lock: COMPLETED (U1-U10 ratified; U2 taxonomy formally locked; constitution ratified within approved scope).

Upgrade Manager implementation remains blocked until:

1. Remaining unresolved contract decisions (integrity mechanism, rollback source format, version linkage, checkpoint semantics, application-level rollback contract, upgrade event names, upgrade error codes) are resolved or explicitly deferred.
2. Implementation scope is separately authorized by the Primary Owner.

The locked contract must NOT be interpreted as permission to: create an Upgrade Manager package; add an upgrade executor; modify Core; implement restart; implement rollback; implement checkpoint; modify persistence; add Event Bus events; implement Voice; implement Action Engine; or enable autonomous self-modification.

The locked minimal boundary is limited to the boundary representation described by this contract. upgrade:plan and upgrade:apply do not authorize arbitrary upgrade execution. Any future protected operation requires its own explicitly authorized taxonomy.

---

# Implementation History

## Phase 9 Step 12 — Minimal Implementation

Status: COMPLETED (separately authorized by the Primary Owner; minimal read-only boundary representation implementation only).

- Package: @rin/upgrade-manager, exactly the 7 authorized files.
- 61 new tests; 408/408 total tests passing; pnpm verify PASS; overall coverage 97.86%; upgrade-manager 100% lines/statements/functions; branch coverage 94.33%.
- No unauthorized execution/self-modification capability; no filesystem/process/network/update-server/registry/installer behavior; no restart/rollback/checkpoint implementation; no Action Engine execution; no Voice/STT/TTS/device implementation; no persistence expansion; no Event Bus upgrade events.

## Phase 9 Step 13 — Implementation Review

Status: PASS — READY FOR IMPLEMENTATION LOCK.

Implementation package reviewed: @rin/upgrade-manager.

Passed areas:

- contract traceability
- U1-U10 compliance
- permission review
- confirmation review
- audit review
- version compatibility review
- self-modification safety
- rollback/checkpoint boundary
- restart boundary
- persistence boundary
- voice boundary
- Event Bus boundary
- Agent Manager boundary
- AI Router boundary
- regression verification
- leakage scan
- dependency review

Findings: no blocking correctness, security, contract, scope, fabrication, test-quality, or documentation findings.

## Phase 9 Step 14 — Implementation Lock

Status: RATIFIED.

IMPLEMENTATION LOCK: RATIFIED

Meaning: the implementation covered by the locked Phase 9 minimal boundary has passed its implementation review and is formally locked to the reviewed scope. Implementation lock does NOT authorize expansion beyond the reviewed boundary.

Implementation review passed. The reviewed minimal Upgrade Manager implementation is locked to the authorized boundary. This implementation lock does not authorize any capability outside that boundary.

## Locked Implemented Boundary

The implemented boundary is limited to representation and read-only planning:

1. UpgradeRequest representation
2. UpgradeTarget / TargetReference representation
3. ReleaseMetadata representation
4. CompatibilityCheck
5. UpgradePlan
6. Permission mapping
7. Confirmation representation
8. UpgradeResult
9. content-free Audit mapping
10. VersionService-shaped compatibility input

The implementation is read-only and non-modifying.

## Explicitly Not Implemented

- actual upgrade Apply execution
- source modification
- package replacement
- dependency installation
- executable replacement
- filesystem mutation
- process execution
- network update/download
- registry/repository/server
- signing/cryptographic verification
- checkpoint
- application rollback
- restore execution
- runtime restart
- lifecycle changes
- database migration execution through Upgrade Manager
- upgrade-state persistence
- Event Bus upgrade events
- Action Engine execution
- Voice API
- STT
- TTS
- voice intent schema
- device control
- autonomous upgrade

## U1-U10 Implementation Status

| Decision | Implementation status |
|---|---|
| U1 | LOCKED / implemented within authorized planning boundary |
| U2 | LOCKED / ratified / implemented permission mapping |
| U3 | LOCKED / confirmation representation implemented |
| U4 | LOCKED / version separation preserved |
| U5 | LOCKED / prohibition preserved; controlled boundary remains non-executing |
| U6 | LOCKED / target metadata represented; unresolved mechanisms remain unresolved |
| U7 | LOCKED / rollback distinction preserved; no rollback implementation |
| U8 | LOCKED / Core restart ownership preserved; restart not implemented |
| U9 | LOCKED / persistence expansion remains deferred |
| U10 | LOCKED / voice remains conceptual only |

No full self-upgrade implementation is claimed.

## Security Lock

The reviewed implementation introduces no new security authority. PermissionEvaluator remains the sole authorization authority. Fail-closed behavior remains mandatory. Audit remains content-free. No security bypass exists. No autonomous modification exists.

## Contract Immutability Boundary

Locked against accidental expansion:

- permission taxonomy
- confirmation policy
- version separation
- self-modification prohibition
- target metadata direction
- rollback distinction
- restart ownership
- persistence boundary
- voice boundary
- Router boundary
- Agent Manager boundary
- Event Bus boundary

Future expansion requires a separate authorized contract/change process.

## Test / Verification Record

Phase 9 Step 13 verified results:

- 408/408 tests PASS
- 347 existing + 61 new
- pnpm verify PASS
- lint PASS
- format PASS
- typecheck 9/9 PASS
- build 9/9 PASS
- overall coverage 97.86%
- upgrade-manager 100% lines/statements/functions
- branch coverage 94.33%

## Next Gate

Phase 9 Step 14 implementation lock is complete. The next work requires a NEW authorization.

Potential future work (NOT started): commit/push of accumulated Phase 9 changes; broader upgrade lifecycle implementation; integrity mechanism decision; rollback/checkpoint contract; restart implementation; Action Engine restoration; controlled Apply execution; post-upgrade verification/health; application rollback; voice-first upgrade UX.

---

# Official Constitution

RATIFIED WITHIN APPROVED SCOPE (Phase 9 Step 8 contract lock).

The Upgrade Manager boundary contract constitution is ratified only to the extent directly supported by the reviewed contract (Phase 9 Step 7: PASS) and the Owner-approved U1-U10 decisions.

Ratified constitution articles:

1. OWNER AUTHORITY: The Primary Owner remains the highest authority; upgrades occur only with explicit Owner authorization.
2. FAIL-CLOSED PERMISSION: Every protected operation passes through the PermissionEvaluator; no policy, unavailable evaluation, or evaluation failure results in grant.
3. EXPLICIT CONFIRMATION: Upgrade APPLY is a confirmation-required high-impact operation requiring explicit Owner confirmation immediately before execution; inspection, compatibility inspection, and pure planning require no confirmation; a voice request alone is not final confirmation.
4. CONTROLLED UPGRADE BOUNDARY: A controlled upgrade exists only through the explicitly authorized mechanism described by Decision U5 (owner-authorized, permission-gated, confirmation-required for apply, contract-bounded, preflighted, backed up, verified, restarted through Core, health-checked, rollback-capable).
5. SELF-MODIFICATION PROHIBITION: Autonomous/uncontrolled self-modification remains PROHIBITED, including autonomous source rewriting, uncontrolled dependency installation, arbitrary package or executable replacement, permission/security/audit bypass, unauthorized contract mutation, and autonomous upgrade execution.
6. ROUTING / ORCHESTRATION SEPARATION: The AI Router remains request-routing only; upgrade orchestration belongs to a dedicated future Upgrade/Update Manager (Decision U1).
7. CORE OWNERSHIP: Core owns runtime lifecycle, runtime version reporting, restart, and lifecycle/re-initialization primitives (Decision U1, U8).
8. PERSISTENCE DEFERRAL: Upgrade-state persistence remains DEFERRED; the Phase 5 persistence boundary (AuditLog + RuntimeConfiguration) is unchanged (Decision U9).
9. ROLLBACK DISTINCTION: Database migration rollback is database-scoped and is not application-level upgrade rollback; application-level rollback and checkpoint remain DEFERRED / NOT SPECIFIED (Decision U7).
10. NON-AUTHORIZATION: Contract authoring and contract lock do not authorize implementation.

No new laws are fabricated. Engineering Laws that lack source authority remain:

UNRESOLVED / NOT AUTHORIZED AS LAW.

This ratification does not elevate repository narrative text into constitutional authority beyond the articles above. Constitution ratification is a contract-policy act and remains separate from any future implementation authorization.

---

# Documentation Reconciliation

## Documented Source

- Update Management responsibilities, lifecycle, categories, and laws: Volume-09/08 Update Management chapter.
- Release taxonomy: Volume-09/09 Release Operations and Volume-07/10 Release Validation.
- Runtime lifecycle and shutdown: Volume-06/02 Runtime Lifecycle; Core API Runtime Lifecycle responsibilities.
- Version concepts: @rin/core VersionService and @rin/types API_VERSION.
- Migration policy: Database-Specification/04 Migrations and persistence MigrationRunner.
- Backup and recovery: Volume-08/11 Backup-Recovery and Database-Specification/05 Backup-Recovery.
- Permission and confirmation: Volume-08/03 Authorization-Permission System and locked @rin/types / @rin/security contracts.
- Audit: Volume-08/09 Audit Logging and locked AuditSink / AuditEntry contracts.
- Self-modification prohibition and owner authority: Volume-10/01 and Volume-10/10.
- Voice pipeline: Volume-06/05 Voice Engine.
- Owner decisions: Phase 9 Step 3 Owner Decision Resolution (U1-U10).

## Derived from Locked Contract

- Request, response, and error envelope patterns: RouterRequest, CoreApiResponse, CoreApiError.
- Permission posture: locked PermissionEvaluator behavior (fail-closed).
- Audit posture: locked AuditSink / AuditEntry content-free behavior.
- Single audit entry per request and requestId = traceId mapping: AI Router implementation precedent.
- Migration mechanism: MigrationRunner.

## Ratified under Owner Decision Resolution and Contract Lock

- Phase 9 Step 7 contract review: PASS.
- Phase 9 Step 8 contract lock: COMPLETED. Decisions U1-U10 formally ratified (LOCKED) as recorded in the Owner Decision Boundary, Contract Lock Table, and Official Constitution.
- U2 upgrade permission taxonomy: FORMALLY RATIFIED (LOCKED) at Phase 9 Step 8 — action upgrade:plan; action upgrade:apply; resource upgrade. No additional strings exist.
- Official Constitution: RATIFIED within approved scope (articles directly supported by the reviewed contract and the U1-U10 decisions; no new laws fabricated).
- Implementation remains separately gated. No source implementation occurred in Phase 9 Steps 1-8.
- Phase 9 Step 12 minimal implementation: COMPLETED (separately authorized by the Primary Owner; read-only boundary representation only; 61 new tests; 408/408 total tests passing).
- Phase 9 Step 13 implementation review: PASS — READY FOR IMPLEMENTATION LOCK (no blocking findings).
- Phase 9 Step 14 implementation lock: COMPLETED (IMPLEMENTATION LOCK: RATIFIED). Implementation remains limited to the reviewed boundary. No expansion authorized. No commit/push performed in this step.
- TOC maintenance (API-Specification.md) remains separate documentation-maintenance work.

## Unresolved

- Engineering Laws, Best Practices, Anti-Patterns, Engineering Checklist, and Future Evolution content for the Upgrade Manager API: UNRESOLVED AUTHORITY (the Official Constitution is ratified only within approved scope; it does not elevate narrative text).
- Integrity mechanism, rollback source format, application-version to schema-version linkage, checkpoint semantics, application-level rollback contract, upgrade event names, and upgrade error codes: UNRESOLVED / NOT SPECIFIED / DEFERRED as marked above.
- Upgrade implementation details not yet specified (target-version reference shape, release metadata field shapes, execution semantics): NOT SPECIFIED.

---

END OF LOCKED MINIMAL BOUNDARY CONTRACT (locked Phase 9 Step 8)