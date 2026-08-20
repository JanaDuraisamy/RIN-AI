# Core Restart Seam API

## Contract Status

RATIFIED — Phase 10 Restart Seam Contract Lock. Decisions R1 and R2 LOCKED / RATIFIED — PHASE 10. Decision R3 (implementation) IMPLEMENTED — PHASE 10 within the authorized boundary (see §19 R3 Implementation Record).

This specification documents ONLY the minimal Core restart boundary identified during the Phase 10 Restart Seam Contract Study, using the existing RinCore.restart() implementation as evidence. Contract locking does NOT authorize implementation. The existing implementation is evidence, not permission to expand behavior.

---

# 1. Purpose

This contract defines the minimal boundary for the Core-owned runtime restart seam:

RinCore.restart() → graceful shutdown → runtime re-initialization → running runtime

The contract formalizes the existing restart boundary only. It does not expand behavior, add lifecycle states, or create execution machinery.

---

# 2. Evidence

- packages/core/src/core.ts — RinCore.restart() implementation (graceful shutdown; state machine reset; lifecycle reset; registry clear; startup verification unset; re-initialization; service start).
- packages/core/src/lifecycle.ts — RuntimeLifecycle stages; graceful-shutdown is terminal; reset() re-initializes the lifecycle object only (NOT a full runtime restart).
- packages/core/src/runtime-state.ts — RuntimeStateMachine states; reset() returns to 'created'; no restart state exists.
- packages/core/src/core.test.ts — existing restart behavior test ("restarts into a running runtime": stateMachine running; lifecycle active-runtime; startupVerified true; 3 services re-registered).
- docs/API-Specification/01-Core-API.md — "Restart Runtime" listed under Core API Runtime Lifecycle API responsibilities.
- docs/API-Specification/08-Upgrade-Manager-API.md — Decision U8 (Core owns runtime restart; graceful shutdown → runtime re-initialization; restart not implemented in Phase 9; no lifecycle states or transitions added); U1 (Core owns lifecycle/version/restart primitives); U2 (upgrade permission taxonomy); U3 (confirmation); U9 (persistence deferment); U10 (voice is not confirmation); Restart Boundary section; audit mapping precedent.
- docs/Engineering-Bible/Volume-06-Core-Architecture/02-Runtime-Lifecycle.md — Graceful Shutdown sequence (stop new requests; finish active tasks; save runtime state; flush logs; close resources; shutdown Core).
- docs/Engineering-Bible/Volume-06-Core-Architecture/14-Error-Recovery.md — recovery classification and lifecycle; no restart-specific machinery.
- packages/types/src/index.ts — CoreApiRequest, CoreApiResponse, CoreApiError envelopes.
- packages/types/src/permission.ts — PermissionEvaluator (fail-closed sole authority), PermissionRequest, PermissionDecision, PermissionRegistry.
- packages/types/src/audit.ts — AuditSink, AuditEntry (content-free metadata, requestId/correlationId).
- packages/upgrade-manager/src/types.ts — Phase 9 boundary representation precedent (UpgradeRequest extends CoreApiRequest envelope shape; UpgradeResult extends CoreApiResponse<T> + traceId; ApplyBoundary confirmation representation).

---

# 3. Restart Semantics Boundary

LOCKED ARCHITECTURE DIRECTION (Decision U8, ratified Phase 9 Step 8):

- Core owns runtime restart.
- Future semantics: graceful shutdown → runtime re-initialization.
- Existing shutdown safety principles preserved (Volume-06/02 Graceful Shutdown sequence).
- Restart not implemented in Phase 9; no lifecycle states or transitions added.

Current state (verified evidence):

- RinCore.restart() performs an in-process re-initialization: shutdown → stateMachine.reset() → lifecycle.reset() → registry.clear() → health.setStartupVerified(false) → initialize() → startServices().
- After restart: stateMachine 'running'; lifecycle 'active-runtime'; startupVerified true; core services re-registered.
- RuntimeLifecycle.reset() re-initializes the lifecycle object to 'system-initialization' only. It is NOT a runtime restart. RuntimeLifecycle.reset() is a primitive of the restart sequence; it must not be claimed as a full restart.
- RuntimeStateMachine.reset() returns state to 'created'. No restart state exists.

