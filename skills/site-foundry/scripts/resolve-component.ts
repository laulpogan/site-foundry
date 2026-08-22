import { defaultPublicFetcher, resolvePinnedShadcnButton } from "../../../src/runtime/local-services.js";
import { fail, output } from "./io.js";

resolvePinnedShadcnButton(defaultPublicFetcher).then(output).catch(fail);
