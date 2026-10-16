import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonHeader, IonIcon, IonToolbar, ToastController } from '@ionic/angular';
import { AddressService } from '../../core/services/address.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

interface SettingItem {
  label: string;
  caption: string;
  icon: string;
  tint: string;
  ink: string;
  route?: string;
  action?: 'customer' | 'pro' | 'upgrade';
}

@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrl: 'profile.page.scss',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, AvatarComponent, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly addresses = inject(AddressService);
  private readonly toasts = inject(ToastController);
  private readonly alerts = inject(AlertController);

  readonly orders = inject(OrderService);
  readonly mock = this.auth.settings.useMockApi;
  readonly liveMetrics = computed(() => [
    { value: String(this.orders.history().length + (this.orders.isActive() ? 1 : 0)), label: 'Bookings', icon: 'document-text-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
    { value: String(this.orders.history().length), label: 'Completed', icon: 'checkmark-circle-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
  ]);
  readonly metrics = [
    { value: '12', label: 'Requests', icon: 'document-text-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
    { value: '28', label: 'Jobs Done', icon: 'checkmark-circle-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
    { value: '5.0', label: 'Rating', icon: 'star-outline', tint: 'var(--servio-amber-surface)', ink: '#B45309' },
    { value: '14', label: 'Reviews', icon: 'chatbubbles-outline', tint: 'var(--servio-cat-tech)', ink: '#7C3AED' },
  ];

  readonly services = [
    { name: 'Academic Tutoring', detail: 'Math, English, test prep', pricePhp: 350, unit: 'hr', icon: 'school-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
    { name: 'General Handyman', detail: 'Assembly, minor fixes', pricePhp: 400, unit: 'hr', icon: 'construct-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
    { name: 'Grocery Pickup', detail: 'Purchases paid separately', pricePhp: 150, unit: 'errand', icon: 'cart-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
  ];

  readonly settings = computed<SettingItem[]>(() => {
    const isPro = this.auth.user()?.role === 'PRO';
    const hasApprovedPro = this.auth.pro()?.kycStatus === 'APPROVED';
    const list: SettingItem[] = [
      { label: 'Saved Addresses', caption: 'Pin your home or work on the map', icon: 'location-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00', route: '/addresses' },
      { label: 'My Requests & Bookings', caption: 'Active and past orders', icon: 'receipt-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00', route: '/tabs/tracking' },
      { label: 'Saved Helpers', caption: 'Neighbors you trust', icon: 'heart-outline', tint: 'var(--servio-cat-beauty)', ink: '#DB2777', route: '/tabs/directory' },
      { label: 'Payment Methods (GCash / Card)', caption: 'Escrow-protected payments', icon: 'card-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
      { label: 'Help & Community Safety', caption: 'Disputes, safety and support', icon: 'shield-checkmark-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
    ];

    if (isPro) {
      list.push(
        {
          label: 'Servio Pro Dashboard',
          caption: 'Manage jobs, availability and earnings',
          icon: 'swap-horizontal-outline',
          tint: 'var(--servio-cat-tech)',
          ink: '#7C3AED',
          route: '/pro',
        },
        {
          label: 'Switch to Customer Mode',
          caption: 'Browse helpers and book services as a customer',
          icon: 'person-outline',
          tint: 'var(--servio-cat-errands)',
          ink: '#059669',
          action: 'customer',
        },
      );
    } else if (hasApprovedPro) {
      list.push({
        label: 'Switch to Servio Pro',
        caption: 'Return to your Pro dashboard and jobs',
        icon: 'swap-horizontal-outline',
        tint: 'var(--servio-cat-tech)',
        ink: '#7C3AED',
        action: 'pro',
      });
    } else {
      list.push({
        label: 'Become a Servio Pro',
        caption: 'Accept jobs and track earnings on SERVIO',
        icon: 'swap-horizontal-outline',
        tint: 'var(--servio-cat-tech)',
        ink: '#7C3AED',
        action: 'upgrade',
      });
    }
    return list;
  });

  edit(): void { void this.router.navigateByUrl('/profile/edit'); }
  ionViewWillEnter(): void { void this.auth.refreshProfile(true); void this.addresses.refresh().catch(() => undefined); }

  async openNotifications(): Promise<void> {
    const toast = await this.toasts.create({
      message: 'You have no new notifications.',
      duration: 2000,
      position: 'top',
    });
    await toast.present();
  }

  async open(item: SettingItem): Promise<void> {
    if (item.action === 'customer') {
      try {
        await this.auth.switchRole('CUSTOMER');
        const toast = await this.toasts.create({ message: 'Switched to Customer mode.', duration: 2000, position: 'top' });
        await toast.present();
      } catch (err) {
        const toast = await this.toasts.create({ message: err instanceof Error ? err.message : 'Could not switch mode.', duration: 2500, position: 'top' });
        await toast.present();
      }
      return;
    }
    if (item.action === 'pro') {
      try {
        await this.auth.switchRole('PRO');
        const toast = await this.toasts.create({ message: 'Switched to Servio Pro mode.', duration: 2000, position: 'top' });
        await toast.present();
        void this.router.navigateByUrl('/pro');
      } catch (err) {
        const toast = await this.toasts.create({ message: err instanceof Error ? err.message : 'Could not switch to Pro mode.', duration: 2500, position: 'top' });
        await toast.present();
      }
      return;
    }
    if (item.action === 'upgrade') {
      const alert = await this.alerts.create({
        header: 'Switch to Servio Pro',
        subHeader: 'Become a Service Provider',
        message: 'Activate your Pro account to accept local jobs, manage your availability, and track your earnings on SERVIO.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Activate & Switch',
            handler: async () => {
              try {
                await this.auth.upgradeToPro();
                const toast = await this.toasts.create({ message: 'Welcome to Servio Pro! You are now in Pro mode.', duration: 2200, position: 'top' });
                await toast.present();
                void this.router.navigateByUrl('/pro');
              } catch (err) {
                const toast = await this.toasts.create({ message: err instanceof Error ? err.message : 'Could not activate Servio Pro.', duration: 3000, position: 'top' });
                await toast.present();
              }
            },
          },
        ],
      });
      await alert.present();
      return;
    }
    if (item.route) {
      this.router.navigateByUrl(item.route);
      return;
    }
    const toast = await this.toasts.create({ message: `${item.label} is not part of this prototype yet.`, duration: 1800, position: 'top' });
    await toast.present();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
