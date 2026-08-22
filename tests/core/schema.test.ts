import { describe, expect, it } from "vitest";
import { validateArtifact } from "../../src/core/schema.js";

const validSpec = {
  site_type: "marketing",
  audience: ["engineering teams"],
  primary_goal: "book-demo",
  routes: [{ path: "/", purpose: "convert visitors" }],
  required_interactions: ["open-mobile-navigation"],
  brand_attributes: ["precise"],
  content_density: "moderate",
  motion_level: "restrained",
  stack: "react-typescript-tailwind",
  assumptions: [],
  prohibited_claims: ["customer counts"],
};

describe("artifact schemas", () => {
  it("accepts a complete site specification", () => {
    expect(validateArtifact("site-spec", validSpec)).toEqual(validSpec);
  });

  it("rejects a site specification without routes", () => {
    expect(() => validateArtifact("site-spec", { ...validSpec, routes: [] })).toThrow(
      /site-spec.*routes/i,
    );
  });

  it("rejects provenance without an explicit approved license", () => {
    const record = {
      component_id: "button",
      source_url: "https://example.com/button",
      canonical_repository: "https://github.com/example/components",
      revision: "abc123",
      author: "Example",
      license: "unknown",
      files_copied: ["button.tsx"],
      dependencies_added: [],
      adaptations: [],
      screenshots: [],
      decision: "accepted",
    };

    expect(() => validateArtifact("provenance", record)).toThrow(/license/i);
  });

  it("rejects component sets with more than two accent sources", () => {
    const set = {
      foundation: "shadcn",
      accents: ["magic-ui", "react-bits", "aceternity"],
      icon_family: "lucide",
      motion_runtime: "motion",
      selections: [],
    };

    expect(() => validateArtifact("component-set", set)).toThrow(/accents/i);
  });

  it("accepts every declared run state and rejects unknown states", () => {
    expect(validateArtifact("run-state", { state: "BRIEFED", revision: 1 })).toMatchObject({
      state: "BRIEFED",
    });
    expect(() => validateArtifact("run-state", { state: "DONE", revision: 1 })).toThrow(
      /state/i,
    );
  });
});
