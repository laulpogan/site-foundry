import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { applyDeterministicRepairs, GENERATED_INSTALL_ARGS, RECORDING_PRIMARY_SELECTOR, resolvePinnedShadcnButton, retryingPublicFetcher } from "../../src/runtime/local-services.js";

describe("live public component resolution", () => {
  it("retries transient public-source gateway failures", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("gateway", { status: 504 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const response = await retryingPublicFetcher("https://api.github.com/repos/example/repo", fetcher, sleep);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("resolves registry discovery to a pinned canonical licensed source", async () => {
    const revision = "1773ecfeeb4a04366978d353e69b5c7ded78dcb2";
    const fetchPublic = vi.fn(async (url: string) => {
      if (url.endsWith("button.json")) return new Response(JSON.stringify({ name: "button", type: "registry:ui", dependencies: ["radix-ui"], files: [{ path: "button.tsx", type: "registry:ui", content: "preview" }] }), { status: 200 });
      if (url.endsWith("/git/ref/heads/main")) return new Response(JSON.stringify({ object: { sha: revision } }), { status: 200 });
      if (url.endsWith("LICENSE.md")) return new Response("MIT License\nCopyright", { status: 200 });
      if (url.endsWith("button.tsx")) return new Response("import * as React from 'react'; import { cva } from 'class-variance-authority'; import { Slot } from 'radix-ui'; import { cn } from '@/lib/utils'; export function Button(props: React.ComponentProps<'button'>) { return <button className={cn(cva('px-4'))} {...props} /> }", { status: 200 });
      return new Response("not found", { status: 404 });
    });
    const result = await resolvePinnedShadcnButton(fetchPublic);
    expect(result.package).toMatchObject({ kind: "source-package", name: "button", revision, license: "MIT" });
    expect(result.provenance).toMatchObject({ canonical_repository: "https://github.com/shadcn-ui/ui", revision, license: "MIT", decision: "accepted" });
    expect(result.candidate.status).toBe("resolved");
    expect(fetchPublic).toHaveBeenCalledWith(expect.stringContaining("ui.shadcn.com"));
    expect(fetchPublic).toHaveBeenCalledWith(expect.stringContaining(revision));
  });

  it("fails closed when canonical license evidence is absent", async () => {
    const fetchPublic = vi.fn(async (url: string) => {
      if (url.endsWith("button.json")) return new Response(JSON.stringify({ name: "button", type: "registry:ui", dependencies: [], files: [] }), { status: 200 });
      if (url.endsWith("/git/ref/heads/main")) return new Response(JSON.stringify({ object: { sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } }), { status: 200 });
      return new Response("not found", { status: 404 });
    });
    await expect(resolvePinnedShadcnButton(fetchPublic)).rejects.toMatchObject({ code: "LICENSE_REJECTED" });
  });
});

describe("deterministic repairs", () => {
  it("installs the generated site's pinned build dependencies", () => {
    expect(GENERATED_INSTALL_ARGS).toEqual(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--include=dev"]);
  });

  it("records a visible primary action instead of a hidden responsive control", () => {
    expect(RECORDING_PRIMARY_SELECTOR).toBe("button:visible");
  });

  it("repairs overflow, focus, reduced-motion, and contrast findings in generated CSS", async () => {
    const root = await mkdtemp(join(tmpdir(), "foundry-local-repair-"));
    const source = join(root, "src");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(join(source, "styles.css"), "body { color: #777; }\n", "utf8");
    const result = await applyDeterministicRepairs(root, [
      { code: "horizontal-overflow", severity: "serious", message: "overflow", route: "/", viewport: "320x720" },
      { code: "visible-focus", severity: "serious", message: "focus", route: "/", viewport: "390x844" },
      { code: "reduced-motion", severity: "moderate", message: "motion", route: "/", viewport: "390x844" },
      { code: "axe-serious", severity: "serious", message: "color-contrast", route: "/", viewport: "390x844" },
    ]);
    expect(result.changed_files).toEqual(["src/styles.css"]);
    const css = await readFile(join(source, "styles.css"), "utf8");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("--foreground: #11110f");
  });
});
