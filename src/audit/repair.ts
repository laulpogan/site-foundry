import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditIssue, AuditReport } from "./audit.js";

export interface RepairResult {
  changed_files: string[];
  notes: string[];
}

export type Repairer = (issues: AuditIssue[], pass: number) => Promise<RepairResult>;

export interface RepairPassRecord extends RepairResult {
  status: "repaired" | "unresolved" | "clean";
  pass: number;
  issues: AuditIssue[];
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function repairFromEvidence(
  output: string,
  report: AuditReport,
  pass: number,
  repairer: Repairer,
): Promise<RepairPassRecord> {
  await mkdir(output, { recursive: true });
  if (report.acceptance_gates_passed) {
    const clean: RepairPassRecord = { status: "clean", pass, issues: [], changed_files: [], notes: ["Acceptance gates passed"] };
    await writeJsonAtomic(join(output, `repair-pass-${pass}.json`), clean);
    return clean;
  }
  if (pass >= 6) {
    const unresolved: RepairPassRecord = { status: "unresolved", pass, issues: report.issues, changed_files: [], notes: ["Repair cap reached"] };
    await writeJsonAtomic(join(output, "unresolved-defects.json"), { repair_passes: 6, issues: report.issues });
    return unresolved;
  }
  const result = await repairer(report.issues, pass);
  const record: RepairPassRecord = { status: "repaired", pass, issues: report.issues, ...result };
  await writeJsonAtomic(join(output, `repair-pass-${pass}.json`), record);
  return record;
}
