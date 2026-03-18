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
  isControlPanelCollapsed = false;
  private readonly kenoService = inject(KenoService);
  readonly boardNumbers = this.kenoService.getBoardNumbers();
  readonly maxSpots = 10;
  
  selectedNumbers: number[] = [];
  winningNumbers: number[] = [];
  revealedWinningNumbers: number[] = [];
  matchedNumbers: number[] = [];
  gameStatus: GameStatus = 'idle';
  betAmount = 1;
  currentPayout = 0;
  statusMessage = 'SELECT UP TO 10 SPOTS';
  balance = 1000;
  isAutoPlaying = false;
  currentAutoRound = 0;
  autoPlayRounds = 0;
  autoPlayTotalPayout = 0;

  selectedNumberSet = new Set<number>();
  winningNumberSet = new Set<number>();
  revealedWinningNumberSet = new Set<number>();
  matchedNumberSet = new Set<number>();

  get canPlay(): boolean { return this.selectedNumbers.length > 0 && !this.isInteractionLocked; }
  get isInteractionLocked(): boolean { return this.gameStatus === 'drawing' || this.isAutoPlaying; }
  get paytableSpotCount(): number { return this.selectedNumbers.length || 10; }
  get paytableEntries(): PaytableEntry[] { return this.kenoService.getPaytableEntries(this.paytableSpotCount); }

  toggleNumber(value: number): void {
    if (this.isInteractionLocked) return;
    this.resetRoundState();
    if (this.selectedNumberSet.has(value)) {
      this.selectedNumbers = this.selectedNumbers.filter(n => n !== value);
    } else if (this.selectedNumbers.length < this.maxSpots) {
      this.selectedNumbers = [...this.selectedNumbers, value].sort((a,b) => a-b);
    }
    this.selectedNumberSet = new Set(this.selectedNumbers);
    this.statusMessage = `${this.selectedNumbers.length} SPOTS ACTIVE`;
  }

  quickPick(): void {
    if (this.isInteractionLocked) return;
    this.resetRoundState();
    this.selectedNumbers = this.kenoService.quickPick(this.maxSpots);
    this.selectedNumberSet = new Set(this.selectedNumbers);
  }

  clearBoard(): void {
    if (this.isInteractionLocked) return;
    this.selectedNumbers = [];
    this.selectedNumberSet.clear();
    this.resetRoundState();
    this.statusMessage = 'SELECT UP TO 10 SPOTS';
  }

  async play(): Promise<void> {
    if (!this.canPlay) return;
    this.isAutoPlaying = false;
    await this.runRound();
  }

  async startAutoPlay(rounds: number): Promise<void> {
    if (!this.canPlay) return;
    this.isAutoPlaying = true;
    this.autoPlayRounds = rounds;
    for (let i = 1; i <= rounds; i++) {
      this.currentAutoRound = i;
      await this.runRound(i, rounds);
      if (i < rounds) await new Promise(r => setTimeout(r, 400));
    }
    this.isAutoPlaying = false;
  }

  private async runRound(current?: number, total?: number): Promise<void> {
    this.gameStatus = 'drawing';
    this.winningNumbers = this.kenoService.drawWinningNumbers();
    this.winningNumberSet = new Set(this.winningNumbers);
    this.revealedWinningNumbers = [];
    this.revealedWinningNumberSet.clear();
    
    for (const num of this.winningNumbers) {
      this.revealedWinningNumbers.push(num);
      this.revealedWinningNumberSet.add(num);
      this.matchedNumbers = this.kenoService.getMatchedNumbers(this.selectedNumbers, this.revealedWinningNumbers);
      this.matchedNumberSet = new Set(this.matchedNumbers);
      await new Promise(r => setTimeout(r, 80)); // Snappy stagger
    }

    this.currentPayout = this.kenoService.calculatePayout(this.selectedNumbers.length, this.matchedNumbers.length, this.betAmount);
    this.gameStatus = 'results';
    this.statusMessage = this.currentPayout > 0 ? `WIN: ${this.currentPayout}x!` : `NO MATCH`;
  }

  private resetRoundState() {
    this.gameStatus = 'idle';
    this.winningNumbers = [];
    this.revealedWinningNumbers = [];
    this.matchedNumbers = [];
    this.winningNumberSet.clear();
    this.revealedWinningNumberSet.clear();
    this.matchedNumberSet.clear();
  }

  getTileClasses(value: number) {
    const isSelected = this.selectedNumberSet.has(value);
    const isRevealed = this.revealedWinningNumberSet.has(value);
    const isMatched = isSelected && isRevealed;
    return {
      'tile-selected': isSelected && !isRevealed,
      'tile-drawing': isRevealed && !isSelected,
      'tile-hit': isMatched,
      'tile-miss': this.gameStatus === 'results' && isRevealed && !isSelected
    };
  }

  trackByNumber(index: number, value: number) { return value; }
    isPaytableHit(matchCount: number): boolean {
    return this.gameStatus === 'results' && this.matchedNumbers.length === matchCount;
  }
}