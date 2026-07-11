export default {
  mortality: 'Mortality',
  cull: 'Cull',
  dead: 'Mark dead',
  move: 'Move',
  moveTo: 'Move to…',
  moved: 'Moved',
  lossRecorded: 'Loss recorded',
  lossCount: 'Count',
  cause: 'Cause (optional)',
  continue: 'Continue',
  confirmLoss: 'Record loss',
  countInvalid: 'Enter a count between 1 and {{max}}',
  recordLossTitle: {
    MORTALITY: 'Record mortality',
    CULL: 'Record culling',
  },
  confirmLossBody: {
    MORTALITY:
      'Record {{count}} death(s) in {{target}}? This reduces the batch count and cannot be undone.',
    CULL: 'Cull {{count}} from {{target}}? This reduces the batch count and cannot be undone.',
  },
  confirmAnimalBody: {
    MORTALITY: 'Mark {{target}} as dead? This cannot be undone.',
    CULL: 'Cull {{target}}? This cannot be undone.',
  },
  moveTitle: 'Move {{target}}',
  unit: 'Destination unit',
  unitRequired: 'Choose a unit',
};
