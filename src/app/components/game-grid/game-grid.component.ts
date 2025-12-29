import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../control-panel/control-panel.component';

export interface Tile {
  id: number;
  revealed: boolean;
  isMine: boolean;
  row: number;
  col: number;
}

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss'
})
export class GameGridComponent {
  @Input() tiles: Tile[] = [];
  @Input() gameState!: GameState;
  @Input() gridSize: number = 5;

  @Output() tileClick = new EventEmitter<Tile>();

  onTileClick(tile: Tile) {
    this.tileClick.emit(tile);
  }

  trackByTileId(index: number, tile: Tile): number {
    return tile.id;
  }
}