import { Component } from '@angular/core';
import { KenoComponent } from './components/keno/keno.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [KenoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Keno';
}