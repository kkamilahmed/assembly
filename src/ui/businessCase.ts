// What an attack is worth, in the units a head of fraud thinks in. The
// simulation draws far fewer payments than a real network so the story fits
// on stage: everyday traffic is a thin sample, while every attack packet
// stands for a handful of real fraudulent charges so the storm can be seen.
// These convert what it measured into the network's terms. Illustrative
// figures, kept in one place so they can be set to a specific customer's
// numbers before a talk.

import { SPEED } from '@/presenter/presenterConfig';

/** Card payments a second across the whole network. */
export const NETWORK_PAYMENTS_PER_SEC = 3000;
/** Of those, card-not-present (online and in-app) payments: what the fraud
 *  rate is quoted against. */
export const ONLINE_PAYMENTS_PER_SEC = 1800;
/** Real fraudulent charges one red packet on screen stands for. */
export const CHARGES_PER_FRAUD_PACKET = 4;
/** Net loss per fraudulent charge approved: the $1 test charge itself plus
 *  its share of dispute fees and the follow-on fraud on cards it confirmed. */
export const LOSS_PER_FRAUD_CHARGE_USD = 1.25;
/** Hours until tomorrow morning's overnight batch check, which is when a
 *  network without streaming analytics would find the attack. */
export const HOURS_UNTIL_BATCH = 19.5;

export interface FraudRate {
  /** Fraudulent charges approved a second, network terms. */
  chargesPerSec: number;
  /** Share of online payments that are fraud getting through. */
  rate: number;
  /** Lost every 10 minutes at this rate, USD. */
  per10MinUsd: number;
  /** Lost by the overnight batch check at this rate, USD. */
  byBatchUsd: number;
  /** Fraudulent charges approved by then. */
  byBatchCharges: number;
}

/** Converts fraud packets settled over `seconds` of wall clock into the
 *  network's terms. */
export function fraudRate(fraudPackets: number, seconds: number): FraudRate {
  const packetsPerSec = seconds > 0 ? fraudPackets / seconds / SPEED : 0;
  const chargesPerSec = packetsPerSec * CHARGES_PER_FRAUD_PACKET;
  const lossPerSec = chargesPerSec * LOSS_PER_FRAUD_CHARGE_USD;
  return {
    chargesPerSec,
    rate: chargesPerSec / ONLINE_PAYMENTS_PER_SEC,
    per10MinUsd: Math.round(lossPerSec * 600),
    byBatchUsd: Math.round(lossPerSec * HOURS_UNTIL_BATCH * 3600),
    byBatchCharges: Math.round(chargesPerSec * HOURS_UNTIL_BATCH * 3600),
  };
}

/** The limit the card schemes hold a network to; over it, fines follow. */
export const FRAUD_RATE_LIMIT = 0.005;

/** Fraud packets to real charges. */
export function packetsToCharges(packets: number): number {
  return packets * CHARGES_PER_FRAUD_PACKET;
}
