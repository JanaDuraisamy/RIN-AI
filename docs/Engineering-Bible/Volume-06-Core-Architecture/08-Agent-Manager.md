# Agent Manager

## Introduction

The Agent Manager is responsible for managing every intelligent agent within the RIN ecosystem.

Rather than allowing agents to operate independently, the Agent Manager coordinates their lifecycle, workload, availability, communication, and performance while maintaining architectural integrity.

The Agent Manager ensures that every agent functions as part of one unified AI Companion.

---

# Purpose

The Agent Manager exists to organize, supervise, and optimize the operation of specialized agents.

It enables RIN to expand intelligently without increasing unnecessary architectural complexity.

Every agent operates under the supervision of the Agent Manager.

---

# Responsibilities

The Agent Manager is responsible for:

- Agent Registration
- Agent Discovery
- Agent Activation
- Agent Deactivation
- Task Assignment
- Agent Scheduling
- Performance Monitoring
- Agent Health Management
- Capability Discovery

---

# Internal Architecture

```text
AI Router
      │
      ▼
Agent Manager
      │
      ├──────────────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼
Memory Agent   Research Agent  Engineering Agent  Action Agent
      │              │              │              │
      └──────────────┴──────────────┴──────────────┘
                     │
                     ▼
             Unified Response
```

---

# Agent Lifecycle

## Stage 1

Agent Registration

↓

## Stage 2

Capability Discovery

↓

## Stage 3

Availability Verification

↓

## Stage 4

Task Assignment

↓

## Stage 5

Execution

↓

## Stage 6

Result Validation

↓

## Stage 7

Performance Update

---

# Engineering Principles

## Specialized Responsibility

Each agent should perform one primary responsibility exceptionally well.

---

## Unified Coordination

The Primary Owner interacts only with RIN.

Internal agent coordination remains invisible.

---

## Dynamic Assignment

Tasks should be assigned according to:

- Capability
- Availability
- Priority
- Runtime Load
- Context

---
# Engineering Laws

The original Engineering Laws section is not recoverable from repository evidence.

This heading is restored structurally from sibling chapter conventions only.

Law count and law content require Primary Owner authority.

Classification: UNRESOLVED AUTHORITY.

---

# Best Practices

The original Best Practices section is not recoverable from repository evidence.

This heading is restored structurally from sibling chapter conventions only.

The Agent API narrative provides responsibility-level best practices (keep agents focused, register capabilities clearly, validate task inputs, monitor agent health, preserve interface compatibility) in API-Specification/03-Agent-API.md. These remain API narrative and are not elevated to Agent Manager chapter law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Anti-Patterns

The original Anti-Patterns section is not recoverable from repository evidence.

This heading is restored structurally from sibling chapter conventions only.

The Agent API narrative lists responsibility-level anti-patterns (direct agent coupling, duplicate responsibilities, hidden communication channels, bypassing Core Runtime coordination, undocumented agent capabilities) in API-Specification/03-Agent-API.md. These remain API narrative and are not elevated to Agent Manager chapter law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Failure Recovery

Documented concepts from API-Specification/03-Agent-API.md (Error Handling):

- Agent errors shall remain structured, predictable, recoverable whenever practical, and traceable.
- Agent failures shall not unnecessarily impact unrelated agents.

Classification: DOCUMENTED.

Error codes, retry policy, escalation policy, timeout policy, cancellation semantics, and fallback rules are not recoverable from repository evidence.

Classification: UNRESOLVED.

---

# Engineering Checklist

The original Engineering Checklist section is not recoverable from repository evidence.

This heading is restored structurally from sibling chapter conventions only.

The Agent API narrative provides a responsibility-level checklist (interface documented, registration verified, capability defined, error handling implemented, version identified, tests completed) in API-Specification/03-Agent-API.md. This remains API narrative and is not elevated to Agent Manager chapter law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Future Evolution

The original Future Evolution section is not recoverable from repository evidence.

This heading is restored structurally from sibling chapter conventions only.

