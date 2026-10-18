import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import type { AlertOptions } from '@ionic/core';
import { vi } from 'vitest';
import { ProfilePage } from './profile.page';
import { AuthService, AppPro } from '../../core/services/auth.service';
import { CommunityService } from '../../core/services/community.service';
import { OrderService } from '../../core/services/order.service';
import { AddressService } from '../../core/services/address.service';

const skus = [{id:'math',name:'Math Tutoring',category:'tutoring',pricePhp:350,unit:'hr',inclusions:['Math']},
  {id:'repair',name:'Repair Visit',category:'repairs',pricePhp:1100,unit:'visit',inclusions:['Inspection']}];
describe('saved service category',()=>{
  const pro = signal<AppPro | null>(null); const updateTrade=vi.fn(); const create=vi.fn();
  beforeEach(()=>{
    vi.resetAllMocks(); pro.set({userId:'pro',isOnline:false,kycStatus:'APPROVED',jobsDone:0,ratingAvg:'5',ratingCount:0,skuIds:['math']});
    create.mockResolvedValue({present:vi.fn()});
    TestBed.configureTestingModule({providers:[
      {provide:AuthService,useValue:{pro,user:signal({id:'pro',role:'PRO'}),settings:{useMockApi:signal(false)},updateTrade}},
      {provide:CommunityService,useValue:{skus:signal(skus),catalog:vi.fn().mockResolvedValue(undefined),refresh:vi.fn().mockResolvedValue(undefined)}},
      {provide:OrderService,useValue:{}},{provide:AddressService,useValue:{}},{provide:Router,useValue:{}},
      {provide:AlertController,useValue:{create}}, {provide:ToastController,useValue:{create:vi.fn().mockResolvedValue({present:vi.fn()})}},
    ]});
  });
  afterEach(()=>TestBed.resetTestingModule());
  it('reopens the saved category and displays actual API offered services',async()=>{
    const page=TestBed.runInInjectionContext(()=>new ProfilePage());
    expect(page.services().map(s=>s.name)).toEqual(['Math Tutoring']);
    await page.open({label:'Trade',caption:'',icon:'',tint:'',ink:'',action:'trade'});
    const options=create.mock.calls[0][0] as AlertOptions;
    expect(options.inputs?.find(i=>i.checked)?.value).toBe('tutoring');
    pro.update(p=>({...p!,skuIds:['repair']}));
    expect(page.currentCategory()).toBe('repairs'); expect(page.services().map(s=>s.name)).toEqual(['Repair Visit']);
  });
  it('keeps the category dialog open when saving fails and resets saving state',async()=>{
    const page=TestBed.runInInjectionContext(()=>new ProfilePage());
    await page.open({label:'Trade',caption:'',icon:'',tint:'',ink:'',action:'trade'});
    const options=create.mock.calls[0][0] as AlertOptions;
    const button=options.buttons?.find(b=>typeof b!=='string' && b.text==='Update Category');
    updateTrade.mockRejectedValue(new Error('Route not found'));
    if(!button || typeof button==='string' || !button.handler) throw Error('Missing update action');
    expect(await button.handler('repairs')).toBe(false);
    expect(updateTrade).toHaveBeenCalledWith('repairs'); expect(page.tradeSaving()).toBe(false);
  });
});
