import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { isLocalBrowserUrl } from "./capture.js";

export type InteractionState = "hover" | "focus" | "open" | "loading" | "reduced-motion";

export interface InteractionRequest {
  url: string;
  output: string;
  states: InteractionState[];
  network_policy: "local-only";
}

export interface InteractionDriver {
  exercise(request: InteractionRequest): Promise<string[]>;
}

const REQUIRED_STATES: InteractionState[] = ["hover", "focus", "open", "loading", "reduced-motion"];

export class PlaywrightInteractionDriver implements InteractionDriver {
  async exercise(request: InteractionRequest): Promise<string[]> {
    await mkdir(request.output, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const completed: string[] = [];
    try {
      for (const state of request.states) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          reducedMotion: state === "reduced-motion" ? "reduce" : "no-preference",
        });
        await context.route("**/*", async (route) => {
          if (isLocalBrowserUrl(route.request().url())) await route.continue();
          else await route.abort("blockedbyclient");
        });
        const page = await context.newPage();
        await page.goto(request.url, { waitUntil: "networkidle" });
        if (state === "hover") await page.locator("[data-foundry-hover], button, a").first().hover();
        if (state === "focus") await page.locator("button, a, input, select, textarea, [tabindex]").first().focus();
        if (state === "open") {
          const target = page.locator("[data-foundry-open]").first();
          if (await target.count()) await target.click();
        }
        if (state === "loading") {
          const target = page.locator("[data-foundry-state='loading']").first();
          if (await target.count()) await target.scrollIntoViewIfNeeded();
        }
        await page.screenshot({ path: join(request.output, `state-${state}.png`), fullPage: true });
        completed.push(state);
        await context.close();
      }
    } finally {
      await browser.close();
    }
    return completed;
  }
}

export async function exerciseCandidate(
  url: string,
  output: string,
  driver: InteractionDriver = new PlaywrightInteractionDriver(),
): Promise<string[]> {
  return driver.exercise({ url, output, states: REQUIRED_STATES, network_policy: "local-only" });
}
