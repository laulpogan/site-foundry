import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageDelivery } from "../../src/proof/package.js";

describe("proof package", () => {
  it("writes a hash-indexed package with every required evidence class", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-proof-"));
    const site = join(root, "site");
    const evidence = join(root, "evidence");
    await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(site), mkdir(evidence)]));
    await writeFile(join(site, "DESIGN.md"), "# Design\n", "utf8");
    await writeFile(join(site, "tokens.css"), ":root{}\n", "utf8");
    await writeFile(join(site, "component-manifest.json"), "{}\n", "utf8");
    await writeFile(join(site, "provenance.json"), "[]\n", "utf8");
    await writeFile(join(evidence, "desktop.png"), "png", "utf8");
    await writeFile(join(evidence, "mobile.png"), "png", "utf8");
    await writeFile(join(evidence, "interaction.webm"), "video", "utf8");
    const output = join(root, "proof");

    const index = await packageDelivery({
      output,
      site,
      screenshots: [join(evidence, "desktop.png"), join(evidence, "mobile.png")],
      recordings: [join(evidence, "interaction.webm")],
      audit: { acceptance_gates_passed: true, issues: [], pages_audited: 10 },
      repairs: [],
    });

    expect(index.complete).toBe(true);
    expect(index.files.length).toBeGreaterThanOrEqual(9);
    expect(index.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(JSON.parse(await readFile(join(output, "proof-index.json"), "utf8"))).toEqual(index);
  });

  it("rejects a package without desktop, mobile, and recording evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-proof-"));
    await expect(packageDelivery({ output: join(root, "proof"), site: root, screenshots: [], recordings: [], audit: { acceptance_gates_passed: true, issues: [], pages_audited: 0 }, repairs: [] })).rejects.toThrow(/screenshots.*recording/i);
  });
});
