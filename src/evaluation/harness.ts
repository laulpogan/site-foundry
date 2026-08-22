import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { FoundryError } from "../core/errors.js";

export interface EvaluationBrief {
  id: string;
  kind: "marketing" | "saas-product";
  segment: string;
  brief: string;
  brand_attributes: string[];
}

export interface EvaluationBudget {
  model_calls: number;
  implementation_minutes: number;
}

export interface EvaluationMetrics {
  reuse_ratio: number;
  provenance_ratio: number;
  access_violations: number;
  license_violations: number;
  coherence_score: number;
  functional_failures: number;
  accessibility_failures: number;
  custom_component_count: number;
}

export interface EvaluationResult extends EvaluationMetrics {
  brief_id: string;
  system: "foundry" | "baseline";
  budget: EvaluationBudget;
  screenshots: string[];
}

export type EvaluationRunner = (brief: EvaluationBrief, budget: Readonly<EvaluationBudget>) => Promise<EvaluationResult>;

export interface BlindCandidate {
  screenshots: string[];
  measurements: EvaluationMetrics;
}

export interface BlindEvaluationComparison {
  brief_id: string;
  candidate_a: BlindCandidate;
  candidate_b: BlindCandidate;
}

const defaultBriefDirectory = new URL("../../evaluation/briefs/", import.meta.url);
const defaultManifest = new URL("../../evaluation/manifest.json", import.meta.url);

function assertBrief(value: unknown, filename: string): EvaluationBrief {
  if (!value || typeof value !== "object") throw new FoundryError("INVALID_ARTIFACT", `Invalid evaluation brief ${filename}`);
  const brief = value as Partial<EvaluationBrief>;
  if (!brief.id || !brief.segment || !brief.brief || !Array.isArray(brief.brand_attributes) || (brief.kind !== "marketing" && brief.kind !== "saas-product")) {
    throw new FoundryError("INVALID_ARTIFACT", `Incomplete evaluation brief ${filename}`);
  }
  return brief as EvaluationBrief;
}

export async function loadLockedBriefs(directory: string | URL = defaultBriefDirectory): Promise<EvaluationBrief[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => assertBrief(JSON.parse(await readFile(directory instanceof URL ? new URL(file, directory) : join(directory, file), "utf8")), file)));
}

export async function computeSuiteHash(directory: string | URL = defaultBriefDirectory): Promise<string> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    const path = directory instanceof URL ? new URL(file, directory) : join(directory, file);
    hash.update(file).update("\0").update(await readFile(path)).update("\0");
  }
  return hash.digest("hex");
}

export async function verifyLockedSuite(
  directory: string | URL = defaultBriefDirectory,
  manifestPath: string | URL = defaultManifest,
): Promise<{ valid: true; briefs: number; sha256: string }> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { briefs?: number; sha256?: string };
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  const actual = await computeSuiteHash(directory);
  if (manifest.briefs !== files.length || manifest.sha256 !== actual) {
    throw new FoundryError("INVALID_ARTIFACT", `Evaluation suite hash mismatch: expected ${manifest.sha256 ?? "missing"}, received ${actual}`);
  }
  return { valid: true, briefs: files.length, sha256: actual };
}

function metrics(result: EvaluationResult): EvaluationMetrics {
  return {
    reuse_ratio: result.reuse_ratio,
    provenance_ratio: result.provenance_ratio,
    access_violations: result.access_violations,
    license_violations: result.license_violations,
    coherence_score: result.coherence_score,
    functional_failures: result.functional_failures,
    accessibility_failures: result.accessibility_failures,
    custom_component_count: result.custom_component_count,
  };
}

export async function runEvaluation(options: {
  foundry: EvaluationRunner;
  baseline: EvaluationRunner;
  budget: EvaluationBudget;
}): Promise<{ results: Array<{ brief: EvaluationBrief; foundry: EvaluationResult; baseline: EvaluationResult }>; comparisons: BlindEvaluationComparison[]; answer_key: Record<string, "A" | "B"> }> {
  await verifyLockedSuite();
  const briefs = await loadLockedBriefs();
  const budget = Object.freeze({ ...options.budget });
  const results = [] as Array<{ brief: EvaluationBrief; foundry: EvaluationResult; baseline: EvaluationResult }>;
  const comparisons: BlindEvaluationComparison[] = [];
  const answerKey: Record<string, "A" | "B"> = {};
  for (const brief of briefs) {
    const [foundry, baseline] = await Promise.all([options.foundry(brief, budget), options.baseline(brief, budget)]);
    results.push({ brief, foundry, baseline });
    const foundryFirst = parseInt(createHash("sha256").update(brief.id).digest("hex")[0] ?? "0", 16) % 2 === 0;
    const foundryCandidate = { screenshots: foundry.screenshots, measurements: metrics(foundry) };
    const baselineCandidate = { screenshots: baseline.screenshots, measurements: metrics(baseline) };
    comparisons.push({
      brief_id: brief.id,
      candidate_a: foundryFirst ? foundryCandidate : baselineCandidate,
      candidate_b: foundryFirst ? baselineCandidate : foundryCandidate,
    });
    answerKey[brief.id] = foundryFirst ? "A" : "B";
  }
  return { results, comparisons, answer_key: answerKey };
}

export interface RatedCase {
  brief_id: string;
  foundry: EvaluationMetrics;
  baseline: EvaluationMetrics;
  preference: "foundry" | "baseline" | "tie";
}

function average(cases: RatedCase[], system: "foundry" | "baseline", key: keyof EvaluationMetrics): number {
  return cases.reduce((sum, item) => sum + item[system][key], 0) / cases.length;
}

export function summarizeEvaluation(cases: RatedCase[]) {
  if (cases.length === 0) throw new FoundryError("INVALID_ARTIFACT", "Human-rated evaluation cases are required");
  const winRate = cases.filter((item) => item.preference === "foundry").length / cases.length;
  const summary = {
    blind_preference_win_rate: winRate,
    reuse_gate: average(cases, "foundry", "reuse_ratio") >= 0.9,
    provenance_gate: average(cases, "foundry", "provenance_ratio") === 1,
    access_gate: cases.every((item) => item.foundry.access_violations === 0),
    license_gate: cases.every((item) => item.foundry.license_violations === 0),
    coherence_gate: average(cases, "foundry", "coherence_score") > average(cases, "baseline", "coherence_score"),
    functional_gate: average(cases, "foundry", "functional_failures") <= average(cases, "baseline", "functional_failures"),
    accessibility_gate: average(cases, "foundry", "accessibility_failures") <= average(cases, "baseline", "accessibility_failures"),
    custom_component_gate: average(cases, "foundry", "custom_component_count") < average(cases, "baseline", "custom_component_count"),
  };
  return { ...summary, release_ready: winRate >= 0.7 && Object.values(summary).every(Boolean) };
}

export async function runDefaultEvaluation(): Promise<unknown> {
  const suite = await verifyLockedSuite();
  return { ...suite, status: "human-evaluation-required", rubric: "evaluation/rubric.yaml" };
}
