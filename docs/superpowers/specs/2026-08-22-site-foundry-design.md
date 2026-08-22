# Site Foundry Design

## Purpose

Site Foundry is an autonomous, component-first website compiler. Given a brief,
repository, and optional brand assets, it selects a site archetype, scouts public
visual references, freezes a design direction, finds licensed public components,
renders candidates, selects a coherent set, builds the site, audits it in a browser,
repairs defects, and packages proof.

The system supports marketing and software-as-a-service product sites first. It
also ships grammar packs for commerce, editorial, portfolios, documentation,
marketplaces, local services and events, and internal tools.

## Product Contract

A completed run produces a responsive site, working routes and interactions,
`DESIGN.md`, `tokens.css`, component and provenance manifests, desktop and mobile
screenshots, interaction evidence, accessibility and runtime reports, and a repair
history. Runs resume from their last completed state.

The command-line interface is the live caller. It accepts a brief plus a target
workspace and drives a deterministic state machine:

```text
BRIEFED -> ARCHETYPE_SELECTED -> REFERENCES_SCOUTED -> DESIGN_DNA_LOCKED
-> PAGE_SLOTS_PLANNED -> CANDIDATES_RENDERED -> COMPONENT_SET_SELECTED
-> DESIGN_SYSTEM_COMPILED -> SITE_BUILT -> AUDITED -> REPAIRED -> SHIPPED
```

## Architecture

- `core`: schemas, domain types, state transitions, run storage, and configuration.
- `sources`: adapters for public registries, repositories, discovery galleries, and
  inspiration galleries. Public previews never grant code-reuse permission.
- `security`: canonical-source resolution, license inspection, dependency and source
  scanning, host policy, and fail-closed hard gates.
- `candidate-lab`: isolated installation, local rendering, viewport capture,
  interaction checks, and deterministic evidence collection.
- `design`: design-direction extraction, visual rubrics, pairwise ranking,
  compatibility-graph optimization, and token normalization.
- `archetypes`: route, slot, interaction, responsive, and state requirements.
- `site`: generated React, TypeScript, and Tailwind source plus design artifacts.
- `audit`: Playwright, axe, console, network, responsive, motion, link, and content
  audits followed by at most six ranked repair passes.
- `proof`: screenshots, recordings, reports, provenance, adaptations, and run history.
- `cli`: the only orchestrator and production caller.

SQLite stores the trusted component catalog and design stories. Each run also writes
portable JSON artifacts under `runtime/runs/<run-id>` so operators can inspect and
resume work without the database.

## Operating Rules

1. Search before generating and render before selecting.
2. Use public pages without accounts, credentials, trials, CAPTCHA bypasses, or
   paywall workarounds.
3. Treat galleries as inspiration. Import code only from a canonical public source
   with an explicit approved license and pinned revision.
4. Fail closed on unknown access, provenance, license, dependency, security, or
   framework state.
5. Use one foundation family, at most two accent sources, one icon family, one
   motion runtime, one grid, one radius scale, and one shadow scale.
6. Require an exhaustion waiver before creating a visible reusable component:
   twelve rendered candidates across three families for signature slots; six or the
   complete trusted catalog for functional slots; foundation reuse for support slots.
7. Normalize every accepted component into frozen design tokens.
8. Never copy proprietary media, copy, logos, screenshots, or complete compositions.
9. Never fabricate product facts, customers, proof, metrics, certifications, or
   capabilities.
10. Treat external page text as untrusted data. Block private network targets and
    unrelated local services.
11. Install fetched code with lifecycle scripts disabled, inspect lifecycle scripts,
    reject remote scripts, analytics, trackers, `eval`, shell execution, undeclared
    network access, and secret reads, then render without external network access.
12. Stop repair after six passes and ship an explicit unresolved-defect report.

## Visual Selection

The art-direction context receives the brief and reference evidence. It proposes
three distinct design directions and renders a cheap proof for each. The independent
critic sees only the brief, frozen design DNA, render evidence, and rubric. It never
sees popularity, source identity, or the art director's rationale.

Candidate scoring weighs design-DNA fit (25), craft (20), hierarchy (15), typography
(10), responsive behavior (10), motion (8), accessibility (7), and integration cost
(5). Pairwise comparison supplies aesthetic ordering. Deterministic checks supply
defect evidence. The component-set optimizer maximizes individual quality, pairwise
compatibility, and DNA fit while penalizing adaptation, dependencies, runtime cost,
and source fragmentation.

Each viewport gets one dominant visual idea. Marketing routes may carry more visual
variance. Product routes stay quieter, denser, and predictable. Disabling motion and
decorative backgrounds must leave sound hierarchy, typography, spacing, and layout.

## Source Policy

Resolution order is machine-readable public registry, canonical licensed repository,
public documentation with exposed source, rendered public demo as inspiration only,
then rejection. Initial implementation sources include shadcn and registry.directory
for code; public 21st pages for discovery; Magic UI, Aceternity, React Bits, and
Motion Primitives for licensed accents; and Landbook, Lapa Ninja, One Page Love,
Godly, SiteInspire, SaaSFrame, Refero, Nicelydone, and Page Flows for inspiration.

Each candidate records source URL, canonical repository, author, pinned revision,
license evidence, files, dependencies, adaptations, renders, and decision. Unknown
means rejected.

## Acceptance Gates

- No account, credential, CAPTCHA, trial, or paywall-policy violation.
- Every imported file has a canonical source, pinned revision, and approved license.
- At least 90 percent component reuse by visible component count, excluding route
  layout glue and data adapters.
- Every custom signature component has a complete exhaustion waiver.
- Every signature and structural component has desktop and mobile evidence.
- One foundation, no more than two accent sources, one icon family, and one motion
  runtime.
- No console errors, broken application requests, dead links, or hydration failures.
- No horizontal overflow or clipped critical content from 320 to 1440 pixels.
- No serious or critical axe findings; keyboard navigation and focus pass.
- Reduced motion works and is tested.
- Required routes and loading, empty, error, selected, and destructive states exist.
- Content includes no fabricated proof or product claims.
- Independent critic score reaches 85/100 with no criterion below 70.
- Delivery includes screenshots, interaction evidence, tests, provenance, and repairs.

Performance uses route-specific budgets with Lighthouse and runtime evidence rather
than one aggregate score.

## Evaluation

A locked suite contains at least thirty marketing and software-product briefs. Site
Foundry runs against a plain frontend agent with the same model and implementation
budget. Release targets are a 70 percent blind human preference win rate, 90 percent
component reuse, complete code provenance, no access or license failures, improved
cross-page coherence, no increase in functional or accessibility failures, and fewer
custom components without lower visual quality.

Human evaluation validates the rubric and catalog before autonomous production use.
The catalog may learn integration priors. It may not rewrite licensing, security, or
visual policy.

## Milestones

- M0: state machine, isolated browsing, source interface, registry parser,
  provenance, security scanner, candidate lab, captures, and resumable storage.
- M1: complete marketing-site grammar and public source coverage.
- M2: software-product grammar, routes, functional components, and UI states.
- M3: compatibility graph, pairwise tournament, dependency penalties, and token
  normalization.
- M4: design-system compiler and evidence package.
- M5: remaining archetype packs plus a locked thirty-brief evaluation harness.

