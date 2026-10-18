import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ActionSheetController, IonModal } from '@ionic/angular';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BulletinPage } from './bulletin.page';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { SheetsService } from '../../core/services/sheets.service';
import { BulletinRequest } from '../../shared/models/domain.models';

const request: BulletinRequest = { id:'request-1', authorId:'customer', skuId:'sku-1', title:'Math Tutoring', description:'Help with algebra',
  category:'tutoring',author:'Customer',postedAgo:'Just now',neighborhood:'Ugac Norte',distanceKm:Infinity,pricePhp:350,priceUnit:'hr',status:'URGENT' };

describe('Bulletin request interaction', () => {
  const requests = signal<BulletinRequest[]>([]);
  const user = signal({ id:'pro',role:'PRO' });
  const acceptRequest = vi.fn(); const releaseRequest = vi.fn(); const navigate = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks(); requests.set([{...request}]); user.set({id:'pro',role:'PRO'});
    TestBed.configureTestingModule({ providers:[
      {provide:CommunityService,useValue:{requests,acceptRequest,releaseRequest,bulletin:vi.fn().mockResolvedValue(undefined),error:signal('')}},
      {provide:AuthService,useValue:{user}}, {provide:OrderService,useValue:{load:vi.fn()}},
      {provide:Router,useValue:{navigate}}, {provide:SheetsService,useValue:{}},
      {provide:ActionSheetController,useValue:{}}, {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({}))}},
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('opens the actual Bulletin card when tapped or activated with a keyboard', async () => {
    const fixture = TestBed.createComponent(BulletinPage); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('article.request');
    card.click(); fixture.detectChanges();
    expect(fixture.componentInstance.selectedRequest()?.id).toBe(request.id);
    fixture.componentInstance.closeRequest(); fixture.detectChanges();
    card.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    expect(fixture.componentInstance.selectedRequest()?.id).toBe(request.id);
  });
  it('accepts via the API and retains the reservation in the Urgent filter', async () => {
    const page = TestBed.runInInjectionContext(() => new BulletinPage()); page.filter.set('URGENT'); page.openRequest(request);
    acceptRequest.mockImplementation(async () => requests.set([{...request,status:'ACCEPTED',acceptedProId:'pro'}]));
    await page.acceptRequest(request);
    expect(acceptRequest).toHaveBeenCalledWith(request.id);
    expect(page.selectedRequest()?.acceptedProId).toBe('pro');
    expect(page.requests()).toHaveLength(1);
    expect(page.saving()).toBe(false);
  });
  it('shows a failed acceptance instead of navigating or pretending it succeeded', async () => {
    const page = TestBed.runInInjectionContext(() => new BulletinPage()); page.openRequest(request);
    acceptRequest.mockRejectedValue(new Error('Request already accepted'));
    await page.acceptRequest(request);
    expect(page.actionError()).toBe('Request already accepted'); expect(navigate).not.toHaveBeenCalled();
  });
  it('waits for the request modal to dismiss before navigating to checkout', async () => {
    user.set({id:'customer',role:'CUSTOMER'});
    const page = TestBed.runInInjectionContext(() => new BulletinPage());
    let resolve!: () => void;
    page.requestDetails = {dismiss:vi.fn().mockReturnValue(new Promise<void>(r=>resolve=r))} as unknown as IonModal;
    const pending = page.continueRequest({...request,status:'ACCEPTED',acceptedProId:'pro'});
    expect(navigate).not.toHaveBeenCalled();
    resolve(); await pending;
    expect(navigate).toHaveBeenCalledWith(['/checkout'],{queryParams:{bulletin:request.id,helper:'pro',sku:'sku-1'}});
  });
  it('keeps an incoming accepted request visible for its customer and links the exact checkout', async () => {
    user.set({id:'customer',role:'CUSTOMER'});
    const accepted: BulletinRequest = {...request,status:'ACCEPTED',acceptedProId:'pro'}; requests.set([accepted]);
    const page = TestBed.runInInjectionContext(() => new BulletinPage()); page.filter.set('URGENT');
    expect(page.requests()).toHaveLength(1); await page.continueRequest(accepted);
    expect(navigate).toHaveBeenCalledWith(['/checkout'],{queryParams:{bulletin:request.id,helper:'pro',sku:'sku-1'}});
  });
});
