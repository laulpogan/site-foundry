import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDesignSystem } from "../../src/site/design-system.js";
import { generateSite, validateReusePolicy } from "../../src/site/generator.js";
import type { ComponentSet, DesignDNA, SiteSpec } from "../../src/core/types.js";

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

const set: ComponentSet = {
  foundation: "shadcn",
  accents: [],
  icon_family: "lucide",
  motion_runtime: "motion",
  selections: [{ slot: "button", candidate_id: "shadcn-button" }],
};

const spec: SiteSpec = {
  site_type: "marketing",
  audience: ["engineering teams"],
  primary_goal: "book-demo",
  routes: [
    { path: "/", purpose: "convert visitors" },
    { path: "/product", purpose: "explain the product" },
    { path: "/contact", purpose: "capture contact" },
  ],
  required_interactions: ["open-mobile-navigation", "submit-contact-form"],
  brand_attributes: ["precise", "technical"],
  content_density: "moderate",
  motion_level: "restrained",
  stack: "react-typescript-tailwind",
  assumptions: ["Product facts remain neutral editable copy"],
  prohibited_claims: ["customer logos", "testimonials"],
};

describe("design-system compiler", () => {
  it("compiles frozen DNA into DESIGN.md and CSS tokens", () => {
    const result = compileDesignSystem(dna, set);
    expect(result.designMarkdown).toContain("quiet technical confidence");
    expect(result.designMarkdown).toContain("Foundation: shadcn");
    expect(result.tokensCss).toContain("--container-max: 1240px");
    expect(result.tokensCss).toContain("--motion-fast: 180ms");
  });
});

describe("reuse policy", () => {
  it("accepts at least 90 percent imported visible components", () => {
    expect(validateReusePolicy({ visible_component_count: 10, reused_component_count: 9, waivers: [] })).toMatchObject({ reuse_ratio: 0.9 });
  });

  it("rejects a reuse ratio below 90 percent", () => {
    expect(() => validateReusePolicy({ visible_component_count: 10, reused_component_count: 8, waivers: [] })).toThrow(/90%/);
  });

  it("enforces signature and functional exhaustion waivers", () => {
    expect(() => validateReusePolicy({
      visible_component_count: 10,
      reused_component_count: 9,
      waivers: [{ slot: "hero", classification: "signature", source_families_searched: 2, candidates_rendered: 11, rejections: [], composition_attempted: true, why_new_code_is_required: "No fit", primitives_reused: [] }],
    })).toThrow(/12 rendered candidates.*three source families/i);
    expect(() => validateReusePolicy({
      visible_component_count: 10,
      reused_component_count: 9,
      waivers: [{ slot: "table", classification: "functional", source_families_searched: 1, candidates_rendered: 5, rejections: [], composition_attempted: true, why_new_code_is_required: "No fit", primitives_reused: [] }],
    })).toThrow(/six rendered candidates/i);
  });
});

describe("site generator", () => {
  it("writes complete routes, working interactions, sourced code, tokens, and provenance", async () => {
    const target = await mkdtemp(join(tmpdir(), "foundry-site-"));
    const result = await generateSite({
      target,
      spec,
      dna,
      componentSet: set,
      reuse: { visible_component_count: 1, reused_component_count: 1, waivers: [] },
      packages: [{
        kind: "source-package",
        name: "button",
        source_url: "https://ui.shadcn.com/r/styles/new-york-v4/button.json",
        canonical_repository: "https://github.com/shadcn-ui/ui",
        revision: "abc123",
        license: "MIT",
        dependencies: [],
        files: [{ path: "button.tsx", target: "components/ui/button.tsx", type: "registry:ui", content: "import * as React from 'react'; export function Button(props: React.ComponentProps<'button'>) { return <button {...props} /> }" }],
      }],
      provenance: [{
        component_id: "shadcn-button",
        source_url: "https://ui.shadcn.com/r/styles/new-york-v4/button.json",
        canonical_repository: "https://github.com/shadcn-ui/ui",
        revision: "abc123",
        author: "shadcn",
        license: "MIT",
        files_copied: ["components/ui/button.tsx"],
        dependencies_added: [],
        adaptations: ["design tokens"],
        screenshots: ["button-mobile.png"],
        decision: "accepted",
      }],
    });

    expect(result.files).toEqual(expect.arrayContaining(["DESIGN.md", "tokens.css", "src/App.tsx", "src/components/ui/button.tsx", "component-manifest.json", "provenance.json"]));
    const app = await readFile(join(target, "src/App.tsx"), "utf8");
    expect(app).toContain('from "./components/ui/button"');
    expect(app).toContain("submit-contact-form");
    expect(app).toContain("/product");
    expect(app).not.toMatch(/lorem ipsum|Fortune 500|99\.99%/i);
    expect(JSON.parse(await readFile(join(target, "component-manifest.json"), "utf8"))).toMatchObject({ reuse_ratio: 1 });
  });

  it("refuses to generate without selected public source packages", async () => {
    const target = await mkdtemp(join(tmpdir(), "foundry-site-"));
    await expect(generateSite({ target, spec, dna, componentSet: set, reuse: { visible_component_count: 1, reused_component_count: 1, waivers: [] }, packages: [], provenance: [] })).rejects.toThrow(/selected source package/i);
  });
});
