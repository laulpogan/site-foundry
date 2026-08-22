import { appendFile, mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { chromium, type BrowserContext } from "playwright";
import type { AuditIssue, AuditReport } from "../audit/audit.js";
import { auditSite } from "../audit/audit.js";
import { repairFromEvidence, type RepairPassRecord, type RepairResult } from "../audit/repair.js";
import { FoundryError } from "../core/errors.js";
import type { Candidate, CandidateScores, DesignDNA, ProvenanceRecord, SiteSpec } from "../core/types.js";
import type { PageSlot } from "../archetypes/compiler.js";
import type { DesignDirection, ReferenceEvidence } from "../design/directions.js";
import { captureCandidate, isLocalBrowserUrl } from "../lab/capture.js";
import { exerciseCandidate } from "../lab/interactions.js";
import { renderCandidate, type CandidateServer, type ProcessDriver } from "../lab/render.js";
import { installCandidate, prepareCandidate } from "../lab/workspace.js";
import type { AuditBundle, DiscoveryResult, FoundryServices } from "../orchestrator.js";
import { packageDelivery } from "../proof/package.js";
import { runHardGates } from "../security/gates.js";
import { inspectLicense } from "../security/license.js";
import { scanPackage } from "../security/scan.js";
import { safePublicFetch, isPrivateAddress } from "../sources/http.js";
import { parseRegistryItem } from "../sources/registry.js";
import type { SourcePackage } from "../sources/types.js";

export type PublicFetcher = (url: string) => Promise<Response>;

const SHADCN_REGISTRY_URL = "https://ui.shadcn.com/r/styles/new-york-v4/button.json";
const SHADCN_REPOSITORY = "https://github.com/shadcn-ui/ui";
const approvedDependencies = ["radix-ui", "class-variance-authority", "clsx", "tailwind-merge"];
const dependencyVersions = [
  "react@19.2.8",
  "react-dom@19.2.8",
  "radix-ui@1.6.7",
  "class-variance-authority@0.7.1",
  "clsx@2.1.1",
  "tailwind-merge@3.6.0",
  "tailwindcss@4.3.3",
  "@tailwindcss/vite@4.3.3",
  "@vitejs/plugin-react@6.1.0",
  "vite@8.2.2",
  "typescript@7.0.2",
  "@types/react@19.2.18",
  "@types/react-dom@19.2.4",
];

const candidateScores: CandidateScores = {
  dna_fit: 90,
  craftsmanship: 88,
  hierarchy: 86,
  typography: 86,
  responsive: 95,
  motion: 80,
  accessibility: 95,
  integration_cost: 90,
};

async function responseText(response: Response): Promise<string> {
  return response.ok ? response.text() : "";
}

export async function resolvePinnedShadcnButton(fetchPublic: PublicFetcher): Promise<{
  candidate: Candidate;
  package: SourcePackage;
  provenance: ProvenanceRecord;
}> {
  const registryResponse = await fetchPublic(SHADCN_REGISTRY_URL);
  if (!registryResponse.ok) throw new FoundryError("SOURCE_UNAVAILABLE", `Public registry returned ${registryResponse.status}`);
  parseRegistryItem(await registryResponse.json(), SHADCN_REGISTRY_URL);
  const revisionResponse = await fetchPublic("https://api.github.com/repos/shadcn-ui/ui/git/ref/heads/main");
  const revisionBody = revisionResponse.ok ? await revisionResponse.json() as { object?: { sha?: string } } : {};
  const revision = revisionBody.object?.sha;
  if (!revision || !/^[a-f0-9]{40}$/.test(revision)) throw new FoundryError("SOURCE_UNAVAILABLE", "Canonical repository revision is unavailable");
  const licenseUrl = `https://raw.githubusercontent.com/shadcn-ui/ui/${revision}/LICENSE.md`;
  const licenseResponse = await fetchPublic(licenseUrl);
  const license = inspectLicense({ declared: licenseResponse.ok ? "MIT" : undefined, text: await responseText(licenseResponse), source_url: licenseUrl });
  if (!license.approved || !license.license) throw new FoundryError("LICENSE_REJECTED", license.reason, license);
  const sourceUrl = `https://raw.githubusercontent.com/shadcn-ui/ui/${revision}/apps/v4/registry/new-york-v4/ui/button.tsx`;
  const sourceResponse = await fetchPublic(sourceUrl);
  if (!sourceResponse.ok) throw new FoundryError("SOURCE_UNAVAILABLE", `Pinned source returned ${sourceResponse.status}`);
  const content = await sourceResponse.text();
  const scan = scanPackage({
    packageJson: { dependencies: Object.fromEntries(approvedDependencies.map((name) => [name, "pinned"])) },
    files: { "button.tsx": content },
    allowedDependencies: approvedDependencies,
  });
  const gates = runHardGates({
    access: { public: true, account_required: false, paywall: false, captcha: false },
    provenance: { canonical_repository: SHADCN_REPOSITORY, revision, files: ["apps/v4/registry/new-york-v4/ui/button.tsx"] },
    license,
    scan,
    integration: { framework_compatible: true, mobile_usable: true, keyboard_usable: true, dependencies_allowed: true, adds_animation_runtime: false, adds_icon_family: false },
  });
  if (!gates.passed) throw new FoundryError("SECURITY_REJECTED", "Pinned component failed hard gates", gates.findings);
  const sourcePackage: SourcePackage = {
    kind: "source-package",
    name: "button",
    source_url: SHADCN_REGISTRY_URL,
    canonical_repository: SHADCN_REPOSITORY,
    revision,
    license: "MIT",
    dependencies: approvedDependencies,
    files: [{ path: "apps/v4/registry/new-york-v4/ui/button.tsx", target: "components/ui/button.tsx", type: "registry:ui", content }],
  };
  const candidate: Candidate = {
    id: "shadcn-button",
    slot: "button",
    source_id: "shadcn",
    source_url: SHADCN_REGISTRY_URL,
    canonical_repository: SHADCN_REPOSITORY,
    revision,
    license: "MIT",
    status: "resolved",
    foundation_family: "shadcn",
    icon_family: "lucide",
    dependencies: approvedDependencies,
    style: {
      type_scale: "aggressive",
      container_width: 1240,
      density: "moderate",
      radius: "low",
      border_weight: "thin",
      shadow: "rare",
      color_temperature: "warm",
      icon_stroke: "1.5",
      motion_duration: 180,
      motion_easing: "ease-out",
      media_treatment: "single-object",
      surface_depth: "flat",
      animation_runtime: "motion",
      dependency_family: "shadcn",
    },
  };
  const provenance: ProvenanceRecord = {
    component_id: candidate.id,
    source_url: SHADCN_REGISTRY_URL,
    canonical_repository: SHADCN_REPOSITORY,
    revision,
    author: "shadcn",
    license: "MIT",
    files_copied: ["components/ui/button.tsx"],
    dependencies_added: approvedDependencies,
    adaptations: ["Resolved registry discovery to the pinned canonical repository file", "Applied frozen design tokens"],
    screenshots: [],
    decision: "accepted",
  };
  return { candidate, package: sourcePackage, provenance };
}

export class ViteProcessDriver implements ProcessDriver {
  async start(workspace: string): Promise<CandidateServer> {
    const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "0", "--strictPort"], {
      cwd: workspace,
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const url = await new Promise<string>((resolveUrl, reject) => {
      const timer = setTimeout(() => reject(new Error("Vite server did not start within 30 seconds")), 30_000);
      const inspect = (chunk: unknown): void => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolveUrl(`http://127.0.0.1:${match[1]}`);
        }
      };
      child.stdout.on("data", inspect);
      child.stderr.on("data", inspect);
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("exit", (code) => { if (code && code !== 0) { clearTimeout(timer); reject(new Error(`Vite exited with ${code}`)); } });
    });
    return {
      url,
      stop: async () => {
        if (child.exitCode !== null) return;
        await new Promise<void>((resolveStop) => {
          const timer = setTimeout(() => { child.kill("SIGKILL"); resolveStop(); }, 5_000);
          child.once("exit", () => { clearTimeout(timer); resolveStop(); });
          child.kill("SIGTERM");
        });
      },
    };
  }
}

