import type {
  CandidateReference,
  CodeResolution,
  LicenseEvidence,
  SearchQuery,
  SourceAdapter,
  SourceConfig,
  VisualArtifact,
} from "./types.js";

export class GalleryAdapter implements SourceAdapter {
  constructor(readonly config: SourceConfig) {}

  async search(_query: SearchQuery): Promise<CandidateReference[]> {
    return [];
  }

  async capture(reference: CandidateReference): Promise<VisualArtifact> {
    return {
      source_url: reference.url,
      captured_at: new Date().toISOString(),
      observations: ["Inspiration evidence only; no code or proprietary assets retained"],
    };
  }

  async resolveCode(_reference: CandidateReference): Promise<CodeResolution> {
    return {
      kind: "inspiration-only",
      reason: `${this.config.id} policy forbids code import`,
    };
  }

  async inspectLicense(reference: CandidateReference): Promise<LicenseEvidence> {
    return { source_url: reference.url, evidence: "Inspiration only; no implementation permission inferred" };
  }
}
