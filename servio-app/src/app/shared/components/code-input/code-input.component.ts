import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  QueryList,
  ViewChildren,
  signal,
} from '@angular/core';

/**
 * Segmented numeric code entry (6-digit SMS OTP, 4-digit completion PIN).
 * Auto-advances on input, retreats on backspace, accepts paste, and emits
 * `completed` once every cell is filled.
 */
@Component({
  selector: 'app-code-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cells" [class.error]="error" [class.large]="size === 'large'" role="group" [attr.aria-label]="label">
      @for (cell of cells(); track $index; let i = $index) {
        <input
          #cellInput
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          [value]="cell"
          [class.filled]="cell !== ''"
          [attr.aria-label]="'Digit ' + (i + 1) + ' of ' + length"
          (input)="onInput(i, $event)"
          (keydown)="onKeydown(i, $event)"
          (paste)="onPaste(i, $event)"
          (focus)="select($event)"
        />
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .cells { display: flex; justify-content: center; gap: 8px; }
    input {
      width: 48px;
      height: 56px;
      padding: 0;
      border-radius: 12px;
      border: 1.5px solid #E5E7EB;
      background: #FFFFFF;
      text-align: center;
      font: inherit;
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      caret-color: #FF5C00;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      box-sizing: border-box;
    }
    input:focus { border-color: #FF5C00; box-shadow: 0 0 0 4px rgba(255, 92, 0, 0.14); }
    input.filled { border-color: #FFC9A6; }
    .large { gap: 12px; }
    .large input { width: 64px; height: 72px; border-radius: 16px; font-size: 32px; }
    .error input { border-color: #EF4444; animation: shake 0.36s ease; }
    @keyframes shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  `,
})
export class CodeInputComponent implements OnInit {
  @Input() length = 6;
  @Input() size: 'default' | 'large' = 'default';
  @Input() error = false;
  @Input() label = 'Verification code';
  @Output() codeChange = new EventEmitter<string>();
  @Output() completed = new EventEmitter<string>();

  @ViewChildren('cellInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly cells = signal<string[]>([]);

  ngOnInit(): void {
    this.cells.set(Array.from({ length: this.length }, () => ''));
  }

  focusFirst(): void {
    setTimeout(() => this.focus(0), 60);
  }

  clear(): void {
    this.cells.set(Array.from({ length: this.length }, () => ''));
    this.inputs.forEach((i) => (i.nativeElement.value = ''));
    this.focusFirst();
  }

  onInput(i: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    if (!digits) {
      el.value = '';
      this.setCell(i, '');
      return;
    }
    if (digits.length > 1) {
      this.fillFrom(i, digits);
      return;
    }
    el.value = digits;
    this.setCell(i, digits);
    if (i < this.length - 1) this.focus(i + 1);
    this.emit();
  }

  onKeydown(i: number, event: KeyboardEvent): void {
    const value = this.cells()[i];
    // Handle hardware digits on keydown so fast typing never races the focus move.
    // Soft keyboards report 'Unidentified' here and are handled by onInput instead.
    if (/^\d$/.test(event.key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      (event.target as HTMLInputElement).value = event.key;
      this.setCell(i, event.key);
      if (i < this.length - 1) this.focus(i + 1);
      this.emit();
      return;
    }
    if (event.key === 'Backspace') {
      if (value) {
        this.setCell(i, '');
        (event.target as HTMLInputElement).value = '';
        this.emit();
      } else if (i > 0) {
        this.setCell(i - 1, '');
        const prev = this.inputs.get(i - 1)?.nativeElement;
        if (prev) prev.value = '';
        this.focus(i - 1);
        this.emit();
      }
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' && i > 0) {
      this.focus(i - 1);
    } else if (event.key === 'ArrowRight' && i < this.length - 1) {
      this.focus(i + 1);
    }
  }

  onPaste(i: number, event: ClipboardEvent): void {
    const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!digits) return;
    event.preventDefault();
    this.fillFrom(i, digits);
  }

  select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private fillFrom(start: number, digits: string): void {
    const next = [...this.cells()];
    let i = start;
    for (const d of digits) {
      if (i >= this.length) break;
      next[i] = d;
      const el = this.inputs.get(i)?.nativeElement;
      if (el) el.value = d;
      i++;
    }
    this.cells.set(next);
    this.focus(Math.min(i, this.length - 1));
    this.emit();
  }

  private setCell(i: number, v: string): void {
    this.cells.update((c) => c.map((x, idx) => (idx === i ? v : x)));
  }

  private focus(i: number): void {
    this.inputs.get(i)?.nativeElement.focus();
  }

  private emit(): void {
    const code = this.cells().join('');
    this.codeChange.emit(code);
    if (code.length === this.length && this.cells().every((c) => c !== '')) this.completed.emit(code);
  }
}
