# AI Router API

## Introduction

The AI Router API defines the official engineering contract for the central intelligence orchestration engine of the RIN ecosystem.

The AI Router selects the most appropriate reasoning strategy and execution path for every request received from the Primary Owner.

The AI Router does not generate intelligence itself.

It coordinates intelligence across the entire RIN ecosystem.

---

# Purpose

The purpose of the AI Router API is to provide a documented, versioned, and maintainable contract for request intake, classification, context analysis, memory retrieval coordination, reasoning strategy selection, agent assignment, permission-aware execution, and response coordination.

The AI Router API preserves modularity, observability, and long-term architectural consistency.

---

# Responsibilities

The AI Router API is responsible for:

- Request Classification
- Context Analysis
- Memory Retrieval Requests
- Reasoning Strategy Selection
- Agent Assignment
- Execution Planning
- Response Coordination
- Performance Optimization
- Resource-Aware Routing

---

# API Categories

## Routing API

Responsibilities:

- Receive Request
- Classify Request
- Analyze Context
- Coordinate Execution

---

## Context API

Responsibilities:

- Preserve active conversation
- Incorporate long-term memory
- Incorporate short-term memory
- Incorporate current project
- Incorporate runtime status

---

## Memory Retrieval API

Responsibilities:

- Request relevant memory
- Return memory results to routing context
- Retrieve only when relevant

---

## Reasoning Strategy Selection API

Responsibilities:

- Select reasoning strategy
- Prefer engineering efficiency
- Remain provider-neutral

---

## Agent Assignment API

Responsibilities:

- Request agent assignment
- Collect coordinated results

---

## Permission Evaluation API

Responsibilities:

- Validate protected operations
- Respect the Permission System
- Reject safely on denial

---

## Response Coordination API

Responsibilities:

- Generate unified response
- Preserve one consistent companion experience

---

# Contract Boundaries

## Router Request

| Field | Purpose | Classification |
|---|---|---|
| caller | Source of the request (for example Core or Voice) | DOCUMENTED (intake sources) / APPROVED BETA DEFAULT (value set) |
| input | Request content supplied by the caller | DERIVED — content schema NOT SPECIFIED, deferred |
| traceId | Correlation identifier generated at intake | DERIVED (RequestRouter and MemoryEngine pattern) |

---

## Router Response

| Field | Purpose | Classification |
|---|---|---|
| status | success or error outcome | DERIVED (CoreApiResponse / MemoryApiResponse pattern) |
| result | Unified routing outcome | DERIVED — shape NOT SPECIFIED, deferred |
| error | Error envelope or null | DERIVED ({ code, message, traceId } pattern) |
| executionTimeMs | Routing duration | DERIVED |
| version | API version | DERIVED |

---

## Context Representation

| Member | Source | Classification |
|---|---|---|
| conversation | Active conversation | DOCUMENTED (Volume-06/07 Context First) |
| long-term memory | Long-Term Memory | DOCUMENTED |
| short-term memory | Short-Term Memory | DOCUMENTED |
| current project | Current project | DOCUMENTED |
| runtime status | Runtime status | DOCUMENTED (member) — source of truth NOT SPECIFIED, deferred |

---

## Classification Result Boundary

Every request shall be classified before execution.

The classification taxonomy is NOT SPECIFIED by the Engineering Bible and remains PROPOSED / DEFERRED.

---

## Memory Retrieval Boundary

- Retrieval occurs only when relevant.
- The AI Router reuses the locked Memory Engine contracts: MemoryContextQuery, MemoryRequestContext, and MemoryApiResponse.
- The AI Router does not write Memory entities.
- No semantic or vector search is included.
- No summarization or consolidation is included.
- No Memory events are invented.

Classification: DOCUMENTED (locked contracts and boundaries).

---

## Reasoning Strategy Boundary

- The AI Router selects a reasoning strategy.
- The AI Router does not generate intelligence itself.
- The AI Router does not directly call any external AI provider.
- No provider SDK, API credentials, API keys, streaming contract, or provider-specific request or response format is included.
- A reasoning strategy MAY resolve to a model later through a separately specified contract.
- External AI API communication remains the responsibility of the Communication Layer.

Classification: APPROVED BETA DEFAULT (boundary) — strategy taxonomy PROPOSED / DEFERRED.

---

## Agent Manager Boundary

