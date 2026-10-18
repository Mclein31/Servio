import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AppComponent } from './app.component';
describe('AppComponent preload timing',()=>{
  const events=new Subject<NavigationEnd>();
  beforeEach(()=>{vi.useFakeTimers();TestBed.configureTestingModule({providers:[{provide:Router,useValue:{events,navigated:false}}]});});
  afterEach(()=>{TestBed.resetTestingModule();vi.useRealTimers();});
  it('ends the branded preload at two seconds even if navigation is slow',()=>{
    const app=TestBed.runInInjectionContext(()=>new AppComponent());
    vi.advanceTimersByTime(1999);expect(app.launching()).toBe(true);
    vi.advanceTimersByTime(1);expect(app.launching()).toBe(false);expect(app.pageReady()).toBe(false);
    events.next(new NavigationEnd(1,'/','/tabs/home'));expect(app.pageReady()).toBe(true);
  });
  it('keeps a ready page behind the preload for exactly two seconds',()=>{
    const app=TestBed.runInInjectionContext(()=>new AppComponent());
    events.next(new NavigationEnd(1,'/','/onboarding'));
    expect(app.launching()).toBe(true);vi.advanceTimersByTime(2000);expect(app.launching()).toBe(false);
  });
});
