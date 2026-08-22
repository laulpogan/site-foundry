import { describe, expect, it } from "vitest";
import { inspectLicense } from "../../src/security/license.js";

describe("inspectLicense", () => {
  it.each(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"])(
    "accepts approved SPDX license %s with canonical evidence",
    (license) => {
      expect(inspectLicense({ declared: license, text: `${license} License`, source_url: "https://github.com/example/repo/blob/abc/LICENSE" })).toMatchObject({
        approved: true,
        license,
      });
    },
  );

  it.each([undefined, "unknown", "GPL-3.0", "AGPL-3.0", "Custom commercial"])(
    "rejects absent, copyleft, or custom license %s",
    (declared) => {
      expect(inspectLicense({ declared, text: declared ?? "", source_url: "https://example.com" })).toMatchObject({
        approved: false,
      });
    },
  );

  it("rejects a license claim without source evidence", () => {
    expect(inspectLicense({ declared: "MIT", text: "MIT License", source_url: "" })).toMatchObject({
      approved: false,
      reason: expect.stringMatching(/evidence/i),
    });
  });
});
