import { deriveDirections, type ReferenceEvidence } from "../../../src/design/directions.js";
import type { SiteSpec } from "../../../src/core/types.js";
import { fail, output, readJsonArgument } from "./io.js";

Promise.all([readJsonArgument<SiteSpec>(2), readJsonArgument<ReferenceEvidence[]>(3)])
  .then(([spec, references]) => output(deriveDirections(spec, references)))
  .catch(fail);
