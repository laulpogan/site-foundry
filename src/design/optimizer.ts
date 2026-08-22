import { FoundryError } from "../core/errors.js";
import { validateArtifact } from "../core/schema.js";
import type { Candidate, CandidateScores, ComponentSet, DesignDNA } from "../core/types.js";
import { scoreCandidate } from "./rank.js";

interface PartialSet {
  candidates: Candidate[];
  score: number;
  family?: string;
  runtime?: string;
  icon?: string;
  accents: Set<string>;
}

function compatibility(a: Candidate, b: Candidate, dna: DesignDNA): number {
  let score = 0;
  if (a.style.type_scale === b.style.type_scale) score += 2;
  if (a.style.radius === b.style.radius) score += 2;
  if (a.style.border_weight === b.style.border_weight) score += 1;
  if (a.style.shadow === b.style.shadow) score += 1;
  if (a.style.color_temperature === b.style.color_temperature) score += 1;
  if (a.style.media_treatment === b.style.media_treatment) score += 1;
  if (Math.abs(a.style.container_width - b.style.container_width) <= 40) score += 2;
  if (a.style.container_width === dna.layout.max_width) score += 1;
  return score;
}

function addCandidate(partial: PartialSet, candidate: Candidate, dna: DesignDNA): PartialSet | undefined {
  if (!candidate.scores) return undefined;
  const family = partial.family ?? candidate.foundation_family;
  const runtime = partial.runtime ?? candidate.style.animation_runtime;
  const icon = partial.icon ?? candidate.icon_family ?? "lucide";
  if (candidate.foundation_family !== family || candidate.style.animation_runtime !== runtime || (candidate.icon_family ?? "lucide") !== icon) return undefined;
  const accents = new Set(partial.accents);
  if (candidate.accent_source) accents.add(candidate.accent_source);
  if (accents.size > 2) return undefined;
  const pairwise = partial.candidates.reduce((sum, selected) => sum + compatibility(selected, candidate, dna), 0);
  const dependencyPenalty = candidate.dependencies.length * 0.25;
  return {
    candidates: [...partial.candidates, candidate],
    score: partial.score + scoreCandidate(candidate.scores) + pairwise - dependencyPenalty,
    family,
    runtime,
    icon,
    accents,
  };
}

export function optimizeComponentSet(ranked: Record<string, Candidate[]>, dna: DesignDNA): ComponentSet {
  const slots = Object.keys(ranked).sort();
  let partials: PartialSet[] = [{ candidates: [], score: 0, accents: new Set() }];
  for (const slot of slots) {
    const candidates = ranked[slot] ?? [];
    partials = partials.flatMap((partial) => candidates.flatMap((candidate) => {
      const added = addCandidate(partial, candidate, dna);
      return added ? [added] : [];
    }));
    partials.sort((a, b) => b.score - a.score || a.candidates.map((candidate) => candidate.id).join("|").localeCompare(b.candidates.map((candidate) => candidate.id).join("|")));
    partials = partials.slice(0, 500);
    if (partials.length === 0) break;
  }
  const winner = partials[0];
  if (!winner || winner.candidates.length !== slots.length || !winner.family || !winner.runtime || !winner.icon) {
    throw new FoundryError("NO_FEASIBLE_COMPONENT_SET", "No complete component set satisfies cohesion constraints", { slots });
  }
  return validateArtifact("component-set", {
    foundation: winner.family,
    accents: [...winner.accents].sort(),
    icon_family: winner.icon,
    motion_runtime: winner.runtime,
    selections: winner.candidates.map((candidate) => ({ slot: candidate.slot, candidate_id: candidate.id })),
  });
}
