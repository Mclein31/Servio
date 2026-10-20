import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { LiveService } from './live.service';
import { OrderService } from './order.service';

export type NotificationKind = 'BOOKING' | 'MESSAGE' | 'ADDON' | 'OFFER' | 'BULLETIN' | 'REVIEW';
export interface AppNotification { id: string; kind: NotificationKind; title: string; body: string; route: string | null; bookingId: string | null; readAt: string | null; createdAt: string }
interface InboxDto { notifications: AppNotification[]; unreadCount: number }

/**
 * Server inbox + header badge. On phones, new notifications that arrive over the live socket while the
 * app is in the background are also shown as free local system notifications (no Firebase/APNs). A fully
 * closed app receives nothing until reopened; the inbox then catches up.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);
  readonly items = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly hasUnread = computed(() => this.unreadCount() > 0);
  readonly loading = signal(false);
  readonly error = signal('');
  private revision = 0;
  /** Notifications already seen by this device session; only newer unread ones become system alerts. */
  private known = new Set<string>();
  /** False until the first inbox load, which only records what already exists. */
  private primed = false;
  private foreground = true;
  private localReady?: Promise<boolean>;
  private localId = 1;
  /** Unread notifications that were new in the latest refresh (system-alerted when backgrounded). */
  lastFresh: AppNotification[] = [];

  constructor() {
    const owner = computed(() => this.api.settings.useMockApi() ? '' : this.auth.user()?.id ?? '');
    effect((cleanup) => {
      const userId = owner();
      untracked(() => { this.revision++; this.items.set([]); this.unreadCount.set(0); this.error.set(''); this.known = new Set(); this.primed = false; });
      if (!/^[0-9a-f-]{36}$/.test(userId)) return;
      untracked(() => { void this.refresh(); void this.prepareLocal(); });
      // OrderService holds the personal room open; reuse its events instead of a second socket.
      const subscription = this.live.events.subscribe((event) => {
        if (event.resource === `user:${userId}` && ['notification', 'connected'].includes(event.type)) void this.refresh();
      });
      cleanup(() => subscription.unsubscribe());
    });
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => { this.foreground = isActive; });
      void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        const extra = notification.extra as { id?: string; route?: string | null; bookingId?: string | null } | undefined;
        if (extra?.id) void this.open({ id: extra.id, route: extra.route ?? null, bookingId: extra.bookingId ?? null });
      });
    }
  }

  async refresh(): Promise<void> {
    if (this.api.settings.useMockApi() || !this.auth.user()) return;
    const revision = ++this.revision;
    this.loading.set(true);
    try {
      const inbox = await this.api.get<InboxDto>('/notifications', { limit: 50 });
      if (revision !== this.revision) return;
      const fresh = this.primed ? inbox.notifications.filter((n) => !n.readAt && !this.known.has(n.id)) : [];
      for (const n of inbox.notifications) this.known.add(n.id);
      this.primed = true;
      this.items.set(inbox.notifications); this.unreadCount.set(inbox.unreadCount); this.error.set('');
      this.lastFresh = fresh;
      if (fresh.length && !this.foreground) void this.alert(fresh);
    } catch (error) { if (revision === this.revision) this.error.set(error instanceof Error ? error.message : 'Could not load notifications.'); }
    finally { if (revision === this.revision) this.loading.set(false); }
  }

  async markAllRead(): Promise<void> { await this.mark({ all: true }); }
  /** Opening a chat reads its message notifications. */
  async markBooking(bookingId: string, kind?: NotificationKind): Promise<void> {
    if (!this.items().some((n) => !n.readAt && n.bookingId === bookingId && (!kind || n.kind === kind))) return;
    await this.mark({ bookingId, ...(kind ? { kind } : {}) });
  }

  async open(notification: Pick<AppNotification, 'id' | 'route' | 'bookingId'>): Promise<void> {
    if (notification.id) void this.mark({ ids: [notification.id] }).catch(() => undefined);
    // Booking screens show OrderService's selected booking; select this one before navigating.
    if (notification.bookingId) await this.orders.load(notification.bookingId).catch(() => undefined);
    const route = notification.route && /^\/[A-Za-z0-9/_-]*$/.test(notification.route) ? notification.route : '/tabs/home';
    await this.router.navigateByUrl(route);
  }

  private async mark(body: Record<string, unknown>): Promise<void> {
    if (this.api.settings.useMockApi()) return;
    const now = new Date().toISOString();
    const matches = (n: AppNotification) => body['all'] === true || (body['ids'] as string[] | undefined)?.includes(n.id) === true
      || (n.bookingId === body['bookingId'] && (!body['kind'] || n.kind === body['kind']));
    const changed = this.items().filter((n) => !n.readAt && matches(n)).length;
    this.items.update((items) => items.map((n) => !n.readAt && matches(n) ? { ...n, readAt: now } : n));
    // Optimistic badge; the server count below is authoritative (it includes rows beyond the loaded page).
    this.unreadCount.set(body['all'] === true ? 0 : Math.max(0, this.unreadCount() - changed));
    const revision = this.revision;
    const result = await this.api.post<{ unreadCount: number }>('/notifications/read', body);
    if (revision === this.revision) this.unreadCount.set(result.unreadCount);
  }

  /** Asks once for permission to show system notifications; free on Android and iOS (no push service). */
  private prepareLocal(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
    this.localReady ??= (async () => {
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({ id: 'servio', name: 'SERVIO updates', description: 'Bookings, messages and job requests', importance: 5, visibility: 1 });
      }
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
    })().catch(() => false);
    return this.localReady;
  }

  private async alert(items: AppNotification[]): Promise<void> {
    if (!(await this.prepareLocal())) return;
    await LocalNotifications.schedule({ notifications: items.slice(0, 5).map((n) => ({
      id: this.localId++, title: n.title, body: n.body, channelId: 'servio',
      extra: { id: n.id, route: n.route, bookingId: n.bookingId },
    })) }).catch(() => undefined);
  }
}
