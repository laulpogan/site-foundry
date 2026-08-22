import { describe, expect, it } from "vitest";
import { loadSourceConfig } from "../../src/sources/config.js";

describe("source configuration", () => {
  it("loads code, discovery, and inspiration source policies", async () => {
    const sources = await loadSourceConfig();
    expect(sources.length).toBeGreaterThanOrEqual(12);
    expect(sources.find((source) => source.id === "registry-directory")).toMatchObject({
      account_policy: "public-only",
      implementation_policy: "allowed-with-license",
    });
    expect(sources.find((source) => source.id === "21st")).toMatchObject({
      implementation_policy: "resolve-canonical-public-source-or-skip",
    });
    expect(sources.find((source) => source.id === "landbook")).toMatchObject({
      implementation_policy: "inspiration-only",
    });
  });
});
