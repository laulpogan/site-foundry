import { compileDesignSystem } from "../../../src/site/design-system.js";
import type { ComponentSet, DesignDNA } from "../../../src/core/types.js";
import { fail, output, readJsonArgument } from "./io.js";

interface Input { dna: DesignDNA; componentSet: ComponentSet }
readJsonArgument<Input>().then((input) => output(compileDesignSystem(input.dna, input.componentSet))).catch(fail);