The Agent API narrative anticipates dynamic agent creation, hierarchical agent coordination, distributed agent clusters, AI-assisted task scheduling, cross-device agent collaboration, and autonomous workload balancing in API-Specification/03-Agent-API.md. These remain API narrative and are not elevated to Agent Manager chapter law without owner authority.

Classification: UNRESOLVED (narrative reference only).

---

# Official Constitution

OFFICIAL CONSTITUTION:

UNRESOLVED AUTHORITY

The original Agent Manager constitution is not recoverable from repository evidence. No constitution text is fabricated.

The Agent API chapter ends with its own constitution quote in API-Specification/03-Agent-API.md. That quote governs the Agent API chapter narrative only and carries no owner approval marker; it is not adopted here as the Agent Manager chapter constitution.

---

# Agent API Relationship

The Agent API (API-Specification/03-Agent-API.md) is the narrative API source for the Agent Manager. Documented categories:

1. Registration API
2. Discovery API
3. Task Execution API
4. Capability API
5. Communication API
6. Lifecycle API
7. Health API

Documented request principles (whenever applicable): request identifier, agent identifier, task identifier, context reference, timestamp, API version.

Documented response principles (whenever applicable): status, agent identifier, task result, execution time, error information, version information.

Documented Agent API laws (narrative): every agent shall register through the Agent API; agent communication shall follow documented interfaces; agent capabilities shall remain discoverable; agent lifecycle shall remain manageable through the Core Runtime; agent APIs shall preserve modular engineering boundaries.

These categories and principles are responsibility-level narrative. Typed contracts are a later phase and are NOT created here.

Classification: DOCUMENTED (narrative), PROPOSED / OWNER DECISION (typed contracts).

---

# Shared Context

Agents receive approved context through the Memory API and Core API rather than direct memory access (API-Specification/03-Agent-API.md, Shared Context).

Agents do not directly access the Memory Engine.

The AI Router remains responsible for the current routing and context boundary (Volume-06/07-AI-Router.md and API-Specification/07-AI-Router-API.md).

Classification: DOCUMENTED.

---

# Security

Protected agent operations shall require authorization (API-Specification/03-Agent-API.md, Security).

The Security Foundation permission architecture is fail-closed by default: no policy means denied (locked contracts in @rin/types and @rin/security, reused by the AI Router permission boundary).

Classification: DOCUMENTED (authorization requirement), DERIVED FROM LOCKED CONTRACT (fail-closed posture).

Agent-level permission action taxonomy is not recoverable from repository evidence and is not defined here.

Classification: UNRESOLVED.

---

# Event Bus

The Agent API narrative states that agent communication shall remain observable through the Event Bus where appropriate (API-Specification/03-Agent-API.md, Communication API).

No event names, event payloads, subscriptions, publishers, or event lifecycle are documented or invented here.

Classification: DIRECTIONAL STATEMENT ONLY / UNRESOLVED until an approved Event Bus contract exists.

---

# Task Contract

Evidence-backed task principles:

- Task identity (task identifier)
- Request identity and context reference
- Assigned agent identity
- Priority
- Timestamps
- API version
- Lifecycle concept (registration to capability discovery to availability verification to task assignment to execution to result validation to performance update)

Classification: DOCUMENTED.

Task input/output payload structure, timeout, cancellation, retry, and escalation are not recoverable from repository evidence. No task schema is created.

Classification: UNRESOLVED.

---

# Capability System

Evidence-backed concepts:

- Agent capabilities exist (Agent entity in @rin/types exposes a capabilities list)
- Capabilities are discoverable
- Capability compatibility may be validated
- Supported features may be updated
- Assignment considers capability

Classification: DOCUMENTED.

Capability taxonomy, identifier format, metadata schema, matching algorithm, and versioning rules are not recoverable from repository evidence. No capability registry schema is created.

Classification: UNRESOLVED.

---

# Result System

Documented response principles:

- Status
- Agent identity
- Task result
- Execution time
- Error information
- API version

Classification: DOCUMENTED.

The final result schema is not recoverable from repository evidence and is not defined here.

Classification: UNRESOLVED.

---

# Persistence

Repository evidence does not establish Agent Manager persistence. No agent tables, migrations, or repositories exist or are documented.

