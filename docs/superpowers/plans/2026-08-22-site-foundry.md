# Site Foundry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a working Site Foundry command-line system that covers M0-M5 and proves one public, license-safe component workflow end to end.

**Architecture:** A TypeScript monorepo-style package exposes one `site-foundry` CLI over focused modules for state, sources, security, design selection, generation, browser audit, proof packaging, and evaluation. SQLite retains reusable catalog evidence while every run writes auditable JSON artifacts and resumes through a guarded state machine.

**Tech Stack:** Node.js 24+, TypeScript 7, Vitest 4, Ajv 8, Playwright 1.62, axe-core, YAML, Commander, React 19, Tailwind CSS 4, Vite 8, SQLite.

**Spec:** `docs/superpowers/specs/2026-08-22-site-foundry-design.md`

## Global Constraints

- The CLI is the live caller for every subsystem.
- No authenticated, premium, ambiguous-license, or policy-bypassed source access.
- Imported code requires canonical public source, approved license, and pinned revision.
- External content is untrusted data; block private networks and unrelated local services.
- One foundation family, at most two accent sources, one icon and motion family.
- Custom component waivers enforce the brief's 12/3 and 6/catalog exhaustion thresholds.
- All run transitions persist and resume.
- Browser repair stops after six passes.
- Generated sites use React, TypeScript, Tailwind, Vite, and local copied source.
- Final verification includes unit, integration, CLI, generated-site build, and browser evidence.

---

