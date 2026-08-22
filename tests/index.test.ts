import { describe, expect, it } from "vitest";
import { compileBrief, createLocalServices, FoundryError, RunStore, runFoundry, validateArtifact } from "../src/index.js";

describe("public package API", () => {
  it("exports the supported orchestration surface", () => {
    expect([compileBrief, createLocalServices, FoundryError, RunStore, runFoundry, validateArtifact]).toHaveLength(6);
    expect([compileBrief, createLocalServices, RunStore, runFoundry, validateArtifact].every((value) => typeof value === "function")).toBe(true);
  });
});
