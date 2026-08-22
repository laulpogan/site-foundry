import { combineArchetypes, loadArchetypes } from "../archetypes/compiler.js";
import { validateArtifact } from "../core/schema.js";
import type { RouteSpec, SiteSpec } from "../core/types.js";

export interface BriefInput {
  brief: string;
  site_type?: string;
  audience?: string[];
  primary_goal?: string;
  routes?: RouteSpec[];
  required_interactions?: string[];
  brand_attributes?: string[];
  content_density?: SiteSpec["content_density"];
  motion_level?: SiteSpec["motion_level"];
}

const prohibitedClaims = [
  "customer logos",
  "testimonials",
  "revenue figures",
  "security certifications",
  "benchmark results",
  "customer counts",
  "product capabilities not supplied by the user",
];

function inferType(brief: string): string {
  const text = brief.toLowerCase();
  const hasMarketing = /\b(marketing|launch|pricing|homepage)\b/.test(text);
  const hasProduct = /\b(saas|dashboard|settings|billing|onboarding|authenticated)\b/.test(text);
  if (hasMarketing && hasProduct) return "saas-product-and-marketing";
  if (/\b(store|shop|e-?commerce|cart|checkout)\b/.test(text)) return "ecommerce";
  if (/\b(publication|magazine|editorial|newsletter)\b/.test(text)) return "editorial";
  if (/\b(portfolio|agency|studio|case stud)/.test(text)) return "portfolio";
  if (/\b(documentation|docs|api reference|developer portal)\b/.test(text)) return "docs";
  if (/\b(marketplace|community|moderation|listing)\b/.test(text)) return "marketplace";
  if (/\b(dental|practice|local business|event|booking|location|schedule)\b/.test(text)) return "service-event";
  if (/\b(internal tool|admin|permissions|audit history)\b/.test(text)) return "internal-tool";
  if (hasProduct) return "saas-product";
  return "marketing";
}

function inferAudience(brief: string): string[] {
  const match = brief.match(/\bfor\s+(.+?)(?:\s+with\b|[.,]|$)/i)?.[1]?.trim();
  return [match || "the intended audience"];
}

function inferGoal(brief: string): string {
  const text = brief.toLowerCase();
  if (/book(?:ing)? (?:a )?demo/.test(text)) return "book-demo";
  if (/book(?:ing)?|appointment|schedule/.test(text)) return "request-booking";
  if (/checkout|purchase|buy/.test(text)) return "purchase";
  if (/subscribe|newsletter/.test(text)) return "subscribe";
  if (/download|install/.test(text)) return "start-using-product";
  return "complete-primary-action";
}

export async function compileBrief(input: BriefInput): Promise<SiteSpec> {
  const packs = await loadArchetypes();
  const siteType = input.site_type ?? inferType(input.brief);
  const pack = siteType === "saas-product-and-marketing"
    ? combineArchetypes(packs, ["marketing", "saas-product"], siteType)
    : packs.find((candidate) => candidate.id === siteType) ?? packs.find((candidate) => candidate.id === "marketing");
  if (!pack) throw new Error("Marketing archetype is missing");
  return validateArtifact("site-spec", {
    site_type: siteType,
    audience: input.audience ?? inferAudience(input.brief),
    primary_goal: input.primary_goal ?? inferGoal(input.brief),
    routes: input.routes ?? pack.routes,
    required_interactions: input.required_interactions ?? pack.interactions,
    brand_attributes: input.brand_attributes ?? ["clear", "credible", "specific"],
    content_density: input.content_density ?? "moderate",
    motion_level: input.motion_level ?? "restrained",
    stack: "react-typescript-tailwind",
    assumptions: [
      input.brief,
      "Product facts and proof remain neutral editable copy until supplied by the user",
    ],
    prohibited_claims: prohibitedClaims,
  });
}
