import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { captureCandidate, DEFAULT_VIEWPORTS } from "../../src/lab/capture.js";
import { exerciseCandidate } from "../../src/lab/interactions.js";
import { renderCandidate } from "../../src/lab/render.js";
import { installCandidate, prepareCandidate } from "../../src/lab/workspace.js";

describe("candidate workspace", () => {
  it("copies approved source into an isolated workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-lab-root-"));
    const workspace = await prepareCandidate(root, {
      kind: "source-package",
      name: "button",
      source_url: "https://example.com/button.json",
      revision: "abc123",
      files: [{ path: "registry/button.tsx", target: "components/ui/button.tsx", type: "registry:ui", content: "export const Button = () => null" }],
      dependencies: ["clsx"],
    });
    expect(workspace.path.startsWith(root)).toBe(true);
    expect(await readFile(join(workspace.path, "components/ui/button.tsx"), "utf8")).toContain("Button");
    expect(JSON.parse(await readFile(join(workspace.path, "candidate.json"), "utf8"))).toMatchObject({ source_url: "https://example.com/button.json", revision: "abc123" });
  });

  it("rejects target path traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-lab-root-"));
    await expect(prepareCandidate(root, {
      kind: "source-package",
      name: "escape",
      source_url: "https://example.com/escape.json",
      files: [{ path: "escape.ts", target: "../../escape.ts", type: "registry:ui", content: "bad" }],
      dependencies: [],
    })).rejects.toMatchObject({ code: "SECURITY_REJECTED" });
  });

  it("installs allowlisted dependencies with lifecycle scripts disabled", async () => {
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    await installCandidate("/tmp/foundry-candidate", ["clsx@2.1.1", "motion@12.0.0"], runner);
    expect(runner).toHaveBeenCalledWith("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", "clsx@2.1.1", "motion@12.0.0"], expect.objectContaining({ cwd: "/tmp/foundry-candidate", network: "package-registry-only" }));
  });
});

describe("candidate evidence", () => {
  it("captures all required desktop and mobile viewports", async () => {
    const driver = { capture: vi.fn(async () => ({ screenshots: [], console_errors: [], failed_requests: [], states: [] })) };
    await captureCandidate("http://127.0.0.1:4173", "/tmp/evidence", driver);
    expect(driver.capture).toHaveBeenCalledWith(expect.objectContaining({
      viewports: DEFAULT_VIEWPORTS,
      network_policy: "local-only",
    }));
    expect(DEFAULT_VIEWPORTS).toEqual([
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 720 },
    ]);
  });

  it("requests hover, focus, open, loading, and reduced-motion states", async () => {
    const driver = { exercise: vi.fn(async () => ["hover", "focus", "open", "loading", "reduced-motion"]) };
    expect(await exerciseCandidate("http://127.0.0.1:4173", "/tmp/evidence", driver)).toEqual([
      "hover", "focus", "open", "loading", "reduced-motion",
    ]);
    expect(driver.exercise).toHaveBeenCalledWith(expect.objectContaining({ network_policy: "local-only" }));
  });

  it("stops the isolated server after render evidence is collected", async () => {
    const stop = vi.fn(async () => undefined);
    const processDriver = { start: vi.fn(async () => ({ url: "http://127.0.0.1:4173", stop })) };
    const captureDriver = { capture: vi.fn(async () => ({ screenshots: ["desktop.png"], console_errors: [], failed_requests: [], states: [] })) };
    const interactionDriver = { exercise: vi.fn(async () => ["focus"]) };
    const result = await renderCandidate({ workspace: "/tmp/candidate", output: "/tmp/evidence", processDriver, captureDriver, interactionDriver });
    expect(result.screenshots).toEqual(["desktop.png"]);
    expect(stop).toHaveBeenCalledOnce();
  });
});
