import { describe, expect, it } from "vitest";
import { runHardGates } from "../../src/security/gates.js";

const passingInput = {
  access: { public: true, account_required: false, paywall: false, captcha: false },
  provenance: {
    canonical_repository: "https://github.com/example/components",
    revision: "17ab42",
    files: ["button.tsx"],
  },
  license: { approved: true, license: "MIT", source_url: "https://github.com/example/components/blob/17ab42/LICENSE" },
  scan: { passed: true, findings: [] },
  integration: {
    framework_compatible: true,
    mobile_usable: true,
    keyboard_usable: true,
    dependencies_allowed: true,
    adds_animation_runtime: false,
    adds_icon_family: false,
  },
};

describe("runHardGates", () => {
  it("accepts only complete public, licensed, safe, compatible evidence", () => {
    expect(runHardGates(passingInput)).toEqual({ passed: true, findings: [] });
  });

  it.each([
    ["account-required", { access: { ...passingInput.access, account_required: true } }],
    ["license-rejected", { license: { ...passingInput.license, approved: false } }],
    ["provenance-missing", { provenance: { ...passingInput.provenance, revision: "" } }],
    ["static-risk", { scan: { passed: false, findings: [{ code: "dynamic-code", message: "eval" }] } }],
    ["mobile-unusable", { integration: { ...passingInput.integration, mobile_usable: false } }],
    ["keyboard-unusable", { integration: { ...passingInput.integration, keyboard_usable: false } }],
    ["extra-motion-runtime", { integration: { ...passingInput.integration, adds_animation_runtime: true } }],
  ])("fails closed for %s", (code, override) => {
    const report = runHardGates({ ...passingInput, ...override } as typeof passingInput);
    expect(report.passed).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({ code }));
  });
});
