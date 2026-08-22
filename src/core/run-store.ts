import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FoundryError } from "./errors.js";
import { validateArtifact } from "./schema.js";
import { assertTransition } from "./state-machine.js";
import type { RunState, RunStateName } from "./types.js";

export interface RunRecord {
  id: string;
  current: RunState;
  history: RunState[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export class RunStore {
  constructor(private readonly root: string) {}

  private runPath(id: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
      throw new FoundryError("INVALID_ARTIFACT", `Invalid run id: ${id}`);
    }
    return join(this.root, id);
  }

  async create(id: string, brief: unknown): Promise<RunRecord> {
    const runPath = this.runPath(id);
    if (await exists(join(runPath, "state.json"))) {
      throw new FoundryError("INVALID_TRANSITION", `Run already exists: ${id}`);
    }
    await mkdir(join(runPath, "artifacts"), { recursive: true });
    await writeJsonAtomic(join(runPath, "artifacts", "brief.json"), brief);
    const current = validateArtifact("run-state", {
      state: "BRIEFED",
      revision: 1,
      artifact: "brief.json",
      updated_at: new Date().toISOString(),
    });
    const record: RunRecord = { id, current, history: [current] };
    await writeJsonAtomic(join(runPath, "state.json"), record);
    return record;
  }

  async load(id: string): Promise<RunRecord> {
    const path = join(this.runPath(id), "state.json");
    if (!(await exists(path))) {
      throw new FoundryError("RUN_NOT_FOUND", `Run not found: ${id}`);
    }
    const record = JSON.parse(await readFile(path, "utf8")) as RunRecord;
    validateArtifact("run-state", record.current);
    for (const state of record.history) validateArtifact("run-state", state);
    return record;
  }

  async transition(
    id: string,
    next: RunStateName,
    artifactName?: string,
    artifact?: unknown,
  ): Promise<RunRecord> {
    const record = await this.load(id);
    assertTransition(record.current.state, next);
    if (artifactName) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(artifactName)) {
        throw new FoundryError("INVALID_ARTIFACT", `Invalid artifact name: ${artifactName}`);
      }
      await writeJsonAtomic(join(this.runPath(id), "artifacts", artifactName), artifact);
    }
    const stateInput: Record<string, unknown> = {
      state: next,
      revision: record.current.revision + 1,
      updated_at: new Date().toISOString(),
    };
    if (artifactName) stateInput.artifact = artifactName;
    const current = validateArtifact("run-state", stateInput);
    const updated: RunRecord = {
      ...record,
      current,
      history: [...record.history, current],
    };
    await writeJsonAtomic(join(this.runPath(id), "state.json"), updated);
    return updated;
  }
}
