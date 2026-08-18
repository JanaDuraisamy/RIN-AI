# Agent Manager API

## Introduction

The Agent Manager API defines the official engineering contract for the subsystem responsible for managing every intelligent agent within the RIN ecosystem.

The Agent Manager coordinates agent lifecycle, workload, availability, communication, and performance while maintaining architectural integrity.

Every agent functions as part of one unified AI Companion.

This specification documents ONLY the minimal boundary contract identified during Phase 8 Step 6. It does not authorize implementation.

---

# Purpose

The purpose of the Agent Manager API is to provide a documented, versioned, and maintainable contract for agent registration, agent discovery, task assignment coordination, capability discovery, and permission-aware coordination.

This contract binds the already-documented Agent Manager boundary without inventing execution semantics.

---

# Responsibilities

Documented responsibilities (Volume-06/08 Agent Manager chapter, preserved intact):

- Agent Registration
- Agent Discovery
- Agent Activation
- Agent Deactivation
- Task Assignment
- Agent Scheduling
- Performance Monitoring
- Agent Health Management
- Capability Discovery

Classification: DOCUMENTED.

---

# API Categories

Documented narrative categories (API-Specification/03-Agent-API.md):

1. Registration API
2. Discovery API
3. Task Execution API
4. Capability API
5. Communication API
6. Lifecycle API
7. Health API

Documented request principles (whenever applicable): request identifier, agent identifier, task identifier, context reference, timestamp, API version.

Documented response principles (whenever applicable): status, agent identifier, task result, execution time, error information, version information.

Classification: DOCUMENTED (narrative). Typed contracts are a later phase and are NOT defined by this specification.

---

# Contract Boundaries

## Agent Representation

The existing Agent entity in @rin/types defines the only agent-facing data shape:

| Field | Purpose | Classification |
|---|---|---|
| id | Agent identity | DOCUMENTED (@rin/types Agent entity) |
| name | Display name | DOCUMENTED |
| description | Agent description | DOCUMENTED |
| version | Agent version | DOCUMENTED |
| capabilities | Capability strings | DOCUMENTED (string[]) — capability taxonomy UNRESOLVED |
| healthStatus | Health status | DOCUMENTED (field) — value semantics UNRESOLVED (Volume-06/12 examples only) |
| configuration | Opaque configuration | DOCUMENTED (field) — schema UNRESOLVED |
| createdAt | Creation timestamp | DOCUMENTED |

The entity is currently exported but not consumed by any package. Its consumption contract remains UNRESOLVED.

No capability metadata, versions, constraints, weights, or registry schema are defined.

---

## Registration and Discovery Boundary

Documented concepts:

- Register Agent
- Find Agent
- Enumerate Agents
- Check Availability
- Validate Compatibility

Classification: DOCUMENTED (verbs and responsibilities, 03-Agent-API.md).

Matching semantics, registry schema, and discovery algorithms are NOT SPECIFIED.

Registration and discovery implementation is NOT authorized under the seam-only beta scope (Owner Decision 4).

Classification: DEFERRED.

---

## Task Boundary

Documented task-level references (03-Agent-API.md request principles and lifecycle stages):

- Request identifier
- Agent identifier
- Task identifier
- Context reference
- Timestamp
- API version
- Lifecycle concept (registration, capability discovery, availability verification, task assignment, execution, result validation, performance update)

Classification: DOCUMENTED.

Task input and output payload structure is NOT SPECIFIED and is represented opaquely.

Classification: UNRESOLVED — DO NOT IMPLEMENT.

---

## Assignment Boundary

Documented assignment criteria (Volume-06/08 Dynamic Assignment, preserved intact):

- Capability
- Availability
- Priority
- Runtime Load
- Context

Classification: DOCUMENTED (criteria).

Assignment algorithm, weighting, scoring, tie-breaking, fallback, load balancing, and parallelism are NOT SPECIFIED.

Classification: UNRESOLVED — DO NOT IMPLEMENT.

---

## Result Boundary

The result envelope follows the established CoreApiResponse-compatible pattern:

