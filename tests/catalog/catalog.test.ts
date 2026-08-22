import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Catalog } from "../../src/catalog/catalog.js";

const catalogs: Catalog[] = [];

afterEach(() => {
  for (const catalog of catalogs.splice(0)) catalog.close();
});

describe("Catalog", () => {
  it("round-trips sources, candidates, decisions, and design stories", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-catalog-"));
    const catalog = new Catalog(join(root, "catalog.sqlite"));
    catalogs.push(catalog);

    catalog.upsertSource({ id: "shadcn", url: "https://ui.shadcn.com", mode: "registry-index", quality_prior: 90 });
    catalog.upsertCandidate({ id: "button", source_id: "shadcn", slot: "button", payload: { license: "MIT" } });
    catalog.recordDecision({ candidate_id: "button", run_id: "run-1", decision: "accepted", reason: "foundation match" });
    catalog.recordStory({ id: "story-1", signature: "technical saas restrained", payload: { foundation: "shadcn" }, score: 91 });

    expect(catalog.getSource("shadcn")).toMatchObject({ mode: "registry-index", quality_prior: 90 });
    expect(catalog.getCandidate("button")?.payload).toEqual({ license: "MIT" });
    expect(catalog.listDecisions("run-1")).toEqual([
      expect.objectContaining({ candidate_id: "button", decision: "accepted" }),
    ]);
    expect(catalog.findSimilarStories("technical restrained", 3)).toEqual([
      expect.objectContaining({ id: "story-1", score: 91 }),
    ]);
  });

  it("updates records without creating duplicates", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-catalog-"));
    const catalog = new Catalog(join(root, "catalog.sqlite"));
    catalogs.push(catalog);

    catalog.upsertSource({ id: "registry", url: "https://one.example", mode: "registry-index", quality_prior: 50 });
    catalog.upsertSource({ id: "registry", url: "https://two.example", mode: "registry-index", quality_prior: 80 });

    expect(catalog.listSources()).toHaveLength(1);
    expect(catalog.getSource("registry")?.url).toBe("https://two.example");
  });
});
