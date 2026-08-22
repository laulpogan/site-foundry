import { join } from "node:path";
import { compileBrief, type BriefInput } from "./brief/compiler.js";
import { planPageSlots, selectArchetype, type ArchetypePack, type PageSlot } from "./archetypes/compiler.js";
import { RunStore, type RunRecord } from "./core/run-store.js";
import type { Candidate, ComponentSet, DesignDNA, ProvenanceRecord, SiteSpec } from "./core/types.js";
import { deriveDirections, type DesignDirection, type ReferenceEvidence } from "./design/directions.js";
import { optimizeComponentSet } from "./design/optimizer.js";
import { compileDesignSystem } from "./site/design-system.js";
import { generateSite, type ReuseEvidence } from "./site/generator.js";
import type { SourcePackage } from "./sources/types.js";
import type { AuditReport } from "./audit/audit.js";
import type { RepairPassRecord } from "./audit/repair.js";
import type { ProofIndex } from "./proof/package.js";

export interface DiscoveryResult {
  ranked: Record<string, Candidate[]>;
  packages: SourcePackage[];
  provenance: ProvenanceRecord[];
  reuse: ReuseEvidence;
}

export interface AuditBundle {
  report: AuditReport;
  screenshots: string[];
  recordings: string[];
}

export interface FoundryServices {
  scoutReferences(spec: SiteSpec): Promise<ReferenceEvidence[]>;
  selectDirection(directions: DesignDirection[], spec: SiteSpec): Promise<DesignDirection>;
  discoverAndRender(spec: SiteSpec, dna: DesignDNA, slots: PageSlot[]): Promise<DiscoveryResult>;
  audit(target: string, spec: SiteSpec, pass: number): Promise<AuditBundle>;
  repair(target: string, report: AuditReport, pass: number): Promise<RepairPassRecord>;
  package(target: string, runDirectory: string, audit: AuditBundle, repairs: RepairPassRecord[]): Promise<ProofIndex>;
}

export interface RunFoundryOptions {
  runId: string;
  runtimeRoot: string;
  target: string;
  brief?: BriefInput;
  services: FoundryServices;
  resume?: boolean;
}

export interface FoundryRunResult {
  status: "shipped" | "unresolved";
  run_id: string;
  state: string;
  target: string;
  proof?: ProofIndex;
}

interface ArchetypeArtifact { spec: SiteSpec; archetype: ArchetypePack }
interface CandidateArtifact extends DiscoveryResult {}
interface AuditArtifact extends AuditBundle { pass: number }

function artifactName(record: RunRecord): string {
  if (!record.current.artifact) throw new Error(`State ${record.current.state} has no artifact`);
  return record.current.artifact;
}

async function loadAt<T>(store: RunStore, runId: string, record: RunRecord): Promise<T> {
  return store.readArtifact<T>(runId, artifactName(record));
}

function repairCount(record: RunRecord): number {
  return record.history.filter((state) => state.state === "REPAIRED").length;
}

