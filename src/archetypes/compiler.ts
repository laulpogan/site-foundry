import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { FoundryError } from "../core/errors.js";
import type { RouteSpec, SiteSpec } from "../core/types.js";

export type SlotClassification = "signature" | "structural" | "functional" | "support";

export interface PageSlot {
  id: string;
  classification: SlotClassification;
  routes?: string[];
}

export interface ArchetypePack {
  id: string;
  triggers: string[];
  routes: RouteSpec[];
  slots: PageSlot[];
  interactions: string[];
  required_states: string[];
}

const archetypeDirectory = new URL("../../skills/site-foundry/archetypes/", import.meta.url);

function validatePack(value: unknown, filename: string): ArchetypePack {
  if (!value || typeof value !== "object") throw new FoundryError("INVALID_ARTIFACT", `Invalid archetype ${filename}`);
  const pack = value as Partial<ArchetypePack>;
  if (!pack.id || !Array.isArray(pack.triggers) || !Array.isArray(pack.routes) || !Array.isArray(pack.slots) || !Array.isArray(pack.interactions) || !Array.isArray(pack.required_states)) {
    throw new FoundryError("INVALID_ARTIFACT", `Incomplete archetype ${filename}`);
  }
  return pack as ArchetypePack;
}

export async function loadArchetypes(): Promise<ArchetypePack[]> {
  const files = (await readdir(archetypeDirectory)).filter((file) => file.endsWith(".yaml")).sort();
  return Promise.all(files.map(async (file) => validatePack(parse(await readFile(new URL(file, archetypeDirectory), "utf8")), file)));
}

export async function selectArchetype(spec: SiteSpec): Promise<ArchetypePack> {
  const packs = await loadArchetypes();
  const exact = packs.find((pack) => pack.id === spec.site_type);
  if (exact) return exact;
  if (spec.site_type === "saas-product-and-marketing") return combineArchetypes(packs, ["marketing", "saas-product"], spec.site_type);
  const text = `${spec.site_type} ${spec.assumptions.join(" ")}`.toLowerCase();
  const ranked = packs
    .map((pack) => ({ pack, score: pack.triggers.filter((trigger) => text.includes(trigger)).length }))
    .sort((a, b) => b.score - a.score || a.pack.id.localeCompare(b.pack.id));
  return ranked[0]?.score ? ranked[0].pack : (packs.find((pack) => pack.id === "marketing") as ArchetypePack);
}

export function combineArchetypes(packs: ArchetypePack[], ids: string[], id: string): ArchetypePack {
  const selected = ids.map((name) => packs.find((pack) => pack.id === name)).filter((pack): pack is ArchetypePack => Boolean(pack));
  if (selected.length !== ids.length) throw new FoundryError("INVALID_ARTIFACT", `Missing archetype in ${ids.join(", ")}`);
  const unique = <T>(items: T[], key: (item: T) => string): T[] => [...new Map(items.map((item) => [key(item), item])).values()];
  return {
    id,
    triggers: [...new Set(selected.flatMap((pack) => pack.triggers))],
    routes: unique(selected.flatMap((pack) => pack.routes), (route) => route.path),
    slots: unique(selected.flatMap((pack) => pack.slots), (slot) => slot.id),
    interactions: [...new Set(selected.flatMap((pack) => pack.interactions))],
    required_states: [...new Set(selected.flatMap((pack) => pack.required_states))],
  };
}

export function planPageSlots(_spec: SiteSpec, pack: ArchetypePack): PageSlot[] {
  return pack.slots.map((slot) => ({ ...slot, routes: slot.routes ?? pack.routes.map((route) => route.path) }));
}
