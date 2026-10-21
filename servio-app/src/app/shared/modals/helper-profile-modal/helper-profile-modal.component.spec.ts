// helper profile modal tests
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { CommunityService } from '../../../core/services/community.service';
import { AuthService } from '../../../core/services/auth.service';
import { HELPERS } from '../../../core/data/mock-data';
import { HelperProfileModalComponent } from './helper-profile-modal.component';

describe('helper profile booking', () => {
  const directory = vi.fn();
  const dismiss = vi.fn();
  const navigate = vi.fn();
  const helpers = signal(HELPERS);
  beforeEach(() => {
    vi.resetAllMocks(); helpers.set(HELPERS);
    TestBed.configureTestingModule({ providers: [
      { provide: CommunityService, useValue: { helpers, directory } },
      { provide: AuthService, useValue: { user: signal(null), settings: { useMockApi: () => false } } },
      { provide: ModalController, useValue: { dismiss } },
      { provide: Router, useValue: { navigate } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('opens an already displayed helper without another network request', async () => {
    directory.mockRejectedValue(new Error('Network unavailable'));
    const page = TestBed.runInInjectionContext(() => new HelperProfileModalComponent());
    page.helperId = HELPERS[0].id;
    await page.ngOnInit();
    expect(page.helper()?.id).toBe(HELPERS[0].id);
    expect(directory).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    page.chosen.set(HELPERS[0].skus[1]);
    await page.bookService();
    expect(navigate).toHaveBeenCalledWith(['/checkout'], { queryParams: { helper: HELPERS[0].id, sku: HELPERS[0].skus[1].id } });
  });
  it('keeps a failed profile open with a recoverable error', async () => {
    helpers.set([]); directory.mockRejectedValue(new Error('Network unavailable'));
    const page = TestBed.runInInjectionContext(() => new HelperProfileModalComponent());
    await page.ngOnInit();
    expect(dismiss).not.toHaveBeenCalled();
    expect(page.helper()).toBeNull();
    await page.bookService();
    expect(navigate).not.toHaveBeenCalled();
  });
});
