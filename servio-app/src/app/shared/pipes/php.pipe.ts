// peso format pipe
import { Pipe, PipeTransform } from '@angular/core';
import { formatPhp } from '../utils/money';

@Pipe({ name: 'php' })
export class PhpPipe implements PipeTransform {
  transform(value: number | null | undefined, mode?: 'whole' | 'signed'): string {
    if (value === null || value === undefined) return '';
    return formatPhp(value, { whole: mode === 'whole', signed: mode === 'signed' });
  }
}
