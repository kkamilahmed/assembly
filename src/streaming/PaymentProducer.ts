import { scaleMs } from '@/presenter/presenterConfig';
import { random, resetRandom } from '@/presenter/rng';
import type { FraudAnalyzer } from './FraudAnalyzer';
import {
  ATTACK_RISK_SIGMA,
  ATTACKER_CITIES,
  CARDHOLDER_CITIES,
  FLIGHT,
  NETWORK_TICK_MS,
  PACKET_SPEED,
  PAYMENT_INTERVAL_MS,
  PROBLEM_SOURCE_ID,
  RISK_FLAG,
  RISK_SIGMA,
  TAKEOVER_RISK,
  TRAFFIC_PATTERN,
  type SourceId,
} from './networkConfig';

export type PacketKind = 'normal' | 'attack';

export interface AttackConfig {
  /** Attack packets a second at the problem source. */
  perSec: number;
  /** Risk over baseline of an attack charge. */
  risk: number;
  /** Share of every other source's payments from taken-over accounts. */
  takeoverShare: number;
  /** How many of the attacker cities it sends from. */
  spread: number;
}

interface Payment {
  id: string;
  source: SourceId;
  kind: PacketKind;
  spawnedAt: number;
  offset: number;
  approved: boolean | null;
  stage: 'flying' | 'scanned' | 'done';
}

/** Where a payment was sent from, [lat, lon]: card data carries the
 *  issuing country and the device's location, and the globe draws it. */
export type Origin = readonly [number, number];

export type SpawnListener = (id: string, source: SourceId, kind: PacketKind, spawnedAt: number, from: Origin) => void;
export type BlockListener = (id: string, timestamp: number) => void;
export type SettleListener = (id: string, timestamp: number) => void;
export type HoldListener = (id: string, timestamp: number) => void;

/** Box-Muller over the seedable stream, so a rehearsal reproduces. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
}

function pick<T>(list: ReadonlyArray<T>, n = list.length): T {
  return list[Math.floor(random() * Math.min(n, list.length))];
}

const NO_ATTACK: AttackConfig = { perSec: 0, risk: 0, takeoverShare: 0, spread: 0 };

let nextId = 1;

/**
 * A stand-in for the network's Kafka producers: sends a payment from each
 * source in turn every PAYMENT_INTERVAL_MS, plus the attack's own storm of
 * card-testing charges when one is running. Every payment is scored and
 * authorized as it enters the network (the analyzer scores it, the
 * production rules decide); a blocked one is dropped short of landing and
 * an approved one settles when it lands. Driven by wall-clock deadlines, not
 * render frames, so it keeps time whatever the frame rate.
 */
export class PaymentProducer {
  private analyzer: FraudAnalyzer | null = null;
  private payments: Payment[] = [];
  private attack: AttackConfig = NO_ATTACK;
  /** The production rules block what the stream flags. False while an
   *  attack is slipping under them. */
  private rulesHold = true;
  /** The problem merchant is frozen: nothing new leaves it, and its
   *  payments in flight are held where they are and never land. */
  private frozen = false;
  private nextSpawnAt = 0;
  private nextAttackAt = 0;
  private patternIndex = 0;
  private intervalId: number | null = null;

  private spawnListeners = new Set<SpawnListener>();
  private blockListeners = new Set<BlockListener>();
  private settleListeners = new Set<SettleListener>();
  private holdListeners = new Set<HoldListener>();

  init(analyzer: FraudAnalyzer) {
    this.analyzer = analyzer;
  }

  start() {
    if (this.intervalId !== null) return;
    this.nextSpawnAt = Date.now() + 300;
    this.intervalId = window.setInterval(() => this.tick(), NETWORK_TICK_MS);
  }

  reset() {
    resetRandom();
    this.attack = NO_ATTACK;
    this.rulesHold = true;
    this.payments = [];
    this.patternIndex = 0;
    this.nextSpawnAt = Date.now() + 300;
  }

