import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, ChangeDetectionStrategy,
  ChangeDetectorRef, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type GameStatus = 'idle' | 'running' | 'gameover' | 'cashedout';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'hardcore';

export interface DiffConfig { roastChance: number; progMult: number; }
export interface LaneVM {
  index: number;
  label: string;          
  coinState: 'inactive' | 'active' | 'current';
  fireArmed: boolean;
  fireBurning: boolean;
  fireLethal: boolean;
}
export interface DotVM { index: number; state: 'idle' | 'reached' | 'current'; }
export interface Particle { id: number; cx: number; cy: number; dx: number; dy: number; color: string; size: number; dur: number; }

const LANE_COUNT = 6;
const DIFF: Record<Difficulty, DiffConfig> = {
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
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('gameArea',  { static: true }) gameAreaRef!: ElementRef<HTMLDivElement>;
  @ViewChild('startZone', { static: true }) startZoneRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chicken',   { static: true }) chickenRef!: ElementRef<HTMLDivElement>;

  status: GameStatus = 'idle';
  balance = 1000;
  stake   = 50;
  lane    = 0;    
  visibleStart = 0; 
  mult    = 1.0;
  diff: Difficulty = 'easy';
  locked  = false; 
  cashedAmount = 0;

  lanes: LaneVM[]    = [];
  dots: DotVM[]      = [];
  particles: Particle[] = [];

  chickenLeftPx = 0;
  chickenJumping = false;
  chickenDead    = false;
  shiftStepAnim = false;

  onlineCount  = 3548;
  showLiveWin  = false;
  liveWinText  = '';
  readonly betOptions: number[]      = [0.5, 1, 50, 100];
  readonly diffOptions: Difficulty[] = ['easy', 'medium', 'hard', 'hardcore'];

  private pId = 0;
  private readonly chickenWidth = 92;
  private onlineTick?: ReturnType<typeof setInterval>;
  private liveWinTimer?: ReturnType<typeof setTimeout>;
  private hazardMap = new Map<number, boolean>();

  constructor(private cd: ChangeDetectorRef, private zone: NgZone) {}

  ngOnInit(): void {
    this.buildLanes();
    this.buildDots();
    this.zone.runOutsideAngular(() => {
      this.onlineTick = setInterval(() => this.zone.run(() => {
        this.onlineCount = Math.max(3000, this.onlineCount + Math.floor(Math.random() * 7) - 3);
        this.cd.markForCheck();
      }), 2500);
    });
  }

  ngAfterViewInit(): void {
    this.chickenLeftPx = this.calcChickenLeft(-1);
    this.cd.markForCheck();
  }

  ngOnDestroy(): void {
    clearInterval(this.onlineTick);
    clearTimeout(this.liveWinTimer);
  }

  get isRunning()  { return this.status === 'running'; }
  get canStart()   { return this.status !== 'running' && this.balance >= this.stake; }
  get canCashOut() { return this.status === 'running'; }
  get payout()     { return +(this.stake * this.mult).toFixed(2); }
  get multLabel()  { return this.mult.toFixed(2) + 'x'; }
  get multColor()  { return this.mult > 1.5 ? '#fbbf24' : '#34d399'; }

  buildLanes(): void {
    const cfg = DIFF[this.diff];
    this.lanes = Array.from({ length: LANE_COUNT }, (_, i) => ({
      index:       i,
      label:       (1 + (this.visibleStart + i + 1) * 0.18 * cfg.progMult).toFixed(2) + 'x',
      coinState:   'inactive' as const,
      fireArmed:   false,
      fireBurning: false,
      fireLethal:  false,
    }));
    this.refreshLaneWindow();
  }

  buildDots(): void {
    this.dots = Array.from({ length: LANE_COUNT }, (_, i) => ({ index: i, state: 'idle' as const }));
  }

  syncCoins(): void {
    for (const l of this.lanes) {
      const globalIdx = this.visibleStart + l.index;
      if (this.status === 'running') {
        l.coinState = globalIdx < this.lane ? 'active' : globalIdx === this.lane ? 'current' : 'inactive';
      } else {
        l.coinState = globalIdx < this.lane ? 'active' : 'inactive';
      }
    }
  }

  syncDots(): void {
    for (const d of this.dots) {
      const globalIdx = this.visibleStart + d.index;
      if (globalIdx < this.lane) d.state = 'reached';
      else if (globalIdx === this.lane && this.status === 'running') d.state = 'current';
      else d.state = 'idle';
    }
  }

  syncLabels(): void {
    const cfg = DIFF[this.diff];
    for (const l of this.lanes) {
      l.label = (1 + (this.visibleStart + l.index + 1) * 0.18 * cfg.progMult).toFixed(2) + 'x';
    }
  }

  private isFireLane(globalIdx: number): boolean {
    const cached = this.hazardMap.get(globalIdx);
    if (cached !== undefined) return cached;

    const cfg = DIFF[this.diff];
    const patterned = globalIdx % 5 === 2 || globalIdx % 7 === 4;
    const chance = Math.min(0.72, cfg.roastChance * 0.72 + (patterned ? 0.2 : 0.05));
    const val = Math.random() < chance;
    this.hazardMap.set(globalIdx, val);
    return val;
  }

  private refreshLaneWindow(): void {
    this.syncLabels();
    for (const l of this.lanes) {
      const globalIdx = this.visibleStart + l.index;
      l.fireArmed = this.isFireLane(globalIdx);
      if (!l.fireBurning) l.fireLethal = false;
    }
  }

  calcChickenLeft(laneIdx: number): number {
    const szW   = this.startZoneRef?.nativeElement.offsetWidth ?? 120;
    const areaW = this.gameAreaRef?.nativeElement.offsetWidth  ?? 900;
    const laneW = (areaW - szW) / LANE_COUNT;
    if (laneIdx < 0) return szW - this.chickenWidth + 10;
    return szW + laneIdx * laneW + laneW / 2 - this.chickenWidth / 2;
  }

  moveChicken(laneIdx: number): void {
    this.chickenLeftPx = this.calcChickenLeft(laneIdx);
  }

  resetChicken(): void {
    this.chickenJumping = false;
    this.chickenDead    = false;
    this.chickenLeftPx  = this.calcChickenLeft(-1);
  }

  igniteFire(laneIdx: number, lethal: boolean, durationMs: number): void {
    const lane = this.lanes[laneIdx];
    if (!lane) return;
    lane.fireBurning = false;
    lane.fireLethal  = false;
    this.cd.markForCheck();
    setTimeout(() => {
      lane.fireBurning = true;
      lane.fireLethal  = lethal;
      this.cd.markForCheck();
      setTimeout(() => {
        lane.fireBurning = false;
        lane.fireLethal  = false;
        this.cd.markForCheck();
      }, durationMs);
    }, 20); 
  }

  spawnParticles(laneIdx: number, colors: string[], count: number): void {
    const laneEl = document.getElementById(`lane${laneIdx}`);
    const areaEl = this.gameAreaRef.nativeElement;
    if (!laneEl) return;
    const lr = laneEl.getBoundingClientRect();
    const ar = areaEl.getBoundingClientRect();
    const cx = lr.left - ar.left + lr.width  / 2;
    const cy = lr.top  - ar.top  + lr.height * 0.55;

    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 90;
      const p: Particle = {
        id:    ++this.pId,
        cx, cy,
        dx:    Math.cos(ang) * spd,
        dy:    Math.sin(ang) * spd - 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size:  3 + Math.random() * 5,
        dur:   400 + Math.random() * 400,
      };
      this.particles = [...this.particles, p];
      setTimeout(() => {
        this.particles = this.particles.filter(pp => pp.id !== p.id);
        this.cd.markForCheck();
      }, p.dur + 80);
    }
  }

  advance(): void {
    if (this.status !== 'running') return;
    if (this.locked) return;

    this.locked = true;
    const target = this.lane;
    const targetVisible = target - this.visibleStart;
    if (targetVisible < 0 || targetVisible >= LANE_COUNT) {
      this.locked = false;
      return;
    }
    const cfg    = DIFF[this.diff];
    const lethal = this.isFireLane(target);

    // Phase 1: start jump, move chicken
    this.chickenJumping = true;
    this.moveChicken(targetVisible);
    this.cd.markForCheck();

    setTimeout(() => {
      this.chickenJumping = false;

      if (lethal) {
        this.igniteFire(targetVisible, true, 1200);
      }

      if (lethal) {
        this.status      = 'gameover';
        this.chickenDead = true;
        this.spawnParticles(targetVisible, ['#fb923c','#ef4444','#fbbf24','#f87171'], 28);
        this.syncCoins();
        this.syncDots();
        this.cd.markForCheck();

        setTimeout(() => {
          this.locked = false;
          this.cd.markForCheck();
        }, 700);

      } else {
        this.lane = target + 1;
        this.mult = +(1 + this.lane * 0.18 * cfg.progMult).toFixed(2);

        if (this.lane - this.visibleStart >= LANE_COUNT) {
          this.visibleStart = this.lane - (LANE_COUNT - 1);
          this.refreshLaneWindow();
          this.shiftStepAnim = true;
          setTimeout(() => {
            this.shiftStepAnim = false;
            this.cd.markForCheck();
          }, 180);
        } else {
          this.refreshLaneWindow();
        }

        const chickenVisible = this.lane - 1 - this.visibleStart;
        this.moveChicken(chickenVisible);

        this.spawnParticles(Math.max(0, Math.min(LANE_COUNT - 1, chickenVisible)), ['#22c55e','#86efac','#fbbf24'], 12);
        this.syncCoins();
        this.syncDots();

        this.locked = false;
        this.cd.markForCheck();
      }
    }, 220);
  }

  startGame(): void {
    if (!this.canStart) return;
    this.balance -= this.stake;
    this.lane    = 0;
    this.visibleStart = 0;
    this.mult    = 1.0;
    this.status  = 'running';
    this.locked  = false;
    this.cashedAmount = 0;
    this.hazardMap.clear();

    this.buildLanes();
    this.buildDots();
    this.resetChicken();
    this.syncCoins();
    this.syncDots();
    this.refreshLaneWindow();
    this.cd.markForCheck();
  }

  cashOut(): void {
    if (this.status !== 'running') return;
    this.cashedAmount = this.payout;
    this.balance     += this.cashedAmount;
    this.status       = 'cashedout';
    this.locked       = false;

    this.syncCoins();
    this.syncDots();

    this.liveWinText = `+$${this.cashedAmount.toFixed(2)}`;
    this.showLiveWin = true;
    clearTimeout(this.liveWinTimer);
    this.liveWinTimer = setTimeout(() => { this.showLiveWin = false; this.cd.markForCheck(); }, 3000);
    this.cd.markForCheck();
  }

  resetGame(): void {
    this.status = 'idle';
    this.lane   = 0;
    this.visibleStart = 0;
    this.mult   = 1.0;
    this.locked = false;
    this.cashedAmount = 0;
    this.hazardMap.clear();

    this.buildLanes();
    this.buildDots();
    this.resetChicken();
    this.syncCoins();
    this.syncDots();
    this.cd.markForCheck();
  }

  selectBet(amount: number): void { if (!this.isRunning) { this.stake = amount; } }
  selectDiff(d: Difficulty): void {
    if (this.isRunning) return;
    this.diff = d;
    this.hazardMap.clear();
    this.refreshLaneWindow();
  }

  trackLane(_: number, l: LaneVM): number        { return l.index; }
  trackDot (_: number, d: DotVM): number          { return d.index; }
  trackPart(_: number, p: Particle): number       { return p.id; }

  onAreaClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('.ov-card')) return;
    this.advance();
  }
}