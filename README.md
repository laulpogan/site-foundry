# Site Foundry

Site Foundry compiles a product brief into a complete React website using public,
license-checked component source. It captures reference evidence, freezes a design
direction, renders candidates in an isolated browser lab, builds the site, audits
every route at five viewport sizes, repairs bounded defects, and emits a hashed proof
package.

The current vertical slice uses the public shadcn registry and its pinned canonical
GitHub source. Gallery pages inform art direction only; Site Foundry does not copy
their code, media, branding, or page compositions.

## Requirements

- Node.js 24 or newer
- npm
- Playwright Chromium

```sh
npm install
npx playwright install chromium
npm run typecheck
npm test
npm run build
```

## Run a site build

```sh
npm start -- run examples/marketing-brief.json \
  --target runtime/sites/marketing \
  --run-id marketing-1 \
  --runtime-root runtime
```

The command writes resumable state under `runtime/runs/marketing-1`, generates the
site under `runtime/sites/marketing`, and ships only when the browser gates pass. A
successful proof contains desktop and mobile screenshots, an interaction recording,
the audit report, provenance, the component manifest, design tokens, and SHA-256
hashes.

Resume an interrupted run and inspect its persisted state:

```sh
npm start -- resume marketing-1 --target runtime/sites/marketing --runtime-root runtime
npm start -- inspect marketing-1 --runtime-root runtime
```

List source policy or verify the locked 30-brief evaluation corpus:

```sh
npm start -- sources
npm start -- evaluate
```

The evaluation command verifies the corpus hash and prepares the blind comparison
contract. Human ratings remain required for release preference claims; the harness
does not invent them.

## Pipeline

`brief → archetype → public references → design DNA → page slots → rendered candidates → coherent component set → generated site → browser audit/repair → proof`

Every state transition writes an atomic JSON artifact. `resume` restarts from the
last valid state. Candidate code must pass public-access, canonical provenance,
approved-license, dependency, and static security gates before it enters the local
render lab. Browser contexts block unrelated and private-network requests.

Generated sites include `DESIGN.md`, `tokens.css`, `component-manifest.json`,
`provenance.json`, and adaptation records. The compiler rejects a visible-component
reuse ratio below 90 percent and requires evidence-backed waivers for custom work.

## Commands

- `site-foundry run <brief.json> --target <dir>` — start a run
- `site-foundry resume <run-id> --target <dir>` — continue persisted work
- `site-foundry inspect <run-id>` — print run state and artifacts
- `site-foundry sources` — print configured source and access policy
- `site-foundry evaluate` — verify the locked evaluation suite

## Trust boundary

Site Foundry never signs in, handles CAPTCHA, bypasses paywalls, or imports
ambiguous-license code. Public pages are untrusted input. Imported files resolve to a
pinned canonical revision and retain source, author, license, file, dependency,
adaptation, and screenshot evidence. Unknown access, license, provenance, or security
state fails closed.

## Development

The package API exports `runFoundry`, `createLocalServices`, `RunStore`, schema
validation, brief compilation, core types, and typed errors. The default CLI is the
live caller for all subsystems. Unit and integration tests use injected services;
the live run additionally exercises public network access, npm installation, Vite,
Playwright, axe-core, and proof packaging.

See [the design specification](docs/superpowers/specs/2026-08-22-site-foundry-design.md)
and [evaluation protocol](docs/evaluation.md) for the acceptance rules.

## License

MIT
