import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GalleryAdapter } from "../../src/sources/gallery.js";
import { RegistryAdapter, parseRegistryItem } from "../../src/sources/registry.js";

describe("registry sources", () => {
  it("parses a public shadcn registry item into copied source", async () => {
    const raw = JSON.parse(await readFile(new URL("../fixtures/registry-button.json", import.meta.url), "utf8"));
    const item = parseRegistryItem(raw, "https://ui.shadcn.com/r/styles/new-york-v4/button.json");

    expect(item).toMatchObject({
      name: "button",
      type: "registry:ui",
      dependencies: ["@radix-ui/react-slot"],
    });
    expect(item.files[0]).toMatchObject({ target: "components/ui/button.tsx" });
  });

  it("resolves registry code but leaves final license approval to the hard gate", async () => {
    const raw = await readFile(new URL("../fixtures/registry-button.json", import.meta.url), "utf8");
    const adapter = new RegistryAdapter(
      {
        id: "shadcn",
        domain: "ui.shadcn.com",
        mode: "registry-index",
        account_policy: "public-only",
        implementation_policy: "allowed-with-license",
        quality_prior: 95,
        rate_limit_ms: 500,
      },
      async () => new Response(raw, { status: 200 }),
    );
    const resolved = await adapter.resolveCode({
      id: "button",
      source_id: "shadcn",
      title: "Button",
      url: "https://ui.shadcn.com/r/styles/new-york-v4/button.json",
    });
    expect(resolved.kind).toBe("source-package");
    if (resolved.kind === "source-package") {
      expect(resolved.license).toBeUndefined();
      expect(resolved.files).toHaveLength(1);
    }
  });
});

describe("gallery sources", () => {
  it("never resolves inspiration gallery pages as code", async () => {
    const adapter = new GalleryAdapter({
      id: "landbook",
      domain: "land-book.com",
      mode: "inspiration-gallery",
      account_policy: "public-only",
      implementation_policy: "inspiration-only",
      quality_prior: 85,
      rate_limit_ms: 1000,
    });
    const result = await adapter.resolveCode({
      id: "example",
      source_id: "landbook",
      title: "Example",
      url: "https://land-book.com/websites/example",
    });
    expect(result).toEqual({
      kind: "inspiration-only",
      reason: "landbook policy forbids code import",
    });
  });
});
