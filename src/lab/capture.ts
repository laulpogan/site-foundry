import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

export interface Viewport {
  width: number;
  height: number;
}

export const DEFAULT_VIEWPORTS: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
];

export interface CaptureRequest {
  url: string;
  output: string;
  viewports: Viewport[];
  network_policy: "local-only";
}

export interface CandidateEvidence {
  screenshots: string[];
  console_errors: string[];
  failed_requests: string[];
  states: string[];
}

export interface CaptureDriver {
  capture(request: CaptureRequest): Promise<CandidateEvidence>;
}

export function isLocalBrowserUrl(raw: string): boolean {
  const url = new URL(raw);
  return ["data:", "blob:", "file:"].includes(url.protocol) ||
    ((url.protocol === "http:" || url.protocol === "https:") && ["127.0.0.1", "localhost", "::1"].includes(url.hostname));
}

async function restrictNetwork(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    if (isLocalBrowserUrl(route.request().url())) await route.continue();
    else await route.abort("blockedbyclient");
  });
}

export class PlaywrightCaptureDriver implements CaptureDriver {
  async capture(request: CaptureRequest): Promise<CandidateEvidence> {
    await mkdir(request.output, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const screenshots: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    try {
      for (const viewport of request.viewports) {
        const context = await browser.newContext({ viewport });
        await restrictNetwork(context);
        const page: Page = await context.newPage();
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("requestfailed", (failed) => {
          const url = failed.url();
          if (isLocalBrowserUrl(url)) failedRequests.push(`${url}: ${failed.failure()?.errorText ?? "failed"}`);
        });
        await page.goto(request.url, { waitUntil: "networkidle" });
        const filename = `${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: join(request.output, filename), fullPage: true });
        screenshots.push(filename);
        await context.close();
      }
    } finally {
      await browser.close();
    }
    return { screenshots, console_errors: consoleErrors, failed_requests: failedRequests, states: [] };
  }
}

export async function captureCandidate(
  url: string,
  output: string,
  driver: CaptureDriver = new PlaywrightCaptureDriver(),
): Promise<CandidateEvidence> {
  return driver.capture({ url, output, viewports: DEFAULT_VIEWPORTS, network_policy: "local-only" });
}
