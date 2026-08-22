import { auditSite } from "../../../src/audit/audit.js";
import type { SiteSpec } from "../../../src/core/types.js";
import { fail, output, readJsonArgument } from "./io.js";

const baseUrl = process.argv[2];
if (!baseUrl) fail(new Error("Usage: audit-site.ts <base-url> <site-spec.json>"));
readJsonArgument<SiteSpec>(3).then((spec) => auditSite(baseUrl, spec)).then(output).catch(fail);
