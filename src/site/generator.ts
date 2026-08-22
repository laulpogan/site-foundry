import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { FoundryError } from "../core/errors.js";
import type { ComponentSet, DesignDNA, ProvenanceRecord, SiteSpec } from "../core/types.js";
import type { SourcePackage } from "../sources/types.js";
import { compileDesignSystem } from "./design-system.js";

export interface CustomComponentWaiver {
  slot: string;
  classification: "signature" | "functional";
  source_families_searched: number;
  candidates_rendered: number;
  rejections: Array<{ candidate?: string; reason?: string }>;
  composition_attempted: boolean;
  why_new_code_is_required: string;
  primitives_reused: string[];
}

export interface ReuseEvidence {
  visible_component_count: number;
  reused_component_count: number;
  waivers: CustomComponentWaiver[];
}

export interface ReuseReport extends ReuseEvidence {
  reuse_ratio: number;
}

export function validateReusePolicy(evidence: ReuseEvidence): ReuseReport {
  if (evidence.visible_component_count <= 0 || evidence.reused_component_count > evidence.visible_component_count) {
    throw new FoundryError("INVALID_ARTIFACT", "Visible and reused component counts are invalid");
  }
  const reuseRatio = evidence.reused_component_count / evidence.visible_component_count;
  if (reuseRatio < 0.9) throw new FoundryError("INVALID_ARTIFACT", `Component reuse must reach 90%; received ${(reuseRatio * 100).toFixed(1)}%`);
  for (const waiver of evidence.waivers) {
    if (!waiver.composition_attempted || !waiver.why_new_code_is_required.trim()) {
      throw new FoundryError("INVALID_ARTIFACT", `Waiver ${waiver.slot} requires composition evidence and a concrete reason`);
    }
    if (waiver.classification === "signature" && (waiver.candidates_rendered < 12 || waiver.source_families_searched < 3)) {
      throw new FoundryError("INVALID_ARTIFACT", `Signature waiver ${waiver.slot} requires 12 rendered candidates from three source families`);
    }
    if (waiver.classification === "functional" && waiver.candidates_rendered < 6) {
      throw new FoundryError("INVALID_ARTIFACT", `Functional waiver ${waiver.slot} requires six rendered candidates or the complete trusted catalog`);
    }
  }
  return { ...evidence, reuse_ratio: reuseRatio };
}

export interface GenerateSiteOptions {
  target: string;
  spec: SiteSpec;
  dna: DesignDNA;
  componentSet: ComponentSet;
  reuse: ReuseEvidence;
  packages: SourcePackage[];
  provenance: ProvenanceRecord[];
}

export interface GeneratedSite {
  target: string;
  files: string[];
  reuse: ReuseReport;
}

function safePath(root: string, path: string): string {
  const target = resolve(root, path);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new FoundryError("SECURITY_REJECTED", `Generated path escapes target: ${path}`);
  return target;
}

function routeExample(path: string): string {
  return path.replace(/:([a-z]+)/g, "demo-$1");
}

