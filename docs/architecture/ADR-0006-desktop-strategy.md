# ADR-0006: Desktop Application Strategy (Tauri 2.0 vs. Electron)

## Status
Accepted

## Context
RixMesh requires a cross-platform desktop application running on Linux, Windows, and macOS that provides a unified environment with editor, terminal, Git diff viewer, and agent control panels. While the web interface (`apps/web`) serves as the primary frontend presentation layer, users require a native desktop shell capable of opening local Git repositories directly from the OS file dialog, managing background daemon lifecycles, and avoiding browser tab restrictions.

## Decision
1. **Target Desktop Framework: Tauri 2.0**:
   - We adopt **Tauri 2.0** as the primary desktop packaging engine for RixMesh Studio, with Electron as a secondary fallback.
   - **Advantages of Tauri 2.0**:
     - Binary footprint: ~15MB compared to ~120MB+ for Electron.
     - Memory consumption: Leverages native OS webviews (WebKit on Linux/macOS, WebView2 on Windows), minimizing RAM usage when concurrent agent subprocesses are active.
     - Security: Granular capability and permission system restricting file dialogs and shell commands.
     - Built-in multi-platform bundler generating `.deb`/`AppImage` (Linux), `NSIS`/`.msi` (Windows), and `.dmg`/`.app` (macOS).

2. **Integration Architecture**:
   - `apps/desktop` hosts the Tauri configuration and Rust runner.
   - The desktop shell embeds the production build of `apps/web`.
   - On application startup, the desktop shell launches the lightweight `apps/server` control plane daemon on `127.0.0.1`, managing its lifecycle, and communicates via HTTP RPC / SSE.

3. **Fallback & Staged Execution**:
   - In `v0.1.0-alpha.1`, the platform can be executed as a local web app via `pnpm start` (Node 24 backend + Vite frontend).
   - In `v0.1.0-alpha.2`, the Tauri 2.0 wrapper will be added in `apps/desktop`.

## Consequences
- **Positive**: Low resource overhead, fast launch times, native OS look-and-feel, clean separation between desktop shell and headless server daemon.
- **Negative**: Windows requires the presence of Microsoft Edge WebView2 runtime (pre-installed on Windows 10/11); Linux requires `webkit2gtk-4.1` system libraries.
