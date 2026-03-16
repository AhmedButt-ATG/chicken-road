import { Injectable } from '@angular/core';

export interface PaytableEntry {
  matches: number;
  multiplier: number;
}

@Injectable({
  providedIn: 'root'
})
export class KenoService {
  private readonly maxBoardNumber = 80;
  private readonly drawCount = 20;

  private readonly paytable: Record<number, Record<number, number>> = {
    1: { 1: 3 },
    2: { 1: 1, 2: 12 },
    3: { 2: 2, 3: 43 },
    4: { 2: 1, 3: 5, 4: 120 },
    5: { 3: 2, 4: 18, 5: 800 },
    6: { 3: 1, 4: 4, 5: 40, 6: 1_600 },
    7: { 0: 1, 3: 1, 4: 10, 5: 80, 6: 400, 7: 5_000 },
    8: { 0: 1, 4: 5, 5: 30, 6: 150, 7: 1_200, 8: 10_000 },
    9: { 0: 1, 4: 2, 5: 15, 6: 80, 7: 500, 8: 4_000, 9: 10_000 },
    10: { 0: 1, 5: 2, 6: 15, 7: 50, 8: 200, 9: 2_500, 10: 10_000 }
  };

  getBoardNumbers(): number[] {
    return Array.from({ length: this.maxBoardNumber }, (_, index) => index + 1);
  }

  drawWinningNumbers(): number[] {
    return this.pickUniqueNumbers(this.drawCount, this.maxBoardNumber);
  }

  quickPick(count = 10): number[] {
    return this.pickUniqueNumbers(Math.min(count, 10), this.maxBoardNumber).sort((left, right) => left - right);
  }

  getMatchedNumbers(selectedNumbers: readonly number[], winningNumbers: readonly number[]): number[] {
    const winningSet = new Set(winningNumbers);
    return [...selectedNumbers]
      .filter((value) => winningSet.has(value))
      .sort((left, right) => left - right);
  }

  getPaytableEntries(spotCount: number): PaytableEntry[] {
    const table = this.paytable[spotCount] ?? {};

    return Object.entries(table)
      .map(([matches, multiplier]) => ({
        matches: Number(matches),
        multiplier
      }))
      .sort((left, right) => left.matches - right.matches);
  }

  calculatePayout(spotCount: number, matchCount: number, betAmount = 1): number {
    const multiplier = this.paytable[spotCount]?.[matchCount] ?? 0;
    return multiplier * Math.max(1, betAmount);
  }

  private pickUniqueNumbers(count: number, maxNumber: number): number[] {
    const pool = Array.from({ length: maxNumber }, (_, index) => index + 1);

    for (let current = pool.length - 1; current > 0; current -= 1) {
      const randomIndex = Math.floor(Math.random() * (current + 1));
      [pool[current], pool[randomIndex]] = [pool[randomIndex], pool[current]];
    }

    return pool.slice(0, count);
  }
}
