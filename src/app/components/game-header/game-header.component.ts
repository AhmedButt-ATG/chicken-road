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

  private timerId: number | undefined;
  now = new Date();

  ngOnInit() {
    this.timerId = window.setInterval(() => {
      this.now = new Date();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
    }
  }

  get timeLabel(): string {
    return this.now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  get currentLabel(): string {
    if (this.revealedTiles === 0) {
      return '0.00x';
    }
    return `${this.currentMultiplier.toFixed(2)}x`;
  }
}