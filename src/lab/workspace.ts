import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { FoundryError } from "../core/errors.js";
import type { SourcePackage } from "../sources/types.js";

export interface CandidateWorkspace {
  path: string;
  files: string[];
  source_url: string;
  revision?: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  cwd: string;
  network: "package-registry-only" | "none";
  env?: Record<string, string>;
}

export type CommandRunner = (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;

export const defaultCommandRunner: CommandRunner = async (command, args, options) =>
  new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { PATH: process.env.PATH ?? "", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ exitCode: code ?? 1, stdout, stderr }));
  });

function safeTarget(workspace: string, target: string): string {
  const resolved = resolve(workspace, target);
  if (resolved !== workspace && !resolved.startsWith(`${workspace}${sep}`)) {
    throw new FoundryError("SECURITY_REJECTED", `Component file escapes workspace: ${target}`);
  }
  return resolved;
}

export async function prepareCandidate(root: string, source: SourcePackage): Promise<CandidateWorkspace> {
  await mkdir(root, { recursive: true });
  const workspace = await mkdtemp(resolve(root, "candidate-"));
  const copied: string[] = [];
  for (const file of source.files) {
    const target = safeTarget(workspace, file.target);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
    copied.push(file.target);
  }
  const manifest: Record<string, unknown> = {
    name: source.name,
    source_url: source.source_url,
    dependencies: source.dependencies,
    files: copied,
  };
  if (source.revision) manifest.revision = source.revision;
  await writeFile(resolve(workspace, "candidate.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const result: CandidateWorkspace = { path: workspace, files: copied, source_url: source.source_url };
  if (source.revision) result.revision = source.revision;
  return result;
}

export async function installCandidate(
  workspace: string,
  dependencies: string[],
  runner: CommandRunner = defaultCommandRunner,
): Promise<CommandResult> {
  const result = await runner(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", ...dependencies],
    { cwd: workspace, network: "package-registry-only" },
  );
  if (result.exitCode !== 0) {
    throw new FoundryError("SOURCE_UNAVAILABLE", "Candidate dependency installation failed", { stderr: result.stderr });
  }
  return result;
}
