import { describe, it, expect } from 'vitest';
import { firstStage, nextStage } from '../src/livestock/stage-machine';

const stages = [
  { id: 'a', sequence: 1, isTerminal: false },
  { id: 'b', sequence: 2, isTerminal: false },
  { id: 'c', sequence: 3, isTerminal: true },
];

describe('stage machine', () => {
  it('firstStage = lowest sequence; null when empty', () => {
    expect(firstStage(stages)?.id).toBe('a');
    expect(firstStage([])).toBeNull();
  });

  it('nextStage advances forward only and stops at the end', () => {
    expect(nextStage(stages, 1)?.id).toBe('b');
    expect(nextStage(stages, 2)?.id).toBe('c');
    expect(nextStage(stages, 3)).toBeNull();
  });

  it('nextStage from before the first returns the first', () => {
    expect(nextStage(stages, 0)?.id).toBe('a');
  });
});
