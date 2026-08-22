import { describe, expect, it } from "vitest";
import { deriveDirections } from "../../src/design/directions.js";
import { buildBlindComparison, runPairwiseTournament, scoreCandidate } from "../../src/design/rank.js";
import { optimizeComponentSet } from "../../src/design/optimizer.js";
import type { Candidate, CandidateScores, DesignDNA, SiteSpec } from "../../src/core/types.js";

const scores = (dna_fit: number): CandidateScores => ({
  dna_fit,
  craftsmanship: 90,
  hierarchy: 85,
  typography: 80,
  responsive: 90,
  motion: 75,
  accessibility: 90,
  integration_cost: 85,
});

const candidate = (id: string, slot: string, family: string, fit: number, overrides: Partial<Candidate> = {}): Candidate => ({
  id,
  slot,
  source_id: `${family}-source`,
  source_url: `https://example.com/${id}`,
  status: "rendered",
  foundation_family: family,
  dependencies: ["clsx"],
  style: {
    type_scale: "aggressive",
    container_width: 1240,
    density: "moderate",
    radius: "low",
    border_weight: "thin",
    shadow: "rare",
    color_temperature: "warm",
    icon_stroke: "1.5",
    motion_duration: 180,
    motion_easing: "ease-out",
    media_treatment: "single-object",
    surface_depth: "flat",
    animation_runtime: "motion",
    dependency_family: family,
  },
  scores: scores(fit),
  ...overrides,
});

const spec: SiteSpec = {
  site_type: "marketing",
  audience: ["engineers"],
  primary_goal: "book-demo",
  routes: [{ path: "/", purpose: "convert" }],
  required_interactions: [],
  brand_attributes: ["precise", "technical"],
  content_density: "moderate",
  motion_level: "restrained",
  stack: "react-typescript-tailwind",
  assumptions: [],
  prohibited_claims: [],
};

const dna: DesignDNA = {
  thesis: "quiet technical confidence",
  layout: { grid: "12-column", max_width: 1240, section_rhythm: "large" },
  typography: { display_character: "heavy geometric", body_character: "neutral grotesk", scale: "aggressive" },
  color: { base: "warm neutral", accent_count: 1, contrast: "high" },
  geometry: { radius: "low", borders: "thin", shadows: "rare" },
  media: { treatment: "single oversized focal object" },
  motion: { energy: "restrained", durations: "fast", signature_effects_per_page: 1 },
  density: "low-marketing-medium-product",
  anti_patterns: ["glass everywhere"],
};

describe("design directions", () => {
  it("derives three deliberately distinct directions", () => {
    const directions = deriveDirections(spec, [
      { source_url: "https://one.example", observations: ["large type", "warm neutral", "single product object"] },
      { source_url: "https://two.example", observations: ["editorial grid", "serif display", "dense text"] },
      { source_url: "https://three.example", observations: ["dark canvas", "kinetic diagrams", "high contrast"] },
    ]);
    expect(directions).toHaveLength(3);
    expect(new Set(directions.map((direction) => direction.dna.thesis)).size).toBe(3);
    expect(directions.map((direction) => direction.id)).toEqual(["quiet-industrial", "editorial-technical", "cinematic-kinetic"]);
  });
});

describe("candidate ranking", () => {
  it("applies the declared weighted score", () => {
    expect(scoreCandidate(scores(100))).toBeCloseTo(89.3, 1);
  });

  it("builds critic comparisons without source identity or popularity", () => {
    const payload = buildBlindComparison(candidate("a", "hero", "shadcn", 90), candidate("b", "hero", "shadcn", 80), spec, dna);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("source_id");
    expect(serialized).not.toContain("example.com");
    expect(payload).toMatchObject({ slot: "hero", candidate_a: { id: "A" }, candidate_b: { id: "B" } });
  });

  it("runs a deterministic pairwise tournament with a pluggable critic", async () => {
    const result = await runPairwiseTournament(
      [candidate("a", "hero", "shadcn", 70), candidate("b", "hero", "shadcn", 90), candidate("c", "hero", "shadcn", 80)],
      spec,
      dna,
      async (comparison) => ({ winner: comparison.candidate_a.weighted_score >= comparison.candidate_b.weighted_score ? "A" : "B", evidence: "hierarchy", confidence: 0.8 }),
    );
    expect(result[0]?.candidate.id).toBe("b");
    expect(result[0]?.wins).toBe(2);
  });
});

describe("component-set optimizer", () => {
  it("selects a coherent family instead of independent slot winners", () => {
    const result = optimizeComponentSet({
      hero: [candidate("hero-a", "hero", "shadcn", 88), candidate("hero-b", "hero", "other", 99)],
      navigation: [candidate("nav-a", "navigation", "shadcn", 90), candidate("nav-b", "navigation", "other", 60)],
      footer: [candidate("footer-a", "footer", "shadcn", 90), candidate("footer-b", "footer", "other", 60)],
    }, dna);
    expect(result.foundation).toBe("shadcn");
    expect(result.selections.map((selection) => selection.candidate_id)).toEqual(["footer-a", "hero-a", "nav-a"]);
  });

  it("enforces one motion runtime and at most two accent sources", () => {
    const result = optimizeComponentSet({
      hero: [candidate("hero", "hero", "shadcn", 90, { accent_source: "magic-ui" })],
      demo: [candidate("demo", "demo", "shadcn", 90, { accent_source: "react-bits" })],
      footer: [candidate("footer", "footer", "shadcn", 90)],
    }, dna);
    expect(result.accents).toEqual(["magic-ui", "react-bits"]);
    expect(result.motion_runtime).toBe("motion");
  });

  it("fails when no complete coherent set exists", () => {
    let failure: unknown;
    try {
      optimizeComponentSet({
        hero: [candidate("hero", "hero", "one", 90)],
        footer: [candidate("footer", "footer", "two", 90)],
      }, dna);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "NO_FEASIBLE_COMPONENT_SET" });
  });
});
