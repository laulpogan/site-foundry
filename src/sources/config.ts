import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { FoundryError } from "../core/errors.js";
import type { SourceConfig } from "./types.js";

export async function loadSourceConfig(path = new URL("../../skills/site-foundry/sources.yaml", import.meta.url)): Promise<SourceConfig[]> {
  const parsed: unknown = parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new FoundryError("INVALID_ARTIFACT", "Source configuration must be an array");
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new FoundryError("INVALID_ARTIFACT", `Invalid source configuration at index ${index}`);
    }
    const source = entry as Partial<SourceConfig>;
    if (
      !source.id ||
      !source.domain ||
      source.account_policy !== "public-only" ||
      !source.implementation_policy ||
      !source.mode ||
      !Number.isFinite(source.rate_limit_ms) ||
      !Number.isFinite(source.quality_prior)
    ) {
      throw new FoundryError("INVALID_ARTIFACT", `Incomplete source configuration at index ${index}`);
    }
    return source as SourceConfig;
  });
}
