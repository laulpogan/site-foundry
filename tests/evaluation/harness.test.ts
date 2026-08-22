import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { loadLockedBriefs, runEvaluation, summarizeEvaluation, verifyLockedSuite } from "../../src/evaluation/harness.js";

describe("locked evaluation suite", () => {
  it("contains thirty distinct marketing and software-product briefs", async () => {
    const suite = await loadLockedBriefs();
    expect(suite).toHaveLength(30);
    expect(new Set(suite.map((item) => item.id)).size).toBe(30);
    expect(new Set(suite.map((item) => item.kind))).toEqual(new Set(["marketing", "saas-product"]));
    expect(new Set(suite.map((item) => item.segment)).size).toBeGreaterThanOrEqual(8);
    await expect(verifyLockedSuite()).resolves.toMatchObject({ valid: true, briefs: 30 });
  });

  it("detects fixture tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-eval-"));
    await writeFile(join(root, "one.json"), '{"id":"one"}\n', "utf8");
    await writeFile(join(root, "manifest.json"), '{"briefs":1,"sha256":"deadbeef"}\n', "utf8");
    await expect(verifyLockedSuite(root, join(root, "manifest.json"))).rejects.toThrow(/hash mismatch/i);
  });
});

describe("evaluation harness", () => {
  it("runs both systems with the same frozen budget and builds blind comparisons", async () => {
    const foundry = vi.fn(async (brief, budget) => ({ brief_id: brief.id, system: "foundry" as const, budget, reuse_ratio: 0.95, provenance_ratio: 1, access_violations: 0, license_violations: 0, coherence_score: 90, functional_failures: 0, accessibility_failures: 0, custom_component_count: 1, screenshots: [`${brief.id}-f.png`] }));
    const baseline = vi.fn(async (brief, budget) => ({ brief_id: brief.id, system: "baseline" as const, budget, reuse_ratio: 0.4, provenance_ratio: 0.5, access_violations: 0, license_violations: 0, coherence_score: 70, functional_failures: 0, accessibility_failures: 0, custom_component_count: 8, screenshots: [`${brief.id}-b.png`] }));
    const result = await runEvaluation({ foundry, baseline, budget: { model_calls: 12, implementation_minutes: 60 } });
    expect(foundry).toHaveBeenCalledTimes(30);
    expect(baseline).toHaveBeenCalledTimes(30);
    expect(foundry.mock.calls[0]?.[1]).toEqual(baseline.mock.calls[0]?.[1]);
    expect(result.comparisons[0]).toEqual(expect.objectContaining({ candidate_a: expect.any(Object), candidate_b: expect.any(Object) }));
    expect(JSON.stringify(result.comparisons)).not.toContain('"system"');
  });

  it("computes the release gates from human preferences and measured evidence", () => {
    const cases = Array.from({ length: 30 }, (_, index) => ({
      brief_id: `brief-${index}`,
      foundry: { reuse_ratio: 0.95, provenance_ratio: 1, access_violations: 0, license_violations: 0, coherence_score: 90, functional_failures: 0, accessibility_failures: 0, custom_component_count: 1 },
      baseline: { reuse_ratio: 0.5, provenance_ratio: 0.5, access_violations: 0, license_violations: 0, coherence_score: 70, functional_failures: 0, accessibility_failures: 0, custom_component_count: 6 },
      preference: index < 21 ? "foundry" as const : "baseline" as const,
    }));
    expect(summarizeEvaluation(cases)).toMatchObject({
      blind_preference_win_rate: 0.7,
      reuse_gate: true,
      provenance_gate: true,
      access_gate: true,
      license_gate: true,
      coherence_gate: true,
      functional_gate: true,
      accessibility_gate: true,
      custom_component_gate: true,
      release_ready: true,
    });
  });
});
