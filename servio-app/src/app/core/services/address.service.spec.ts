// addresses tests
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { AddressService, SavedAddress } from './address.service';

const home: SavedAddress = {id:'home',label:'Home',street:'Entrance by the market',barangay:'Centro 10',city:'Tuguegarao City',landmark:null,lat:17.613,lng:121.727,isDefault:true};
describe('account address book', () => {
  const user=signal({id:'customer'});
  const api={settings:{useMockApi:signal(false)},get:vi.fn(),post:vi.fn(),patch:vi.fn(),request:vi.fn()};
  beforeEach(() => { user.set({id:'customer'}); vi.resetAllMocks(); TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{user}},{provide:ApiService,useValue:api}]}); });
  afterEach(() => TestBed.resetTestingModule());
  it('does not invent a live address; persists the confirmed coordinates and isolates accounts', async () => {
    const book=TestBed.inject(AddressService); TestBed.tick();
    api.get.mockResolvedValue({addresses:[]}); await book.refresh(); expect(book.selected()).toBeNull();
    api.post.mockResolvedValue({address:home});
    const {id: _id,...input}=home; void _id;
    await book.save(input); expect(api.post).toHaveBeenCalledWith('/me/addresses',input); expect(book.selected()?.lat).toBe(17.613);
    user.set({id:'other'}); TestBed.tick(); expect(book.addresses()).toEqual([]); expect(book.selected()).toBeNull();
  });
  it('keeps the first refresh when the identity effect runs after it starts', async () => {
    const book=TestBed.inject(AddressService);
    let resolve!: (data: {addresses:SavedAddress[]}) => void;
    api.get.mockReturnValue(new Promise((r) => resolve=r)); const first=book.refresh(); TestBed.tick();
    resolve({addresses:[home]}); await first; expect(book.addresses()).toEqual([home]);
  });
  it('ignores an old address refresh arriving after a successful pin edit', async () => {
    const book=TestBed.inject(AddressService); TestBed.tick();
    let resolve!: (data: {addresses:SavedAddress[]}) => void;
    api.get.mockReturnValue(new Promise((r) => resolve=r)); const old=book.refresh();
    const changed={...home,lat:17.62}; api.patch.mockResolvedValue({address:changed});
    const {id: _id,...input}=changed; void _id; await book.save(input,home.id);
    resolve({addresses:[home]}); await old; expect(book.selected()?.lat).toBe(17.62);
  });
  it('retains the prior selection on failed saves and ignores a late response after switching users', async () => {
    const book=TestBed.inject(AddressService); TestBed.tick(); api.get.mockResolvedValue({addresses:[home]}); await book.refresh();
    api.patch.mockRejectedValue(new Error('Offline')); const {id: _id,...input}=home; void _id;
    await expect(book.save({...input,lat:17.62},home.id)).rejects.toThrow('Offline'); expect(book.selected()?.lat).toBe(home.lat);
    let resolve!: (data: {addresses:SavedAddress[]}) => void;
    api.get.mockReturnValue(new Promise((r) => resolve=r)); const request=book.refresh(); user.set({id:'other'}); TestBed.tick(); resolve({addresses:[home]}); await request; expect(book.addresses()).toEqual([]);
  });
});
