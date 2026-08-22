import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, relative } from "node:path";
import { FoundryError } from "../core/errors.js";
import type { AuditReport } from "../audit/audit.js";
import type { RepairPassRecord } from "../audit/repair.js";

export interface PackageDeliveryOptions {
  output: string;
  site: string;
  screenshots: string[];
  recordings: string[];
  audit: AuditReport;
  repairs: RepairPassRecord[];
}

export interface ProofFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface ProofIndex {
  complete: boolean;
  acceptance_gates_passed: boolean;
  created_at: string;
  files: ProofFile[];
}

async function hashFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const value = await readFile(path);
  return { sha256: createHash("sha256").update(value).digest("hex"), bytes: value.byteLength };
}

export async function packageDelivery(options: PackageDeliveryOptions): Promise<ProofIndex> {
  if (options.screenshots.length < 2 || options.recordings.length < 1) {
    throw new FoundryError("INVALID_ARTIFACT", "Proof requires desktop and mobile screenshots plus an interaction recording");
  }
  const siteOutput = join(options.output, "site");
  const evidenceOutput = join(options.output, "evidence");
  await Promise.all([mkdir(siteOutput, { recursive: true }), mkdir(evidenceOutput, { recursive: true })]);
  const copied: string[] = [];
  for (const filename of ["DESIGN.md", "tokens.css", "component-manifest.json", "provenance.json"]) {
    const destination = join(siteOutput, filename);
    await copyFile(join(options.site, filename), destination);
    copied.push(destination);
  }
  for (const source of [...options.screenshots, ...options.recordings]) {
    const destination = join(evidenceOutput, basename(source));
    await copyFile(source, destination);
    copied.push(destination);
  }
  const auditPath = join(options.output, "audit-report.json");
  const repairsPath = join(options.output, "repair-history.json");
  await writeFile(auditPath, `${JSON.stringify(options.audit, null, 2)}\n`, "utf8");
  await writeFile(repairsPath, `${JSON.stringify(options.repairs, null, 2)}\n`, "utf8");
  copied.push(auditPath, repairsPath);
  const files: ProofFile[] = [];
  for (const path of copied.sort()) files.push({ path: relative(options.output, path), ...await hashFile(path) });
  const index: ProofIndex = {
    complete: options.audit.acceptance_gates_passed,
    acceptance_gates_passed: options.audit.acceptance_gates_passed,
    created_at: new Date().toISOString(),
    files,
  };
  await writeFile(join(options.output, "proof-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return index;
}
