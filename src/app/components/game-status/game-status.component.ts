import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState } from '../control-panel/control-panel.component';

@Component({
  selector: 'app-game-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-status.component.html',
  styleUrl: './game-status.component.scss'
})
export class GameStatusComponent {
  @Input() gameState!: GameState;
}