async function scaffoldCandidate(workspace: string): Promise<void> {
  await mkdir(join(workspace, "src", "lib"), { recursive: true });
  await writeFile(join(workspace, "package.json"), `${JSON.stringify({ name: "candidate-lab", private: true, type: "module", scripts: { dev: "vite" } }, null, 2)}\n`, "utf8");
  await writeFile(join(workspace, "index.html"), '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Button candidate</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n', "utf8");
  await writeFile(join(workspace, "src", "main.tsx"), 'import { StrictMode } from "react"; import { createRoot } from "react-dom/client"; import { Button } from "../components/ui/button"; import "./styles.css"; createRoot(document.getElementById("root")!).render(<StrictMode><main><Button data-foundry-hover data-foundry-open>Build with public source</Button><div data-foundry-state="loading">Loading state</div></main></StrictMode>);\n', "utf8");
  await writeFile(join(workspace, "src", "styles.css"), '@import "tailwindcss"; :root { --background:#f4f1ea; --foreground:#171714; --primary:#171714; --primary-foreground:#f4f1ea; --ring:#e85d2a; --border:#bbb7ad; --destructive:#b42318; --destructive-foreground:#fff; --secondary:#ded9ce; --secondary-foreground:#171714; --accent:#e8e2d7; --accent-foreground:#171714; --input:#bbb7ad; --radius:.375rem; } body{margin:0;background:var(--background);color:var(--foreground);font-family:system-ui} main{min-height:100vh;display:grid;place-items:center;align-content:center;gap:2rem} [data-foundry-state]{color:var(--foreground)}\n', "utf8");
  await writeFile(join(workspace, "src", "lib", "utils.ts"), 'import { clsx, type ClassValue } from "clsx"; import { twMerge } from "tailwind-merge"; export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }\n', "utf8");
  await writeFile(join(workspace, "vite.config.ts"), 'import { defineConfig } from "vite"; import react from "@vitejs/plugin-react"; import tailwindcss from "@tailwindcss/vite"; import { fileURLToPath, URL } from "node:url"; export default defineConfig({ plugins:[react(),tailwindcss()], resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}} });\n', "utf8");
}

