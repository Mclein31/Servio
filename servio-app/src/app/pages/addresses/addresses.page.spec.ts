import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AddressService } from '../../core/services/address.service';
import { AddressesPage } from './addresses.page';

vi.mock('@capacitor/geolocation',()=>({Geolocation:{getCurrentPosition:vi.fn()}}));

describe('address pin confirmation', () => {
  const book={addresses:signal([]),save:vi.fn()}; const back=vi.fn();
  beforeEach(() => { vi.resetAllMocks(); TestBed.configureTestingModule({providers:[{provide:AddressService,useValue:book},{provide:Location,useValue:{back}},{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:{get:()=> '1'}}}}]}); });
  afterEach(() => TestBed.resetTestingModule());
  it('requires an explicit pin before saving and passes the chosen coordinates', async () => {
    const page=TestBed.runInInjectionContext(() => new AddressesPage()); page.edit(); page.street='Centro 10'; page.barangay='Centro 10';
    await page.save(); expect(book.save).not.toHaveBeenCalled();
    page.selectPin(17.61046,121.72988); book.save.mockResolvedValue(undefined); await page.save();
    expect(book.save).toHaveBeenCalledWith(expect.objectContaining({lat:17.61046,lng:121.72988,city:'Tuguegarao City',isDefault:true}),undefined); expect(back).toHaveBeenCalledOnce();
  });
  it('ignores a GPS result from a closed editor', async () => {
    let resolve!: (fix: Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>) => void;
    const spy=vi.spyOn(Geolocation,'getCurrentPosition').mockReturnValue(new Promise((r) => resolve=r));
    const page=TestBed.runInInjectionContext(() => new AddressesPage()); page.edit(); const pending=page.locate(); page.closeEditor(); page.edit();
    resolve({coords:{latitude:17.61,longitude:121.72,accuracy:10,altitude:null,altitudeAccuracy:null,speed:null,heading:null,magneticHeading:null,trueHeading:null,headingAccuracy:null,course:null},timestamp:Date.now()}); await pending;
    expect(page.pin()).toBeNull(); expect(page.locating()).toBe(false); spy.mockRestore();
  });
  it('retains the selected pin and address text when server validation fails', async () => {
    const page=TestBed.runInInjectionContext(() => new AddressesPage()); page.edit(); page.street='My entrance'; page.barangay='Centro 10'; page.selectPin(17.61,121.72);
    book.save.mockRejectedValue(new Error('Outside service area')); await page.save();
    expect(page.error()).toBe('Outside service area'); expect(page.pin()).toEqual([17.61,121.72]); expect(page.street).toBe('My entrance'); expect(page.editing()).toBe(true); expect(back).not.toHaveBeenCalled();
  });
  it('edits every field and re-pins an existing address under the same id', async () => {
    const page=TestBed.runInInjectionContext(() => new AddressesPage());
    page.edit({id:'a1',label:'Home',street:'Old gate',barangay:'Centro 10',city:'Tuguegarao City',landmark:null,lat:17.61,lng:121.72,isDefault:true});
    expect(page.wasDefault).toBe(true); expect(page.pin()).toEqual([17.61,121.72]);
    page.label='Work'; page.street='New gate'; page.barangay='Ugac Norte'; page.landmark='Blue door'; page.selectPin(17.62,121.73);
    book.save.mockResolvedValue(undefined); await page.save();
    expect(book.save).toHaveBeenCalledWith({label:'Work',street:'New gate',barangay:'Ugac Norte',city:'Tuguegarao City',landmark:'Blue door',lat:17.62,lng:121.73,isDefault:true},'a1');
  });
});
