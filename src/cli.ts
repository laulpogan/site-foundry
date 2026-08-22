#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import type { BriefInput } from "./brief/compiler.js";
import { RunStore, type RunRecord } from "./core/run-store.js";
import { loadSourceConfig } from "./sources/config.js";
import { runFoundry, type FoundryRunResult, type FoundryServices } from "./orchestrator.js";

export interface RunCommandInput { briefPath: string; target: string; runId: string; runtimeRoot: string | undefined }
export interface ResumeCommandInput { runId: string; target: string; runtimeRoot: string | undefined }

export interface CliActions {
  run(input: RunCommandInput): Promise<unknown>;
  resume(input: ResumeCommandInput): Promise<unknown>;
  inspect(runId: string, runtimeRoot?: string): Promise<unknown>;
  sources(): Promise<unknown>;
  evaluate(options?: { runtimeRoot?: string }): Promise<unknown>;
}

export function createCli(actions: CliActions, output: (line: string) => void = console.log): Command {
  const program = new Command();
  program.name("site-foundry").description("Compile coherent sites from licensed public components").showHelpAfterError();
  program.command("run")
    .argument("<brief>", "JSON brief path")
    .requiredOption("--target <directory>")
    .option("--run-id <id>", "stable run id", `run-${Date.now()}`)
    .option("--runtime-root <directory>", "runtime storage root")
    .action(async (briefPath: string, options: { target: string; runId: string; runtimeRoot?: string }) => {
      output(JSON.stringify(await actions.run({ briefPath, target: options.target, runId: options.runId, runtimeRoot: options.runtimeRoot })));
    });
  program.command("resume")
    .argument("<run-id>")
    .requiredOption("--target <directory>")
    .option("--runtime-root <directory>")
    .action(async (runId: string, options: { target: string; runtimeRoot?: string }) => {
      output(JSON.stringify(await actions.resume({ runId, target: options.target, runtimeRoot: options.runtimeRoot })));
    });
  program.command("inspect")
    .argument("<run-id>")
    .option("--runtime-root <directory>")
    .action(async (runId: string, options: { runtimeRoot?: string }) => output(JSON.stringify(await actions.inspect(runId, options.runtimeRoot), null, 2)));
  program.command("sources").action(async () => output(JSON.stringify(await actions.sources(), null, 2)));
  program.command("evaluate")
    .option("--runtime-root <directory>")
    .action(async (options: { runtimeRoot?: string }) => output(JSON.stringify(await actions.evaluate(options), null, 2)));
  return program;
}

export function createDefaultActions(services: FoundryServices, evaluateAction: () => Promise<unknown>): CliActions {
  const runtime = (input?: string): string => resolve(input ?? "runtime");
  return {
    async run(input): Promise<FoundryRunResult> {
      const brief = JSON.parse(await readFile(resolve(input.briefPath), "utf8")) as BriefInput;
      return runFoundry({ runId: input.runId, runtimeRoot: runtime(input.runtimeRoot), target: resolve(input.target), brief, services });
    },
    async resume(input): Promise<FoundryRunResult> {
      return runFoundry({ runId: input.runId, runtimeRoot: runtime(input.runtimeRoot), target: resolve(input.target), services, resume: true });
    },
    async inspect(runId, runtimeRoot): Promise<RunRecord> {
      return new RunStore(resolve(runtime(runtimeRoot), "runs")).load(runId);
    },
    sources: loadSourceConfig,
    evaluate: evaluateAction,
  };
}

async function main(): Promise<void> {
  const servicesPath = "./runtime/local-services.js";
  const evaluationPath = "./evaluation/harness.js";
  const [{ createLocalServices }, { runDefaultEvaluation }] = await Promise.all([
    import(servicesPath) as Promise<{ createLocalServices(): FoundryServices }>,
    import(evaluationPath) as Promise<{ runDefaultEvaluation(): Promise<unknown> }>,
  ]);
  await createCli(createDefaultActions(createLocalServices(), runDefaultEvaluation)).parseAsync(process.argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
