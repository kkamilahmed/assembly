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

/** Where the network's ends are: the scoring hub, and the problem
 *  merchant's checkout. [lat, lon] in degrees. */
export const HUB_AT: readonly [number, number] = [40.71, -74.01]; // New York
export const MERCHANT_AT: Record<SourceId, readonly [number, number]> = {
  'CAFE-01': HUB_AT,
  'ATM-07': HUB_AT,
  'MALL-03': HUB_AT,
  'TDZ-WEB': [41.88, -87.63], // Chicago
};

/** Where everyday card holders pay from: the network's own region and the
 *  cities its customers travel to and shop online from. */
export const CARDHOLDER_CITIES: ReadonlyArray<readonly [number, number]> = [
  [51.51, -0.13], [19.43, -99.13], [-23.55, -46.63], [43.65, -79.38], [34.05, -118.24], [25.76, -80.19],
  [48.86, 2.35], [52.52, 13.4], [40.42, -3.7], [29.76, -95.37], [47.61, -122.33], [-34.6, -58.38],
  [4.71, -74.07], [45.5, -73.57], [41.88, -87.63], [39.95, -75.17], [42.36, -71.06], [33.75, -84.39],
  [32.78, -96.8], [37.77, -122.42], [18.47, -66.11], [53.35, -6.26], [38.72, -9.14], [-33.45, -70.67],
];

/** Where card testers and stolen logins send from. The first eight carry a
 *  slight attack; an emergency comes from all of them. Kept to places whose
 *  flights to New York and Chicago arc where the resting view can see
 *  them, not flat across the far side of the globe. */
export const ATTACKER_CITIES: ReadonlyArray<readonly [number, number]> = [
  [55.76, 37.62], [6.52, 3.38], [50.45, 30.52], [44.43, 26.1], [30.04, 31.24], [41.01, 28.98],
  [52.23, 21.01], [10.48, -66.9], [53.9, 27.57], [5.6, -0.19], [36.8, 10.18], [44.79, 20.45],
  [56.95, 24.1], [59.44, 24.75], [39.93, 32.86], [33.57, -7.59], [-0.18, -78.47], [18.49, -69.93],
  [-12.05, -77.04], [9.93, -84.08], [8.98, -79.52], [41.72, 44.79], [14.69, -17.45], [55.75, 49.12],
];

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

/** Every payment's journey, in units along its flight: scored and
 *  authorized early (the network sees it as soon as it is sent), a blocked
 *  one dropped just short of landing, an approved one settled on landing. */
export const FLIGHT = { scan: 1.3, kick: 9.0, settle: 10 } as const;

/** Packet speed along its flight, units per second. Scaled with the
 *  presenter speed so the network runs faster without the layout changing. */
export const PACKET_SPEED = 2.0 * (1000 / scaleMs(1000));


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
 * a taken-over account, and `spread` how many of the attacker cities it
 * sends from.
 */
export const ATTACK = {
  slight: { perSec: 4, risk: 56, takeoverShare: 0, spread: 8 },
  emergency: { perSec: 4.6, risk: 76, takeoverShare: 0.4, spread: ATTACKER_CITIES.length },
} as const;
export type DeviationLevel = keyof typeof ATTACK;
/** Spread of an attack charge's risk score. */
export const ATTACK_RISK_SIGMA = 5;
/** Risk over baseline of a payment from a taken-over account. */
export const TAKEOVER_RISK = 62;

/** How long an attack takes to build. Card testing creeps in, a takeover
 *  wave arrives all at once. */
export const ATTACK_RAMP_MS = { slight: scaleMs(12000), emergency: scaleMs(1500) } as const;
/** Once the rule is refit the testers keep firing at full strength for a
 *  while (they cannot see the declines yet), then give up over FADE. */
export const ATTACK_HOLD_MS = scaleMs(5000);
export const ATTACK_FADE_MS = scaleMs(5000);

/** Control limits on the windowed mean risk (over baseline) of the charges
 *  a source gets approved. Slight lands in warning, emergency in critical. */
export const WARN_TREND = 18;
export const CRITICAL_TREND = 60;

/** Trailing window for the trend, ms. */
export const TREND_WINDOW_MS = scaleMs(6500);

/** Below this many samples a windowed average is too noisy to act on. */
export const MIN_TREND_SAMPLES = 4;

