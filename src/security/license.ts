const APPROVED_LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]);

export interface LicenseInput {
  declared: string | undefined;
  text: string;
  source_url: string;
}

export interface LicenseReport {
  approved: boolean;
  license?: string;
  source_url: string;
  reason: string;
}

export function inspectLicense(input: LicenseInput): LicenseReport {
  if (!input.source_url || !input.source_url.startsWith("https://")) {
    return { approved: false, source_url: input.source_url, reason: "Canonical license evidence URL is missing" };
  }
  if (!input.declared) {
    return { approved: false, source_url: input.source_url, reason: "License is absent" };
  }
  if (!APPROVED_LICENSES.has(input.declared)) {
    return { approved: false, license: input.declared, source_url: input.source_url, reason: `License ${input.declared} is not approved by policy` };
  }
  if (!input.text.trim()) {
    return { approved: false, license: input.declared, source_url: input.source_url, reason: "License text evidence is empty" };
  }
  return { approved: true, license: input.declared, source_url: input.source_url, reason: "Explicit approved license with source evidence" };
}
