# ADR-0005: Platform Brand Selection — RixMesh & Staged Transition Strategy

## Status
Accepted

## Context
The internal working title "Rixed DevOS" sounded like an internal developer utility rather than a standalone, open-source multi-agent development workspace. A public product requires an independent, evocative brand with clear product hierarchy (Studio, Core, Agents, CLI) and strong market positioning.

Several alternatives were analyzed and screened against existing projects and trademarks:
1. **RIXMESH** (Selected Favorite): RIX + MESH (interconnected network of autonomous nodes). Excellent for workspace, orchestrator, and SDK.
   - Tagline: *"One workspace. A whole engineering team. / Create. Delegate. Review. Ship."*
2. **RIXCREW**: Warm and accessible, emphasizing distinct agent roles.
3. **RIXWEAVE**: Emphasizes coordinated agent workflows.
4. **RIXGRID**: Infrastructure and compute-oriented positioning.
5. **RIXHIVE**: Memorable hive/swarm metaphor.

## Decision
1. **Brand Identity**:
   - The public platform name is **RixMesh**.
   - Product components:
     - **RixMesh Studio**: The desktop and web development environment.
     - **RixMesh Core**: The orchestrator, DAG engine, and control plane daemon.
     - **RixMesh CLI**: The command-line runner and developer tool.
     - **RixMesh Agents**: The catalog of specialized engineering personas and skills.
   - Author signature: *"by Rixed"*.
   - Target GitHub repository: `rixed318/rixmesh`.

2. **Safe Staged Rebranding Strategy**:
   - To avoid breaking existing TypeScript imports, pnpm workspace links, and build configurations in one disruptive rename:
     - **Phase 1 (Immediate / v0.1.0-alpha.1)**: Rebrand all user-facing surfaces (UI Header, Health API, Documentation, README, Release manifests) to **RixMesh Studio**. Keep internal npm package scope `@rixed-devos/*` until release baseline stabilizes.
     - **Phase 2 (v0.2.0)**: Centralized atomic rename of internal packages (`@rixmesh/domain`, `@rixmesh/orchestrator`, `@rixmesh/workspaces`, `@rixmesh/providers`, `@rixmesh/policy`, `@rixmesh/artifacts`).
     - **Phase 3 (Public Launch)**: Create GitHub repository `rixed318/rixmesh` and point git remotes.

## Consequences
- **Positive**: Cohesive, professional public identity suitable for desktop apps, CLI tools, and agent ecosystems. Zero disruption to working code during the initial audit phase.
- **Negative**: Temporary dual-presence of `@rixed-devos` package names in internal `package.json` files alongside the user-facing "RixMesh" brand until Phase 2.
