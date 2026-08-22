import { describe, expect, it } from "vitest";
import { loadArchetypes, planPageSlots, selectArchetype } from "../../src/archetypes/compiler.js";
import { compileBrief } from "../../src/brief/compiler.js";

describe("brief compiler", () => {
  it("compiles a complete marketing brief without fabricated proof", async () => {
    const spec = await compileBrief({
      brief: "Launch a precise infrastructure product for platform engineering teams. The main action is booking a demo.",
      site_type: "marketing",
      brand_attributes: ["precise", "confident", "technical"],
    });

    expect(spec).toMatchObject({
      site_type: "marketing",
      audience: ["platform engineering teams"],
      primary_goal: "book-demo",
      stack: "react-typescript-tailwind",
    });
    expect(spec.routes.map((route) => route.path)).toEqual(expect.arrayContaining(["/", "/product", "/pricing", "/blog"]));
    expect(spec.prohibited_claims).toEqual(expect.arrayContaining(["customer logos", "testimonials", "revenue figures", "security certifications"]));
    expect(JSON.stringify(spec)).not.toMatch(/SOC 2|Fortune 500|99\.99%/);
  });

  it("combines marketing and software-product grammars for a hybrid brief", async () => {
    const spec = await compileBrief({
      brief: "Build a SaaS marketing site and authenticated dashboard for operations teams with settings, billing, tables, and onboarding.",
    });
    expect(spec.site_type).toBe("saas-product-and-marketing");
    expect(spec.routes.map((route) => route.path)).toEqual(expect.arrayContaining(["/pricing", "/app", "/app/settings", "/app/onboarding"]));
    expect(spec.required_interactions).toEqual(expect.arrayContaining(["submit-contact-form", "filter-records", "open-command-menu"]));
  });

  it("selects an archetype grammar for an unknown site rather than a blank page", async () => {
    const spec = await compileBrief({ brief: "Create a neighborhood dental practice site with services, location, schedule, and FAQ." });
    const archetype = await selectArchetype(spec);
    expect(archetype.id).toBe("service-event");
    expect(planPageSlots(spec, archetype)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "hero", classification: "signature" }),
      expect.objectContaining({ id: "main-navigation", classification: "structural" }),
      expect.objectContaining({ id: "booking-shell", classification: "functional" }),
    ]));
  });

  it("ships all nine archetype packs with routes, slots, states, and interactions", async () => {
    const packs = await loadArchetypes();
    expect(packs.map((pack) => pack.id).sort()).toEqual([
      "docs",
      "ecommerce",
      "editorial",
      "internal-tool",
      "marketing",
      "marketplace",
      "portfolio",
      "saas-product",
      "service-event",
    ]);
    for (const pack of packs) {
      expect(pack.routes.length).toBeGreaterThan(0);
      expect(pack.slots.length).toBeGreaterThan(0);
      expect(pack.required_states).toEqual(expect.arrayContaining(["loading", "empty", "error"]));
      expect(pack.interactions.length).toBeGreaterThan(0);
    }
  });

  it("keeps unknown product claims as explicit assumptions", async () => {
    const spec = await compileBrief({ brief: "Launch a new analytics tool." });
    expect(spec.assumptions).toContain("Product facts and proof remain neutral editable copy until supplied by the user");
  });
});
