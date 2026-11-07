# ADR-0002: Gemini 3.8 Flash (High) as Primary AI Brain & Provider Adapter Model

## Status
Accepted

## Context
Rixed DevOS requires a powerful, fast, and cost-effective primary AI agent capable of complex reasoning, architectural design, multi-file code synthesis, and structured verification. The platform must also support multiple external CLI and API providers without vendor lock-in.

## Decision
1. **Primary Agent Model**: We establish **Gemini 3.8 Flash (High)** as the default supreme orchestrator and primary coding agent.
   - Ultra-fast reasoning latency and massive context window.
   - High instruction fidelity for schema-constrained outputs (task-result v1, review JSON).
   - Multi-turn tool execution capabilities for editing files, running tests, and evaluating diffs.
2. **Provider Adapter Interface (`CodingAgentAdapter`)**:
   - `gemini`: Native Gemini provider with structured system prompts, repository context injection, and tool calling.
   - `codex`: Adapter executing local `codex-cli`.
   - `claude`: Adapter executing local `claude` (Claude Code CLI).
   - `opencode`: Adapter for OpenCode engine.
   - `mock`: Deterministic offline provider for unit/integration/E2E regression testing.

## Consequences
- The developer experience benefits from fast response times while preserving the flexibility to delegate specific subtasks to other providers based on role configuration.