  setAttack(attack: AttackConfig) {
    const now = Date.now();
    const starting = this.attack.perSec <= 0 && attack.perSec > 0;
    this.attack = attack;
    if (starting) this.nextAttackAt = now;
    // A rate that just went up must not wait out the slow interval it
    // replaced.
    else if (attack.perSec > 0.05) this.nextAttackAt = Math.min(this.nextAttackAt, now + scaleMs(1000 / attack.perSec));
  }

  setRulesHold(hold: boolean) {
    this.rulesHold = hold;
  }

  configure({ frozen }: { frozen: boolean }) {
    if (frozen && !this.frozen) {
      // A frozen merchant's charges stop where they are.
      const now = Date.now();
      for (const p of this.payments) {
        if (p.source !== PROBLEM_SOURCE_ID || p.stage === 'done') continue;
        p.stage = 'done';
        this.holdListeners.forEach((l) => l(p.id, now));
      }
      this.payments = this.payments.filter((p) => p.stage !== 'done');
    }
    this.frozen = frozen;
  }

  onSpawn(l: SpawnListener) {
    this.spawnListeners.add(l);
  }
  onBlock(l: BlockListener) {
    this.blockListeners.add(l);
  }
  onSettle(l: SettleListener) {
    this.settleListeners.add(l);
  }
  onHold(l: HoldListener) {
    this.holdListeners.add(l);
  }

  private send(source: SourceId, kind: PacketKind, at: number, offset: number, from: Origin) {
    const p: Payment = { id: `P${nextId++}`, source, kind, spawnedAt: at, offset, approved: null, stage: 'flying' };
    this.payments.push(p);
    this.spawnListeners.forEach((l) => l(p.id, source, kind, at, from));
  }

  private tick() {
    if (!this.analyzer) return;
    const now = Date.now();

    let guard = 0;
    while (now >= this.nextSpawnAt && guard++ < 10) {
      const source = TRAFFIC_PATTERN[this.patternIndex % TRAFFIC_PATTERN.length];
      this.patternIndex += 1;
      const skip = this.frozen && source === PROBLEM_SOURCE_ID;
      if (!skip) {
        const takeover = source !== PROBLEM_SOURCE_ID && random() < this.attack.takeoverShare;
        const offset = takeover ? gaussian(TAKEOVER_RISK, ATTACK_RISK_SIGMA) : gaussian(0, RISK_SIGMA);
        const from = takeover ? pick(ATTACKER_CITIES, this.attack.spread) : pick(CARDHOLDER_CITIES);
        this.send(source, 'normal', this.nextSpawnAt, offset, from);
      }
      this.nextSpawnAt += PAYMENT_INTERVAL_MS;
    }

    if (this.attack.perSec > 0.05) {
      const interval = scaleMs(1000 / this.attack.perSec);
      guard = 0;
      while (now >= this.nextAttackAt && guard++ < 10) {
        if (!this.frozen) {
          const offset = gaussian(this.attack.risk, ATTACK_RISK_SIGMA);
          this.send(PROBLEM_SOURCE_ID, 'attack', this.nextAttackAt, offset, pick(ATTACKER_CITIES, Math.max(1, this.attack.spread)));
        }
        this.nextAttackAt += interval;
      }
    }

    for (const p of this.payments) {
      const s = ((now - p.spawnedAt) / 1000) * PACKET_SPEED;
      if (p.stage === 'flying' && s >= FLIGHT.scan) {
        p.stage = 'scanned';
        const flagged = p.offset > RISK_FLAG;
        p.approved = !(flagged && this.rulesHold);
        this.analyzer.ingest({
          topic: 'authorizations',
          source_id: p.source,
          item_id: p.id,
          timestamp: now,
          offset: p.offset,
          approved: p.approved,
        });
      }
      if (p.stage === 'scanned' && !p.approved && s >= FLIGHT.kick) {
        p.stage = 'done';
        this.blockListeners.forEach((l) => l(p.id, now));
      }
      if (p.stage === 'scanned' && p.approved && s >= FLIGHT.settle) {
        p.stage = 'done';
        this.settleListeners.forEach((l) => l(p.id, now));
      }
    }
    this.payments = this.payments.filter((p) => p.stage !== 'done');
  }
}
