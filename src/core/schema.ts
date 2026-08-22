import { readFileSync } from "node:fs";
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import { FoundryError } from "./errors.js";
import type { ArtifactKind, ArtifactTypes } from "./types.js";

const filenames: Record<ArtifactKind, string> = {
  "site-spec": "site-spec.schema.json",
  "design-dna": "design-dna.schema.json",
  candidate: "candidate.schema.json",
  "component-set": "component-set.schema.json",
  provenance: "provenance.schema.json",
  "run-state": "run-state.schema.json",
};

const validators = new Map<ArtifactKind, ValidateFunction>();
const ajv = new Ajv({ allErrors: true, strict: true });

function schemaUrl(filename: string): URL {
  return new URL(`../../skills/site-foundry/schemas/${filename}`, import.meta.url);
}

function validatorFor(kind: ArtifactKind): ValidateFunction {
  const cached = validators.get(kind);
  if (cached) return cached;
  const schema = JSON.parse(readFileSync(schemaUrl(filenames[kind]), "utf8")) as object;
  const validator = ajv.compile(schema);
  validators.set(kind, validator);
  return validator;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

export function validateArtifact<K extends ArtifactKind>(
  kind: K,
  value: unknown,
): ArtifactTypes[K] {
  const validate = validatorFor(kind);
  if (!validate(value)) {
    throw new FoundryError(
      "INVALID_ARTIFACT",
      `Invalid ${kind}: ${formatErrors(validate.errors)}`,
      validate.errors,
    );
  }
  return value as ArtifactTypes[K];
}
