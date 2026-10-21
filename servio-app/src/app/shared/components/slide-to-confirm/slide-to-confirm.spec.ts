// slide to confirm tests
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SLIDE_CONFIRM_THRESHOLD, SlideToConfirmComponent, slideReleaseConfirms } from './slide-to-confirm.component';
import { vi } from 'vitest';

describe('slide to authorize', () => {
  it('only authorizes beyond 90% of the track', () => {
    expect(SLIDE_CONFIRM_THRESHOLD).toBe(0.9);
    expect(slideReleaseConfirms(0.6)).toBe(false);
    expect(slideReleaseConfirms(0.9)).toBe(false);
    expect(slideReleaseConfirms(0.91)).toBe(true);
  });

  describe('pointer interaction', () => {
    let fixture: ComponentFixture<SlideToConfirmComponent>;
    let component: SlideToConfirmComponent;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [SlideToConfirmComponent] });
      fixture = TestBed.createComponent(SlideToConfirmComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      Object.defineProperty(component.trackEl.nativeElement, 'clientWidth', { configurable: true, value: 300 });
      Object.defineProperty(fixture.nativeElement.querySelector('.thumb'), 'setPointerCapture', { value: vi.fn() });
    });

    afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

    it('captures the pointer on the thumb even when its icon is the event target', () => {
      const thumb = fixture.nativeElement.querySelector('.thumb') as HTMLButtonElement;
      const capture = vi.mocked(thumb.setPointerCapture);
      component.onDown({ currentTarget: thumb, target: thumb.querySelector('ion-icon'), pointerId: 7, clientX: 20 } as unknown as PointerEvent);
      expect(capture).toHaveBeenCalledWith(7);
      expect(component.dragging()).toBe(true);
    });

    it('confirms when the thumb is dragged beyond the release threshold', () => {
      vi.useFakeTimers();
      const confirmed = vi.spyOn(component.confirmed, 'emit');
      component.onDown({ currentTarget: fixture.nativeElement.querySelector('.thumb'), pointerId: 7, clientX: 20 } as unknown as PointerEvent);
      component.onMove({ clientX: 250 } as PointerEvent);
      component.onUp();
      expect(component.progress()).toBeGreaterThan(SLIDE_CONFIRM_THRESHOLD);
      expect(component.done()).toBe(true);
      vi.advanceTimersByTime(380);
      expect(confirmed).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });
  });
});
