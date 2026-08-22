export type SourceMode =
  | "registry-index"
  | "public-component-docs"
  | "discovery-gallery"
  | "inspiration-gallery"
  | "product-inspiration";

export type ImplementationPolicy =
  | "allowed-with-license"
  | "free-public-only-with-license"
  | "resolve-canonical-public-source-or-skip"
  | "inspiration-only";

export interface SourceConfig {
  id: string;
  domain: string;
  mode: SourceMode;
  account_policy: "public-only";
  implementation_policy: ImplementationPolicy;
  rate_limit_ms: number;
  quality_prior: number;
  search_url?: string;
}

export interface SearchQuery {
  text: string;
  slot?: string;
  limit?: number;
}

export interface CandidateReference {
  id: string;
  source_id: string;
  title: string;
  url: string;
  canonical_repository?: string;
}

export interface VisualArtifact {
  source_url: string;
  captured_at: string;
  screenshot?: string;
  observations: string[];
}

export interface SourceFile {
  path: string;
  target: string;
  content: string;
  type: string;
}

export interface SourcePackage {
  kind: "source-package";
  name: string;
  source_url: string;
  canonical_repository?: string;
  revision?: string;
  license?: string;
  files: SourceFile[];
  dependencies: string[];
}

export interface InspirationOnly {
  kind: "inspiration-only";
  reason: string;
}

export type CodeResolution = SourcePackage | InspirationOnly;

export interface LicenseEvidence {
  license?: string;
  source_url: string;
  evidence?: string;
}

export interface SourceAdapter {
  readonly config: SourceConfig;
  search(query: SearchQuery): Promise<CandidateReference[]>;
  capture(reference: CandidateReference): Promise<VisualArtifact>;
  resolveCode(reference: CandidateReference): Promise<CodeResolution>;
  inspectLicense(reference: CandidateReference): Promise<LicenseEvidence>;
}