Explicitly NOT included (never part of this boundary):

- New lifecycle states.
- Restart state machines.
- Supervisor behavior.
- Process spawning.
- Process replacement.
- OS-level restart.
- Service manager integration.
- Daemon management.

Classification: LOCKED (direction, U8) / IMPLEMENTED (in-process primitive) / CONTRACT RATIFIED (this boundary, Phase 10 Restart Seam Contract Lock).

---

# 4. Restart Authority

LOCKED (U8, ratified Phase 9 Step 8):

- Core owns runtime restart.
- Upgrade Manager does NOT own restart.
- AI Router does NOT own restart.
- Agent Manager does NOT own restart.
- PermissionEvaluator remains the sole permission authority.
- Restart is a Core API Runtime Lifecycle responsibility (01-Core-API.md).

Classification: LOCKED.

---

# 5. Permission Boundary

## 5.1 U2 taxonomy comparison

Locked U2 taxonomy (ratified Phase 9 Step 8, no additional strings exist):

- action upgrade:plan; action upgrade:apply; resource upgrade.

The locked U2 strings are upgrade-boundary strings. Restart is a Core runtime operation, semantically distinct from upgrade apply. Reusing upgrade:apply for restart would mislabel a Core operation under the upgrade taxonomy and would violate the locked contract statement that "any future protected operation requires its own explicitly authorized taxonomy."

## 5.2 Restart taxonomy

LOCKED / RATIFIED — PHASE 10 (Decision R1):

- action: core:restart.
- resource: runtime.
- The locked U2 taxonomy is upgrade-boundary-specific and is NOT reused for a Core restart operation.
- PermissionEvaluator remains the sole permission authority.
- Required semantics: no policy → denied; evaluator failure → permission-unavailable; no bypass; no autonomous restart.

## 5.3 Fail-closed behavior

LOCKED (existing PermissionEvaluator contract, unchanged):

- Missing policy → denied.
- Evaluator failure → permission-unavailable (fail-closed; no bypass).
- Denied → restart must not proceed; reject safely.
- No autonomous restart: restart occurs only through the documented Core boundary with the ratified taxonomy (Decision R1).

Classification: LOCKED (fail-closed mechanism and R1 taxonomy, ratified Phase 10).

---

# 6. Confirmation Boundary

LOCKED / RATIFIED — PHASE 10 (Decision R2):

- Restart is confirmation-required.
- Confirmation is represented through the existing confirmation mechanism.
- Voice is NEVER treated as final confirmation (U10).
- No new confirmation mechanism may be invented.
- Upgrade confirmation policy (U3, ratified Phase 9 Step 8) requires explicit Owner confirmation for apply; voice is explicitly NOT confirmation (U10).

Classification: LOCKED (U3 mechanism, U10 voice rule, and R2 restart confirmation policy, ratified Phase 10).

---

# 7. Audit Boundary

LOCKED precedent (Phase 9 audit mapping; AuditSink/AuditEntry unchanged):

- Restart audit entries reuse AuditSink and AuditEntry.
- metadata: {} (content-free — no request content, no policy details, no internal state).
- requestId = traceId mapping (established Phase 7/9 mapping precedent).
- Actor/action/resource strings for restart: LOCKED / RATIFIED — PHASE 10 (Decision R1: actor = invoking component; action core:restart; resource runtime).
- One entry per restart request/outcome.

Classification: LOCKED (mechanism and restart strings, ratified Phase 10).

---

# 8. Result and Error Boundary

- Restart result reuses the existing CoreApiResponse<T> envelope (status success/error; result; error; executionTimeMs; version) — no dedicated restart envelope is introduced.
- Error handling uses the existing CoreApiError contract: code, message, traceId.
- Generic error code only: 'internal-error'. No restart-specific error codes are invented.
- No new error taxonomy and no new recovery machinery (Volume-06/14 Error Recovery remains the recovery authority; the restart boundary does not add recovery behavior).

Classification: LOCKED (envelope and error precedent) / NOT SPECIFIED (restart result payload shape).

---

# 9. Persistence Boundary

LOCKED (Decision U9, ratified Phase 9 Step 8; Phase 5 persistence boundary unchanged):

