
// ── Image cache ──────────────────────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>();
const EMPTY_IMAGE = {
  complete: false,
  naturalWidth: 0,
} as HTMLImageElement;

function loadImage(src: string): HTMLImageElement {
  // Vite/Angular SSR executes module top-level code in Node where Image is undefined.
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return EMPTY_IMAGE;
  }

  if (imageCache.has(src)) return imageCache.get(src)!;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  imageCache.set(src, img);
  return img;
}

// Preload car-right image for rightward cars
const CAR_RIGHT_IMG = loadImage('/car-right.png');
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type GameStatus = 'idle' | 'running' | 'game-over' | 'cashed-out';
type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  speedMultiplier: number;
  spawnIntervalMs: number;
  progressionMultiplier: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Vehicle extends Rect {
  speed: number;
  direction: 1 | -1;
  kind: 'car' | 'bus' | 'barrier';
  color: string;
  lane: number;
  img?: HTMLImageElement;
  imgLoaded?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

class CollisionUtil {
  static overlaps(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  static chickenHitsVehicle(chicken: Rect, vehicles: Vehicle[]): boolean {
    return vehicles.some((vehicle) => this.overlaps(chicken, vehicle));
  }
}

class GameStateStore {
  status: GameStatus = 'idle';
  balance = 1000;
  currentMultiplier = 1.0;
  laneProgress = 0;
  stakedAmount = 0;
  cashedAmount = 0;
  difficulty: Difficulty = 'medium';

  startRun(stake: number): boolean {
    if (this.balance < stake || this.status === 'running') return false;
    this.balance -= stake;
    this.stakedAmount = stake;
    this.cashedAmount = 0;
    this.currentMultiplier = 1.0;
    this.laneProgress = 0;
    this.status = 'running';
    return true;
  }

  setDifficulty(value: Difficulty): void {
    this.difficulty = value;
  }

  advanceLane(config: DifficultyConfig): void {
    if (this.status !== 'running') return;
    this.laneProgress += 1;
    const growth = 1 + this.laneProgress * 0.18 * config.progressionMultiplier;
    this.currentMultiplier = Number(growth.toFixed(2));
  }

  crash(): void {
    if (this.status === 'running') this.status = 'game-over';
  }

  cashOut(): number {
    if (this.status !== 'running') return 0;
    const payout = Number((this.stakedAmount * this.currentMultiplier).toFixed(2));
    this.balance += payout;
    this.cashedAmount = payout;
    this.status = 'cashed-out';
    return payout;
  }

  resetToIdle(): void {
    this.status = 'idle';
    this.currentMultiplier = 1.0;
    this.laneProgress = 0;
    this.stakedAmount = 0;
    this.cashedAmount = 0;
  }
}


// ── Asset URLs ────────────────────────────────────────────────────────────────
// Chicken sprite sheet (walk / idle frames from OpenGameArt / itch.io CDN)
const CHICKEN_WALK_URLS = [
  'https://opengameart.org/sites/default/files/chicken_walk1.png',
  'https://opengameart.org/sites/default/files/chicken_walk2.png',
];

// We'll use emoji-rendered images as fallback drawn directly on canvas
// Vehicle card faces (playing card suits as decorative overlays)
const CARD_SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const VEHICLE_CARD_COLORS: Record<Vehicle['kind'], string[]> = {
  car:     ['#c0392b', '#e74c3c', '#922b21'],
  bus:     ['#1a5276', '#2471a3', '#154360'],
  barrier: ['#7d6608', '#d4ac0d', '#6e2f0a'],
};

class ChickenRoadEngine {
  readonly laneCount = 6;

  private readonly roadPadding = 24;
  private readonly chickenSize = 44;

  private width = 900;
  private height = 580;
  private laneHeight = 80;
  private roadTop = 90;
  private chickenX = 0;
  private chickenY = 0;
  private chickenTargetY = 0;
  private laneCooldowns: number[] = [];
  private jumpPulse = 0;

  // Chicken image (load once)
  private chickenImg: HTMLImageElement;
  private chickenImgAlt: HTMLImageElement;
  private chickenFrame = 0;
  private chickenFrameTimer = 0;

  vehicles: Vehicle[] = [];
  particles: Particle[] = [];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly state: GameStateStore,
    private readonly difficultyMap: Record<Difficulty, DifficultyConfig>
  ) {
    // Use local public asset for chicken, fallback to emoji if not loaded
    this.chickenImg = loadImage('/chiken.png');
    this.chickenImgAlt = loadImage('https://em-content.zobj.net/source/google/387/chicken_1f414.png');

    this.resize(this.width, this.height);
    this.resetRunEntities();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.roadTop = 90;
    this.laneHeight = (this.height - this.roadTop - this.roadPadding) / this.laneCount;
    this.chickenX = this.width * 0.08;
    this.setChickenLane(0, true);
  }

  resetRunEntities(): void {
    this.vehicles = [];
    this.particles = [];
    this.laneCooldowns = Array.from({ length: this.laneCount }, () => 0);
    this.jumpPulse = 0;
    this.chickenFrame = 0;
    this.setChickenLane(0, true);
  }

  startRun(): void {
    this.resetRunEntities();
  }

  moveForward(): void {
    if (this.state.status !== 'running') return;
    const nextLane = Math.min(this.state.laneProgress + 1, this.laneCount - 1);
    if (nextLane !== this.state.laneProgress) {
      this.state.advanceLane(this.difficultyMap[this.state.difficulty]);
      this.setChickenLane(this.state.laneProgress, false);
      this.jumpPulse = 1;
    }
  }

  update(deltaMs: number): void {
    const delta = deltaMs / 1000;
    const difficulty = this.difficultyMap[this.state.difficulty];

    this.chickenY += (this.chickenTargetY - this.chickenY) * Math.min(1, 11 * delta);
    this.jumpPulse = Math.max(0, this.jumpPulse - 2.7 * delta);

    // Animate chicken frames
    this.chickenFrameTimer += deltaMs;
    if (this.chickenFrameTimer > 200) {
      this.chickenFrame = (this.chickenFrame + 1) % 2;
      this.chickenFrameTimer = 0;
    }

    if (this.state.status === 'running') {
      this.spawnVehicles(deltaMs, difficulty);
      this.updateVehicles(delta, difficulty);

      const chickenHitbox: Rect = {
        x: this.chickenX + 6,
        y: this.chickenY + 6,
        width: this.chickenSize - 12,
        height: this.chickenSize - 10,
      };

      if (CollisionUtil.chickenHitsVehicle(chickenHitbox, this.vehicles)) {
        this.state.crash();
        this.spawnCrashParticles(
          chickenHitbox.x + chickenHitbox.width / 2,
          chickenHitbox.y + chickenHitbox.height / 2
        );
      }
    }

    this.updateParticles(delta);
  }

  render(): void {
    this.drawBackdrop();
    this.drawRoad();
    this.drawLaneIndicators();
    this.drawVehicles();
    this.drawChicken();
    this.drawParticles();
    this.drawProgressMarkers();
  }

  private laneToY(laneIndex: number): number {
    const offset = this.roadTop + (this.laneCount - 1 - laneIndex) * this.laneHeight;
    return offset + (this.laneHeight - this.chickenSize) / 2;
  }

  private setChickenLane(laneIndex: number, instant: boolean): void {
    this.chickenTargetY = this.laneToY(laneIndex);
    if (instant) this.chickenY = this.chickenTargetY;
  }

  private spawnVehicles(deltaMs: number, difficulty: DifficultyConfig): void {
    for (let lane = 0; lane < this.laneCount; lane++) {
      this.laneCooldowns[lane] -= deltaMs;
      if (this.laneCooldowns[lane] > 0) continue;

      const spawnChance = 0.35 + Math.random() * 0.45;
      if (Math.random() > spawnChance) {
        this.laneCooldowns[lane] = difficulty.spawnIntervalMs * (0.6 + Math.random() * 0.6);
        continue;
      }

      this.vehicles.push(this.createVehicle(lane, difficulty));
      this.laneCooldowns[lane] = difficulty.spawnIntervalMs * (0.6 + Math.random() * 0.8);
    }
  }

  private createVehicle(lane: number, difficulty: DifficultyConfig): Vehicle {
    const kindRoll = Math.random();
    const kind: Vehicle['kind'] = kindRoll < 0.55 ? 'car' : kindRoll < 0.8 ? 'bus' : 'barrier';
    const laneDirection: 1 | -1 = lane % 2 === 0 ? 1 : -1;

    const baseSize =
      kind === 'car'
        ? { width: 72, height: 38 }
        : kind === 'bus'
          ? { width: 110, height: 42 }
          : { width: 54, height: 32 };

    const colorOptions = VEHICLE_CARD_COLORS[kind];
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    const y = this.laneToY(lane) + (this.chickenSize - baseSize.height) / 2;
    const x = laneDirection === 1 ? -baseSize.width - 16 : this.width + 16;
    const speed = (85 + Math.random() * 65 + this.state.laneProgress * 9) * difficulty.speedMultiplier;

    return { x, y, width: baseSize.width, height: baseSize.height, speed, direction: laneDirection, kind, color, lane };
  }

  private updateVehicles(delta: number, difficulty: DifficultyConfig): void {
    const speedRamp = 1 + this.state.laneProgress * 0.03 * difficulty.speedMultiplier;
    for (const v of this.vehicles) {
      v.x += v.speed * v.direction * delta * speedRamp;
    }
    this.vehicles = this.vehicles.filter((v) =>
      v.direction === 1 ? v.x < this.width + v.width + 30 : v.x + v.width > -30
    );
  }

  private spawnCrashParticles(x: number, y: number): void {
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.5,
        size: 2 + Math.random() * 5,
        color: Math.random() > 0.25 ? '#facc15' : '#fb7185',
      });
    }
  }

  private updateParticles(delta: number): void {
    for (const p of this.particles) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 160 * delta;
      p.life -= delta;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  private drawBackdrop(): void {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, '#0b0f1e');
    g.addColorStop(0.5, '#111827');
    g.addColorStop(1, '#070b14');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Subtle grid lines
    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
  }

  private drawRoad(): void {
    // Road background
    this.ctx.fillStyle = '#1e2535';
    this.roundRect(this.roadPadding, this.roadTop - 8, this.width - this.roadPadding * 2, this.height - this.roadTop - 10, 12);
    this.ctx.fill();

    for (let lane = 0; lane < this.laneCount; lane++) {
      const y = this.roadTop + lane * this.laneHeight;
      // Alternate lane shading
      this.ctx.fillStyle = lane % 2 === 0 ? 'rgba(30,42,70,0.8)' : 'rgba(20,28,52,0.9)';
      this.ctx.fillRect(this.roadPadding + 4, y, this.width - this.roadPadding * 2 - 8, this.laneHeight - 2);

      // Lane divider dashes
      this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      this.ctx.setLineDash([18, 18]);
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(this.roadPadding + 30, y + this.laneHeight - 2);
      this.ctx.lineTo(this.width - this.roadPadding - 30, y + this.laneHeight - 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Left safe zone (where chicken starts)
    const safeW = this.chickenX + this.chickenSize + 14;
    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
    this.ctx.fillRect(this.roadPadding + 4, this.roadTop, safeW, this.height - this.roadTop - 12);

    // Safe zone border
    this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.roadPadding + 4 + safeW, this.roadTop);
    this.ctx.lineTo(this.roadPadding + 4 + safeW, this.height - 12);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawLaneIndicators(): void {
    // Draw multiplier cards on the right side for each lane
    const cardW = 46;
    const cardH = 28;
    const cardX = this.width - this.roadPadding - cardW - 8;

    for (let lane = 0; lane < this.laneCount; lane++) {
      const laneIdx = this.laneCount - 1 - lane; // flip so lane 0 is bottom
      const y = this.roadTop + lane * this.laneHeight + (this.laneHeight - cardH) / 2;
      const mult = Number((1 + (laneIdx + 1) * 0.18).toFixed(2));
      const reached = this.state.laneProgress > laneIdx;
      const current = this.state.laneProgress === laneIdx && this.state.status === 'running';

      // Card background
      this.ctx.fillStyle = current
        ? 'rgba(16, 185, 129, 0.9)'
        : reached
          ? 'rgba(251, 191, 36, 0.85)'
          : 'rgba(30, 41, 59, 0.92)';

      this.ctx.strokeStyle = current
        ? '#10b981'
        : reached
          ? '#f59e0b'
          : 'rgba(148,163,184,0.3)';
      this.ctx.lineWidth = 1.5;

      this.roundRect(cardX, y, cardW, cardH, 6);
      this.ctx.fill();
      this.ctx.stroke();

      // Multiplier text
      this.ctx.fillStyle = current || reached ? '#0f172a' : '#94a3b8';
      this.ctx.font = `bold ${cardH * 0.42}px "Rajdhani", monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`${mult}x`, cardX + cardW / 2, y + cardH / 2);

      // Card suit decoration
      this.ctx.font = `${cardH * 0.32}px serif`;
      this.ctx.fillStyle = reached || current ? 'rgba(15,23,42,0.4)' : 'rgba(148,163,184,0.2)';
      this.ctx.fillText(CARD_SUIT_SYMBOLS[laneIdx % 4], cardX + 8, y + 8);
    }

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }

  private drawVehicles(): void {
    for (const v of this.vehicles) {
      this.ctx.save();
      this.ctx.translate(v.x + v.width / 2, v.y + v.height / 2);
      if (v.direction === -1) this.ctx.scale(-1, 1);

      // Use car-right.png for rightward cars
      if (v.kind === 'car' && v.direction === 1 && CAR_RIGHT_IMG.complete && CAR_RIGHT_IMG.naturalWidth > 0) {
        // Draw image centered
        this.ctx.drawImage(CAR_RIGHT_IMG, -v.width / 2, -v.height / 2, v.width, v.height);
      } else {
        // Card-shaped vehicle body
        this.ctx.shadowColor = v.color;
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = v.color;
        this.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 8);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Card inner border
        this.ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        this.ctx.lineWidth = 1.5;
        this.roundRect(-v.width / 2 + 3, -v.height / 2 + 3, v.width - 6, v.height - 6, 5);
        this.ctx.stroke();

        // Card suit symbol
        const suit = CARD_SUIT_SYMBOLS[v.lane % 4];
        const suitColor = suit === '♥' || suit === '♦' ? '#fca5a5' : '#bfdbfe';
        this.ctx.fillStyle = suitColor;
        this.ctx.font = `bold ${v.height * 0.65}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(suit, 0, 0);

        // Headlights
        this.ctx.fillStyle = '#fef9c3';
        this.ctx.fillRect(v.width / 2 - 6, -v.height / 2 + 5, 4, 5);
        this.ctx.fillRect(v.width / 2 - 6, v.height / 2 - 10, 4, 5);
      }

      this.ctx.restore();
    }
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }

  private drawChicken(): void {
    const bob = Math.sin(performance.now() * 0.012) * 1.2;
    const jumpScale = 1 + this.jumpPulse * 0.14;
    const drawX = this.chickenX;
    const drawY = this.chickenY + bob;
    const size = this.chickenSize;

    this.ctx.save();
    this.ctx.translate(drawX + size / 2, drawY + size / 2);
    this.ctx.scale(jumpScale, jumpScale);

    // Try to draw the loaded image
    let img: HTMLImageElement | null = null;
    if (this.chickenImg.complete && this.chickenImg.naturalWidth > 0) {
      img = this.chickenImg;
    } else if (this.chickenImgAlt.complete && this.chickenImgAlt.naturalWidth > 0) {
      img = this.chickenImgAlt;
    }

    if (img) {
      // Slight wobble on the chicken image
      const wobble = this.state.status === 'running' ? Math.sin(performance.now() * 0.02) * 0.06 : 0;
      this.ctx.rotate(wobble);

      // Drop shadow glow
      this.ctx.shadowColor = 'rgba(16,185,129,0.6)';
      this.ctx.shadowBlur = 14;
      this.ctx.drawImage(img, -size / 2, -size / 2, size, size);
      this.ctx.shadowBlur = 0;
    } else {
      // Fallback: draw a yellow circle chicken
      this.ctx.fillStyle = '#fef08a';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#fb7185';
      this.ctx.beginPath();
      this.ctx.arc(-size * 0.18, -size * 0.18, size * 0.18, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#0f172a';
      this.ctx.beginPath();
      this.ctx.arc(-size * 0.22, 0, size * 0.08, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private drawParticles(): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life * 1.4));
      this.ctx.fillStyle = `${p.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawProgressMarkers(): void {
    // Lane progress header
    this.ctx.fillStyle = 'rgba(248,250,252,0.7)';
    this.ctx.font = '600 13px "Rajdhani", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const dotY = this.roadTop - 28;
    const totalLanes = this.laneCount;
    const startX = this.chickenX + this.chickenSize + 20;
    const endX = this.width - this.roadPadding - 60;
    const step = (endX - startX) / (totalLanes - 1);

    for (let i = 0; i < totalLanes; i++) {
      const x = startX + i * step;
      const reached = this.state.laneProgress > i;
      const current = this.state.laneProgress === i && this.state.status === 'running';

      this.ctx.beginPath();
      this.ctx.arc(x, dotY, current ? 7 : 5, 0, Math.PI * 2);
      this.ctx.fillStyle = current ? '#10b981' : reached ? '#f59e0b' : 'rgba(148,163,184,0.3)';
      this.ctx.fill();

      if (i < totalLanes - 1) {
        this.ctx.strokeStyle = reached ? '#f59e0b' : 'rgba(148,163,184,0.2)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x + (current ? 7 : 5), dotY);
        this.ctx.lineTo(startX + (i + 1) * step - 5, dotY);
        this.ctx.stroke();
      }
    }

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const rad = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + rad, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, rad);
    this.ctx.arcTo(x + w, y + h, x, y + h, rad);
    this.ctx.arcTo(x, y + h, x, y, rad);
    this.ctx.arcTo(x, y, x + w, y, rad);
    this.ctx.closePath();
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly gameTitle = 'Chicken Road';
  readonly stakeAmount = 50;
  readonly difficultyOptions: Difficulty[] = ['easy', 'medium', 'hard'];
  readonly difficultyMap: Record<Difficulty, DifficultyConfig> = {
    easy:   { speedMultiplier: 0.85, spawnIntervalMs: 1180, progressionMultiplier: 0.9 },
    medium: { speedMultiplier: 1.0,  spawnIntervalMs: 940,  progressionMultiplier: 1.0 },
    hard:   { speedMultiplier: 1.2,  spawnIntervalMs: 760,  progressionMultiplier: 1.2 },
  };

  readonly state = new GameStateStore();

  private engine?: ChickenRoadEngine;
  private animationFrameId?: number;
  private lastFrame = performance.now();
  private resizeObserver?: ResizeObserver;
  private audioContext?: AudioContext;
  private previousStatus: GameStatus = 'idle';

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.engine = new ChickenRoadEngine(ctx, this.state, this.difficultyMap);
    this.setupCanvasSizing();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    void this.audioContext?.close();
  }

  get canStart(): boolean {
    return this.state.status !== 'running' && this.state.balance >= this.stakeAmount;
  }

  get canCashOut(): boolean {
    return this.state.status === 'running';
  }

  get currentPayout(): number {
    return Number((this.stakeAmount * this.state.currentMultiplier).toFixed(2));
  }

  startGame(): void {
    if (!this.state.startRun(this.stakeAmount)) return;
    this.engine?.startRun();
    this.playTone(520, 0.05, 'square');
  }

  restart(): void {
    this.state.resetToIdle();
    this.engine?.resetRunEntities();
  }

  cashOut(): void {
    const payout = this.state.cashOut();
    if (payout > 0) this.playTone(780, 0.08, 'triangle');
  }

  onDifficultyChange(value: string): void {
    if (this.state.status === 'running') return;
    if (value === 'easy' || value === 'medium' || value === 'hard') {
      this.state.setDifficulty(value);
    }
  }

  onCanvasAction(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    if (this.state.status !== 'running') return;
    this.engine?.moveForward();
    this.playTone(640, 0.04, 'sine');
  }

  private startAnimationLoop(): void {
    const tick = (now: number): void => {
      if (!this.lastFrame) this.lastFrame = now;
      const delta = Math.min(34, now - this.lastFrame);
      this.lastFrame = now;

      this.engine?.update(delta);

      if (this.previousStatus !== 'game-over' && this.state.status === 'game-over') {
        this.playTone(120, 0.16, 'sawtooth');
      }

      this.previousStatus = this.state.status;
      this.engine?.render();
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private setupCanvasSizing(): void {
    const canvas = this.canvasRef.nativeElement;
    const updateCanvasSize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const width = Math.max(340, Math.floor(rect.width));
      const height = Math.max(420, Math.floor(Math.min(window.innerHeight * 0.62, width * 0.68)));

      canvas.width = width;
      canvas.height = height;
      this.engine?.resize(width, height);
    };

    this.resizeObserver = new ResizeObserver(updateCanvasSize);
    const parent = canvas.parentElement;
    if (parent) this.resizeObserver.observe(parent);
    updateCanvasSize();
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (typeof window === 'undefined') return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.045, this.audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration + 0.01);
  }
}