### Task 1: Repository and Domain Contracts

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/core/types.ts`, `src/core/errors.ts`, `src/core/schema.ts`, `tests/core/schema.test.ts`, and all JSON schemas under `skills/site-foundry/schemas/`.

**Interfaces:** Produce `SiteSpec`, `RunState`, `Candidate`, `ComponentSet`, `ProvenanceRecord`, `DesignDNA`, `validateArtifact(kind, value)`, and typed `FoundryError` codes.

- [ ] Write schema tests for valid artifacts and fail-closed invalid license, provenance, route, and state values.
- [ ] Run the tests and confirm failures because the modules do not exist.
- [ ] Add package/tool configuration, domain types, checked-in schemas, and Ajv validation.
- [ ] Run focused tests, typecheck, and commit the verified unit.

### Task 2: Resumable State and Catalog

**Files:** Create `src/core/state-machine.ts`, `src/core/run-store.ts`, `src/catalog/catalog.ts`, `tests/core/state-machine.test.ts`, and `tests/catalog/catalog.test.ts`.

**Interfaces:** Produce `RunStore.create`, `RunStore.load`, `RunStore.transition`, `Catalog.upsertSource`, `Catalog.upsertCandidate`, `Catalog.recordDecision`, and `Catalog.findSimilarStories`.

- [ ] Write tests for legal transitions, rejected skips, atomic artifact writes, restart resume, and SQLite catalog round trips.
- [ ] Confirm the tests fail for missing behavior.
- [ ] Implement the ordered state machine, portable run artifacts, and SQLite schema.
- [ ] Run focused tests, typecheck, and commit.

### Task 3: Source Adapters and Public-Access Policy

**Files:** Create `skills/site-foundry/sources.yaml`, `src/sources/types.ts`, `src/sources/config.ts`, `src/sources/http.ts`, `src/sources/registry.ts`, `src/sources/gallery.ts`, `tests/sources/*.test.ts`, and fixture responses.

**Interfaces:** Produce `SourceAdapter.search`, `.capture`, `.resolveCode`, `.inspectLicense`, plus `loadSourceConfig` and `safePublicFetch`.

- [ ] Write tests for registry JSON parsing, inspiration-only resolution, redirect and private-IP rejection, no-auth headers, rate limits, and canonical URLs.
- [ ] Confirm expected failures.
- [ ] Implement declarative adapters for the source map and live public registry/repository resolution.
- [ ] Run source tests, typecheck, and commit.

### Task 4: License, Provenance, and Security Gates

**Files:** Create `src/security/license.ts`, `src/security/scan.ts`, `src/security/gates.ts`, `tests/security/*.test.ts`, and malicious/clean fixtures.

**Interfaces:** Produce `inspectLicense`, `scanPackage`, and `runHardGates`, each returning structured evidence rather than booleans.

- [ ] Write tests that accept approved SPDX licenses and reject unknown/custom/copyleft policy, lifecycle scripts, remote scripts, analytics, `eval`, shell execution, unsafe environment reads, and undeclared network calls.
- [ ] Confirm failures before code.
- [ ] Implement conservative scanners with auditable findings and fail-closed gate composition.
- [ ] Run security tests, typecheck, and commit.

### Task 5: Brief Compiler and Archetypes

**Files:** Create nine YAML packs under `skills/site-foundry/archetypes/`, `src/archetypes/compiler.ts`, `src/brief/compiler.ts`, and `tests/brief/compiler.test.ts`.

**Interfaces:** Produce `compileBrief(input)`, `selectArchetype(spec)`, and `planPageSlots(spec, pack)`.

- [ ] Write tests for marketing, software-product, hybrid, and unknown briefs; required routes, states, interactions, neutral unknown claims, and no fabricated proof.
- [ ] Confirm failures.
- [ ] Implement deterministic brief normalization and composable archetype grammars.
- [ ] Run tests, typecheck, and commit.

### Task 6: Design Directions, Ranking, and Set Optimizer

**Files:** Create rubrics under `skills/site-foundry/rubrics/`, prompts under `skills/site-foundry/prompts/`, `src/design/directions.ts`, `src/design/rank.ts`, `src/design/optimizer.ts`, and `tests/design/*.test.ts`.

**Interfaces:** Produce `deriveDirections`, `scoreCandidate`, `runPairwiseTournament`, and `optimizeComponentSet`.

- [ ] Write tests for three distinct directions, weighted scores, blind critic payloads, deterministic tie-breaking, cohesion constraints, and no feasible set.
- [ ] Confirm failures.
- [ ] Implement rule-based fallback direction extraction, pluggable critic calls, compatibility vectors, and constrained search.
- [ ] Run design tests, typecheck, and commit.

### Task 7: Candidate Lab and Browser Evidence

**Files:** Create `src/lab/workspace.ts`, `src/lab/render.ts`, `src/lab/capture.ts`, `src/lab/interactions.ts`, `tests/lab/*.test.ts`, and a local candidate fixture app.

**Interfaces:** Produce `prepareCandidate`, `renderCandidate`, `captureCandidate`, and `exerciseCandidate`.

- [ ] Write tests for isolated directories, scripts-disabled installation commands, five viewports, hover/focus/open/loading/reduced-motion evidence, console/network collection, and cleanup.
- [ ] Confirm failures.
- [ ] Implement the local lab with injected process/browser drivers and Playwright production adapters.
- [ ] Run tests plus one fixture render, typecheck, and commit.

### Task 8: Component Normalization and Site Compiler

**Files:** Create `src/site/design-system.ts`, `src/site/generator.ts`, `src/site/templates/*`, `tests/site/*.test.ts`, and `skills/site-foundry/SKILL.md` after its baseline invocation test.

**Interfaces:** Produce `compileDesignSystem`, `validateReusePolicy`, and `generateSite` returning file and adaptation manifests.

- [ ] Run a baseline skill-use scenario and record its failure to enforce search/render/license/cohesion gates.
- [ ] Write failing tests for tokens, routes, states, reuse math, waivers, local assets, no dead navigation, and the generated build.
- [ ] Implement the compact skill policy, templates, token compiler, source copier, and waiver validator.
- [ ] Re-run skill scenarios, generated-site tests, typecheck, and commit.

### Task 9: Audit, Repair, and Proof Packaging

**Files:** Create `src/audit/audit.ts`, `src/audit/repair.ts`, `src/proof/package.ts`, `tests/audit/*.test.ts`, and `tests/proof/package.test.ts`.

**Interfaces:** Produce `auditSite`, `repairFromEvidence`, and `packageDelivery`.

- [ ] Write tests for axe severity, console/network/link failures, responsive overflow, reduced motion, content claims, ranked defects, six-pass cap, unresolved report, and complete proof index.
- [ ] Confirm failures.
- [ ] Implement deterministic audits, bounded repair instructions, and hash-indexed proof packaging.
- [ ] Run focused tests, typecheck, and commit.

### Task 10: Orchestrator and CLI

**Files:** Create `src/orchestrator.ts`, `src/cli.ts`, `tests/orchestrator.test.ts`, and `tests/cli.test.ts`.

**Interfaces:** Produce `runFoundry(options)` and CLI commands `run`, `resume`, `inspect`, `sources`, and `evaluate`.

- [ ] Write integration tests for a complete run, interruption/resume, rejected candidates, repair success, terminal failure report, and inspect output.
- [ ] Confirm failures.
- [ ] Wire every module through the state transitions and expose the CLI.
- [ ] Run integration tests and commit.

### Task 11: Evaluation Harness and Thirty Locked Briefs

**Files:** Create `src/evaluation/harness.ts`, thirty fixtures under `evaluation/briefs/`, `evaluation/rubric.yaml`, `tests/evaluation/harness.test.ts`, and `docs/evaluation.md`.

**Interfaces:** Produce `runEvaluation`, `summarizeEvaluation`, and immutable brief-suite hashes.

- [ ] Write tests for thirty distinct briefs, baseline/foundry budget parity, blind preference inputs, provenance/access/reuse/cohesion metrics, and suite tamper detection.
- [ ] Confirm failures.
- [ ] Implement the harness, reports, and locked brief corpus.
- [ ] Run evaluation tests and commit.

### Task 12: Live Vertical Slice, Documentation, and Publication

**Files:** Create `README.md`, `LICENSE`, `.github/workflows/ci.yml`, example briefs, and generated runtime proof excluded from Git where bulky.

**Interfaces:** The published repository exposes `npm run build`, `npm test`, `npm run typecheck`, and `site-foundry run`.

- [ ] Run a public no-account source lookup and record canonical/license evidence.
- [ ] Run the CLI against an example brief, resume it, build the generated site, and audit desktop/mobile routes.
- [ ] Run the full test, typecheck, build, skill validation, and secret/artifact scans.
- [ ] Write usage and architecture documentation from observed commands and evidence.
- [ ] Commit the final verified unit, create `laulpogan/site-foundry`, push the branch, and report repository and branch URLs.
