import { scaleMs } from '@/presenter/presenterConfig';
import { random, resetRandom } from '@/presenter/rng';
import type { FraudAnalyzer } from './FraudAnalyzer';
import {
  ATTACK_RISK_SIGMA,
  NETWORK_TICK_MS,
  PACKET_GAP,
  PACKET_LENGTH,
  PACKET_SPEED,
  PAYMENT_INTERVAL_MS,
  PROBLEM_SOURCE_ID,
  RISK_FLAG,
  RISK_SIGMA,
  TAKEOVER_RISK,
  TRAFFIC_PATTERN,
  type SourceId,
} from './networkConfig';

/** Where along its lane (arc length, world units) each thing happens to a
 *  source's payments. Passed in by the engine from the scene layout, so the
 *  stream and the picture agree on where the scanner and the vault are. */
export interface LaneStations {
  /** The hub's scanner arch: scored and authorized here. */
  scan: number;
  /** Just past the scanner: a blocked payment leaves the lane here. */
  kick: number;
  /** The vault: an approved payment settles here. */
  settle: number;
}

export type PacketKind = keyof typeof PACKET_LENGTH;

export interface AttackConfig {
  /** Attack packets a second at the problem source. */
  perSec: number;
  /** Risk over baseline of an attack charge. */
  risk: number;
  /** Share of every other source's payments from taken-over accounts. */
  takeoverShare: number;
}

interface Payment {
  id: string;
  source: SourceId;
  kind: PacketKind;
  spawnedAt: number;
  offset: number;
  approved: boolean | null;
  stage: 'travelling' | 'scanned' | 'done';
}

export type SpawnListener = (id: string, source: SourceId, kind: PacketKind, spawnedAt: number) => void;
export type BlockListener = (id: string, timestamp: number) => void;
export type SettleListener = (id: string, timestamp: number) => void;

/** Box-Muller over the seedable stream, so a rehearsal reproduces. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
}

const NO_ATTACK: AttackConfig = { perSec: 0, risk: 0, takeoverShare: 0 };

let nextId = 1;

/**
 * A stand-in for the network's Kafka producers: sends a payment from each
 * source in turn every PAYMENT_INTERVAL_MS, plus the attack's own storm of
 * card-testing charges when one is running. Every payment is scored and
 * authorized as it passes the hub's scanner (the analyzer scores it, the
 * production rules decide), blocked ones are pulled off into quarantine and
 * approved ones settle at the vault. Driven by wall-clock deadlines, not
 * render frames, so it keeps time whatever the frame rate.
 */
export class PaymentProducer {
  private stations: Record<SourceId, LaneStations> | null = null;
  private analyzer: FraudAnalyzer | null = null;
  private payments: Payment[] = [];
  private attack: AttackConfig = NO_ATTACK;
  /** The production rules block what the stream flags. False while an
   *  attack is slipping under them. */
  private rulesHold = true;
  /** The problem merchant is frozen: nothing new leaves it, and anything of
   *  its already on the way is declined at the hub. */
  private frozen = false;
  private nextSpawnAt = 0;
  private nextAttackAt = 0;
  private patternIndex = 0;
  /** Last packet put on each lane, so a new one never lands on top of it. */
  private lastOnLane = new Map<SourceId, { at: number; len: number }>();
  private intervalId: number | null = null;

  private spawnListeners = new Set<SpawnListener>();
  private blockListeners = new Set<BlockListener>();
  private settleListeners = new Set<SettleListener>();

  init(stations: Record<SourceId, LaneStations>, analyzer: FraudAnalyzer) {
    this.stations = stations;
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
    this.lastOnLane.clear();
    this.patternIndex = 0;
    this.nextSpawnAt = Date.now() + 300;
  }

  setAttack(attack: AttackConfig) {
    const starting = this.attack.perSec <= 0 && attack.perSec > 0;
    this.attack = attack;
    if (starting) this.nextAttackAt = Date.now();
  }

  setRulesHold(hold: boolean) {
    this.rulesHold = hold;
  }

  configure({ frozen }: { frozen: boolean }) {
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

  /** Puts a packet on its lane no earlier than `at`, and no closer than a
   *  packet's length behind the last one on the same lane. */
  private send(source: SourceId, kind: PacketKind, at: number, offset: number) {
    const len = PACKET_LENGTH[kind];
    const last = this.lastOnLane.get(source);
    const spacing = last ? (((last.len + len) / 2 + PACKET_GAP) / PACKET_SPEED) * 1000 : 0;
    const spawnedAt = last ? Math.max(at, last.at + spacing) : at;
    this.lastOnLane.set(source, { at: spawnedAt, len });
    const p: Payment = { id: `P${nextId++}`, source, kind, spawnedAt, offset, approved: null, stage: 'travelling' };
    this.payments.push(p);
    this.spawnListeners.forEach((l) => l(p.id, source, kind, spawnedAt));
  }

  private tick() {
    if (!this.stations || !this.analyzer) return;
    const now = Date.now();

    let guard = 0;
    while (now >= this.nextSpawnAt && guard++ < 10) {
      const source = TRAFFIC_PATTERN[this.patternIndex % TRAFFIC_PATTERN.length];
      this.patternIndex += 1;
      const skip = this.frozen && source === PROBLEM_SOURCE_ID;
      if (!skip) {
        const takeover = source !== PROBLEM_SOURCE_ID && random() < this.attack.takeoverShare;
        const offset = takeover ? gaussian(TAKEOVER_RISK, ATTACK_RISK_SIGMA) : gaussian(0, RISK_SIGMA);
        this.send(source, 'normal', this.nextSpawnAt, offset);
      }
      this.nextSpawnAt += PAYMENT_INTERVAL_MS;
    }

    if (this.attack.perSec > 0.05) {
      const interval = scaleMs(1000 / this.attack.perSec);
      guard = 0;
      while (now >= this.nextAttackAt && guard++ < 10) {
        if (!this.frozen) this.send(PROBLEM_SOURCE_ID, 'attack', this.nextAttackAt, gaussian(this.attack.risk, ATTACK_RISK_SIGMA));
        this.nextAttackAt += interval;
      }
    }

    for (const p of this.payments) {
      const st = this.stations[p.source];
      const s = ((now - p.spawnedAt) / 1000) * PACKET_SPEED;
      if (p.stage === 'travelling' && s >= st.scan) {
        p.stage = 'scanned';
        const declined = this.frozen && p.source === PROBLEM_SOURCE_ID;
        const flagged = p.offset > RISK_FLAG;
        p.approved = !declined && !(flagged && this.rulesHold);
        this.analyzer.ingest({
          topic: 'authorizations',
          source_id: p.source,
          item_id: p.id,
          timestamp: now,
          offset: p.offset,
          approved: p.approved,
        });
      }
      if (p.stage === 'scanned' && !p.approved && s >= st.kick) {
        p.stage = 'done';
        this.blockListeners.forEach((l) => l(p.id, now));
      }
      if (p.stage === 'scanned' && p.approved && s >= st.settle) {
        p.stage = 'done';
        this.settleListeners.forEach((l) => l(p.id, now));
      }
    }
    this.payments = this.payments.filter((p) => p.stage !== 'done');
  }
}
