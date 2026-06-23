/** A loss (mortality/cull) count must be a whole number between 1 and the current count. */
export function isValidLoss(current: number, loss: number): boolean {
  return Number.isInteger(loss) && loss >= 1 && loss <= current;
}
