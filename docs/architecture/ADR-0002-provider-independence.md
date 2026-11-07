# ADR-0002: Provider Independence & Default Agent Orchestration

## Status
Accepted (Supersedes initial Gemini-only baseline)

## Context
Antigravity-inspired development workspaces require multi-model flexibility. While **Gemini 3.8 Flash (High)** provides industry-leading reasoning speed, massive context windows, and structured tool-calling capabilities, hardcoding a single AI vendor into the orchestrator core introduces vendor lock-in and limits developers who rely on alternative coding engines (such as OpenCode, OpenAI Codex CLI, Anthropic Claude Code, or local offline runtimes).

## Decision
1. **Provider Independence Principle**:
   - The platform core (`@rixed-devos/orchestrator` and `apps/server`) interacts exclusively with the abstract `CodingAgentAdapter` interface.
   - The user selects the default orchestrator model and can assign specific providers or models to individual roles (e.g. Architect, Backend Developer, QA, Reviewer) via role manifests or UI settings.
   - Documented, sanctioned interfaces only: no token scraping from unauthorized browser stores or subscription bypasses.

2. **Default Out-of-the-Box Configuration**:
   - **Gemini 3.8 Flash (High)** is configured as the default model when a Google API key is provided, leveraging `thinkingConfig` (thinkingBudget / HIGH thinking effort) for architectural planning and code generation.
   - If no API key is detected, the engine transparently switches to `tested-mock` offline fallback mode with clear status reporting, never presenting simulated outputs as live API executions.

3. **Supported Adapter Matrix**:
   - `gemini`: Native Google Generative AI adapter with streaming and high thinking effort.
   - `opencode`: Adapter executing OpenCode CLI engine.
   - `codex`: Adapter executing OpenAI Codex CLI.
   - `claude`: Adapter executing Anthropic Claude Code CLI.
   - `acp`: Generic Agent Client Protocol adapter.
   - `mock`: Deterministic offline provider for unit/integration/E2E regression testing.

4. **Honest Status Reporting**:
   - Each provider reports one of: `implemented`, `tested-live`, `tested-mock`, `experimental`, or `unavailable`.

## Consequences
- **Positive**: Complete vendor independence; developers can switch between cloud APIs, official subscription CLIs, and offline local models without changing workflows.
- **Negative**: Adapter implementations must normalize heterogeneous provider events and error codes into a consistent event stream.