Classification: OUT OF SCOPE / UNRESOLVED.

---

# Owner Decision Boundary

The following require Primary Owner decisions and are NOT resolved here:

- Task schema
- Capability model
- Capability registry
- Assignment algorithm
- Selection rules
- Result schema
- Failure semantics
- Lifecycle state authority
- Concurrency and cardinality
- Retry
- Timeout
- Cancellation
- Escalation
- Event contracts
- Agent-level permissions
- Audit responsibility
- Persistence

---

# Cross-Volume Reconciliation

References exist only where repository evidence was found. No new architecture relationships are created.

- AI Router: The AI Router requests agent assignment through the documented AI Router to Agent Manager integration direction; task schema, capability registry, result schema, failure semantics, and lifecycle remain deferred until Agent Manager documentation is completed (API-Specification/07-AI-Router-API.md, Agent Manager Boundary; Phase 6 and Phase 7 Architecture Review handoffs).
- AI Router implementation: @rin/ai-router invokes the Agent Coordinator seam when configured and performs deferred no-assignment when unconfigured (packages/ai-router/src/ai-router.ts). This is implementation-backed evidence of the Router to Agent Manager direction only; it is not elevated to architecture law.
- RIN Core and Runtime Lifecycle: Agent Manager is listed as a core subsystem (Volume-06/01-RIN-Core.md and Volume-06/02-Runtime-Lifecycle.md).
- Nexus System, State Management, and Communication Layer: Agent Manager appears in internal architecture diagrams; State Management records agent state examples (idle, busy, waiting, offline, recovering); Communication Layer records an Agent Manager to Factory internal communication pair (Volume-06/11-Nexus-System.md, 12-State-Management.md, 15-Communication-Layer.md).
- Security: Communication security covers the Agent Manager to Action Engine pair (Volume-08/07-Communication-Security.md).
- Testing: Integration testing targets the AI Router to Agent Manager pair (Volume-07/03-Integration-Testing.md).
- Agent entity: @rin/types defines an Agent entity (identifier, name, description, version, capabilities list, health status, configuration, creation timestamp). It is exported but not consumed by any package.

---

# Documentation Reconciliation

## Documented Source

- Responsibilities (registration, discovery, activation, deactivation, task assignment, scheduling, performance monitoring, health management, capability discovery), internal architecture, seven-stage lifecycle, and engineering principles (specialized responsibility, unified coordination, dynamic assignment criteria: capability, availability, priority, runtime load, context): preserved intact from the original Volume 06, Chapter 08 content above.
- Agent API categories, request and response principles, error handling concepts, shared context boundary, authorization requirement, and Event Bus observability statement: API-Specification/03-Agent-API.md.

## Implementation-Backed Reconstruction

- The AI Router Agent Coordinator seam (optional, opaque, deferred no-assignment) documents the only implemented Agent Manager boundary: packages/ai-router/src/ai-router.ts and its tests.
- The Agent entity in @rin/types documents the only existing agent-facing data shape: packages/types/src/index.ts.
- These describe current implementation state. They are not elevated to architecture law.

## Cross-Volume Reference

- Subsystem listings, diagrams, state examples, integration test targets, and security pairs listed in the Cross-Volume Reconciliation section above.

## Unresolved

- The original V6-08 Engineering Laws, Best Practices, Anti-Patterns, Engineering Checklist, Future Evolution, and Official Constitution content is not recoverable from repository evidence. Structural headings were restored from sibling chapter conventions (Volume 06, Chapters 05, 11, and 15); content remains UNRESOLVED AUTHORITY.
- The dangling empty heading and stray code fence at the original file end were removed as structural truncation damage; the text that followed them is unrecoverable.
- Agent Manager persistence is OUT OF SCOPE (no repository evidence).
- Event Bus integration remains UNRESOLVED until an approved contract exists.
- Task schema, capability model and registry, result schema, failure semantics, lifecycle state authority, concurrency and cardinality, retry, timeout, cancellation, escalation, agent-level permissions, and audit responsibility remain UNRESOLVED and require Primary Owner decisions.

---

END OF RESTORED CHAPTER