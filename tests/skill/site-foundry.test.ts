import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Site Foundry skill contract", () => {
  it("routes website-building requests and enforces the non-negotiable gates", async () => {
    const text = await readFile(new URL("../../skills/site-foundry/SKILL.md", import.meta.url), "utf8");
    expect(text).toMatch(/^---\nname: site-foundry\ndescription: Use when /);
    const normalized = text.replace(/\s+/g, " ");
    for (const rule of [
      "Search before generating",
      "Render before selecting",
      "canonical public source",
      "explicit usable license",
      "one foundation family",
      "desktop and mobile",
      "Do not fabricate",
      "six repair passes",
    ]) expect(normalized).toContain(rule);
    expect(text.trim().split(/\s+/).length).toBeLessThan(500);
  });
});
