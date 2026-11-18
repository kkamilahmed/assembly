import type { Tone } from './kit';

export interface DashboardData {
  /** Oven zone temperature history, oldest first. */
  ovenTemp: number[];
  ovenSetpoint?: number[];
  ovenWarn?: number;
  ovenCrit?: number;
  ovenTone: Tone;
  loavesPerHour: number;
  loavesDelta?: number;
  coreTemp: number;
  coreTempTone: Tone;
  /** 0..1 */
  efficiency: number;
  efficiencyLabel?: string;
  /** Rejected loaves per interval, oldest first. */
  rejects: number[];
  rejectLabels?: string[];
  rejectRate: number;
  rejectTone: Tone;
  wasteSavedKg: number;
}

export const PLACEHOLDER_DASHBOARD: DashboardData = {
  ovenTemp: [212, 216, 214, 219, 217, 221, 218, 222, 219, 224, 221, 220, 223, 221],
  ovenSetpoint: [220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220],
  ovenWarn: 232,
  ovenCrit: 242,
  ovenTone: 'healthy',
  loavesPerHour: 1240,
  loavesDelta: 3.2,
  coreTemp: 96.4,
  coreTempTone: 'healthy',
  efficiency: 0.874,
  efficiencyLabel: 'Target 85%',
  rejects: [6, 9, 5, 7, 11, 8, 4, 6],
  rejectLabels: ['06', '07', '08', '09', '10', '11', '12', '13'],
  rejectRate: 1.8,
  rejectTone: 'healthy',
  wasteSavedKg: 312,
};
