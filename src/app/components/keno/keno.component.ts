import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KenoService, PaytableEntry } from '../../service/keno.service';

export type GameStatus = 'idle' | 'drawing' | 'results';

@Component({
  selector: 'app-keno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './keno.component.html',
  styleUrl: './keno.component.scss'
})
export class KenoComponent {
  private readonly kenoService = inject(KenoService);

  readonly boardNumbers = this.kenoService.getBoardNumbers();
  readonly maxSpots = 10;
  readonly drawSize = 20;

  selectedNumbers: number[] = [];
  winningNumbers: number[] = [];
  revealedWinningNumbers: number[] = [];
  matchedNumbers: number[] = [];
  gameStatus: GameStatus = 'idle';
  betAmount = 1;
  currentPayout = 0;
  statusMessage = 'Pick between 1 and 10 spots, then press Play.';
  isAutoPlaying = false;
  autoPlayRounds = 0;
  currentAutoRound = 0;
  autoPlayTotalPayout = 0;

  selectedNumberSet = new Set<number>();
  winningNumberSet = new Set<number>();
  revealedWinningNumberSet = new Set<number>();
  matchedNumberSet = new Set<number>();

  get canPlay(): boolean {
    return this.selectedNumbers.length > 0 && this.selectedNumbers.length <= this.maxSpots && !this.isInteractionLocked;
  }

  get isInteractionLocked(): boolean {
    return this.gameStatus === 'drawing' || this.isAutoPlaying;
  }

  get paytableSpotCount(): number {
    return this.selectedNumbers.length || 10;
  }

  get paytableEntries(): PaytableEntry[] {
    return this.kenoService.getPaytableEntries(this.paytableSpotCount);
  }

  get sortedWinningNumbers(): number[] {
    return [...this.winningNumbers].sort((left, right) => left - right);
  }

  toggleNumber(value: number): void {
    if (this.isInteractionLocked) {
      return;
    }

    this.resetRoundState();

    if (this.selectedNumberSet.has(value)) {
      this.selectedNumbers = this.selectedNumbers.filter((number) => number !== value);
    } else {
      if (this.selectedNumbers.length >= this.maxSpots) {
        this.statusMessage = 'Maximum of 10 spots reached. Remove one number to pick a new spot.';
        return;
      }

      this.selectedNumbers = [...this.selectedNumbers, value].sort((left, right) => left - right);
    }

    this.selectedNumberSet = new Set(this.selectedNumbers);
    this.statusMessage = this.selectedNumbers.length === 0
      ? 'Pick between 1 and 10 spots, then press Play.'
      : `${this.selectedNumbers.length} spot${this.selectedNumbers.length === 1 ? '' : 's'} selected.`;
  }

  quickPick(): void {
    if (this.isInteractionLocked) {
      return;
    }

    this.resetRoundState();
    this.selectedNumbers = this.kenoService.quickPick(this.maxSpots);
    this.selectedNumberSet = new Set(this.selectedNumbers);
    this.statusMessage = 'Quick Pick loaded 10 random spots.';
  }

  clearBoard(): void {
    if (this.isInteractionLocked) {
      return;
    }

    this.selectedNumbers = [];
    this.selectedNumberSet.clear();
    this.currentPayout = 0;
    this.betAmount = Math.max(1, Math.floor(this.betAmount || 1));
    this.isAutoPlaying = false;
    this.autoPlayRounds = 0;
    this.currentAutoRound = 0;
    this.autoPlayTotalPayout = 0;
    this.resetRoundState();
    this.statusMessage = 'Board cleared. Pick new spots to start again.';
  }

  normalizeBet(): void {
    this.betAmount = Math.max(1, Math.floor(Number(this.betAmount) || 1));
  }

  async play(): Promise<void> {
    if (!this.canPlay) {
      return;
    }

    this.normalizeBet();
    this.autoPlayRounds = 0;
    this.currentAutoRound = 0;
    this.autoPlayTotalPayout = 0;
    await this.runRound();
  }

  async startAutoPlay(rounds: 5 | 10): Promise<void> {
    if (!this.canPlay) {
      return;
    }

    this.normalizeBet();
    this.isAutoPlaying = true;
    this.autoPlayRounds = rounds;
    this.currentAutoRound = 0;
    this.autoPlayTotalPayout = 0;

    for (let round = 1; round <= rounds; round += 1) {
      this.currentAutoRound = round;
      await this.runRound(round, rounds);

      if (round < rounds) {
        await this.delay(350);
      }
    }

    this.isAutoPlaying = false;
    this.statusMessage = `Auto play finished: ${rounds} rounds completed for a total return of ${this.autoPlayTotalPayout.toLocaleString()}x.`;
  }

  isPaytableHit(matchCount: number): boolean {
    return this.gameStatus === 'results' && this.matchedNumbers.length === matchCount;
  }

  getTileClasses(value: number): Record<string, boolean> {
    const isSelected = this.selectedNumberSet.has(value);
    const isRevealed = this.revealedWinningNumberSet.has(value);
    const isWinning = this.winningNumberSet.has(value);
    const isMatched = this.matchedNumberSet.has(value);

    return {
      selected: isSelected && !(this.gameStatus === 'drawing' && isRevealed) && !isMatched,
      drawing: this.gameStatus === 'drawing' && isRevealed,
      hit: this.gameStatus === 'results' && isMatched,
      miss: this.gameStatus === 'results' && isWinning && !isSelected
    };
  }

  trackByNumber(_index: number, value: number): number {
    return value;
  }

  private async runRound(currentRound?: number, totalRounds?: number): Promise<void> {
    this.gameStatus = 'drawing';
    this.currentPayout = 0;
    this.winningNumbers = this.kenoService.drawWinningNumbers();
    this.winningNumberSet = new Set(this.winningNumbers);
    this.revealedWinningNumbers = [];
    this.revealedWinningNumberSet.clear();
    this.matchedNumbers = [];
    this.matchedNumberSet.clear();
    this.statusMessage = currentRound && totalRounds
      ? `Auto play ${currentRound}/${totalRounds}: revealing winning numbers...`
      : 'Revealing winning numbers...';

    for (const winningNumber of this.winningNumbers) {
      this.revealedWinningNumbers = [...this.revealedWinningNumbers, winningNumber];
      this.revealedWinningNumberSet = new Set(this.revealedWinningNumbers);
      this.matchedNumbers = this.kenoService.getMatchedNumbers(this.selectedNumbers, this.revealedWinningNumbers);
      this.matchedNumberSet = new Set(this.matchedNumbers);
      await this.delay(100);
    }

    this.matchedNumbers = this.kenoService.getMatchedNumbers(this.selectedNumbers, this.winningNumbers);
    this.matchedNumberSet = new Set(this.matchedNumbers);
    this.currentPayout = this.kenoService.calculatePayout(this.selectedNumbers.length, this.matchedNumbers.length, this.betAmount);
    this.autoPlayTotalPayout += this.currentPayout;
    this.gameStatus = 'results';
    this.statusMessage = this.currentPayout > 0
      ? `You matched ${this.matchedNumbers.length} and returned ${this.currentPayout.toLocaleString()}x.`
      : `You matched ${this.matchedNumbers.length}. No payout on this round.`;
  }

  private resetRoundState(): void {
    this.gameStatus = 'idle';
    this.winningNumbers = [];
    this.revealedWinningNumbers = [];
    this.matchedNumbers = [];
    this.currentPayout = 0;
    this.winningNumberSet.clear();
    this.revealedWinningNumberSet.clear();
    this.matchedNumberSet.clear();
  }

  private delay(duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }
}
