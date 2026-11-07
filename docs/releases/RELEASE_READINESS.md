# Release Readiness & Platform Packaging Strategy

**Platform:** RixMesh  
**Target Release:** `v0.1.0-alpha.1`  
**Current Tag Status:** Local `v1.0.0` tag retracted; public release target set to `v0.1.0-alpha.1`.

---

## 1. Why v1.0.0 Was Premature

Declaring `v1.0.0` for a multi-agent development platform requires:
1. Validated standalone desktop installers (not just archived raw `dist` folders).
2. End-to-end multi-platform CI verification with code signing.
3. Live coding agent CLI execution with real API tokens and key security.
4. Comprehensive 18-scenario acceptance verification across Linux, Windows, and macOS.

Therefore, `v1.0.0` has been retracted, and the project is properly baselined at **`v0.1.0-alpha.1`**.

---

## 2. Multi-Platform Distribution Matrix

| Platform / Architecture | Distribution Format | Packaging Tool | Status | Code Signing & Notarization Notes |
|---|---|---|---|---|
| **Linux x64** | AppImage, `.deb`, `.tar.gz` | Tauri 2.0 / Electron Builder | **Primary MVP Target** | GPG signed package; no gatekeeper blockers. |
| **Windows x64** | NSIS Installer (`.exe`), `.zip` | Tauri 2.0 / Electron Builder | **Primary MVP Target** | Windows SmartScreen warning expected until EV Code Signing certificate is established. |
| **macOS ARM64 (Apple Silicon)** | `.dmg`, `.app` bundle | Tauri 2.0 / Electron Builder | **Primary MVP Target** | Requires Apple Developer ID certificate and `xcrun notarytool` notarization to avoid Gatekeeper quarantine. |
| **Linux ARM64** | `.tar.gz`, `.deb` | Cross-compile / Docker | Planned for v0.2.0 | Dependent on ARM64 CI runner availability. |
| **macOS x64 (Intel)** | `.dmg` | Universal Binary / x64 build | Planned for v0.2.0 | Can be built as Universal 2 binary alongside ARM64. |
| **Windows ARM64** | `.zip` | Native arm64 compile | Planned for v0.3.0 | Evaluated on demand based on developer adoption. |

---

## 3. Pre-Release Acceptance Checklist

Before tagging and pushing `v0.1.0-alpha.1` to GitHub:

- [x] **Acceptance Testing:** All 18 scenarios (AT-01 to AT-18) passing automated tests (`tests/acceptance/acceptance-matrix.test.ts`).
- [x] **License & Attribution Audit:** `THIRD_PARTY_NOTICES.md` contains accurate upstream repository citations, licenses, and pinned commit SHAs.
- [x] **Secret Scanning:** Repository verified clean of personal tokens, `.env` files, and private SSH keys (`git log -S "sk-"`, `git log -S "AIza"`).
- [x] **Network Security:** Control plane server binds strictly to `127.0.0.1` by default.
- [x] **Filesystem Traversal Protection:** Canonical `realpath` checks enabled to stop symlink traversal attacks.
- [x] **Model Independence:** Provider layer supports multiple backends (Gemini, OpenCode, Codex, Claude, Mock) without hardcoded lock-in.
- [ ] **GitHub Remote Setup:** Establish public remote `rixed318/rixmesh` (or initial `rixed318/rixed-devos`) using SSH or `gh` CLI credentials (no PAT in URLs).

