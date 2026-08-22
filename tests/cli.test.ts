import { describe, expect, it, vi } from "vitest";
import { createCli, type CliActions } from "../src/cli.js";

function harness() {
  const lines: string[] = [];
  const actions: CliActions = {
    run: vi.fn(async () => ({ status: "shipped", run_id: "run-1", state: "SHIPPED", target: "/tmp/site" })),
    resume: vi.fn(async () => ({ status: "shipped", run_id: "run-1", state: "SHIPPED", target: "/tmp/site" })),
    inspect: vi.fn(async () => ({ id: "run-1", current: { state: "SHIPPED" }, history: [] })),
    sources: vi.fn(async () => [{ id: "shadcn", account_policy: "public-only" }]),
    evaluate: vi.fn(async () => ({ briefs: 30, complete: true })),
  };
  return { actions, lines, cli: createCli(actions, (line) => lines.push(line)) };
}

describe("site-foundry CLI", () => {
  it("runs and resumes builds", async () => {
    const first = harness();
    await first.cli.parseAsync(["node", "site-foundry", "run", "brief.json", "--target", "/tmp/site", "--run-id", "run-1"]);
    expect(first.actions.run).toHaveBeenCalledWith(expect.objectContaining({ briefPath: "brief.json", target: "/tmp/site", runId: "run-1" }));
    expect(JSON.parse(first.lines[0]!)).toMatchObject({ status: "shipped" });
    const second = harness();
    await second.cli.parseAsync(["node", "site-foundry", "resume", "run-1", "--target", "/tmp/site"]);
    expect(second.actions.resume).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
  });

  it.each([
    ["inspect", ["run-1"], "inspect"],
    ["sources", [], "sources"],
    ["evaluate", [], "evaluate"],
  ])("routes the %s command", async (command, args, method) => {
    const { cli, actions } = harness();
    await cli.parseAsync(["node", "site-foundry", command, ...args]);
    expect(actions[method as keyof CliActions]).toHaveBeenCalledOnce();
  });
});
