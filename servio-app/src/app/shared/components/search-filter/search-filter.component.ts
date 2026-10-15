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
      <button type="button" class="filter" (click)="filterClick.emit()"
        [attr.aria-label]="selectedFilterCount > 0 ? 'Filters, ' + selectedFilterCount + ' active' : 'Filters'">
        <ion-icon name="options-outline" aria-hidden="true"></ion-icon>
        @if (selectedFilterCount > 0) {
          <span class="dot" aria-hidden="true"></span>
        }
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .search {
      display: flex;
      align-items: center;
      height: 48px;
      padding: 0 4px 0 16px;
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
      margin: 0 8px 0 10px;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 14px;
      color: #111827;
    }
    input::placeholder { color: #9CA3AF; }
    input::-webkit-search-cancel-button { -webkit-appearance: none; }
    .filter {
      position: relative;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: #FFF2E8;
      color: #B64000;
      font-size: 20px;
      cursor: pointer;
    }
    .dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #FF5C00;
      border: 1.5px solid #FFFFFF;
    }
  `,
})
export class SearchFilterComponent {
  @Input() placeholder = 'Search services, skills, or neighbors…';
  @Input() selectedFilterCount = 0;
  @Output() searchChange = new EventEmitter<string>();
  @Output() filterClick = new EventEmitter<void>();

  onInput(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
