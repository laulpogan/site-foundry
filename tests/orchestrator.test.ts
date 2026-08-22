import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runFoundry, type FoundryServices } from "../src/orchestrator.js";
import { RunStore } from "../src/core/run-store.js";
import type { Candidate, CandidateScores, ProvenanceRecord } from "../src/core/types.js";

const score: CandidateScores = { dna_fit: 90, craftsmanship: 90, hierarchy: 90, typography: 90, responsive: 90, motion: 90, accessibility: 90, integration_cost: 90 };
const button: Candidate = {
  id: "shadcn-button",
  slot: "button",
  source_id: "shadcn",
  source_url: "https://ui.shadcn.com/button.json",
  status: "rendered",
  foundation_family: "shadcn",
  dependencies: [],
  style: { type_scale: "aggressive", container_width: 1240, density: "moderate", radius: "low", border_weight: "thin", shadow: "rare", color_temperature: "warm", icon_stroke: "1.5", motion_duration: 180, motion_easing: "ease-out", media_treatment: "single-object", surface_depth: "flat", animation_runtime: "motion", dependency_family: "shadcn" },
  scores: score,
};
const provenance: ProvenanceRecord = {
  component_id: "shadcn-button",
  source_url: button.source_url,
  canonical_repository: "https://github.com/shadcn-ui/ui",
  revision: "abc123",
  author: "shadcn",
  license: "MIT",
  files_copied: ["components/ui/button.tsx"],
  dependencies_added: [],
  adaptations: ["tokens"],
  screenshots: ["button.png"],
  decision: "accepted",
};

function services(overrides: Partial<FoundryServices> = {}): FoundryServices {
  return {
    scoutReferences: vi.fn(async () => [
      { source_url: "https://land-book.com", observations: ["large type", "single focal object"] },
      { source_url: "https://lapa.ninja", observations: ["warm neutral", "clear hierarchy"] },
      { source_url: "https://onepagelove.com", observations: ["restrained motion", "strong rhythm"] },
    ]),
    selectDirection: vi.fn(async (directions) => directions[0]!),
    discoverAndRender: vi.fn(async () => ({
      ranked: { button: [button] },
      packages: [{ kind: "source-package" as const, name: "button", source_url: button.source_url, canonical_repository: provenance.canonical_repository, revision: provenance.revision, license: "MIT", dependencies: [], files: [{ path: "button.tsx", target: "components/ui/button.tsx", type: "registry:ui", content: "import * as React from 'react'; export function Button(props: React.ComponentProps<'button'>) { return <button {...props} /> }" }] }],
      provenance: [provenance],
      reuse: { visible_component_count: 1, reused_component_count: 1, waivers: [] },
    })),
    audit: vi.fn(async () => ({ report: { acceptance_gates_passed: true, issues: [], pages_audited: 35 }, screenshots: ["desktop.png", "mobile.png"], recordings: ["interaction.webm"] })),
    repair: vi.fn(async (_target, report, pass) => ({ status: "repaired" as const, pass, issues: report.issues, changed_files: ["src/styles.css"], notes: ["fixed"] })),
    package: vi.fn(async () => ({ complete: true, acceptance_gates_passed: true, created_at: "2026-08-22T00:00:00.000Z", files: [] })),
    ...overrides,
  };
}

const brief = { brief: "Build a precise marketing launch site for engineering teams. Book a demo.", site_type: "marketing" };

describe("runFoundry", () => {
  it("drives every state through the live generated-site caller", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-run-"));
    const target = join(root, "site");
    const result = await runFoundry({ runId: "complete", runtimeRoot: join(root, "runtime"), target, brief, services: services() });
    expect(result.status).toBe("shipped");
    const record = await new RunStore(join(root, "runtime", "runs")).load("complete");
    expect(record.current.state).toBe("SHIPPED");
    expect(record.history.map((state) => state.state)).toEqual([
      "BRIEFED", "ARCHETYPE_SELECTED", "REFERENCES_SCOUTED", "DESIGN_DNA_LOCKED", "PAGE_SLOTS_PLANNED", "CANDIDATES_RENDERED", "COMPONENT_SET_SELECTED", "DESIGN_SYSTEM_COMPILED", "SITE_BUILT", "AUDITED", "SHIPPED",
    ]);
    expect(await readFile(join(target, "src/App.tsx"), "utf8")).toContain("Button");
  });

  it("resumes from the last completed state after interruption", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-run-"));
    const runtimeRoot = join(root, "runtime");
    const target = join(root, "site");
    const broken = services({ scoutReferences: vi.fn(async () => { throw new Error("network interrupted"); }) });
    await expect(runFoundry({ runId: "resume", runtimeRoot, target, brief, services: broken })).rejects.toThrow(/network interrupted/);
    expect((await new RunStore(join(runtimeRoot, "runs")).load("resume")).current.state).toBe("ARCHETYPE_SELECTED");

    const healthy = services();
    const result = await runFoundry({ runId: "resume", runtimeRoot, target, brief, services: healthy, resume: true });
    expect(result.status).toBe("shipped");
    expect(healthy.scoutReferences).toHaveBeenCalledOnce();
  });

  it("writes explicit failure evidence when no coherent component set exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-run-"));
    const runtimeRoot = join(root, "runtime");
    const empty = services({ discoverAndRender: vi.fn(async () => ({ ranked: {}, packages: [], provenance: [], reuse: { visible_component_count: 1, reused_component_count: 0, waivers: [] } })) });
    await expect(runFoundry({ runId: "rejected", runtimeRoot, target: join(root, "site"), brief, services: empty })).rejects.toMatchObject({ code: "NO_FEASIBLE_COMPONENT_SET" });
    expect(JSON.parse(await readFile(join(runtimeRoot, "runs", "rejected", "failure.json"), "utf8"))).toMatchObject({ state: "CANDIDATES_RENDERED" });
  });

  it("stops unshipped when defects remain after six repair passes", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-run-"));
    let audits = 0;
    const failing = services({
      audit: vi.fn(async () => ({ report: { acceptance_gates_passed: false, issues: [{ code: "axe-serious", severity: "serious" as const, message: "contrast", route: "/", viewport: "390x844" }], pages_audited: 5 }, screenshots: ["desktop.png", "mobile.png"], recordings: ["interaction.webm"] })),
      repair: vi.fn(async (_target, report, pass) => { audits += 1; return { status: (pass >= 6 ? "unresolved" : "repaired") as "unresolved" | "repaired", pass, issues: report.issues, changed_files: [], notes: [] }; }),
      package: vi.fn(async () => ({ complete: false, acceptance_gates_passed: false, created_at: "2026-08-22T00:00:00.000Z", files: [] })),
    });
    const result = await runFoundry({ runId: "failed-audit", runtimeRoot: join(root, "runtime"), target: join(root, "site"), brief, services: failing });
    expect(result.status).toBe("unresolved");
    expect(audits).toBe(6);
    expect((await new RunStore(join(root, "runtime", "runs")).load("failed-audit")).current.state).toBe("REPAIRED");
  });
});
