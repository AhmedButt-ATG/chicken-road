import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface GameState {
  isPlaying: boolean;
  gameOver: boolean;
  won: boolean;
  revealedTiles: number;
  currentMultiplier: number;
  potentialPayout: number;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss'
})
export class ControlPanelComponent {
  @Input() balance: number = 0;
  @Input() betAmount: number = 0;
  @Input() numberOfMines: number = 0;
  @Input() gridSize: number = 0;
  @Input() gameState!: GameState;
  @Input() soundEnabled: boolean = true;
  @Input() musicEnabled: boolean = true;
  @Input() mineOptions: number[] = [];
  @Input() gridSizes: number[] = [];

  @Output() startGame = new EventEmitter<void>();
  @Output() cashOut = new EventEmitter<void>();
  @Output() resetGame = new EventEmitter<void>();
  @Output() adjustBet = new EventEmitter<number>();
  @Output() setMineCount = new EventEmitter<number>();
  @Output() setGridSize = new EventEmitter<number>();
  @Output() toggleSound = new EventEmitter<void>();
  @Output() toggleMusic = new EventEmitter<void>();

  onStartGame() {
    this.startGame.emit();
  }

  onCashOut() {
    this.cashOut.emit();
  }

  onResetGame() {
    this.resetGame.emit();
  }

  onAdjustBet(amount: number) {
    this.adjustBet.emit(amount);
  }

  onSetMineCount(count: number) {
    this.setMineCount.emit(count);
  }

  onSetGridSize(size: number) {
    this.setGridSize.emit(size);
  }

  onToggleSound() {
    this.toggleSound.emit();
  }

  onToggleMusic() {
    this.toggleMusic.emit();
  }
}