| Member | Source | Classification |
|---|---|---|
| status | success or error outcome | DERIVED (CoreApiResponse pattern) |
| agent identifier | Assigning agent | DOCUMENTED (response principles) |
| task result | Result content | DERIVED — shape NOT SPECIFIED, deferred |
| execution time | Execution duration | DERIVED (CoreApiResponse pattern) |
| error information | Error envelope or null | DERIVED ({ code, message, traceId } pattern) |
| version information | API version | DERIVED (CoreApiResponse pattern) |

Result payload schema remains DEFERRED.

---

## Error Envelope

- The Agent Manager reuses the established error envelope: { code, message, traceId } (locked CoreApiError and SecurityErrorInfo contracts).
- Agent Manager-specific error codes are PROPOSED / DEFERRED and are not locked in this specification.
- Error messages shall not leak internal policy, credentials, secrets, or internal policy details.

Classification: DERIVED (established across Core, Memory, Security, and AI Router contracts).

---

## Shared Context

- Agents receive approved context through the Memory API and Core API rather than direct memory access (03-Agent-API.md, Shared Context).
- Agents do not directly access the Memory Engine.
- The Agent Manager reuses the locked RouterContext boundary for any context received from the AI Router.
- No new context fields are added.
- No semantic or vector search is included.

Classification: DOCUMENTED (boundary) / DERIVED FROM LOCKED CONTRACT (RouterContext reuse).

---

## AI Router Boundary

- The AI Router requests agent assignment through the documented AI Router to Agent Manager integration direction (07-AI-Router-API.md, Agent Manager Boundary).
- The AI Router Agent Coordinator seam is a directional placeholder: opaque input and output, deferred no-assignment when unconfigured.
- No task payload fields beyond the documented identity and context references are introduced.
- No provider or model assumptions are introduced.

Classification: APPROVED BETA DEFAULT (directional placeholder seam only).

---

## Permission Boundary

- Every protected operation shall pass through the PermissionEvaluator before execution.
- The Agent Manager reuses the locked PermissionRequest contract and PermissionEvaluator seam.
- Behavior remains fail-closed: no policy means denied.
- Denied: no execution, reject safely.
- Confirmation-required: no execution.
- Restricted: no execution.
- Permission-unavailable: no execution.
- Identity, MFA, and elevated authorization remain deferred.

OWNER-APPROVED BETA DEFAULT taxonomy (ratified for the minimal boundary during Phase 8 Step 9 Contract Lock):

- caller: agent-manager
- action: agent-manager:coordinate
- resource: agent-manager

This taxonomy authorizes the minimal seam-level coordination boundary only. It is NOT a universal taxonomy for future Agent operations, and it does not authorize arbitrary Agent Manager execution. Any future protected operation requires its own explicitly authorized taxonomy.

Classification: DOCUMENTED (mechanism and fail-closed behavior) / OWNER-APPROVED BETA DEFAULT (taxonomy).

---

## Audit Boundary

- Audit behavior follows the locked content-free AuditSink and AuditEntry contracts.
- Audit entries shall not contain task content, memory content, credentials, secrets, or internal policy details.
- Single audit entry per request follows the AI Router implementation precedent.

OWNER-APPROVED BETA DEFAULT mapping (ratified during Phase 8 Step 9 Contract Lock):

- actor: agent-manager
- action: agent-manager:coordinate
- resource: agent-manager
- requestId mapping: DERIVED (AI Router precedent: requestId = traceId)

Classification: DOCUMENTED (content-free contract) / DERIVED (single-entry pattern) / OWNER-APPROVED BETA DEFAULT (mapping).

---

## Event Bus Boundary

- Agent API operations are observable through the Event Bus where appropriate (03-Agent-API.md, directional statement only).
- No event names, event payloads, subscriptions, publishers, or event lifecycle are defined by this specification.

Classification: DIRECTIONAL STATEMENT ONLY / DEFERRED.

---

## Persistence Boundary

Agent Manager persistence is OUT OF SCOPE for this beta boundary.

- No Agent, Task, or Capability tables.
- No migrations.
- No schema changes.
- Phase 5 persistence scope remains AuditLog and RuntimeConfiguration only.

