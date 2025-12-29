import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-header.component.html',
  styleUrl: './game-header.component.scss'
})
export class GameHeaderComponent {
  @Input() currentMultiplier: number = 0;
  @Input() betAmount: number = 0;
  @Input() revealedTiles: number = 0;
  @Input() multiplierDisplay: string[] = [];
}