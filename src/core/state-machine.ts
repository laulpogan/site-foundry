import { FoundryError } from "./errors.js";
import type { RunStateName } from "./types.js";

const transitions: Record<RunStateName, readonly RunStateName[]> = {
  BRIEFED: ["ARCHETYPE_SELECTED"],
  ARCHETYPE_SELECTED: ["REFERENCES_SCOUTED"],
  REFERENCES_SCOUTED: ["DESIGN_DNA_LOCKED"],
  DESIGN_DNA_LOCKED: ["PAGE_SLOTS_PLANNED"],
  PAGE_SLOTS_PLANNED: ["CANDIDATES_RENDERED"],
  CANDIDATES_RENDERED: ["COMPONENT_SET_SELECTED"],
  COMPONENT_SET_SELECTED: ["DESIGN_SYSTEM_COMPILED"],
  DESIGN_SYSTEM_COMPILED: ["SITE_BUILT"],
  SITE_BUILT: ["AUDITED"],
  AUDITED: ["REPAIRED", "SHIPPED"],
  REPAIRED: ["AUDITED", "SHIPPED"],
  SHIPPED: [],
};

export function assertTransition(from: RunStateName, to: RunStateName): void {
  if (!transitions[from].includes(to)) {
    throw new FoundryError("INVALID_TRANSITION", `Cannot transition from ${from} to ${to}`, {
      from,
      to,
      allowed: transitions[from],
    });
  }
}

export function allowedTransitions(state: RunStateName): readonly RunStateName[] {
  return transitions[state];
}
