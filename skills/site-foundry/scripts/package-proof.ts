import { packageDelivery, type PackageDeliveryOptions } from "../../../src/proof/package.js";
import { fail, output, readJsonArgument } from "./io.js";

readJsonArgument<PackageDeliveryOptions>().then(packageDelivery).then(output).catch(fail);
