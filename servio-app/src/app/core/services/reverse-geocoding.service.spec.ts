import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { AddressFields, ReverseGeocodingService } from './reverse-geocoding.service';
import { ApiService } from '../api/api.service';
import { AddressService } from './address.service';
import { AddressesPage } from '../../pages/addresses/addresses.page';

const address = (street:string): AddressFields => ({street,barangay:'Ugac Norte',city:'Tuguegarao City'});

describe('key-free pin address autofill', () => {
  let requests: ((value: AddressFields) => void)[];
  let page: AddressesPage;
  let lookup: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); requests=[];
    lookup=vi.fn(() => new Promise<AddressFields>(resolve => requests.push(resolve)));
    TestBed.configureTestingModule({providers:[
      {provide:AddressService,useValue:{addresses:() => []}}, {provide:Location,useValue:{}},
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:{get:() => null}}}},
      {provide:ReverseGeocodingService,useValue:{lookup}},
    ]});
    page=TestBed.runInInjectionContext(() => new AddressesPage()); page.edit();
  });
  afterEach(() => { page.closeEditor(); TestBed.resetTestingModule(); vi.useRealTimers(); });
  it('debounces pin moves and fills address fields from the latest selection', async () => {
    page.selectPin(17.61,121.72); page.selectPin(17.62,121.73);
    await vi.advanceTimersByTimeAsync(350);
    expect(lookup).toHaveBeenCalledExactlyOnceWith(17.62,121.73);
    requests[0](address('Luna Street')); await Promise.resolve();
    expect(page.street).toBe('Luna Street'); expect(page.barangay).toBe('Ugac Norte'); expect(page.city).toBe('Tuguegarao City'); expect(page.geocoding()).toBe(false);
  });
  it('ignores stale results after another pin move and editor closure', async () => {
    page.selectPin(17.61,121.72); await vi.advanceTimersByTimeAsync(350);
    page.selectPin(17.62,121.73); await vi.advanceTimersByTimeAsync(350);
    requests[1](address('New street')); await Promise.resolve();
    requests[0](address('Old street')); await Promise.resolve(); expect(page.street).toBe('New street');
    page.selectPin(17.63,121.74); await vi.advanceTimersByTimeAsync(350); page.closeEditor();
    requests[2](address('Closed street')); await Promise.resolve(); expect(page.street).not.toBe('Closed street');
  });
  it('allows manual completion when lookup fails', async () => {
    lookup.mockRejectedValue(new Error('offline')); page.selectPin(17.61,121.72);
    await vi.advanceTimersByTimeAsync(350);
    expect(page.geocoding()).toBe(false); expect(page.error()).toContain('Enter the address details manually'); expect(page.pin()).toEqual([17.61,121.72]);
  });
  it('retries a busy shared geocoder once', async () => {
    const get=vi.fn().mockRejectedValueOnce(new HttpErrorResponse({status:429})).mockResolvedValue(address('Street'));
    TestBed.resetTestingModule(); TestBed.configureTestingModule({providers:[{provide:ApiService,useValue:{get}}]});
    const pending=TestBed.inject(ReverseGeocodingService).lookup(17.61,121.72);
    await vi.advanceTimersByTimeAsync(1200);
    expect(await pending).toEqual(address('Street')); expect(get).toHaveBeenCalledTimes(2);
  });
  it('uses the authenticated SERVIO API rather than a Google key', async () => {
    const get=vi.fn().mockResolvedValue(address('Street'));
    TestBed.resetTestingModule(); TestBed.configureTestingModule({providers:[{provide:ApiService,useValue:{get}}]});
    await TestBed.inject(ReverseGeocodingService).lookup(17.61,121.72);
    expect(get).toHaveBeenCalledWith('/locations/reverse',{lat:17.61,lng:121.72});
  });
});
