// notifications tests
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { LiveEvent, LiveService } from './live.service';
import { AppNotification, NotificationService } from './notification.service';
import { OrderService } from './order.service';

const USER = '00000000-0000-4000-8000-000000000001';
const note = (id: string, extra: Partial<AppNotification> = {}): AppNotification => ({ id, kind: 'MESSAGE', title: 'Your Pro', body: 'Hi', route: '/order/b1/chat', bookingId: 'b1', readAt: null, createdAt: new Date().toISOString(), ...extra });

describe('notification inbox', () => {
  const get = vi.fn(), post = vi.fn(), load = vi.fn(), navigateByUrl = vi.fn();
  let events: Subject<LiveEvent>; let user: ReturnType<typeof signal<{ id: string } | null>>;
  beforeEach(() => {
    vi.resetAllMocks(); events = new Subject(); user = signal<{ id: string } | null>({ id: USER });
    get.mockResolvedValue({ notifications: [note('n1'), note('n2', { kind: 'BOOKING', bookingId: 'b2', route: '/tabs/tracking' })], unreadCount: 3 });
    post.mockResolvedValue({ unreadCount: 2 }); load.mockResolvedValue(undefined); navigateByUrl.mockResolvedValue(true);
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: { get, post, settings: { useMockApi: () => false } } },
      { provide: AuthService, useValue: { user, beforeSignOut: [] } },
      { provide: LiveService, useValue: { events } },
      { provide: OrderService, useValue: { load } },
      { provide: Router, useValue: { navigateByUrl } },
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  const start = async () => {
    const service = TestBed.inject(NotificationService); TestBed.tick();
    await vi.waitFor(() => expect(service.unreadCount()).toBe(3));
    return service;
  };

  it('loads the signed-in inbox and refreshes on live notification events', async () => {
    const service = await start();
    expect(service.hasUnread()).toBe(true); expect(get).toHaveBeenCalledWith('/notifications', { limit: 50 });
    get.mockResolvedValue({ notifications: [], unreadCount: 0 });
    events.next({ resource: `user:${USER}`, type: 'notification' });
    await vi.waitFor(() => expect(service.hasUnread()).toBe(false));
    events.next({ resource: 'user:someone-else', type: 'notification' });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('clears the inbox when the account signs out', async () => {
    const service = await start();
    user.set(null); TestBed.tick();
    expect(service.items()).toEqual([]); expect(service.unreadCount()).toBe(0);
  });

  it('marks a booking’s messages read optimistically and trusts the server count', async () => {
    const service = await start();
    await service.markBooking('b1', 'MESSAGE');
    expect(post).toHaveBeenCalledWith('/notifications/read', { bookingId: 'b1', kind: 'MESSAGE' });
    expect(service.items().find((n) => n.id === 'n1')!.readAt).not.toBeNull();
    expect(service.unreadCount()).toBe(2);
    post.mockClear(); await service.markBooking('b1', 'MESSAGE');
    expect(post).not.toHaveBeenCalled();
  });

  it('opens a notification on its booking and refuses unsafe routes', async () => {
    const service = await start();
    await service.open(note('n2', { bookingId: 'b2', route: '/tabs/tracking' }));
    expect(load).toHaveBeenCalledWith('b2'); expect(navigateByUrl).toHaveBeenCalledWith('/tabs/tracking');
    await service.open({ id: '', route: 'https://evil.example', bookingId: null });
    expect(navigateByUrl).toHaveBeenLastCalledWith('/tabs/home');
  });

  it('treats only notifications that arrive after the first load as new', async () => {
    const service = await start();
    expect(service.lastFresh).toEqual([]);
    get.mockResolvedValue({ notifications: [note('n3'), note('n1'), note('n2', { kind: 'BOOKING' })], unreadCount: 4 });
    events.next({ resource: `user:${USER}`, type: 'notification' });
    await vi.waitFor(() => expect(service.unreadCount()).toBe(4));
    expect(service.lastFresh.map((n) => n.id)).toEqual(['n3']);
  });
});