- Restart must NOT introduce new persistence tables.
- No new columns.
- No upgrade-state persistence.
- No checkpoint persistence.
- No restart history storage.
- Phase 5 persistence scope remains AuditLog and RuntimeConfiguration only.

Classification: LOCKED.

---

# 10. Upgrade Manager Interaction

LOCKED (U1, U8; ratified Phase 9 Step 8):

- Upgrade Manager: plan → permission/confirmation representation → future apply flow.
- Core: restart.
- Restart responsibility is NOT moved into @rin/upgrade-manager.
- The controlled-upgrade chain step "restarted through Core" (U5 flow) is satisfied by the Core restart seam; the seam itself is not an upgrade operation.

Classification: LOCKED.

---

# 11. Security

LOCKED (existing security contracts, unchanged):

- Fail-closed permission behavior (missing policy → denied).
- Evaluator failure → permission-unavailable, no bypass.
- No permission bypass of any kind.
- No autonomous restart.
- No audit-content leakage (content-free metadata {}).
- PermissionEvaluator remains the sole permission authority.

Classification: LOCKED.

---

# 12. Testing Boundary

Identified for a FUTURE implementation authorization (tests NOT created by this contract):

- permission allowed → restart representation permitted
- no policy → denied
- evaluator failure → permission-unavailable
- confirmation representation (confirmation-required; never voice-confirmed)
- audit mapping (content-free; requestId = traceId; one entry per outcome)
- restart success (stateMachine running; lifecycle active-runtime; startupVerified true; services re-registered)
- restart failure (fail-closed; safe-mode semantics preserved)
- lifecycle safety (graceful shutdown sequence preserved; reset() not claimed as full restart)
- no persistence expansion
- no unauthorized restart (fail-closed without taxonomy/policy)

Classification: DOCUMENTED (future tests) / NOT CREATED.

---

# 13. Contract Scope Exclusions

This contract does NOT include:

- OS/process restart.
- Supervisor.
- Daemon management.
- Package replacement.
- Dependency installation.
- Filesystem mutation.
- Action Engine.
- Rollback.
- Checkpoint.
- Event Bus restart events.
- Voice/STT/TTS.
- Device control.
- Autonomous self-modification.
- Update servers.
- Registries.
- Download mechanisms.

Classification: EXCLUDED.

---

# 14. Unsupported / NOT SPECIFIED

- Restart permission taxonomy: LOCKED / RATIFIED — PHASE 10 (Decision R1; action core:restart; resource runtime) — no longer NOT SPECIFIED.
- Restart confirmation policy: LOCKED / RATIFIED — PHASE 10 (Decision R2; confirmation-required; voice never final) — no longer NOT SPECIFIED.
- Restart result payload shape (NOT SPECIFIED; envelope reuse locked, payload shape not defined).
- Restart history/state storage (NOT SPECIFIED; prohibited by U9).
- Restart scheduling, queuing, or rate limiting (NOT SPECIFIED).
- Concurrent restart semantics (NOT SPECIFIED).

---

# 15. Owner Decision Boundary

| ID | Question | Evidence | Ratification | Status |
|---|---|---|---|---|
| R1 | Ratify restart permission taxonomy (action core:restart; resource runtime) | U2 locked statement: any future protected operation requires its own explicitly authorized taxonomy; U8 Core ownership | Ratified. U2 not reused; PermissionEvaluator remains sole authority; fail-closed: no policy → denied, evaluator failure → permission-unavailable, no bypass, no autonomous restart | RATIFIED — PHASE 10 |
| R2 | Ratify restart confirmation policy | U3 confirmation mechanism; U10 voice not confirmation | Ratified. Restart is confirmation-required; represented through the existing confirmation mechanism; voice is NEVER final confirmation; no new confirmation mechanism | RATIFIED — PHASE 10 |
| R3 | Authorize implementation of the restart seam guard (permission evaluation + audit + confirmation representation around the existing RinCore.restart() primitive) | This contract; existing primitive evidence; R3 implementation authorization | Implemented and reviewed. Minimal guarded restart seam in @rin/core; R1 taxonomy and R2 confirmation enforced; fail-closed; content-free audit; existing envelopes; primitive reused unaltered; no persistence, no lifecycle expansion, no autonomous execution | IMPLEMENTED — PHASE 10 |

