import { scoutPublicGalleries } from "../../../src/runtime/local-services.js";
import { fail, output } from "./io.js";

scoutPublicGalleries().then(output).catch(fail);
