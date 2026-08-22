import { describe, expect, it } from "vitest";
import { scanPackage } from "../../src/security/scan.js";

describe("scanPackage", () => {
  it("accepts inert local component source", () => {
    const report = scanPackage({
      packageJson: { dependencies: { clsx: "2.1.1" } },
      files: {
        "button.tsx": "export function Button() { return <button>Save</button> }",
        "styles.css": ".button { color: var(--foreground); }",
      },
      allowedDependencies: ["clsx"],
    });
    expect(report).toMatchObject({ passed: true, findings: [] });
  });

  it.each([
    ["lifecycle-script", { packageJson: { scripts: { postinstall: "node setup.js" } }, files: {} }],
    ["remote-script", { packageJson: {}, files: { "widget.tsx": "const s = document.createElement('script'); s.src = 'https://tracker.example/a.js'" } }],
    ["analytics", { packageJson: { dependencies: { "@segment/analytics-next": "1.0.0" } }, files: {} }],
    ["dynamic-code", { packageJson: {}, files: { "widget.ts": "eval(payload)" } }],
    ["shell-execution", { packageJson: {}, files: { "widget.ts": "import { exec } from 'node:child_process'; exec(command)" } }],
    ["environment-read", { packageJson: {}, files: { "widget.ts": "const key = process.env.SECRET_KEY" } }],
    ["undeclared-network", { packageJson: {}, files: { "widget.ts": "await fetch(userUrl)" } }],
    ["dependency-not-allowed", { packageJson: { dependencies: { unknown: "1.0.0" } }, files: {} }],
  ])("rejects %s", (code, input) => {
    const report = scanPackage({ ...input, allowedDependencies: [] });
    expect(report.passed).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({ code }));
  });
});
