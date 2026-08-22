import { parseSync } from "oxc-parser";

export interface ScanFinding {
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export interface PackageScanInput {
  packageJson: {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  files: Record<string, string>;
  allowedDependencies: string[];
}

export interface PackageScanReport {
  passed: boolean;
  findings: ScanFinding[];
  boundary: "static-risk-filter";
}

const lifecycleScripts = new Set(["preinstall", "install", "postinstall", "prepare"]);
const analyticsPackages = ["segment", "analytics", "mixpanel", "amplitude", "posthog", "gtag"];
const shellModules = new Set(["child_process", "node:child_process"]);
const networkFunctions = new Set(["fetch", "axios", "request", "got"]);

interface AstNode {
  type: string;
  start?: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
  return Boolean(value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string");
}

function lineOf(content: string, node: AstNode): number {
  return content.slice(0, node.start ?? 0).split("\n").length;
}

function identifierName(value: unknown): string | undefined {
  return isNode(value) && value.type === "Identifier" && typeof value.name === "string" ? value.name : undefined;
}

function literalText(value: unknown): string | undefined {
  return isNode(value) && value.type === "Literal" && typeof value.value === "string" ? value.value : undefined;
}

function memberName(value: unknown): string | undefined {
  if (!isNode(value) || value.type !== "MemberExpression") return undefined;
  return identifierName(value.property);
}

function scanSource(file: string, content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lang = file.endsWith(".tsx") ? "tsx" : file.endsWith(".jsx") ? "jsx" : file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs") ? "js" : "ts";
  const parsed = parseSync(file, content, { lang, sourceType: "unambiguous" });
  for (const diagnostic of parsed.errors) {
    findings.push({ code: "parse-error", message: diagnostic.message, file });
  }

  const add = (code: string, message: string, node: AstNode): void => {
    findings.push({ code, message, file, line: lineOf(content, node) });
  };
  const visit = (node: AstNode): void => {
    if (node.type === "ImportDeclaration") {
      const module = literalText(node.source);
      if (!module) return;
      if (shellModules.has(module)) add("shell-execution", `Imports ${module}`, node);
      if (analyticsPackages.some((name) => module.toLowerCase().includes(name))) add("analytics", `Imports analytics dependency ${module}`, node);
    }
    if (node.type === "CallExpression") {
      const name = identifierName(node.callee) ?? memberName(node.callee) ?? "";
      if (name === "eval") add("dynamic-code", "Calls eval", node);
      if (["exec", "execSync", "spawn", "spawnSync", "fork"].includes(name)) add("shell-execution", `Calls ${name}`, node);
      if (networkFunctions.has(name)) add("undeclared-network", `Calls ${name}`, node);
      if (name === "createElement" && literalText(Array.isArray(node.arguments) ? node.arguments[0] : undefined) === "script") add("remote-script", "Creates a script element", node);
    }
    if (node.type === "NewExpression" && identifierName(node.callee) === "Function") {
      add("dynamic-code", "Constructs Function", node);
    }
    if (node.type === "MemberExpression" && isNode(node.object) && node.object.type === "MemberExpression") {
      const root = identifierName(node.object.object);
      const middle = memberName(node.object);
      const property = memberName(node);
      if (root === "process" && middle === "env" && property && property !== "NODE_ENV") {
        add("environment-read", `Reads process.env.${property}`, node);
      }
    }
    if (node.type === "AssignmentExpression" && memberName(node.left) === "src") {
      const value = literalText(node.right);
      if (value?.startsWith("http")) add("remote-script", `Loads remote source ${value}`, node);
    }
    for (const [key, value] of Object.entries(node)) {
      if (["type", "start", "end", "loc", "range"].includes(key)) continue;
      if (isNode(value)) visit(value);
      else if (Array.isArray(value)) for (const child of value) if (isNode(child)) visit(child);
    }
  };
  visit(parsed.program as unknown as AstNode);
  return findings;
}

export function scanPackage(input: PackageScanInput): PackageScanReport {
  const findings: ScanFinding[] = [];
  for (const [name, command] of Object.entries(input.packageJson.scripts ?? {})) {
    if (lifecycleScripts.has(name)) findings.push({ code: "lifecycle-script", message: `${name}: ${command}` });
  }
  const dependencies = { ...input.packageJson.dependencies, ...input.packageJson.devDependencies };
  for (const dependency of Object.keys(dependencies)) {
    if (!input.allowedDependencies.includes(dependency)) {
      findings.push({ code: "dependency-not-allowed", message: `${dependency} is not in the dependency allowlist` });
    }
    if (analyticsPackages.some((name) => dependency.toLowerCase().includes(name))) {
      findings.push({ code: "analytics", message: `Analytics dependency ${dependency}` });
    }
  }
  for (const [file, content] of Object.entries(input.files)) {
    if (/\.(?:[cm]?[jt]sx?)$/.test(file)) findings.push(...scanSource(file, content));
    if (/\.css$/.test(file) && /url\(\s*["']?https?:\/\//i.test(content)) {
      findings.push({ code: "undeclared-network", message: "CSS loads a remote URL", file });
    }
  }
  return { passed: findings.length === 0, findings, boundary: "static-risk-filter" };
}
