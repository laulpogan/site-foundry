import { captureCandidate, type CandidateEvidence, type CaptureDriver } from "./capture.js";
import { exerciseCandidate, type InteractionDriver } from "./interactions.js";

export interface CandidateServer {
  url: string;
  stop(): Promise<void>;
}

export interface ProcessDriver {
  start(workspace: string): Promise<CandidateServer>;
}

export interface RenderCandidateOptions {
  workspace: string;
  output: string;
  processDriver: ProcessDriver;
  captureDriver?: CaptureDriver;
  interactionDriver?: InteractionDriver;
}

export async function renderCandidate(options: RenderCandidateOptions): Promise<CandidateEvidence> {
  const server = await options.processDriver.start(options.workspace);
  try {
    const evidence = await captureCandidate(server.url, options.output, options.captureDriver);
    const states = await exerciseCandidate(server.url, options.output, options.interactionDriver);
    return { ...evidence, states };
  } finally {
    await server.stop();
  }
}
