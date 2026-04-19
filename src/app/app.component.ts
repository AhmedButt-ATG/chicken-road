import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// ── Types ─────────────────────────────────────────────────────────
export type GameStatus = 'idle' | 'running' | 'game-over' | 'cashed-out';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'hardcore';

export interface DifficultyConfig {
  roastChance: number;
  progMult: number;
}

export interface LaneModel {
  index: number;
  multiplier: string;
  coinState: 'inactive' | 'active' | 'current';
  fireVisible: boolean;
  fireLethal: boolean;
}

export interface ProgressDot {
  index: number;
  state: 'idle' | 'reached' | 'current';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
  duration: number;
}

// ── Constants ─────────────────────────────────────────────────────
const LANE_COUNT = 6;
const DIFFICULTY_MAP: Record<Difficulty, DifficultyConfig> = {
  easy:     { roastChance: 0.15, progMult: 0.8  },
  medium:   { roastChance: 0.26, progMult: 1.0  },
  hard:     { roastChance: 0.36, progMult: 1.25 },
  hardcore: { roastChance: 0.50, progMult: 1.6  },
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {

  // ── State ──────────────────────────────────────────────────────
  status: GameStatus = 'idle';
  balance = 1000;
  stake = 50;
  laneProgress = 0;
  currentMultiplier = 1.0;
  difficulty: Difficulty = 'easy';
  cashedAmount = 0;
  onlineCount = 3548;
  liveWin = '';
  showLiveWin = false;

  // ── Derived UI models ─────────────────────────────────────────
  lanes: LaneModel[] = [];
  progressDots: ProgressDot[] = [];
  particles: Particle[] = [];

  // ── Chicken animation state ───────────────────────────────────
  chickenLeft = 0;        // px from left
  chickenJumping = false;
  chickenDead = false;

  // ── Difficulty options ────────────────────────────────────────
  readonly difficultyOptions: Difficulty[] = ['easy', 'medium', 'hard', 'hardcore'];
  readonly betOptions = [0.5, 1, 50, 100];

  // ── Private timers ────────────────────────────────────────────
  private particleIdCounter = 0;
  private onlineInterval?: ReturnType<typeof setInterval>;
  private liveWinTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    this.buildLanes();
    this.buildProgressDots();

    // Fake online counter (outside zone to avoid heavy CD)
    this.zone.runOutsideAngular(() => {
      this.onlineInterval = setInterval(() => {
        this.zone.run(() => {
          this.onlineCount += Math.floor(Math.random() * 7) - 3;
          if (this.onlineCount < 3000) this.onlineCount = 3000;
          this.cd.markForCheck();
        });
      }, 2500);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.onlineInterval);
    clearTimeout(this.liveWinTimeout);
  }

  // ── Getters ───────────────────────────────────────────────────
  get isRunning(): boolean { return this.status === 'running'; }
  get canStart(): boolean  { return this.status !== 'running' && this.balance >= this.stake; }
  get canCashOut(): boolean { return this.status === 'running'; }

  get currentPayout(): number {
    return Number((this.stake * this.currentMultiplier).toFixed(2));
  }

  get multiplierDisplay(): string {
    return this.currentMultiplier.toFixed(2) + 'x';
  }

  get multiplierColor(): string {
    return this.currentMultiplier > 1.5 ? '#fbbf24' : '#34d399';
  }

  // ── Build helpers ─────────────────────────────────────────────
  buildLanes(): void {
    const config = DIFFICULTY_MAP[this.difficulty];
    this.lanes = Array.from({ length: LANE_COUNT }, (_, i) => ({
      index: i,
      multiplier: (1 + (i + 1) * 0.18 * config.progMult).toFixed(2),
      coinState: 'inactive',
      fireVisible: false,
      fireLethal: false,
    }));
  }

  buildProgressDots(): void {
    this.progressDots = Array.from({ length: LANE_COUNT }, (_, i) => ({
      index: i,
      state: 'idle',
    }));
  }

  // ── Coin state sync ───────────────────────────────────────────
  private updateCoins(): void {
    for (const lane of this.lanes) {
      if (this.status === 'running') {
        if (lane.index < this.laneProgress)       lane.coinState = 'active';
        else if (lane.index === this.laneProgress) lane.coinState = 'current';
        else                                       lane.coinState = 'inactive';
      } else {
        lane.coinState = lane.index < this.laneProgress ? 'active' : 'inactive';
      }
    }
  }

  private updateProgress(): void {
    for (const dot of this.progressDots) {
      if (dot.index < this.laneProgress)       dot.state = 'reached';
      else if (dot.index === this.laneProgress && this.status === 'running') dot.state = 'current';
      else dot.state = 'idle';
    }
  }

  private updateMultiplierLabels(): void {
    const config = DIFFICULTY_MAP[this.difficulty];
    for (const lane of this.lanes) {
      lane.multiplier = (1 + (lane.index + 1) * 0.18 * config.progMult).toFixed(2);
    }
  }

  // ── Chicken position ──────────────────────────────────────────
  getChickenLeft(laneIndex: number): number {
    // Percentage-based: start zone ~120px wide, each lane is equal fraction of remaining
    // We'll return a % value relative to game-area width
    const startZonePct = 13; // ~120px of ~900px
    if (laneIndex < 0) return startZonePct - 4; // peeking out of door
    const laneWidthPct = (100 - startZonePct) / LANE_COUNT;
    return startZonePct + laneIndex * laneWidthPct + laneWidthPct / 2 - 3.8;
  }

  private moveChickenTo(laneIndex: number): void {
    this.chickenLeft = this.getChickenLeft(laneIndex);
  }

  private resetChicken(): void {
    this.chickenLeft = this.getChickenLeft(-1);
    this.chickenJumping = false;
    this.chickenDead = false;
  }

  // ── Fire ──────────────────────────────────────────────────────
  private showFire(laneIndex: number, lethal: boolean): void {
    const lane = this.lanes[laneIndex];
    lane.fireVisible = true;
    lane.fireLethal  = lethal;
    setTimeout(() => {
      lane.fireVisible = false;
      lane.fireLethal  = false;
      this.cd.markForCheck();
    }, lethal ? 700 : 450);
  }

  // ── Particles ─────────────────────────────────────────────────
  private spawnParticles(leftPct: number, topPct: number, colors: string[], count = 18): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 4 + Math.random() * 10; // % units
      const p: Particle = {
        id:       ++this.particleIdCounter,
        x:        leftPct,
        y:        topPct,
        dx:       Math.cos(angle) * dist,
        dy:       Math.sin(angle) * dist - 8,
        color:    colors[Math.floor(Math.random() * colors.length)],
        size:     3 + Math.random() * 5,
        duration: 400 + Math.random() * 400,
      };
      this.particles.push(p);
      setTimeout(() => {
        this.particles = this.particles.filter(pp => pp.id !== p.id);
        this.cd.markForCheck();
      }, p.duration + 50);
    }
  }

  trackParticle(_: number, p: Particle): number { return p.id; }
  trackLane(_: number, l: LaneModel): number { return l.index; }
  trackDot(_: number, d: ProgressDot): number { return d.index; }

  // ── Core Game Logic ───────────────────────────────────────────
  startGame(): void {
    if (!this.canStart) return;
    this.balance -= this.stake;
    this.laneProgress = 0;
    this.currentMultiplier = 1.0;
    this.cashedAmount = 0;
    this.status = 'running';

    this.buildLanes();
    this.buildProgressDots();
    this.updateCoins();
    this.updateProgress();
    this.resetChicken();
    this.cd.markForCheck();
  }

  advanceLane(targetIndex?: number): void {
    if (this.status !== 'running') return;
    if (targetIndex !== undefined && targetIndex !== this.laneProgress) return;

    const i = this.laneProgress;
    const config = DIFFICULTY_MAP[this.difficulty];
    const lethal = Math.random() < config.roastChance;

    // Jump animation
    this.chickenJumping = true;
    setTimeout(() => { this.chickenJumping = false; this.cd.markForCheck(); }, 350);

    this.moveChickenTo(i);
    this.cd.markForCheck();

    setTimeout(() => {
      this.showFire(i, lethal);

      if (lethal) {
        this.status = 'game-over';
        this.chickenDead = true;

        // crash particles
        this.spawnParticles(
          this.getChickenLeft(i) + 3.5,
          55,
          ['#fb923c', '#ef4444', '#fbbf24', '#f87171'],
          28,
        );

        this.cd.markForCheck();
      } else {
        this.laneProgress = i + 1;
        this.currentMultiplier = Number(
          (1 + this.laneProgress * 0.18 * config.progMult).toFixed(2)
        );

        this.updateCoins();
        this.updateProgress();

        // win particles
        this.spawnParticles(
          this.getChickenLeft(i) + 3.5,
          50,
          ['#22c55e', '#86efac', '#fbbf24'],
          12,
        );

        if (this.laneProgress >= LANE_COUNT) {
          this.cashOut();
        }

        this.cd.markForCheck();
      }
    }, 200);
  }

  cashOut(): void {
    if (this.status !== 'running') return;
    const payout = Number((this.stake * this.currentMultiplier).toFixed(2));
    this.balance += payout;
    this.cashedAmount = payout;
    this.status = 'cashed-out';

    this.liveWin = `+$${payout.toFixed(2)}`;
    this.showLiveWin = true;
    clearTimeout(this.liveWinTimeout);
    this.liveWinTimeout = setTimeout(() => {
      this.showLiveWin = false;
      this.cd.markForCheck();
    }, 3000);

    this.updateCoins();
    this.cd.markForCheck();
  }

  resetGame(): void {
    this.status = 'idle';
    this.laneProgress = 0;
    this.currentMultiplier = 1.0;
    this.cashedAmount = 0;
    this.chickenDead = false;
    this.chickenJumping = false;

    this.buildLanes();
    this.buildProgressDots();
    this.resetChicken();
    this.cd.markForCheck();
  }

  // ── UI actions ────────────────────────────────────────────────
  selectBet(amount: number): void {
    if (this.isRunning) return;
    this.stake = amount;
  }

  selectDifficulty(diff: Difficulty): void {
    if (this.isRunning) return;
    this.difficulty = diff;
    this.updateMultiplierLabels();
  }

  onGameAreaClick(): void {
    if (this.status !== 'running') return;
    this.advanceLane();
  }
}