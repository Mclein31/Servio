// search filter
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-search-filter',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search" role="search">
      <ion-icon name="search-outline" class="lead" aria-hidden="true"></ion-icon>
      <input type="search" [placeholder]="placeholder" [attr.aria-label]="placeholder" (input)="onInput($event)" enterkeyhint="search" autocomplete="off" />
    </div>
  `,
  styles: `
    :host { display: block; }
    .search {
      display: flex;
      align-items: center;
      height: 48px;
      padding: 0 16px;
      border-radius: 24px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .search:focus-within { border-color: #FF5C00; box-shadow: 0 0 0 3px rgba(255, 92, 0, 0.12); }
    .lead { flex: 0 0 auto; font-size: 20px; color: #6B7280; }
    input {
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
      margin: 0 0 0 10px;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 14px;
      color: #111827;
    }
    input::placeholder { color: #9CA3AF; }
    input::-webkit-search-cancel-button { -webkit-appearance: none; }
  `,
})
export class SearchFilterComponent {
  @Input() placeholder = 'Search services, skills, or neighbors…';
  @Output() searchChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
