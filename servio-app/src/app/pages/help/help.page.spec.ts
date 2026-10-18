import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { vi } from 'vitest';
import { ApiService } from '../../core/api/api.service';
import { HelpPage } from './help.page';
describe('support report submission',()=>{
  const post=vi.fn();
  beforeEach(()=>{vi.resetAllMocks();TestBed.configureTestingModule({providers:[{provide:Location,useValue:{}},{provide:ApiService,useValue:{settings:{useMockApi:()=>false},post}}]});});
  afterEach(()=>TestBed.resetTestingModule());
  it('keeps the message on failure and reuses the retry key',async()=>{
    const page=TestBed.runInInjectionContext(()=>new HelpPage());page.message.set('The service is not working.');
    post.mockRejectedValueOnce(new Error('Network failed'));
    await page.submit();expect(page.message()).toBe('The service is not working.');expect(page.error()).toBe('Network failed');
    const key=post.mock.calls[0][1].clientKey;
    post.mockResolvedValueOnce({request:{id:'report-1',category:'BOOKING',message:page.message(),status:'OPEN',createdAt:new Date().toISOString()}});
    await page.submit();expect(post.mock.calls[1][1].clientKey).toBe(key);expect(page.requests()).toHaveLength(1);expect(page.message()).toBe('');
  });
});
