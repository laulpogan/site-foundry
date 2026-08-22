export const RUN_STATES = [
  "BRIEFED",
  "ARCHETYPE_SELECTED",
  "REFERENCES_SCOUTED",
  "DESIGN_DNA_LOCKED",
  "PAGE_SLOTS_PLANNED",
  "CANDIDATES_RENDERED",
  "COMPONENT_SET_SELECTED",
  "DESIGN_SYSTEM_COMPILED",
  "SITE_BUILT",
  "AUDITED",
  "REPAIRED",
  "SHIPPED",
] as const;

export type RunStateName = (typeof RUN_STATES)[number];

export interface RouteSpec {
  path: string;
  purpose: string;
  states?: string[];
}

export interface SiteSpec {
  site_type: string;
  audience: string[];
  primary_goal: string;
  routes: RouteSpec[];
  required_interactions: string[];
  brand_attributes: string[];
  content_density: "low" | "moderate" | "dense";
  motion_level: "none" | "restrained" | "expressive";
  stack: "react-typescript-tailwind";
  assumptions: string[];
  prohibited_claims: string[];
}

export interface RunState {
  state: RunStateName;
  revision: number;
  artifact?: string;
  updated_at?: string;
}

export interface Candidate {
  id: string;
  slot: string;
  source_id: string;
  source_url: string;
  canonical_repository?: string;
  revision?: string;
  license?: string;
  status: "discovered" | "resolved" | "rejected" | "rendered" | "accepted";
  foundation_family: string;
  accent_source?: string;
  dependencies: string[];
  style: StyleVector;
  scores?: CandidateScores;
}

export interface CandidateScores {
  dna_fit: number;
  craftsmanship: number;
  hierarchy: number;
  typography: number;
  responsive: number;
  motion: number;
  accessibility: number;
  integration_cost: number;
}

export interface StyleVector {
  type_scale: string;
  container_width: number;
  density: "low" | "moderate" | "dense";
  radius: string;
  border_weight: string;
  shadow: string;
  color_temperature: string;
  icon_stroke: string;
  motion_duration: number;
  motion_easing: string;
  media_treatment: string;
  surface_depth: string;
  animation_runtime: string;
  dependency_family: string;
}

export interface ComponentSet {
  foundation: string;
  accents: string[];
  icon_family: string;
  motion_runtime: string;
  selections: Array<{ slot: string; candidate_id: string }>;
}

export interface ProvenanceRecord {
  component_id: string;
  source_url: string;
  canonical_repository: string;
  revision: string;
  author: string;
  license: "MIT" | "Apache-2.0" | "BSD-2-Clause" | "BSD-3-Clause" | "ISC";
  files_copied: string[];
  dependencies_added: string[];
  adaptations: string[];
  screenshots: string[];
  decision: "accepted" | "rejected";
}

export interface DesignDNA {
  thesis: string;
  layout: { grid: string; max_width: number; section_rhythm: string };
  typography: { display_character: string; body_character: string; scale: string };
  color: { base: string; accent_count: number; contrast: string };
  geometry: { radius: string; borders: string; shadows: string };
  media: { treatment: string };
  motion: { energy: string; durations: string; signature_effects_per_page: number };
  density: string;
  anti_patterns: string[];
}

export type ArtifactKind =
  | "site-spec"
  | "design-dna"
  | "candidate"
  | "component-set"
  | "provenance"
  | "run-state";

export interface ArtifactTypes {
  "site-spec": SiteSpec;
  "design-dna": DesignDNA;
  candidate: Candidate;
  "component-set": ComponentSet;
  provenance: ProvenanceRecord;
  "run-state": RunState;
}
