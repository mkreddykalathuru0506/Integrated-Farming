export type StageRef = { id: string; sequence: number; isTerminal: boolean };

/** The first stage (lowest sequence), or null if there are none. */
export function firstStage(stages: StageRef[]): StageRef | null {
  return stages.length ? stages.reduce((a, b) => (b.sequence < a.sequence ? b : a)) : null;
}

/**
 * Forward-only state machine: the stage with the smallest `sequence` strictly
 * greater than `currentSequence`. Returns null if already at/after the last stage.
 */
export function nextStage(stages: StageRef[], currentSequence: number): StageRef | null {
  const ahead = stages.filter((s) => s.sequence > currentSequence);
  return ahead.length ? ahead.reduce((a, b) => (b.sequence < a.sequence ? b : a)) : null;
}
