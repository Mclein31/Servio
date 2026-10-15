import { Pipe, PipeTransform } from '@angular/core';
import { formatPhp } from '../utils/money';

/**
 * `{{ 1100 | php }}` → ₱1,100.00 · `{{ 350 | php:'whole' }}` → ₱350 · `{{ 350 | php:'signed' }}` → +₱350.00
 * Wrap the output in an element with class `price` so it never line-wraps.
 */
@Pipe({ name: 'php' })
export class PhpPipe implements PipeTransform {
  transform(value: number | null | undefined, mode?: 'whole' | 'signed'): string {
    if (value === null || value === undefined) return '';
    return formatPhp(value, { whole: mode === 'whole', signed: mode === 'signed' });
  }
}
