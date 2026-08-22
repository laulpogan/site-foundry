import { scanPackage, type PackageScanInput } from "../../../src/security/scan.js";
import { fail, output, readJsonArgument } from "./io.js";

readJsonArgument<PackageScanInput>().then((input) => output(scanPackage(input))).catch(fail);