Classification: OUT OF SCOPE / DEFERRED.

---

## Action Engine Boundary

- The Action Agent appears only as a naming reference in the Volume-06/08 internal architecture diagram.
- No Router to Action or Agent to Action contract is defined by this specification.
- The Action Engine chapter (Volume-06/06) remains truncated and unrestored.

Classification: BLOCKED — DO NOT IMPLEMENT.

---

## In-Memory Beta Boundary

- Beta scope is SEAM-ONLY (Owner Decision 4).
- No registration or discovery store is contracted or implemented.
- The Agent entity and capabilities: string[] remain reusable documented representations.
- No restart recovery, no durable registry, and no persistence of any kind is included.
- Registration and discovery semantics remain DEFERRED.

Classification: OWNER-APPROVED BETA SCOPE (seam-only).

---

## Integration Expectations

Documented integration pairs:

- AI Router to Agent Manager (Volume-07/03 Integration Testing)
- Agent Manager to Action Engine (Volume-07/03 Integration Testing pair; Volume-08/07 communication security pair) — pair documented, contract BLOCKED

The Agent Manager to Factory relationship is a name-level internal communication example within the Engineering Bible and is NOT a contract in this specification.

Classification: DOCUMENTED (pairs) / BLOCKED (Action Engine contract).

---

# Engineering Principles

## Specialized Responsibility

Each agent should perform one primary responsibility exceptionally well.

Classification: DOCUMENTED (Volume-06/08, preserved intact).

---

## Unified Coordination

The Primary Owner interacts only with RIN.

Internal agent coordination remains invisible.

Classification: DOCUMENTED (Volume-06/08, preserved intact).

---

## Dynamic Assignment

Tasks should be assigned according to:

- Capability
- Availability
- Priority
- Runtime Load
- Context

Classification: DOCUMENTED (criteria; algorithm UNRESOLVED).

---

## Security

Protected agent operations shall require authorization.

Classification: DOCUMENTED (03-Agent-API.md, narrative).

---

## Observability

Agent activities shall support monitoring and structured logging.

Classification: DOCUMENTED (03-Agent-API.md, narrative).

---

# Engineering Laws

The original Agent Manager Engineering Laws are not recoverable from repository evidence.

This heading is restored structurally only. Law count and law content remain UNRESOLVED / NOT AUTHORIZED AS LAW under this lock.

The Agent API narrative laws (every agent shall register through the Agent API; agent communication shall follow documented interfaces; agent capabilities shall remain discoverable; agent lifecycle shall remain manageable through the Core Runtime; agent APIs shall preserve modular engineering boundaries) are recorded in 03-Agent-API.md. They remain API narrative and are NOT elevated to Agent Manager API law without owner authority.

Classification: UNRESOLVED AUTHORITY.

---

# Best Practices

The original Best Practices section is not recoverable from repository evidence.

The Agent API narrative provides responsibility-level best practices (keep agents focused, register capabilities clearly, validate task inputs, monitor agent health, preserve interface compatibility) in 03-Agent-API.md. These remain API narrative and are NOT elevated to contract law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Anti-Patterns

The original Anti-Patterns section is not recoverable from repository evidence.

The Agent API narrative lists responsibility-level anti-patterns (direct agent coupling, duplicate responsibilities, hidden communication channels, bypassing Core Runtime coordination, undocumented agent capabilities) in 03-Agent-API.md. These remain API narrative and are NOT elevated to contract law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Engineering Checklist

The original Engineering Checklist section is not recoverable from repository evidence.

The Agent API narrative provides a responsibility-level checklist (interface documented, registration verified, capability defined, error handling implemented, version identified, tests completed) in 03-Agent-API.md. This remains API narrative and is NOT elevated to contract law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Future Evolution

The original Future Evolution section is not recoverable from repository evidence.

The Agent API narrative anticipates dynamic agent creation, hierarchical agent coordination, distributed agent clusters, AI-assisted task scheduling, cross-device agent collaboration, and autonomous workload balancing in 03-Agent-API.md. These remain API narrative and are NOT elevated to contract law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Owner Decision Boundary

