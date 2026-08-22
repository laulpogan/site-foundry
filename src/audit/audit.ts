import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type BrowserContext } from "playwright";
import type { SiteSpec } from "../core/types.js";
import { DEFAULT_VIEWPORTS, isLocalBrowserUrl, type Viewport } from "../lab/capture.js";

export type IssueSeverity = "critical" | "serious" | "moderate" | "minor";

export interface AxeViolationEvidence {
  id: string;
  impact: string | null;
  description: string;
}

export interface PageAuditEvidence {
  console_errors: string[];
  failed_requests: string[];
  links: string[];
  horizontal_overflow: boolean;
  axe_violations: AxeViolationEvidence[];
  keyboard_navigation: boolean;
  visible_focus: boolean;
  reduced_motion: boolean;
  text: string;
}

export interface PageAuditRequest {
  url: string;
  route: string;
  viewport: Viewport;
  network_policy: "local-only";
}

export interface AuditDriver {
  auditPage(request: PageAuditRequest): Promise<PageAuditEvidence>;
  close?(): Promise<void>;
}

export interface AuditIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  route: string;
  viewport: string;
}

export interface AuditReport {
  acceptance_gates_passed: boolean;
  issues: AuditIssue[];
  pages_audited: number;
}

async function restrictNetwork(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    if (isLocalBrowserUrl(route.request().url())) await route.continue();
    else await route.abort("blockedbyclient");
  });
}

export class PlaywrightAuditDriver implements AuditDriver {
  private readonly browser = chromium.launch({ headless: true });

  async auditPage(request: PageAuditRequest): Promise<PageAuditEvidence> {
    const browser = await this.browser;
    const context = await browser.newContext({ viewport: request.viewport, reducedMotion: "reduce" });
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    try {
      await restrictNetwork(context);
      const page = await context.newPage();
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("requestfailed", (failed) => failedRequests.push(`${failed.url()}: ${failed.failure()?.errorText ?? "failed"}`));
      await page.goto(request.url, { waitUntil: "networkidle" });
      const axe = await new AxeBuilder({ page }).analyze();
      const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      await page.keyboard.press("Tab");
      const keyboardNavigation = await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement);
      const visibleFocus = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return false;
        const style = getComputedStyle(active);
        return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      });
      const reducedMotion = await page.evaluate(() => document.getAnimations().every((animation) => {
        const duration = animation.effect?.getTiming().duration;
        return typeof duration !== "number" || duration <= 20;
      }));
      return {
        console_errors: consoleErrors,
        failed_requests: failedRequests,
        links,
        horizontal_overflow: horizontalOverflow,
        axe_violations: axe.violations.map((violation) => ({ id: violation.id, impact: violation.impact ?? null, description: violation.description })),
        keyboard_navigation: keyboardNavigation,
        visible_focus: visibleFocus,
        reduced_motion: reducedMotion,
        text: await page.locator("body").innerText(),
      };
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    await (await this.browser).close();
  }
}

function concreteRoute(path: string): string {
  return path.replace(/:([a-z]+)/g, "demo-$1");
}

const severityRank: Record<IssueSeverity, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 };

export async function auditSite(
  baseUrl: string,
  spec: SiteSpec,
  driver: AuditDriver = new PlaywrightAuditDriver(),
): Promise<AuditReport> {
  const issues: AuditIssue[] = [];
  const allowedRoutes = new Set(spec.routes.map((route) => concreteRoute(route.path)));
  const add = (condition: boolean, code: string, severity: IssueSeverity, message: string, route: string, viewport: string): void => {
    if (condition) issues.push({ code, severity, message, route, viewport });
  };
  let pagesAudited = 0;
  try {
    for (const routeSpec of spec.routes) {
      const route = concreteRoute(routeSpec.path);
      for (const dimensions of DEFAULT_VIEWPORTS) {
      const viewport = `${dimensions.width}x${dimensions.height}`;
      const evidence = await driver.auditPage({ url: new URL(route, baseUrl).href, route, viewport: dimensions, network_policy: "local-only" });
      pagesAudited += 1;
      for (const error of evidence.console_errors) add(true, "console-error", "critical", error, route, viewport);
      for (const failure of evidence.failed_requests) add(true, "failed-request", "serious", failure, route, viewport);
      for (const link of evidence.links) {
        if (link.startsWith("/") && !allowedRoutes.has(link.split(/[?#]/)[0] ?? link)) add(true, "dead-link", "serious", `Unknown internal route ${link}`, route, viewport);
      }
      add(evidence.horizontal_overflow, "horizontal-overflow", "serious", "Critical content overflows the viewport", route, viewport);
      for (const violation of evidence.axe_violations) {
        if (violation.impact === "critical" || violation.impact === "serious") add(true, `axe-${violation.impact}`, violation.impact, `${violation.id}: ${violation.description}`, route, viewport);
      }
      add(!evidence.keyboard_navigation, "keyboard-navigation", "serious", "Keyboard navigation did not move focus", route, viewport);
      add(!evidence.visible_focus, "visible-focus", "serious", "Focused control has no visible outline", route, viewport);
      add(!evidence.reduced_motion, "reduced-motion", "moderate", "Animation remains active under reduced motion", route, viewport);
      for (const claim of spec.prohibited_claims) {
        if (claim && evidence.text.toLowerCase().includes(claim.toLowerCase())) add(true, "prohibited-claim", "critical", `Unverified claim appears: ${claim}`, route, viewport);
      }
      }
    }
  } finally {
    await driver.close?.();
  }
  issues.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.code.localeCompare(b.code) || a.route.localeCompare(b.route) || a.viewport.localeCompare(b.viewport));
  return { acceptance_gates_passed: issues.length === 0, issues, pages_audited: pagesAudited };
}