---

# 16. Contract Lock Table

| Contract item | Status | Owner decision | Evidence | Locked at |
|---|---|---|---|---|
| Restart ownership | Locked | U8 | 08-Upgrade-Manager-API.md | Phase 9 Step 8 |
| Restart semantics direction | Locked | U8 | 08-Upgrade-Manager-API.md | Phase 9 Step 8 |
| Persistence deferment | Locked | U9 | 08-Upgrade-Manager-API.md | Phase 9 Step 8 |
| Fail-closed permission | Locked | existing | @rin/types permission contract | Existing |
| Content-free audit | Locked | existing | @rin/types audit contract | Existing |
| Restart taxonomy (action core:restart; resource runtime) | Locked | R1 | this contract | Phase 10 — Restart Seam Contract Lock |
| Restart confirmation policy (confirmation-required; voice never final) | Locked | R2 | this contract | Phase 10 — Restart Seam Contract Lock |
| Restart guard implementation | IMPLEMENTED | R3 | this contract | Phase 10 — Restart Seam Implementation (reviewed and locked) |

Distinction convention: LOCKED = ratified (Phase 9 Step 8, Phase 10 Restart Seam Contract Lock, or previously); NOT AUTHORIZED = requires a separate Owner authorization; NOT SPECIFIED = no mechanism defined; EXCLUDED = outside boundary.

---

# 17. Implementation Gate

Contract locking does NOT authorize implementation.

Implementation of the restart seam guard (permission evaluation, confirmation representation, audit integration, result envelope around the existing RinCore.restart() primitive) requires:

1. Ratification of Decisions R1 and R2 — COMPLETED (Phase 10 Restart Seam Contract Lock).
2. Decision R3 — a separate Owner authorization for an implementation step with new tests — COMPLETED (Phase 10 R3 Restart Seam Implementation, reviewed and locked).
3. Full verification (pnpm verify; diff checks; leakage scan) — COMPLETED.

Implementation is limited to the locked R3 restart seam.

Implementation does not authorize broader upgrade lifecycle execution.

No source file was modified by this contract; source changes were made only under the separate R3 implementation authorization.

---

# 18. Official Constitution

RATIFIED WITHIN APPROVED SCOPE (Phase 10 Restart Seam Contract Study, Phase 10 Restart Seam Contract Lock, and Phase 10 R3 Restart Seam Implementation authorizations).

The Core Restart Seam boundary contract is locked only to the extent directly supported by the reviewed evidence (U8 direction, existing RinCore.restart() implementation, existing locked contracts) and the Phase 10 authorizations. Decisions R1 and R2 are RATIFIED — PHASE 10. Decision R3 is IMPLEMENTED — PHASE 10 within the authorized boundary. The existing implementation is evidence, not permission to expand behavior.

---

# 19. R3 Implementation Record

IMPLEMENTED — PHASE 10 (R3 Restart Seam Implementation, reviewed and locked).

Exact implemented scope:

- permission-gated restart seam (`RinCore.restartSeam` in @rin/core)
- core:restart / runtime taxonomy
- fail-closed PermissionEvaluator (missing policy → denied; evaluator failure → permission-unavailable; unauthorized caller → denied; no bypass)
- confirmation-required boundary (existing confirmation mechanism; voice never final confirmation)
- content-free audit (actor = invoking component; action core:restart; resource runtime; metadata {}; requestId = traceId; one entry per outcome)
- existing result/error envelopes (CoreApiResponse<null> / CoreApiError; no restart-specific error codes)
- existing RinCore.restart() primitive reused unaltered
- no persistence
- no lifecycle expansion
- no autonomous execution

Implementation is limited to the locked R3 restart seam.

Implementation does not authorize broader upgrade lifecycle execution.

Implementation exclusions preserved: no OS/process/supervisor restart; no scheduling/queue/rate-limiting/concurrency; no restart history/state/checkpoint; no Event Bus restart events; no Action Engine; no rollback/checkpoint; no Voice/STT/TTS; no autonomous restart/self-modification; no new permission authority; no new audit taxonomy; no restart-specific error taxonomy; no change to U1–U10; no change to the locked restart contract except implementation-status recording.

END OF CONTRACT