The following decisions were resolved by the Primary Owner during Phase 8 Step 9 Contract Lock:

## Decision 1: Lifecycle State Authority

Resolution: DEFERRED (owner-approved deferral). Lifecycle and state authority is NOT assigned to the Agent Manager or State Management by this contract.

Evidence: Volume-06/08 documents Agent Manager lifecycle coordination and Agent Health Management; Volume-06/12 documents State Management tracking the status of every agent (idle, busy, waiting, offline, recovering examples). No agent state type exists in @rin/types. RuntimeState covers the runtime, not agents.

Status: DEFERRED / OWNER-APPROVED DEFERRAL. Lifecycle-state ownership remains unresolved for a future architecture decision.

## Decision 2: Agent Permission Taxonomy

Resolution: BETA-PROPOSED strings ratified for the minimal boundary:

- caller: agent-manager
- action: agent-manager:coordinate
- resource: agent-manager

These strings are for the minimal Agent Manager boundary only. They are NOT a universal taxonomy for future Agent operations. The permission mechanism remains the locked PermissionEvaluator; fail-closed remains unchanged.

Status: OWNER-APPROVED BETA DEFAULT.

## Decision 3: Agent Manager Audit Mapping

Resolution: minimal content-free audit mapping ratified:

- actor: agent-manager
- action: agent-manager:coordinate
- resource: agent-manager
- requestId: propagated from the request traceId where available

Audit mechanism: existing AuditSink. Entries remain content-free: no task payloads, memory contents, credentials, secrets, policy internals, or model/provider data.

Status: OWNER-APPROVED BETA DEFAULT.

## Decision 4: Beta Scope

Resolution: SEAM-ONLY BETA. No registration or discovery store is contracted or implemented. The Agent entity and capabilities: string[] remain reusable documented representations. Registration and discovery semantics remain deferred.

Evidence: Register Agent and Find Agent verbs and the Agent entity are documented; matching semantics are absent.

Status: OWNER-APPROVED BETA SCOPE.

---

# Contract Lock Table

| Area | State | Classification | Evidence | Owner Approval |
|---|---|---|---|---|
| AI Router directional seam | Locked | APPROVED BETA DEFAULT | 07-AI-Router-API.md:182–187 | Existing |
| Shared context | DOCUMENTED / REUSABLE | DOCUMENTED / DERIVED FROM LOCKED CONTRACT | 03-Agent-API.md Shared Context; RouterContext | Ratified under this lock (boundary only) |
| Agent representation | Locked | DOCUMENTED | @rin/types Agent entity | Existing |
| Capabilities representation | Locked | DOCUMENTED (string[]) | Agent entity | Existing |
| Request envelope principles | DOCUMENTED / REUSABLE | DOCUMENTED (narrative) | 03-Agent-API.md request principles | Ratified under this lock (identity-level only) |
| Response envelope principles | DOCUMENTED / REUSABLE | DOCUMENTED (narrative) | 03-Agent-API.md response principles | Ratified under this lock (identity-level only) |
| Result envelope | Derived | DERIVED | CoreApiResponse pattern | Existing |
| Error envelope | Derived | DERIVED | CoreApiError / SecurityErrorInfo | Existing |
| Permission mechanism | Locked | DOCUMENTED | PermissionEvaluator, fail-closed | Existing |
| Permission strings | Locked for minimal contract | OWNER-APPROVED BETA DEFAULT | Decision 2 (caller agent-manager; action agent-manager:coordinate; resource agent-manager) | Ratified (Decision 2) |
| Audit content-free contract | Locked | DOCUMENTED | AuditEntry / AuditSink | Existing |
| Audit mapping | Locked for minimal contract | OWNER-APPROVED BETA DEFAULT | Decision 3 (actor agent-manager; action agent-manager:coordinate; resource agent-manager) | Ratified (Decision 3) |
| Lifecycle state authority | Deferred | OWNER-APPROVED DEFERRAL | V6-08 vs V6-12 overlap | Ratified (Decision 1) |
| Beta scope | Locked for beta scope | OWNER-APPROVED BETA DEFAULT | Decision 4 (seam-only; no registry or storage) | Ratified (Decision 4) |
| In-memory beta boundary | Locked for beta scope | OWNER-APPROVED BETA DEFAULT | Decision 4; persistence OUT OF SCOPE | Ratified (Decision 4) |
| Registration / discovery implementation | Open | DEFERRED | Decision 4 (seam-only) | Not applicable (deferred) |
| Task payload | Open | UNRESOLVED — DO NOT IMPLEMENT | none | Not applicable (deferred) |
| Capability metadata / matching | Open | UNRESOLVED — DO NOT IMPLEMENT | none | Not applicable (deferred) |
| Assignment algorithm / selection | Open | UNRESOLVED — DO NOT IMPLEMENT | criteria only | Not applicable (deferred) |
| Concurrency / retry / timeout / cancellation / escalation | Open | DEFERRED | none | Not applicable (deferred) |
| Event Bus integration | Open | DEFERRED | directional statement only | Not applicable (deferred) |
| Persistence | Closed | OUT OF SCOPE | Phase 5 lock | Existing |
| Action Engine contract | Closed | BLOCKED | V6-06 truncated | Not applicable |

