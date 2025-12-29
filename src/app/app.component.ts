import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Tile {
  id: number;
  revealed: boolean;
  isMine: boolean;
  row: number;
  col: number;
}

interface GameState {
  isPlaying: boolean;
  gameOver: boolean;
  won: boolean;
  revealedTiles: number;
  currentMultiplier: number;
  potentialPayout: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Mines';
  
  // Game settings
  balance = 5000.00;
  betAmount = 2.00;
  numberOfMines = 3;
  gridSize = 5;
  
  // Game state
  gameState: GameState = {
    isPlaying: false,
    gameOver: false,
    won: false,
    revealedTiles: 0,
    currentMultiplier: 0,
    potentialPayout: 0
  };
  
  tiles: Tile[] = [];
  minePositions: number[] = [];
  
  // UI state
  soundEnabled = true;
  musicEnabled = true;
  
  // Grid size options
  gridSizes = [3, 5, 7, 9];
  mineOptions = [1, 2, 3, 4];
  
  ngOnInit() {
    this.initializeGrid();
  }
  
  initializeGrid() {
    this.tiles = [];
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        this.tiles.push({
          id: row * this.gridSize + col,
          revealed: false,
          isMine: false,
          row,
          col
        });
      }
    }
  }
  
  placeMines() {
    this.minePositions = [];
    const totalTiles = this.gridSize * this.gridSize;
    
    while (this.minePositions.length < this.numberOfMines) {
      const position = Math.floor(Math.random() * totalTiles);
      if (!this.minePositions.includes(position)) {
        this.minePositions.push(position);
        this.tiles[position].isMine = true;
      }
    }
  }
  
  calculateMultiplier(revealedTiles: number): number {
    if (revealedTiles === 0) return 0;
    
    const totalTiles = this.gridSize * this.gridSize;
    const safeTiles = totalTiles - this.numberOfMines;
    
    // Calculate multiplier based on revealed safe tiles
    const multiplier = Math.pow(totalTiles / (totalTiles - this.numberOfMines), revealedTiles);
    return Math.round(multiplier * 100) / 100;
  }
  
  startGame() {
    if (this.betAmount > this.balance) {
      alert('Insufficient balance!');
      return;
    }
    
    this.balance -= this.betAmount;
    this.gameState = {
      isPlaying: true,
      gameOver: false,
      won: false,
      revealedTiles: 0,
      currentMultiplier: 0,
      potentialPayout: this.betAmount
    };
    
    this.initializeGrid();
    this.placeMines();
  }
  
  revealTile(tile: Tile) {
    if (!this.gameState.isPlaying || tile.revealed || this.gameState.gameOver) {
      return;
    }
    
    tile.revealed = true;
    
    if (tile.isMine) {
      // Game over - reveal all mines
      this.gameState.gameOver = true;
      this.gameState.isPlaying = false;
      this.tiles.forEach(t => {
        if (t.isMine) t.revealed = true;
      });
    } else {
      // Safe tile
      this.gameState.revealedTiles++;
      this.gameState.currentMultiplier = this.calculateMultiplier(this.gameState.revealedTiles);
      this.gameState.potentialPayout = this.betAmount * this.gameState.currentMultiplier;
      
      // Check if all safe tiles are revealed
      const totalSafeTiles = (this.gridSize * this.gridSize) - this.numberOfMines;
      if (this.gameState.revealedTiles === totalSafeTiles) {
        this.cashOut();
      }
    }
  }
  
  cashOut() {
    if (!this.gameState.isPlaying) return;
    
    this.balance += this.gameState.potentialPayout;
    this.gameState.isPlaying = false;
    this.gameState.won = true;
  }
  
  resetGame() {
    this.gameState = {
      isPlaying: false,
      gameOver: false,
      won: false,
      revealedTiles: 0,
      currentMultiplier: 0,
      potentialPayout: 0
    };
    this.initializeGrid();
  }
  
  adjustBet(amount: number) {
    this.betAmount = Math.max(0.01, this.betAmount + amount);
    this.betAmount = Math.round(this.betAmount * 100) / 100;
  }
  
  setGridSize(size: number) {
    if (!this.gameState.isPlaying) {
      this.gridSize = size;
      this.initializeGrid();
    }
  }
  
  setMineCount(count: number) {
    if (!this.gameState.isPlaying) {
      this.numberOfMines = count;
    }
  }
  
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
  }
  
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
  }
  
  getMultiplierDisplay(index: number): string {
    const multipliers = [
      this.calculateMultiplier(1),
      this.calculateMultiplier(2),
      this.calculateMultiplier(3),
      this.calculateMultiplier(4),
      this.calculateMultiplier(5)
    ];
    return multipliers[index] ? `${multipliers[index].toFixed(2)}x` : '0.00x';
  }
  
  trackByTileId(index: number, tile: Tile): number {
    return tile.id;
  }
}
