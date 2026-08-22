import type { DesignDNA, SiteSpec } from "../core/types.js";

export interface ReferenceEvidence {
  source_url: string;
  observations: string[];
}

export interface DesignDirection {
  id: string;
  label: string;
  rationale: string;
  evidence: string[];
  dna: DesignDNA;
  proof_slots: ["hero", "representative-product-section"];
}

function baseDna(thesis: string): DesignDNA {
  return {
    thesis,
    layout: { grid: "12-column", max_width: 1240, section_rhythm: "large" },
    typography: { display_character: "heavy geometric", body_character: "neutral grotesk", scale: "aggressive" },
    color: { base: "warm neutral", accent_count: 1, contrast: "high" },
    geometry: { radius: "low", borders: "thin", shadows: "rare" },
    media: { treatment: "single oversized focal object" },
    motion: { energy: "restrained", durations: "fast", signature_effects_per_page: 1 },
    density: "low-marketing-medium-product",
    anti_patterns: ["random gradients", "glass everywhere", "nested cards", "animation on every section"],
  };
}

export function deriveDirections(spec: SiteSpec, references: ReferenceEvidence[]): DesignDirection[] {
  const evidence = references.flatMap((reference) => reference.observations).slice(0, 12);
  const quiet = baseDna("quiet industrial precision");
  const editorial = baseDna("editorial technical minimalism");
  editorial.typography = { display_character: "high-contrast editorial", body_character: "humanist grotesk", scale: "editorial" };
  editorial.layout = { grid: "asymmetric-12-column", max_width: 1180, section_rhythm: "alternating" };
  editorial.media = { treatment: "diagram and annotated artifact" };
  const cinematic = baseDna("cinematic kinetic product launch");
  cinematic.color = { base: "near-black", accent_count: 1, contrast: "maximum" };
  cinematic.media = { treatment: "single luminous product system" };
  cinematic.motion = { energy: spec.motion_level === "none" ? "none" : "controlled-kinetic", durations: "measured", signature_effects_per_page: 1 };

  return [
    { id: "quiet-industrial", label: "Quiet industrial precision", rationale: `Makes ${spec.primary_goal} feel credible and direct`, evidence, dna: quiet, proof_slots: ["hero", "representative-product-section"] },
    { id: "editorial-technical", label: "Editorial technical minimalism", rationale: `Uses reading rhythm for ${spec.audience.join(", ")}`, evidence, dna: editorial, proof_slots: ["hero", "representative-product-section"] },
    { id: "cinematic-kinetic", label: "Cinematic kinetic product launch", rationale: "Concentrates spectacle in one product demonstration", evidence, dna: cinematic, proof_slots: ["hero", "representative-product-section"] },
  ];
}