function appSource(spec: SiteSpec, buttonImport: string): string {
  const routes = spec.routes.map((route) => ({ ...route, path: routeExample(route.path) }));
  return `import { useMemo, useState } from "react";\nimport { Button } from ${JSON.stringify(buttonImport)};\n\nconst routes = ${JSON.stringify(routes, null, 2)} as const;\n\nfunction currentRoute() {\n  return routes.find((route) => route.path === window.location.pathname) ?? routes[0];\n}\n\nexport default function App() {\n  const route = currentRoute();\n  const [menuOpen, setMenuOpen] = useState(false);\n  const [submitted, setSubmitted] = useState(false);\n  const state = useMemo(() => new URLSearchParams(window.location.search).get("state"), []);\n  if (!route) return null;\n  return <div className="site-shell">\n    <header>\n      <a className="brand" href="/">FOUND/RY</a>\n      <Button data-foundry-open data-foundry-interaction="open-mobile-navigation" className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}>Menu</Button>\n      <nav aria-label="Main navigation" data-open={menuOpen}>\n        {routes.map((item) => <a key={item.path} href={item.path}>{item.path === "/" ? "Home" : item.path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ")}</a>)}\n      </nav>\n    </header>\n    <main>\n      <section className="hero">\n        <p className="eyebrow">${spec.brand_attributes.join(" · ")}</p>\n        <h1>{route.purpose}</h1>\n        <p>Built for ${spec.audience.join(" and ")}. Product facts remain editable until verified.</p>\n        <Button data-foundry-hover onClick={() => document.getElementById("primary-action")?.scrollIntoView({ behavior: "smooth" })}>${spec.primary_goal.replaceAll("-", " ")}</Button>\n      </section>\n      <section className="product-panel" aria-label="Product demonstration">\n        <div><span>Demo data</span><strong>42</strong><small>Example records</small></div>\n        <div><span>Current route</span><strong>{route.path}</strong><small>{route.purpose}</small></div>\n      </section>\n      {state === "loading" && <section data-foundry-state="loading" aria-live="polite">Loading demo state…</section>}\n      {state === "empty" && <section data-foundry-state="empty">No demo records yet.</section>}\n      {state === "error" && <section data-foundry-state="error" role="alert">The demo request failed. Try again.</section>}\n      {state === "selected" && <section data-foundry-state="selected">Demo record selected.</section>}\n      {state === "destructive" && <section data-foundry-state="destructive">Confirm removal of this demo record.</section>}\n      <section id="primary-action" className="contact">\n        <div><p className="eyebrow">Next step</p><h2>Start with a precise brief.</h2></div>\n        <form data-foundry-interaction="submit-contact-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>\n          <label>Email<input required type="email" name="email" autoComplete="email" /></label>\n          <Button type="submit">Send request</Button>\n          {submitted && <p role="status">Request captured in this local demo.</p>}\n        </form>\n      </section>\n    </main>\n    <footer><span>Site Foundry proof build</span><a href="/contact">Contact</a></footer>\n  </div>;\n}\n`;
}

const styles = `@import "tailwindcss";\n@import "../tokens.css";\n* { box-sizing: border-box; }\nhtml { background: var(--surface); color: var(--foreground); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\nbody { margin: 0; }\na { color: inherit; text-decoration: none; }\nbutton, input { font: inherit; }\n.site-shell { min-height: 100vh; }\nheader, footer { width: min(calc(100% - 2rem), var(--container-max)); margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 0; border-bottom: 1px solid var(--border-color); }\n.brand { font-weight: 800; letter-spacing: -0.05em; }\nnav { display: flex; gap: 1.25rem; text-transform: capitalize; }\n.menu-button { display: none; }\nmain { overflow: clip; }\n.hero { width: min(calc(100% - 2rem), var(--container-max)); margin: auto; min-height: 72vh; display: grid; align-content: center; justify-items: start; gap: 1.5rem; padding: var(--space-section) 0; }\n.hero h1 { max-width: 13ch; margin: 0; font-size: clamp(3.5rem, 9vw, 8.75rem); line-height: .84; letter-spacing: -.075em; text-transform: capitalize; }\n.hero p:not(.eyebrow) { max-width: 42rem; font-size: clamp(1rem, 2vw, 1.35rem); line-height: 1.5; }\n.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; font-weight: 700; }\nbutton { border: 1px solid currentColor; border-radius: var(--radius-base); background: var(--foreground); color: var(--surface); padding: .8rem 1.2rem; cursor: pointer; transition: transform var(--motion-fast) var(--motion-ease); }\nbutton:hover { transform: translateY(-2px); }\nbutton:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }\n.product-panel { width: min(calc(100% - 2rem), var(--container-max)); margin: auto; display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border-color); }\n.product-panel > div { min-height: 18rem; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(1.5rem, 4vw, 3rem); }\n.product-panel > div + div { border-left: 1px solid var(--border-color); }\n.product-panel strong { font-size: clamp(2.5rem, 7vw, 6rem); letter-spacing: -.06em; }\n.contact { width: min(calc(100% - 2rem), var(--container-max)); margin: auto; padding: var(--space-section) 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }\n.contact h2 { font-size: clamp(2.5rem, 6vw, 5rem); line-height: .95; letter-spacing: -.05em; }\nform { display: grid; align-content: center; gap: 1rem; }\nlabel { display: grid; gap: .5rem; }\ninput { width: 100%; padding: .9rem; border: 1px solid var(--border-color); border-radius: var(--radius-base); background: transparent; }\n@media (max-width: 720px) { .menu-button { display: block; } nav { display: none; position: absolute; inset: 4.5rem 1rem auto; padding: 1rem; background: var(--surface); border: 1px solid var(--border-color); flex-direction: column; z-index: 10; } nav[data-open="true"] { display: flex; } .hero { min-height: 68vh; } .product-panel, .contact { grid-template-columns: 1fr; } .product-panel > div + div { border-left: 0; border-top: 1px solid var(--border-color); } }\n`;

