import { FoundryError } from "../core/errors.js";
import type {
  CandidateReference,
  CodeResolution,
  LicenseEvidence,
  SearchQuery,
  SourceAdapter,
  SourceConfig,
  SourceFile,
  SourcePackage,
  VisualArtifact,
} from "./types.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies: string[];
  files: SourceFile[];
}

export function parseRegistryItem(value: unknown, sourceUrl: string): RegistryItem {
  if (!value || typeof value !== "object") {
    throw new FoundryError("SOURCE_UNAVAILABLE", `Invalid registry item: ${sourceUrl}`);
  }
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || typeof item.type !== "string" || !Array.isArray(item.files)) {
    throw new FoundryError("SOURCE_UNAVAILABLE", `Incomplete registry item: ${sourceUrl}`);
  }
  const files = item.files.map((file, index) => {
    if (!file || typeof file !== "object") {
      throw new FoundryError("SOURCE_UNAVAILABLE", `Invalid registry file ${index}: ${sourceUrl}`);
    }
    const candidate = file as Record<string, unknown>;
    if (typeof candidate.path !== "string" || typeof candidate.content !== "string" || typeof candidate.type !== "string") {
      throw new FoundryError("SOURCE_UNAVAILABLE", `Incomplete registry file ${index}: ${sourceUrl}`);
    }
    return {
      path: candidate.path,
      target: typeof candidate.target === "string" ? candidate.target : candidate.path,
      content: candidate.content,
      type: candidate.type,
    };
  });
  const parsed: RegistryItem = {
    name: item.name,
    type: item.type,
    dependencies: Array.isArray(item.dependencies) ? item.dependencies.filter((entry): entry is string => typeof entry === "string") : [],
    files,
  };
  if (typeof item.title === "string") parsed.title = item.title;
  if (typeof item.description === "string") parsed.description = item.description;
  return parsed;
}

export class RegistryAdapter implements SourceAdapter {
  constructor(
    readonly config: SourceConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async search(query: SearchQuery): Promise<CandidateReference[]> {
    if (!this.config.search_url) return [];
    const url = this.config.search_url.replace("{query}", encodeURIComponent(query.text));
    const response = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new FoundryError("SOURCE_UNAVAILABLE", `${this.config.id} search failed: ${response.status}`);
    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) return [];
    return body.slice(0, query.limit ?? 20).flatMap((entry): CandidateReference[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.name !== "string" || typeof item.url !== "string") return [];
      return [{ id: item.name, source_id: this.config.id, title: typeof item.title === "string" ? item.title : item.name, url: item.url }];
    });
  }

  async capture(reference: CandidateReference): Promise<VisualArtifact> {
    return { source_url: reference.url, captured_at: new Date().toISOString(), observations: ["Registry source captured as code evidence"] };
  }

  async resolveCode(reference: CandidateReference): Promise<CodeResolution> {
    const response = await this.fetchImpl(reference.url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new FoundryError("SOURCE_UNAVAILABLE", `${reference.url} returned ${response.status}`);
    const item = parseRegistryItem(await response.json(), reference.url);
    const resolved: SourcePackage = {
      kind: "source-package",
      name: item.name,
      source_url: reference.url,
      files: item.files,
      dependencies: item.dependencies,
    };
    if (reference.canonical_repository) resolved.canonical_repository = reference.canonical_repository;
    return resolved;
  }

  async inspectLicense(reference: CandidateReference): Promise<LicenseEvidence> {
    return { source_url: reference.canonical_repository ?? reference.url };
  }
}
