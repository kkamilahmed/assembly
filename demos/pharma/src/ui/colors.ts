export const STATUS_HEX = {
  healthy: '#2fb574',
  warning: '#e8a82c',
  critical: '#d4453c',
} as const;

// Fleet overview telemetry accents - one hue per sensor channel so the three
// stacked meters on a machine card read apart at a glance.
export const METRIC_HEX = {
  process: '#2f6fd4',
  feed: '#3b8fa3',
  mechanical: '#6f7fa8',
  offset: '#5b6472',
} as const;
