// Shared, plain (no React/Three) constants for the payment network: which
// sources feed it, the traffic cadence, and the risk limits the stream scores
// every payment against.

import { scaleMs } from '@/presenter/presenterConfig';

/** Every place payments come from. Each is a merchant (or the bank's own
 *  cash machine) with its own lane into the processing hub. */
export const SOURCE_IDS = ['CAFE-01', 'ATM-07', 'MALL-03', 'TDZ-WEB'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export const SOURCE_LABELS: Record<SourceId, string> = {
  'CAFE-01': 'Harbor Cafe',
  'ATM-07': 'Main St ATM',
  'MALL-03': 'Northgate Mall',
  'TDZ-WEB': 'TechDealz Online',
};

/** What kind of source it is, for the sources screen. */
export const SOURCE_KINDS: Record<SourceId, string> = {
  'CAFE-01': 'Card and phone terminal',
  'ATM-07': 'Cash machine',
  'MALL-03': 'Store checkouts',
  'TDZ-WEB': 'Online store',
};

/** The source the presenter's D / E keys turn into an attack: an online
 *  store whose checkout card testers have found. */
export const PROBLEM_SOURCE_ID: SourceId = 'TDZ-WEB';

/** The production rule the attack slips under, and what recalibrating fits
 *  back to live traffic. */
export const VELOCITY_RULE = {
  id: 'VEL-SMALL-01',
  label: 'Small-amount velocity',
  /** Charges under $5 a minute, per merchant, before the rule trips. Raised
   *  for a holiday sale and never brought back down. */
  limitPerMin: 1000,
} as const;

// ---- Cadence ----

/** Everyday traffic: one payment leaves a source this often, the sources
 *  taking turns in this order, so the mall is busiest and the cash machine
 *  quietest. */
export const PAYMENT_INTERVAL_MS = scaleMs(430);
export const TRAFFIC_PATTERN: readonly SourceId[] = [
  'MALL-03',
  'CAFE-01',
  'TDZ-WEB',
  'MALL-03',
  'ATM-07',
  'CAFE-01',
  'MALL-03',
  'TDZ-WEB',
  'CAFE-01',
  'MALL-03',
];

/** Packet speed along the rails, world units per second. Scaled with the
 *  presenter speed so the network runs faster without the layout changing. */
export const PACKET_SPEED = 2.0 * (1000 / scaleMs(1000));

/** Length of a packet along the rail, by kind. Card-testing charges are
 *  drawn as small cards, so a storm of them reads as a storm. */
export const PACKET_LENGTH = { normal: 0.68, attack: 0.3 } as const;
/** Clear rail kept between two packets on the same lane. */
export const PACKET_GAP = 0.06;

/** How often the producer advances the network and fires station events. */
export const NETWORK_TICK_MS = 50;

// ---- Risk ----
//
// The stream gives every payment a risk score from 0 to 100. Everyday
// payments score around RISK_BASELINE; a payment scoring more than RISK_FLAG
// over that is flagged as fraud. The analyzer and the store both judge
// against these numbers, so they can never disagree.

export const RISK_BASELINE = 12;
export const RISK_FLAG = 38;

/** Normal payment-to-payment variation. Tight relative to the flag, so a
 *  healthy network essentially never flags anything and every red packet on
 *  screen is caused by the attack the presenter started. */
export const RISK_SIGMA = 3;

/**
 * The attack each level starts:
 *
 *  slight    (D) - card testing at TechDealz. A storm of $1 charges on
 *                  freshly stolen cards, paced to stay under the velocity
 *                  rule's limit, so the rule approves every one of them.
 *  emergency (E) - account-takeover wave. The storm grows and stolen logins
 *                  start paying at every other source at once.
 *
 * `perSec` is attack packets a second, `risk` their score over baseline,
 * `takeoverShare` the share of every other source's payments that come from
 * a taken-over account.
 */
export const ATTACK = {
  slight: { perSec: 4, risk: 56, takeoverShare: 0 },
  emergency: { perSec: 4.6, risk: 76, takeoverShare: 0.4 },
} as const;
export type DeviationLevel = keyof typeof ATTACK;
/** Spread of an attack charge's risk score. */
export const ATTACK_RISK_SIGMA = 5;
/** Risk over baseline of a payment from a taken-over account. */
export const TAKEOVER_RISK = 62;

/** How long an attack takes to build. Card testing creeps in, a takeover
 *  wave arrives all at once. */
export const ATTACK_RAMP_MS = { slight: scaleMs(12000), emergency: scaleMs(1500) } as const;
/** Once every test charge is declined the testers give up, over this long. */
export const ATTACK_FADE_MS = scaleMs(5000);

/** Control limits on the windowed mean risk (over baseline) of the charges
 *  a source gets approved. Slight lands in warning, emergency in critical. */
export const WARN_TREND = 18;
export const CRITICAL_TREND = 60;

/** Trailing window for the trend, ms. */
export const TREND_WINDOW_MS = scaleMs(6500);

/** Below this many samples a windowed average is too noisy to act on. */
export const MIN_TREND_SAMPLES = 4;

/** Blocked packets drawn in the hub's quarantine tray; the count keeps going. */
export const QUARANTINE_VISIBLE = 24;