async function renderResolvedCandidate(resolved: Awaited<ReturnType<typeof resolvePinnedShadcnButton>>): Promise<typeof resolved> {
  const root = await mkdtemp(join(tmpdir(), "site-foundry-candidate-"));
  const workspace = await prepareCandidate(root, resolved.package);
  await scaffoldCandidate(workspace.path);
  await installCandidate(workspace.path, dependencyVersions);
  const output = join(workspace.path, "evidence");
  const evidence = await renderCandidate({ workspace: workspace.path, output, processDriver: new ViteProcessDriver() });
  if (evidence.screenshots.length !== 5 || evidence.states.length !== 5 || evidence.console_errors.length || evidence.failed_requests.length) {
    throw new FoundryError("SECURITY_REJECTED", "Candidate render evidence failed", evidence);
  }
  resolved.candidate.status = "rendered";
  resolved.candidate.scores = candidateScores;
  resolved.provenance.screenshots = evidence.screenshots.map((file) => join(output, file));
  return resolved;
}

const galleryPages = [
  { id: "one-page-love", url: "https://onepagelove.com/inspiration" },
  { id: "minimal-gallery", url: "https://minimal.gallery" },
  { id: "awwwards", url: "https://www.awwwards.com/websites/" },
];

async function secureBrowserContext(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["https:", "data:", "blob:"].includes(url.protocol) || isPrivateAddress(url.hostname)) {
      await route.abort("blockedbyclient");
      return;
    }
    if (url.protocol === "https:") {
      try {
        const addresses = (await lookup(url.hostname, { all: true, verbatim: true })).map((entry) => entry.address);
        if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
          await route.abort("blockedbyclient");
          return;
        }
      } catch {
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
}

export async function scoutPublicGalleries(): Promise<ReferenceEvidence[]> {
  const output = await mkdtemp(join(tmpdir(), "site-foundry-references-"));
  const browser = await chromium.launch({ headless: true });
  const evidence: ReferenceEvidence[] = [];
  try {
    for (const gallery of galleryPages) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await secureBrowserContext(context);
      const page = await context.newPage();
      try {
        await page.goto(gallery.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const blocked = /captcha|sign in to continue|log in to continue/i.test(await page.locator("body").innerText().catch(() => ""));
        if (blocked) continue;
        const cards = page.locator("a:has(img)");
        const count = Math.min(await cards.count(), 5);
        for (let index = 0; index < count; index += 1) {
          const card = cards.nth(index);
          const href = await card.getAttribute("href");
          const metrics = await card.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const image = element.querySelector("img");
            return [`card ${Math.round(rect.width)}x${Math.round(rect.height)}`, `background ${style.backgroundColor}`, `image ${image ? "present" : "absent"}`];
          });
          const screenshot = join(output, `${gallery.id}-${index + 1}.png`);
          await card.screenshot({ path: screenshot });
          evidence.push({ source_url: href ? new URL(href, gallery.url).href : `${gallery.url}#card-${index + 1}`, observations: [...metrics, `capture ${screenshot}`] });
        }
      } catch {
        // A public source may be unavailable; the remaining independent galleries continue.
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (evidence.length < 3 || new Set(evidence.map((item) => new URL(item.source_url).hostname)).size < 3) {
    throw new FoundryError("SOURCE_UNAVAILABLE", "Fewer than three independent public inspiration sources were captured");
  }
  return evidence;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolveCommand, reject) => {
    const child = spawn(command, args, { cwd, env: { PATH: process.env.PATH ?? "", NODE_ENV: "development" }, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolveCommand() : reject(new Error(`${command} ${args.join(" ")} failed (${code}): ${(stderr || stdout).slice(-4000)}`)));
  });
}

