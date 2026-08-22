import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { auditSite } from "../../src/audit/audit.js";
import { repairFromEvidence } from "../../src/audit/repair.js";
import type { SiteSpec } from "../../src/core/types.js";

const spec: SiteSpec = {
  site_type: "marketing",
  audience: ["engineers"],
  primary_goal: "book-demo",
  routes: [{ path: "/", purpose: "convert" }, { path: "/product", purpose: "explain" }],
  required_interactions: [],
  brand_attributes: ["precise"],
  content_density: "moderate",
  motion_level: "restrained",
  stack: "react-typescript-tailwind",
  assumptions: [],
  prohibited_claims: ["Fortune 500", "SOC 2"],
};

const passingPage = {
  console_errors: [],
  failed_requests: [],
  links: ["/", "/product"],
  horizontal_overflow: false,
  axe_violations: [],
  keyboard_navigation: true,
  visible_focus: true,
  reduced_motion: true,
  text: "Precise product copy with demo data.",
};

describe("site audit", () => {
  it("passes complete clean route and viewport evidence", async () => {
    const driver = { auditPage: vi.fn(async () => passingPage) };
    const report = await auditSite("http://127.0.0.1:4173", spec, driver);
    expect(report.acceptance_gates_passed).toBe(true);
    expect(report.issues).toEqual([]);
    expect(driver.auditPage).toHaveBeenCalledTimes(10);
  });

  it("ranks runtime, accessibility, responsive, motion, link, and content defects", async () => {
    const driver = { auditPage: vi.fn(async () => ({
      console_errors: ["Hydration failed"],
      failed_requests: ["/api/demo 500"],
      links: ["/missing"],
      horizontal_overflow: true,
      axe_violations: [{ id: "color-contrast", impact: "serious", description: "Low contrast" }],
      keyboard_navigation: false,
      visible_focus: false,
      reduced_motion: false,
      text: "Trusted by Fortune 500 teams. SOC 2 certified.",
    })) };
    const report = await auditSite("http://127.0.0.1:4173", spec, driver);
    expect(report.acceptance_gates_passed).toBe(false);
    for (const code of ["console-error", "failed-request", "dead-link", "horizontal-overflow", "axe-serious", "keyboard-navigation", "visible-focus", "reduced-motion", "prohibited-claim"]) {
      expect(report.issues).toContainEqual(expect.objectContaining({ code }));
    }
    expect(report.issues[0]?.severity).toBe("critical");
  });
});

describe("repair loop", () => {
  it("applies ranked repairs and writes a pass artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-repair-"));
    const repairer = vi.fn(async () => ({ changed_files: ["src/styles.css"], notes: ["bounded overflow"] }));
    const result = await repairFromEvidence(root, {
      acceptance_gates_passed: false,
      issues: [{ code: "horizontal-overflow", severity: "serious", message: "overflow", route: "/", viewport: "320x720" }],
      pages_audited: 1,
    }, 1, repairer);
    expect(result).toMatchObject({ status: "repaired", pass: 1, changed_files: ["src/styles.css"] });
    expect(JSON.parse(await readFile(join(root, "repair-pass-1.json"), "utf8"))).toMatchObject({ status: "repaired" });
  });

  it("stops after six passes and writes unresolved defects without another mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-repair-"));
    const repairer = vi.fn();
    const result = await repairFromEvidence(root, {
      acceptance_gates_passed: false,
      issues: [{ code: "axe-serious", severity: "serious", message: "contrast", route: "/", viewport: "390x844" }],
      pages_audited: 1,
    }, 6, repairer);
    expect(result.status).toBe("unresolved");
    expect(repairer).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(join(root, "unresolved-defects.json"), "utf8"))).toMatchObject({ repair_passes: 6 });
  });
});