export async function runFoundry(options: RunFoundryOptions): Promise<FoundryRunResult> {
  const runsRoot = join(options.runtimeRoot, "runs");
  const runDirectory = join(runsRoot, options.runId);
  const store = new RunStore(runsRoot);
  let record: RunRecord;
  let rawBrief: BriefInput;
  if (options.resume) {
    record = await store.load(options.runId);
    rawBrief = options.brief ?? await store.readArtifact<BriefInput>(options.runId, "brief.json");
  } else {
    if (!options.brief) throw new Error("A brief is required for a new run");
    rawBrief = options.brief;
    record = await store.create(options.runId, rawBrief);
  }

  try {
    while (true) {
      switch (record.current.state) {
        case "BRIEFED": {
          const spec = await compileBrief(rawBrief);
          const archetype = await selectArchetype(spec);
          record = await store.transition(options.runId, "ARCHETYPE_SELECTED", "archetype.json", { spec, archetype });
          break;
        }
        case "ARCHETYPE_SELECTED": {
          const { spec } = await loadAt<ArchetypeArtifact>(store, options.runId, record);
          const references = await options.services.scoutReferences(spec);
          record = await store.transition(options.runId, "REFERENCES_SCOUTED", "references.json", references);
          break;
        }
        case "REFERENCES_SCOUTED": {
          const prior = record.history.findLast((state) => state.state === "ARCHETYPE_SELECTED");
          const { spec } = await store.readArtifact<ArchetypeArtifact>(options.runId, prior?.artifact ?? "archetype.json");
          const references = await loadAt<ReferenceEvidence[]>(store, options.runId, record);
          const directions = deriveDirections(spec, references);
          const selected = await options.services.selectDirection(directions, spec);
          record = await store.transition(options.runId, "DESIGN_DNA_LOCKED", "design-direction.json", selected);
          break;
        }
        case "DESIGN_DNA_LOCKED": {
          const archetypeState = record.history.findLast((state) => state.state === "ARCHETYPE_SELECTED");
          const { spec, archetype } = await store.readArtifact<ArchetypeArtifact>(options.runId, archetypeState?.artifact ?? "archetype.json");
          const slots = planPageSlots(spec, archetype);
          record = await store.transition(options.runId, "PAGE_SLOTS_PLANNED", "slots.json", slots);
          break;
        }
        case "PAGE_SLOTS_PLANNED": {
          const archetypeState = record.history.findLast((state) => state.state === "ARCHETYPE_SELECTED");
          const directionState = record.history.findLast((state) => state.state === "DESIGN_DNA_LOCKED");
          const { spec } = await store.readArtifact<ArchetypeArtifact>(options.runId, archetypeState?.artifact ?? "archetype.json");
          const direction = await store.readArtifact<DesignDirection>(options.runId, directionState?.artifact ?? "design-direction.json");
          const slots = await loadAt<PageSlot[]>(store, options.runId, record);
          const candidates = await options.services.discoverAndRender(spec, direction.dna, slots);
          record = await store.transition(options.runId, "CANDIDATES_RENDERED", "candidates.json", candidates);
          break;
        }
        case "CANDIDATES_RENDERED": {
          const directionState = record.history.findLast((state) => state.state === "DESIGN_DNA_LOCKED");
          const direction = await store.readArtifact<DesignDirection>(options.runId, directionState?.artifact ?? "design-direction.json");
          const discovery = await loadAt<CandidateArtifact>(store, options.runId, record);
          const componentSet = optimizeComponentSet(discovery.ranked, direction.dna);
          record = await store.transition(options.runId, "COMPONENT_SET_SELECTED", "component-set.json", componentSet);
          break;
        }
        case "COMPONENT_SET_SELECTED": {
          const directionState = record.history.findLast((state) => state.state === "DESIGN_DNA_LOCKED");
          const direction = await store.readArtifact<DesignDirection>(options.runId, directionState?.artifact ?? "design-direction.json");
          const componentSet = await loadAt<ComponentSet>(store, options.runId, record);
          const designSystem = compileDesignSystem(direction.dna, componentSet);
          record = await store.transition(options.runId, "DESIGN_SYSTEM_COMPILED", "design-system.json", designSystem);
          break;
        }
        case "DESIGN_SYSTEM_COMPILED": {
          const archetypeState = record.history.findLast((state) => state.state === "ARCHETYPE_SELECTED");
          const directionState = record.history.findLast((state) => state.state === "DESIGN_DNA_LOCKED");
          const candidateState = record.history.findLast((state) => state.state === "CANDIDATES_RENDERED");
          const setState = record.history.findLast((state) => state.state === "COMPONENT_SET_SELECTED");
          const { spec } = await store.readArtifact<ArchetypeArtifact>(options.runId, archetypeState?.artifact ?? "archetype.json");
          const direction = await store.readArtifact<DesignDirection>(options.runId, directionState?.artifact ?? "design-direction.json");
          const discovery = await store.readArtifact<CandidateArtifact>(options.runId, candidateState?.artifact ?? "candidates.json");
          const componentSet = await store.readArtifact<ComponentSet>(options.runId, setState?.artifact ?? "component-set.json");
          const generated = await generateSite({ target: options.target, spec, dna: direction.dna, componentSet, reuse: discovery.reuse, packages: discovery.packages, provenance: discovery.provenance });
          record = await store.transition(options.runId, "SITE_BUILT", "generated-site.json", generated);
          break;
        }
        case "SITE_BUILT":
        case "REPAIRED": {
          if (record.current.state === "REPAIRED") {
            const repair = await loadAt<RepairPassRecord>(store, options.runId, record);
            if (repair.status === "unresolved") {
              const auditState = record.history.findLast((state) => state.state === "AUDITED");
              const audit = await store.readArtifact<AuditArtifact>(options.runId, auditState?.artifact ?? "audit-pass-6.json");
              const repairs = await Promise.all(record.history.filter((state) => state.state === "REPAIRED" && state.artifact).map((state) => store.readArtifact<RepairPassRecord>(options.runId, state.artifact as string)));
              const proof = await options.services.package(options.target, runDirectory, audit, repairs);
              return { status: "unresolved", run_id: options.runId, state: record.current.state, target: options.target, proof };
            }
          }
          const archetypeState = record.history.findLast((state) => state.state === "ARCHETYPE_SELECTED");
          const { spec } = await store.readArtifact<ArchetypeArtifact>(options.runId, archetypeState?.artifact ?? "archetype.json");
          const pass = repairCount(record) + 1;
          const audit = await options.services.audit(options.target, spec, pass);
          record = await store.transition(options.runId, "AUDITED", `audit-pass-${pass}.json`, { ...audit, pass });
          break;
        }
        case "AUDITED": {
          const audit = await loadAt<AuditArtifact>(store, options.runId, record);
          if (audit.report.acceptance_gates_passed) {
            const repairs = await Promise.all(record.history.filter((state) => state.state === "REPAIRED" && state.artifact).map((state) => store.readArtifact<RepairPassRecord>(options.runId, state.artifact as string)));
            const proof = await options.services.package(options.target, runDirectory, audit, repairs);
            record = await store.transition(options.runId, "SHIPPED", "proof.json", proof);
            return { status: "shipped", run_id: options.runId, state: record.current.state, target: options.target, proof };
          }
          const pass = repairCount(record) + 1;
          const repair = await options.services.repair(options.target, audit.report, pass);
          record = await store.transition(options.runId, "REPAIRED", `repair-pass-${pass}.json`, repair);
          break;
        }
        case "SHIPPED": {
          const proof = await loadAt<ProofIndex>(store, options.runId, record);
          return { status: "shipped", run_id: options.runId, state: record.current.state, target: options.target, proof };
        }
      }
    }
  } catch (error) {
    const current = await store.load(options.runId);
    await store.writeFailure(options.runId, {
      state: current.current.state,
      message: error instanceof Error ? error.message : String(error),
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
      failed_at: new Date().toISOString(),
    });
    throw error;
  }
}
