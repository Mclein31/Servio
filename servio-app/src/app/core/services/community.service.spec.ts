import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CommunityService } from './community.service';
import { DiscoveryLocationService } from './discovery-location.service';
import { ApiService } from '../api/api.service';
describe('nonblocking discovery loading',()=>{
 const get=vi.fn();const post=vi.fn();const imageUrl=vi.fn();const point=signal<{lat:number;lng:number;at:number}|null>(null);
 const refresh=vi.fn();
 beforeEach(()=>{vi.resetAllMocks();point.set(null);TestBed.configureTestingModule({providers:[
  {provide:ApiService,useValue:{settings:{ready:Promise.resolve(),useMockApi:()=>false},get,post,imageUrl}},
  {provide:DiscoveryLocationService,useValue:{point,query:()=>point()?{lat:point()!.lat,lng:point()!.lng}:{},refresh}},
 ]});});afterEach(()=>TestBed.resetTestingModule());
 it('loads discovery without waiting for a slow saved address refresh',async()=>{
  let resolve!:()=>void;refresh.mockReturnValue(new Promise<void>(r=>resolve=r));
  get.mockImplementation(async(path:string)=>path==='/catalog'?{skus:[],addons:[],trustFeeCentavos:5000,cancellationFees:{}}:path==='/pros'?{pros:[]}:{requests:[]});
  const community=TestBed.inject(CommunityService);await community.refresh();
  expect(get).toHaveBeenCalledWith('/pros',{});expect(community.loading()).toBe(false);resolve();
 });
 it('renders helper data before its avatar finishes and hides distances when the saved pin is removed',async()=>{
  let resolve!:(url:string)=>void;imageUrl.mockReturnValue(new Promise<string>(r=>resolve=r));
  point.set({lat:17.61,lng:121.72,at:Date.now()});
  get.mockResolvedValue({pros:[{id:'pro',name:'Helper',avatarKey:'avatar',headline:'Tutor',rating:5,ratingCount:1,distanceKm:1.2,
   fromPriceCentavos:35000,isOnline:true,credentials:[],skus:[],reviews:[],jobsDone:1,yearsExperience:2}]});
  const community=TestBed.inject(CommunityService);await community.directory();
  expect(community.helpers()[0].name).toBe('Helper');expect(community.helpers()[0].distanceKm).toBe(1.2);
  point.set(null);expect(community.helpers()[0].distanceKm).toBe(Infinity);
  resolve('signed-photo');await vi.waitFor(()=>expect(community.helpers()[0].avatarUrl).toBe('signed-photo'));
 });
 it('refreshes both lists after the saved pin changes and rejects results for the previous pin',async()=>{
  point.set({lat:17.61,lng:121.72,at:Date.now()});
  let resolveOld!:(value:unknown)=>void;
  get.mockImplementation((path:string,query:Record<string,number>)=>{
   if(path==='/pros' && query['lat']===17.61)return new Promise(resolve=>resolveOld=resolve);
   return Promise.resolve(path==='/pros'?{pros:[]}:{requests:[]});
  });
  const community=TestBed.inject(CommunityService);
  const old=community.directory();await community.bulletin();
  TestBed.tick();
  point.set({lat:17.8,lng:121.9,at:Date.now()});TestBed.tick();
  await vi.waitFor(()=>expect(get).toHaveBeenCalledWith('/pros',{lat:17.8,lng:121.9}));
  expect(get).toHaveBeenCalledWith('/bulletin',{lat:17.8,lng:121.9});
  resolveOld({pros:[{id:'stale'}]});await old;
  expect(community.helpers()).toEqual([]);
 });
 it('keeps the server-confirmed Bulletin reservation instead of waiting for a feed refresh',async()=>{
  get.mockResolvedValue({requests:[{id:'request',authorId:'customer',skuId:'sku',acceptedProId:null,bookingId:null,title:'Repair',description:'Leak',categoryId:'repairs',
   author:'Customer',createdAt:new Date().toISOString(),neighborhood:'Ugac Norte',distanceKm:null,priceCentavos:1000,unit:'job',status:'OPEN',lat:null,lng:null}]});
  post.mockResolvedValue({request:{id:'request',status:'ACCEPTED',acceptedProId:'current-pro',bookingId:null}});
  const community=TestBed.inject(CommunityService);
  await community.bulletin();
  await community.acceptRequest('request');
  expect(community.requests()[0]).toMatchObject({id:'request',status:'ACCEPTED',acceptedProId:'current-pro',bookingId:null});
 });
 it('updates a cancelled Bulletin request from the mutation response without refetching the feed',async()=>{
  get.mockResolvedValue({requests:[{id:'request',authorId:'customer',skuId:'sku',acceptedProId:'pro',bookingId:null,title:'Repair',description:'Leak',categoryId:'repairs',
   author:'Customer',createdAt:new Date().toISOString(),neighborhood:'Ugac Norte',distanceKm:null,priceCentavos:1000,unit:'job',status:'ACCEPTED',lat:null,lng:null}]});
  post.mockResolvedValue({request:{id:'request',status:'CANCELLED',acceptedProId:null,bookingId:null}});
  const community=TestBed.inject(CommunityService);
  await community.bulletin();
  await community.cancelRequest('request');
  expect(community.requests()[0]).toMatchObject({id:'request',status:'CANCELLED',acceptedProId:null});
  expect(get).toHaveBeenCalledTimes(1);
 });

});