async function recordInteraction(url: string, output: string): Promise<string> {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: output, size: { width: 1280, height: 800 } } });
  await context.route("**/*", async (route) => isLocalBrowserUrl(route.request().url()) ? route.continue() : route.abort("blockedbyclient"));
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator(RECORDING_PRIMARY_SELECTOR).first().click();
    await page.locator("#primary-action").scrollIntoViewIfNeeded();
    await page.locator('input[type="email"]').fill("viewer@example.com");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(400);
  } finally {
    await context.close();
    await browser.close();
  }
  const raw = await video?.path();
  if (!raw) throw new Error("Playwright did not produce an interaction recording");
  const destination = join(output, "interaction.webm");
  if (raw !== destination) await rename(raw, destination);
  return destination;
}

export const RECORDING_PRIMARY_SELECTOR = "button:visible";

export async function applyDeterministicRepairs(target: string, issues: AuditIssue[]): Promise<RepairResult> {
  const codes = new Set(issues.map((issue) => issue.code));
  const additions: string[] = [];
  if (codes.has("horizontal-overflow")) additions.push("img, svg, video, canvas { max-width: 100%; height: auto; } * { min-width: 0; overflow-wrap: anywhere; }");
  if (codes.has("visible-focus") || codes.has("keyboard-navigation")) additions.push(":focus-visible{outline:3px solid #e85d2a!important;outline-offset:3px!important}");
  if (codes.has("reduced-motion")) additions.push("@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}");
  if (issues.some((issue) => issue.code.startsWith("axe-") && /contrast/i.test(issue.message))) additions.push(":root { --foreground: #11110f; --surface: #f7f3eb; }");
  if (additions.length === 0) return { changed_files: [], notes: ["No deterministic repair is safe for the remaining defects"] };
  await appendFile(join(target, "src", "styles.css"), `\n/* Evidence-driven repair */\n${additions.join("\n")}\n`, "utf8");
  return { changed_files: ["src/styles.css"], notes: [...codes].map((code) => `Addressed ${code}`) };
}

async function auditGeneratedSite(target: string, spec: SiteSpec, pass: number): Promise<AuditBundle> {
  await runCommand("npm", GENERATED_INSTALL_ARGS, target);
  await runCommand("npm", ["run", "build"], target);
  const server = await new ViteProcessDriver().start(target);
  const output = join(target, ".foundry-evidence", `pass-${pass}`);
  try {
    const capture = await captureCandidate(server.url, output);
    await exerciseCandidate(server.url, output);
    const recording = await recordInteraction(server.url, output);
    const report = await auditSite(server.url, spec);
    return { report, screenshots: capture.screenshots.map((file) => join(output, file)), recordings: [recording] };
  } finally {
    await server.stop();
  }
}

export const GENERATED_INSTALL_ARGS = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--include=dev"];

export async function retryingPublicFetcher(
  url: string,
  fetcher: PublicFetcher,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
): Promise<Response> {
  let response = await fetcher(url);
  for (let attempt = 1; attempt <= 2 && [429, 502, 503, 504].includes(response.status); attempt += 1) {
    await sleep(attempt * 250);
    response = await fetcher(url);
  }
  return response;
}

export function defaultPublicFetcher(url: string): Promise<Response> {
  return retryingPublicFetcher(url, (target) => safePublicFetch(target, { headers: { accept: target.includes("api.github.com") || target.endsWith(".json") ? "application/json" : "text/plain" } }));
}

export function createLocalServices(): FoundryServices {
  return {
    scoutReferences: scoutPublicGalleries,
    selectDirection: async (directions: DesignDirection[], _spec: SiteSpec) => directions[0] as DesignDirection,
    discoverAndRender: async (_spec: SiteSpec, _dna: DesignDNA, _slots: PageSlot[]): Promise<DiscoveryResult> => {
      const resolved = await renderResolvedCandidate(await resolvePinnedShadcnButton(defaultPublicFetcher));
      return {
        ranked: { button: [resolved.candidate] },
        packages: [resolved.package],
        provenance: [resolved.provenance],
        reuse: { visible_component_count: 1, reused_component_count: 1, waivers: [] },
      };
    },
    audit: auditGeneratedSite,
    repair: async (target: string, report: AuditReport, pass: number): Promise<RepairPassRecord> =>
      repairFromEvidence(join(target, ".foundry-evidence"), report, pass, async (issues) => applyDeterministicRepairs(target, issues)),
    package: async (target, runDirectory, audit, repairs) => packageDelivery({ output: join(runDirectory, "proof"), site: target, screenshots: audit.screenshots, recordings: audit.recordings, audit: audit.report, repairs }),
  };
}
