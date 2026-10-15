import { formatPhLocal, PH_MOBILE_PATTERN } from './auth.service';

describe('Philippine mobile input', () => {
  it('formats 9171234567 as 917 123 4567', () => {
    expect(formatPhLocal('9171234567')).toBe('917 123 4567');
    expect(formatPhLocal('9171')).toBe('917 1');
  });

  it('accepts only 10-digit numbers starting with 9', () => {
    expect(PH_MOBILE_PATTERN.test('9171234567')).toBe(true);
    expect(PH_MOBILE_PATTERN.test('8171234567')).toBe(false);
    expect(PH_MOBILE_PATTERN.test('917123456')).toBe(false);
  });
});
