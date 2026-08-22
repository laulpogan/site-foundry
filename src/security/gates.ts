import type { LicenseReport } from "./license.js";
import type { PackageScanReport, ScanFinding } from "./scan.js";

export interface HardGateInput {
  access: {
    public: boolean;
    account_required: boolean;
    paywall: boolean;
    captcha: boolean;
  };
  provenance: {
    canonical_repository: string;
    revision: string;
    files: string[];
  };
  license: Pick<LicenseReport, "approved" | "license" | "source_url">;
  scan: Pick<PackageScanReport, "passed" | "findings">;
  integration: {
    framework_compatible: boolean;
    mobile_usable: boolean;
    keyboard_usable: boolean;
    dependencies_allowed: boolean;
    adds_animation_runtime: boolean;
    adds_icon_family: boolean;
  };
}

export interface GateFinding {
  code: string;
  message: string;
}

export interface HardGateReport {
  passed: boolean;
  findings: GateFinding[];
}

export function runHardGates(input: HardGateInput): HardGateReport {
  const findings: GateFinding[] = [];
  const reject = (condition: boolean, code: string, message: string): void => {
    if (condition) findings.push({ code, message });
  };
  reject(!input.access.public, "not-public", "Source is not public");
  reject(input.access.account_required, "account-required", "Source requires an account");
  reject(input.access.paywall, "paywall", "Source is behind a paywall");
  reject(input.access.captcha, "captcha", "Source requires CAPTCHA interaction");
  reject(!input.license.approved || !input.license.license || !input.license.source_url, "license-rejected", "License evidence is absent or rejected");
  reject(!input.provenance.canonical_repository || !input.provenance.revision || input.provenance.files.length === 0, "provenance-missing", "Canonical source, pinned revision, and file list are required");
  if (!input.scan.passed || input.scan.findings.length > 0) {
    findings.push({ code: "static-risk", message: "Static risk filter rejected the source package" });
    findings.push(...input.scan.findings.map((finding: ScanFinding) => ({ code: finding.code, message: finding.message })));
  }
  reject(!input.integration.framework_compatible, "framework-incompatible", "Component conflicts with the target framework");
  reject(!input.integration.mobile_usable, "mobile-unusable", "Mobile behavior is unusable");
  reject(!input.integration.keyboard_usable, "keyboard-unusable", "Keyboard or focus behavior is unusable");
  reject(!input.integration.dependencies_allowed, "dependencies-rejected", "Dependencies violate the allowlist");
  reject(input.integration.adds_animation_runtime, "extra-motion-runtime", "Component introduces another animation runtime");
  reject(input.integration.adds_icon_family, "extra-icon-family", "Component introduces another icon family");
  return { passed: findings.length === 0, findings };
}
