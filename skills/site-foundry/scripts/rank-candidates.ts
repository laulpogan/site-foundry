import { runPairwiseTournament, type BlindComparison, type CriticDecision } from "../../../src/design/rank.js";
import type { Candidate, DesignDNA, SiteSpec } from "../../../src/core/types.js";
import { fail, output, readJsonArgument } from "./io.js";

interface Input { candidates: Candidate[]; spec: SiteSpec; dna: DesignDNA }
const critic = async (comparison: BlindComparison): Promise<CriticDecision> => ({
  winner: comparison.candidate_a.weighted_score >= comparison.candidate_b.weighted_score ? "A" : "B",
  evidence: "Deterministic weighted fallback; configure an independent visual critic for production taste validation",
  confidence: 0.5,
});
readJsonArgument<Input>().then((input) => runPairwiseTournament(input.candidates, input.spec, input.dna, critic)).then(output).catch(fail);
