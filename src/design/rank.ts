import type { Candidate, CandidateScores, DesignDNA, SiteSpec } from "../core/types.js";

const weights: Record<keyof CandidateScores, number> = {
  dna_fit: 25,
  craftsmanship: 20,
  hierarchy: 15,
  typography: 10,
  responsive: 10,
  motion: 8,
  accessibility: 7,
  integration_cost: 5,
};

export function scoreCandidate(scores: CandidateScores): number {
  const total = (Object.keys(weights) as Array<keyof CandidateScores>)
    .reduce((sum, key) => sum + Math.max(0, Math.min(100, scores[key])) * weights[key], 0);
  return total / 100;
}

export interface BlindCandidate {
  id: "A" | "B";
  weighted_score: number;
  style: Candidate["style"];
  scores: CandidateScores;
}

export interface BlindComparison {
  slot: string;
  brief: Pick<SiteSpec, "audience" | "primary_goal" | "brand_attributes" | "content_density" | "motion_level">;
  design_dna: DesignDNA;
  candidate_a: BlindCandidate;
  candidate_b: BlindCandidate;
}

export interface CriticDecision {
  winner: "A" | "B";
  evidence: string;
  disqualifier?: string;
  confidence: number;
}

export interface TournamentResult {
  candidate: Candidate;
  wins: number;
  decisions: CriticDecision[];
}

export function buildBlindComparison(a: Candidate, b: Candidate, spec: SiteSpec, dna: DesignDNA): BlindComparison {
  if (!a.scores || !b.scores) throw new Error("Rendered candidates require scores");
  return {
    slot: a.slot,
    brief: {
      audience: spec.audience,
      primary_goal: spec.primary_goal,
      brand_attributes: spec.brand_attributes,
      content_density: spec.content_density,
      motion_level: spec.motion_level,
    },
    design_dna: dna,
    candidate_a: { id: "A", weighted_score: scoreCandidate(a.scores), style: a.style, scores: a.scores },
    candidate_b: { id: "B", weighted_score: scoreCandidate(b.scores), style: b.style, scores: b.scores },
  };
}

export async function runPairwiseTournament(
  candidates: Candidate[],
  spec: SiteSpec,
  dna: DesignDNA,
  critic: (comparison: BlindComparison) => Promise<CriticDecision>,
): Promise<TournamentResult[]> {
  const results = new Map(candidates.map((candidate) => [candidate.id, { candidate, wins: 0, decisions: [] as CriticDecision[] }]));
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left];
      const b = candidates[right];
      if (!a || !b) continue;
      const decision = await critic(buildBlindComparison(a, b, spec, dna));
      const winner = decision.winner === "A" ? a : b;
      const result = results.get(winner.id);
      if (result) {
        result.wins += 1;
        result.decisions.push(decision);
      }
    }
  }
  return [...results.values()].sort((a, b) => b.wins - a.wins || scoreCandidate(b.candidate.scores as CandidateScores) - scoreCandidate(a.candidate.scores as CandidateScores) || a.candidate.id.localeCompare(b.candidate.id));
}
