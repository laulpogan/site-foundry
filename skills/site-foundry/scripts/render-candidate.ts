import { renderCandidate } from "../../../src/lab/render.js";
import { ViteProcessDriver } from "../../../src/runtime/local-services.js";
import { fail, output } from "./io.js";

const workspace = process.argv[2];
const evidence = process.argv[3];
if (!workspace || !evidence) fail(new Error("Usage: render-candidate.ts <workspace> <evidence-directory>"));
renderCandidate({ workspace, output: evidence, processDriver: new ViteProcessDriver() }).then(output).catch(fail);
