export const STATUS_HEX = {
  healthy: '#2fb574',
  warning: '#e8a82c',
  critical: '#d4453c',
} as const;

// Source card accents - one hue per signal so the three stacked meters on a
// source card read apart at a glance.
export const METRIC_HEX = {
  velocity: '#2f6fd4',
  newCards: '#3b8fa3',
  newDevices: '#7c6fd4',
  offset: '#5b6472',
} as const;

/** The three outcomes a payment can have, on every chart. */
export const OUTCOME_HEX = {
  settled: '#2fb574',
  fraud: '#d4453c',
  blocked: '#5b6472',
} as const;
