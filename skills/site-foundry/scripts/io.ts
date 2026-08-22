import { readFile } from "node:fs/promises";

export async function readJsonArgument<T>(index = 2): Promise<T> {
  const path = process.argv[index];
  if (!path) throw new Error(`Expected a JSON file at argument ${index - 1}`);
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function fail(error: unknown): never {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
