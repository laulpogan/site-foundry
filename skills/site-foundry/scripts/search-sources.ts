import { loadSourceConfig } from "../../../src/sources/config.js";
import { fail, output } from "./io.js";

loadSourceConfig().then(output).catch(fail);
