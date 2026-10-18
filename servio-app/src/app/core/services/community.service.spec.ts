import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CommunityService } from './community.service';
import { DiscoveryLocationService } from './discovery-location.service';
import { ApiService } from '../api/api.service';
describe('nonblocking discovery loading',()=>{
 const get=vi.fn();const imageUrl=vi.fn();const point=signal<{lat:number;lng:number;at:number}|null>(null);
 const refreshGranted=vi.fn();
 beforeEach(()=>{vi.resetAllMocks();point.set(null);TestBed.configureTestingModule({providers:[
  {provide:ApiService,useValue:{settings:{ready:Promise.resolve(),useMockApi:()=>false},get,imageUrl}},
  {provide:DiscoveryLocationService,useValue:{point,query:()=>point()?{lat:point()!.lat,lng:point()!.lng}:{},refreshGranted}},
 ]});});afterEach(()=>TestBed.resetTestingModule());
 it('loads discovery without waiting for a slow GPS fix',async()=>{
  let resolve!:()=>void;refreshGranted.mockReturnValue(new Promise<void>(r=>resolve=r));
  get.mockImplementation(async(path:string)=>path==='/catalog'?{skus:[],addons:[],trustFeeCentavos:5000,cancellationFees:{}}:path==='/pros'?{pros:[]}:{requests:[]});
  const community=TestBed.inject(CommunityService);await community.refresh();
  expect(get).toHaveBeenCalledWith('/pros',{});expect(community.loading()).toBe(false);resolve();
 });
 it('renders helper data before its avatar finishes and hides distances after location expiry',async()=>{
  let resolve!:(url:string)=>void;imageUrl.mockReturnValue(new Promise<string>(r=>resolve=r));
  point.set({lat:17.61,lng:121.72,at:Date.now()});
  get.mockResolvedValue({pros:[{id:'pro',name:'Helper',avatarKey:'avatar',headline:'Tutor',rating:5,ratingCount:1,distanceKm:1.2,
   fromPriceCentavos:35000,isOnline:true,credentials:[],skus:[],reviews:[],jobsDone:1,yearsExperience:2}]});
  const community=TestBed.inject(CommunityService);await community.directory();
  expect(community.helpers()[0].name).toBe('Helper');expect(community.helpers()[0].distanceKm).toBe(1.2);
  point.set(null);expect(community.helpers()[0].distanceKm).toBe(Infinity);
  resolve('signed-photo');await vi.waitFor(()=>expect(community.helpers()[0].avatarUrl).toBe('signed-photo'));
 });
});
