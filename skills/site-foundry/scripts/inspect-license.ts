import { inspectLicense, type LicenseInput } from "../../../src/security/license.js";
import { fail, output, readJsonArgument } from "./io.js";

readJsonArgument<LicenseInput>().then((input) => output(inspectLicense(input))).catch(fail);
