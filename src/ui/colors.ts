export const STATUS_HEX = {
  healthy: '#2fb574',
  warning: '#e8a82c',
  critical: '#d4453c',
} as const;

// Fleet overview telemetry accents — one hue per sensor type so the three
// stacked meters on a machine card read apart at a glance.
export const METRIC_HEX = {
  temperature: '#2f6fd4',
  pressure: '#3b8fa3',
  vibration: '#7c6fd4',
} as const;
