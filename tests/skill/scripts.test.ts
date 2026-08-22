import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const scripts = [
  "search-sources.ts",
  "capture-reference.ts",
  "extract-design-dna.ts",
  "resolve-component.ts",
  "inspect-license.ts",
  "security-scan.ts",
  "render-candidate.ts",
  "rank-candidates.ts",
  "optimize-component-set.ts",
  "compile-design-system.ts",
  "audit-site.ts",
  "package-proof.ts",
];

describe("deterministic skill tools", () => {
  it("ships every declared Site Foundry tool as executable TypeScript", async () => {
    for (const script of scripts) {
      const url = new URL(`../../skills/site-foundry/scripts/${script}`, import.meta.url);
      await expect(access(url)).resolves.toBeUndefined();
      const source = await readFile(url, "utf8");
      expect(source).not.toMatch(/TODO|TBD|throw new Error\("not implemented/i);
    }
  });
});