- The AI Router requests agent assignment through the documented AI Router to Agent Manager integration direction.
- Agent task schema, capability registry, result schema, failure semantics, and lifecycle remain DEFERRED until Agent Manager documentation is completed.

Classification: APPROVED BETA DEFAULT (directional placeholder seam only).

---

## Permission Evaluation Boundary

- Every protected operation shall pass through the PermissionEvaluator before execution.
- The AI Router reuses the locked PermissionRequest contract and PermissionEvaluator seam.
- Behavior remains fail-closed.
- Denied: no execution, reject safely.
- Confirmation-required: no execution.
- Restricted: no execution.
- Permission-unavailable: no execution.
- Identity, MFA, and elevated authorization remain deferred.

BETA-PROPOSED taxonomy (fail-closed by default; no policy means denied):

- action: router:coordinate-execution
- resource: target subsystem resource
- caller: ai-router

Classification: DOCUMENTED (seam and fail-closed behavior) / BETA-PROPOSED (taxonomy).

---

## Error Envelope

- The AI Router reuses the established error envelope: { code, message, traceId }.
- Router-specific error codes are PROPOSED / DEFERRED and are not locked in this specification.
- Error messages shall not leak internal policy, model, or provider details.

Classification: DERIVED (established across Core, Memory, and Security implementations).

---

## Trace and Correlation

- A traceId is generated at request intake.
- The traceId propagates through every routing stage and appears in responses and error envelopes.
- No new Event Bus event names are introduced by this contract.

Classification: DERIVED (established RequestRouter and MemoryEngine pattern).

---

## Security Expectations

- No execution path shall bypass the Permission System.
- Audit behavior follows the locked content-free AuditSink contract through existing audit mechanisms.
- No credentials or API keys are stored or transmitted by the AI Router.
- Encryption, identity, and authentication remain deferred.

Classification: DOCUMENTED (locked security architecture).

---

## Integration Expectations

Documented integration pairs:

- RIN Core to AI Router
- AI Router to Memory Engine
- AI Router to Agent Manager
- Voice Engine to AI Router

The AI Router to Action Engine relationship is diagram-only within the Engineering Bible and is NOT a documented integration pair.

Classification: DOCUMENTED (Volume-07/03 Integration Testing scope).

---

# Engineering Principles

## Context First

Every routing decision shall begin with understanding the current context.

---

## Intelligence Optimization

The Router shall choose the most appropriate reasoning strategy instead of always selecting the most powerful model.

---

## Resource Awareness

Routing decisions shall consider CPU usage, memory availability, network connectivity, battery level, and runtime performance.

---

## Permission Awareness

No execution path shall bypass the Permission System.

---

## Unified Experience

The Primary Owner should experience a single intelligent companion.

---

# Engineering Laws

## Law 1

Every request shall be classified before execution.

---

## Law 2

Context shall influence routing decisions.

---

## Law 3

Memory retrieval shall occur only when relevant.

---

## Law 4

AI model selection shall prioritize engineering efficiency.

---

## Law 5

Pending Primary Owner authority (Volume-06/07 Engineering Bible truncation).

---

# Best Practices

- Classify every request before execution.
- Preserve context before every routing decision.
- Retrieve memory only when relevant.
- Prefer engineering efficiency in selection.
- Validate permissions before every protected execution.
- Keep routing observable.

---

# Anti-Patterns

Avoid:

- Executing without classification.
- Routing without context.
- Unnecessary memory retrieval.
- Bypassing the Permission System.
- Provider coupling inside the Router.
- Exposing internal routing complexity.

---

# Engineering Checklist

Before approving an AI Router API change:

- Request contract documented.
- Classification boundary preserved.
- Context members preserved.
- Memory boundary reused.
- Permission seam preserved.
- Provider neutrality preserved.
- Integration pairs respected.

---

# Future Evolution

The AI Router API shall evolve to support:

- Advanced reasoning strategies
- Collaborative multi-agent reasoning
- Explainable decision paths
- Adaptive intelligence strategies
- Provider-neutral intelligence expansion

Future evolution shall preserve security, permission awareness, and architectural consistency.

---

# Official Constitution

> "The AI Router shall coordinate intelligence across the RIN ecosystem by classifying every request, preserving context, retrieving memory only when relevant, selecting the most appropriate reasoning strategy, and respecting the Permission System, while preserving the trust of the Primary Owner."

APPROVED — approved by Primary Owner authority during Phase 6 Step 4 Architecture Lock Review.