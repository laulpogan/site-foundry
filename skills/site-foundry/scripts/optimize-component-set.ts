import { optimizeComponentSet } from "../../../src/design/optimizer.js";
import type { Candidate, DesignDNA } from "../../../src/core/types.js";
import { fail, output, readJsonArgument } from "./io.js";

interface Input { ranked: Record<string, Candidate[]>; dna: DesignDNA }
readJsonArgument<Input>().then((input) => output(optimizeComponentSet(input.ranked, input.dna))).catch(fail);