export async function generateSite(options: GenerateSiteOptions): Promise<GeneratedSite> {
  if (options.packages.length === 0) throw new FoundryError("INVALID_ARTIFACT", "At least one selected source package is required");
  const reuse = validateReusePolicy(options.reuse);
  const design = compileDesignSystem(options.dna, options.componentSet);
  const files = new Map<string, string>();
  const buttonPackage = options.packages.find((item) => item.name === "button");
  const buttonFile = buttonPackage?.files.find((file) => file.target.endsWith("button.tsx"));
  if (!buttonFile) throw new FoundryError("INVALID_ARTIFACT", "Selected component set must include a public button source package");
  for (const sourcePackage of options.packages) {
    for (const source of sourcePackage.files) files.set(`src/${source.target}`, source.content);
  }
  const buttonPath = `./${buttonFile.target.replace(/\.tsx$/, "")}`;
  const packageJson = {
    name: "site-foundry-output",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { dev: "vite --host 127.0.0.1", build: "tsc -b && vite build", preview: "vite preview --host 127.0.0.1" },
    dependencies: {
      "@tailwindcss/vite": "4.3.3",
      "class-variance-authority": "0.7.1",
      clsx: "2.1.1",
      "lucide-react": "1.33.0",
      motion: "13.1.1",
      "radix-ui": "1.6.7",
      react: "19.2.8",
      "react-dom": "19.2.8",
      tailwindcss: "4.3.3",
      "tailwind-merge": "3.6.0",
    },
    devDependencies: { "@types/react": "19.2.18", "@types/react-dom": "19.2.4", "@vitejs/plugin-react": "6.1.0", typescript: "7.0.2", vite: "8.2.2" },
  };
  files.set("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
  files.set("tsconfig.json", `${JSON.stringify({ compilerOptions: { target: "ES2023", useDefineForClassFields: true, lib: ["ES2023", "DOM", "DOM.Iterable"], allowJs: false, skipLibCheck: true, esModuleInterop: true, allowSyntheticDefaultImports: true, strict: true, forceConsistentCasingInFileNames: true, module: "ESNext", moduleResolution: "Bundler", resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: "react-jsx", baseUrl: ".", paths: { "@/*": ["./src/*"] } }, include: ["src"] }, null, 2)}\n`);
  files.set("vite.config.ts", `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\nimport { fileURLToPath, URL } from "node:url";\nexport default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } });\n`);
  files.set("index.html", `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="description" content="Viewer-ready Site Foundry output"/><title>Site Foundry Output</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`);
  files.set("src/main.tsx", `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./styles.css";\ncreateRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);\n`);
  files.set("src/App.tsx", appSource(options.spec, buttonPath));
  files.set("src/styles.css", styles);
  files.set("src/lib/utils.ts", `import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }\n`);
  files.set("DESIGN.md", design.designMarkdown);
  files.set("tokens.css", design.tokensCss);
  files.set("site-spec.json", `${JSON.stringify(options.spec, null, 2)}\n`);
  files.set("component-set.json", `${JSON.stringify(options.componentSet, null, 2)}\n`);
  files.set("component-manifest.json", `${JSON.stringify({ ...reuse, selections: options.componentSet.selections, packages: options.packages.map((item) => ({ name: item.name, source_url: item.source_url, revision: item.revision, files: item.files.map((file) => file.target) })) }, null, 2)}\n`);
  files.set("provenance.json", `${JSON.stringify(options.provenance, null, 2)}\n`);
  files.set("adaptations.json", `${JSON.stringify(options.provenance.flatMap((record) => record.adaptations.map((adaptation) => ({ component_id: record.component_id, adaptation }))), null, 2)}\n`);

  for (const [path, content] of files) {
    const target = safePath(options.target, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return { target: options.target, files: [...files.keys()].sort().map((path) => relative(options.target, safePath(options.target, path))), reuse };
}
