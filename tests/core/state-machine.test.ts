import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunStore } from "../../src/core/run-store.js";

describe("RunStore", () => {
  it("persists a legal transition and artifact for resume", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-state-"));
    const store = new RunStore(root);
    const created = await store.create("run-1", { brief: "Build a precise launch site" });

    expect(created.current.state).toBe("BRIEFED");
    await store.transition("run-1", "ARCHETYPE_SELECTED", "archetype.json", {
      id: "marketing",
    });

    const resumed = await new RunStore(root).load("run-1");
    expect(resumed.current).toMatchObject({
      state: "ARCHETYPE_SELECTED",
      revision: 2,
      artifact: "archetype.json",
    });
    expect(resumed.history).toHaveLength(2);
    expect(JSON.parse(await readFile(join(root, "run-1", "artifacts", "archetype.json"), "utf8"))).toEqual({ id: "marketing" });
    await expect(stat(join(root, "run-1", "state.json.tmp"))).rejects.toThrow();
  });

  it("rejects skipped and backward transitions", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-state-"));
    const store = new RunStore(root);
    await store.create("run-2", { brief: "A docs site" });

    await expect(store.transition("run-2", "REFERENCES_SCOUTED")).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await store.transition("run-2", "ARCHETYPE_SELECTED");
    await expect(store.transition("run-2", "BRIEFED")).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("allows bounded audit and repair cycles", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-state-"));
    const store = new RunStore(root);
    await store.create("run-3", {});
    for (const state of [
      "ARCHETYPE_SELECTED",
      "REFERENCES_SCOUTED",
      "DESIGN_DNA_LOCKED",
      "PAGE_SLOTS_PLANNED",
      "CANDIDATES_RENDERED",
      "COMPONENT_SET_SELECTED",
      "DESIGN_SYSTEM_COMPILED",
      "SITE_BUILT",
      "AUDITED",
      "REPAIRED",
      "AUDITED",
      "SHIPPED",
    ] as const) {
      await store.transition("run-3", state);
    }
    expect((await store.load("run-3")).current.state).toBe("SHIPPED");
  });
});
