import { SLIDE_CONFIRM_THRESHOLD, slideReleaseConfirms } from './slide-to-confirm.component';

describe('slide to authorize', () => {
  it('only authorizes beyond 90% of the track', () => {
    expect(SLIDE_CONFIRM_THRESHOLD).toBe(0.9);
    expect(slideReleaseConfirms(0.6)).toBe(false);
    expect(slideReleaseConfirms(0.9)).toBe(false);
    expect(slideReleaseConfirms(0.91)).toBe(true);
  });
});
