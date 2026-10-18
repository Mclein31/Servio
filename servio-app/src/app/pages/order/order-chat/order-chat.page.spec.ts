import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {Location} from '@angular/common';
import {ActivatedRoute,convertToParamMap} from '@angular/router';
import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {OrderChatPage} from './order-chat.page';
import {OrderService} from '../../../core/services/order.service';
import {AuthService} from '../../../core/services/auth.service';
import {TrackingService} from '../../../core/services/tracking.service';
import {LiveService,LiveEvent} from '../../../core/services/live.service';
import {BookingCallService} from '../../../core/services/booking-call.service';
import {MessageDto} from '../../../core/api/customer.models';
const first:MessageDto={id:'m1',senderId:'customer',body:'Hello',photoKey:null,createdAt:'2026-10-18T10:00:00Z'};
const second:MessageDto={...first,id:'m2',senderId:'pro',body:'On my way',createdAt:'2026-10-18T10:00:01Z'};
describe('incremental live chat',()=>{
 let page:OrderChatPage;let events:Subject<LiveEvent>;
 const get=vi.fn(),post=vi.fn(),imageUrl=vi.fn(),leave=vi.fn(),watch=vi.fn();
 beforeEach(()=>{
  vi.resetAllMocks();events=new Subject();watch.mockReturnValue(leave);get.mockResolvedValue({messages:[first],nextCursor:null});
  TestBed.configureTestingModule({providers:[
   {provide:OrderService,useValue:{order:signal({id:'booking',customerId:'customer'}),isActive:()=>true,api:{get,post,imageUrl,settings:{useMockApi:()=>false}}}},
   {provide:AuthService,useValue:{user:signal({id:'customer',role:'CUSTOMER'})}},{provide:TrackingService,useValue:{}},
   {provide:LiveService,useValue:{events,watch}},{provide:Location,useValue:{}},{provide:BookingCallService,useValue:{}},
   {provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({id:'booking'})}}},
  ]});page=TestBed.runInInjectionContext(()=>new OrderChatPage());
 });
 afterEach(()=>{page.ionViewDidLeave();TestBed.resetTestingModule();});
 const enter=async()=>{page.ionViewWillEnter();await vi.waitFor(()=>expect(page.messages()).toHaveLength(1));};
 it('delivers websocket messages immediately without fetching history again',async()=>{
  await enter();events.next({resource:'booking:booking',type:'message',message:second});
  expect(page.messages().map(m=>m.text)).toEqual(['Hello','On my way']);expect(get).toHaveBeenCalledTimes(1);
  events.next({resource:'booking:other',type:'message',message:{...second,id:'other'}});expect(page.messages()).toHaveLength(2);
 });
 it('fetches only missed messages after the REST cursor on reconnect',async()=>{
  await enter();get.mockResolvedValue({messages:[second],nextCursor:null});
  events.next({resource:'booking:booking',type:'connected'});
  await vi.waitFor(()=>expect(page.messages()).toHaveLength(2));
  expect(get).toHaveBeenLastCalledWith('/bookings/booking/messages',{after:'m1'});
 });
 it('shows the committed send response without another GET and deduplicates its live echo',async()=>{
  await enter();page.draft.set('  Sent text  ');const sent={...second,id:'m3',senderId:'customer',body:'Sent text'};
  post.mockResolvedValue({message:sent});await page.send();
  expect(page.draft()).toBe('');expect(get).toHaveBeenCalledTimes(1);expect(page.messages()).toHaveLength(2);
  events.next({resource:'booking:booking',type:'message',message:sent});expect(page.messages()).toHaveLength(2);
 });
 it('keeps the draft after a failed send',async()=>{
  await enter();page.draft.set('Please come to gate 2');post.mockRejectedValue(new Error('Network failed'));await page.send();
  expect(page.draft()).toBe('Please come to gate 2');expect(page.saving()).toBe(false);expect(page.error()).toBe('Network failed');
 });
 it('refreshes expired photo URLs on reentry even with an empty history delta',async()=>{
  const clock=vi.spyOn(Date,'now');clock.mockReturnValue(100000);
  try {
   get.mockResolvedValue({messages:[{...first,photoKey:'photo'}],nextCursor:null});imageUrl.mockResolvedValueOnce('signed-first');
   await enter();await vi.waitFor(()=>expect(page.messages()[0].photoUrl).toBe('signed-first'));
   page.ionViewDidLeave();clock.mockReturnValue(161000);imageUrl.mockResolvedValue('signed-new');
   get.mockResolvedValue({messages:[],nextCursor:null});page.ionViewWillEnter();
   await vi.waitFor(()=>expect(page.messages()[0].photoUrl).toBe('signed-new'));expect(imageUrl).toHaveBeenCalledTimes(2);
  } finally {clock.mockRestore();}
 });
 it('does not block text history behind a slow photo URL',async()=>{
  get.mockResolvedValue({messages:[{...first,photoKey:'photo'}],nextCursor:null});imageUrl.mockReturnValue(new Promise(()=>{}));
  await enter();expect(page.messages()[0].text).toBe('Hello');expect(page.messages()[0].photoUrl).toBeUndefined();
 });
});
