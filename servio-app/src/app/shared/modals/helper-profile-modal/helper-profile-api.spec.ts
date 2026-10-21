// helper profile booking api tests
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiSettingsService } from '../../../core/api/api-settings.service';
import { ProDto } from '../../../core/api/customer.models';
import { CommunityService } from '../../../core/services/community.service';
import { AuthService } from '../../../core/services/auth.service';
import { HelperProfileModalComponent } from './helper-profile-modal.component';

const apiUrl = 'https://servio-api.mcleinonza0531.workers.dev/api/v1';
const pro: ProDto = {
  id: '11111111-1111-4111-8111-111111111111', name: 'API Provider', avatarKey: null,
  headline: 'Repairs', bio: 'Verified provider', credentials: [], yearsExperience: 3, jobsDone: 5,
  rating: 5, ratingCount: 2, isOnline: true, distanceKm: 1, fromPriceCentavos: 110000,
  skus: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Repair Visit', categoryId: 'repairs',
    priceCentavos: 110000, unit: 'visit', durationLabel: '1 hour', inclusions: ['Inspection'] }], reviews: [],
};

describe('API-backed provider booking with offline fallback disabled', () => {
  let http: HttpTestingController;
  const navigate = vi.fn(); const dismiss = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: ApiSettingsService, useValue: { ready: Promise.resolve(), useMockApi: signal(false), apiUrl: signal(apiUrl) } },
      { provide: AuthService, useValue: { user: signal({ id: 'customer' }), settings: { useMockApi: () => false } } },
      { provide: Router, useValue: { navigate } }, { provide: ModalController, useValue: { dismiss } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });
  it('renders an API provider and passes real UUIDs and the selected SKU to checkout', async () => {
    const load = TestBed.inject(CommunityService).directory();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    http.expectOne(`${apiUrl}/pros`).flush({ pros: [pro] }); await load;
    const fixture = TestBed.createComponent(HelperProfileModalComponent);
    fixture.componentRef.setInput('helperId', pro.id); fixture.detectChanges();
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('API Provider');
    const button = fixture.nativeElement.querySelector('button.pill-btn');
    expect(button.disabled).toBe(false); button.click(); await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/checkout'], { queryParams: { helper: pro.id, sku: pro.skus[0].id } });
    expect(dismiss).toHaveBeenCalledOnce();
  });
  it('shows API errors and retries without silently dismissing', async () => {
    const fixture = TestBed.createComponent(HelperProfileModalComponent);
    fixture.componentRef.setInput('helperId', pro.id); fixture.detectChanges();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    http.expectOne(`${apiUrl}/pros`).flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    await vi.waitFor(() => expect(fixture.componentInstance.error()).not.toBe(''));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy(); expect(dismiss).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button.pill-btn').click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    http.expectOne(`${apiUrl}/pros`).flush({ pros: [pro] });
    await vi.waitFor(() => expect(fixture.componentInstance.helper()?.id).toBe(pro.id));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('API Provider');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