---

# Implementation Gate

This API document DOES NOT authorize Agent Manager implementation.

The minimal boundary contract is locked (Decisions 1–4 ratified; constitution ratified under Phase 8 Step 9 Contract Lock).

Agent Manager implementation remains blocked until:

- The final contract-lock review (Phase 8 Step 10) passes.
- Implementation scope is separately authorized by the Primary Owner.

The locked minimal boundary is limited to the seam-level coordination represented by this contract. agent-manager:coordinate does not authorize arbitrary Agent Manager execution. Any future protected operation requires its own explicitly authorized taxonomy.

---

# Official Constitution

MINIMAL BETA BOUNDARY:

APPROVED

The minimal Agent Manager boundary contract, as defined in this specification, is ratified by Primary Owner authority during Phase 8 Step 9 Contract Lock.

No constitution text is fabricated. No Engineering Laws are invented.

Engineering Laws that lack source authority remain:

UNRESOLVED / NOT AUTHORIZED AS LAW.

Constitution wording for any future Agent Manager expansion shall be proposed and ratified separately, following the 07-AI-Router-API.md approval precedent.

---

# Documentation Reconciliation

## Documented Source

- Responsibilities, lifecycle stages, and engineering principles: Volume-06/08 Agent Manager chapter (restored and committed).
- API categories, request and response principles, shared context, authorization requirement, and Event Bus observability statement: 03-Agent-API.md.
- AI Router boundary and deferrals: 07-AI-Router-API.md (Agent Manager Boundary) and Phase 6 / Phase 7 Architecture Review handoffs.
- Agent representation: @rin/types Agent entity.
- Error, permission, and audit contracts: locked @rin/types and @rin/security contracts.

## Derived from Locked Contract

- Result and error envelope patterns: CoreApiResponse, CoreApiError, SecurityErrorInfo.
- Single audit entry per request and requestId = traceId mapping: AI Router implementation precedent.
- Fail-closed permission posture: locked PermissionEvaluator behavior.

## Ratified under Contract Lock

- Permission mapping (Decision 2): caller agent-manager; action agent-manager:coordinate; resource agent-manager — OWNER-APPROVED BETA DEFAULT.
- Audit mapping (Decision 3): actor agent-manager; action agent-manager:coordinate; resource agent-manager; requestId propagated from traceId where available; content-free AuditSink semantics — OWNER-APPROVED BETA DEFAULT.

## Unresolved

- Engineering Laws, Best Practices, Anti-Patterns, Engineering Checklist, Future Evolution, and Official Constitution content for the Agent Manager API: UNRESOLVED AUTHORITY.
- Task payload, capability metadata and matching, assignment algorithm, selection rules, lifecycle state authority, concurrency, retry, timeout, cancellation, escalation, and Event Bus events: UNRESOLVED / DEFERRED as marked above.

---

END OF MINIMAL BOUNDARY CONTRACT