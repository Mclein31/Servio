import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonHeader, IonIcon, IonToolbar, ToastController } from '@ionic/angular';
import { AddressService } from '../../core/services/address.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { CATEGORIES } from '../../core/data/mock-data';
import { CommunityService } from '../../core/services/community.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PhpPipe } from '../../shared/pipes/php.pipe';

interface SettingItem {
  label: string;
  caption: string;
  icon: string;
  tint: string;
  ink: string;
  route?: string;
  action?: 'customer' | 'pro' | 'upgrade' | 'trade';
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
  readonly community = inject(CommunityService);

  readonly orders = inject(OrderService);
  readonly mock = this.auth.settings.useMockApi;
  readonly liveMetrics = computed(() => {
    const history = this.orders.history();
    const completedCount = history.filter((h) => h.status === 'COMPLETED').length;
    return [
      { value: String(history.length + (this.orders.isActive() ? 1 : 0)), label: 'Bookings', icon: 'document-text-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
      { value: String(completedCount), label: 'Completed', icon: 'checkmark-circle-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
    ];
  });
  readonly metrics = [
    { value: '12', label: 'Requests', icon: 'document-text-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
    { value: '28', label: 'Jobs Done', icon: 'checkmark-circle-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
    { value: '5.0', label: 'Rating', icon: 'star-outline', tint: 'var(--servio-amber-surface)', ink: '#B45309' },
    { value: '14', label: 'Reviews', icon: 'chatbubbles-outline', tint: 'var(--servio-cat-tech)', ink: '#7C3AED' },
  ];

  private readonly sampleServices = [
    { id:'sample-tutor', name: 'Academic Tutoring', detail: 'Math, English, test prep', pricePhp: 350, unit: 'hr', icon: 'school-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
    { id:'sample-handyman', name: 'General Handyman', detail: 'Assembly, minor fixes', pricePhp: 400, unit: 'hr', icon: 'construct-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00' },
    { id:'sample-errands', name: 'Grocery Pickup', detail: 'Purchases paid separately', pricePhp: 150, unit: 'errand', icon: 'cart-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
  ];

  readonly tradeSaving = signal(false);
  readonly currentCategory = computed(() => this.community.skus().find((s) => this.auth.pro()?.skuIds?.includes(s.id))?.category);
  readonly services = computed(() => {
    if (this.mock()) return this.sampleServices;
    const ids = this.auth.pro()?.skuIds ?? [];
    return this.community.skus().filter((s) => ids.includes(s.id)).map((s) => {
      const category = CATEGORIES.find((c) => c.id === s.category)!;
      return { id:s.id, name: s.name, detail: s.inclusions.join(', '), pricePhp: s.pricePhp, unit: s.unit, icon: category.icon, tint: category.tint, ink: category.accent };
    });
  });

  readonly settings = computed<SettingItem[]>(() => {
    const isPro = this.auth.user()?.role === 'PRO';
    const hasApprovedPro = this.auth.pro()?.kycStatus === 'APPROVED';
    const list: SettingItem[] = [
      { label: 'Saved Addresses', caption: 'Pin your home or work on the map', icon: 'location-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00', route: '/addresses' },
      { label: 'My Requests & Bookings', caption: 'Active and past orders', icon: 'receipt-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00', route: '/tabs/tracking' },
      { label: 'Saved Helpers', caption: 'Neighbors you trust', icon: 'heart-outline', tint: 'var(--servio-cat-beauty)', ink: '#DB2777', route: '/tabs/directory' },
      { label: 'Payment Methods (GCash / Card)', caption: 'Choose your preferred checkout method', route: '/payment-methods', icon: 'card-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
      { label: 'Help & Community Safety', caption: 'Disputes, safety and support', route: '/help', icon: 'shield-checkmark-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
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
          label: 'Change Service Category',
          caption: 'Update the trade and services you provide',
          icon: 'construct-outline',
          tint: 'var(--servio-cat-repairs)',
          ink: '#D04A00',
          action: 'trade',
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

  readonly removingService = signal('');
  async removeService(id:string):Promise<void>{
    if(this.removingService())return;
    this.removingService.set(id);
    try{
      if(this.mock())throw new Error('Connect to SERVIO to remove a service.');
      const result=await this.community.api.request<{skuIds:string[]}>('DELETE',`/me/services/${encodeURIComponent(id)}`);
      this.auth.pro.update(p=>p?{...p,skuIds:result.skuIds}:p);
      await this.community.refresh(false);
    }catch(error){const toast=await this.toasts.create({message:error instanceof Error?error.message:'Could not remove service.',duration:3000,position:'top'});await toast.present();}
    finally{this.removingService.set('');}
  }
  manageServices(): void {
    void this.open({ label: 'Change Service Category', caption: '', icon: '', tint: '', ink: '', action: 'trade' });
  }
  edit(): void { void this.router.navigateByUrl('/profile/edit'); }
  ionViewWillEnter(): void { void this.auth.refreshProfile(true); void this.community.catalog().catch(() => undefined); void this.addresses.refresh().catch(() => undefined); }

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
        header: 'Become a Servio Pro',
        subHeader: 'Select your trade category',
        message: 'Choose the primary service category you offer to neighbors:',
        inputs: [
          { name: 'category', type: 'radio', label: 'Repairs & Maintenance', value: 'repairs', checked: true },
          { name: 'category', type: 'radio', label: 'Academic Tutoring', value: 'tutoring' },
          { name: 'category', type: 'radio', label: 'Errands & Delivery', value: 'errands' },
          { name: 'category', type: 'radio', label: 'Beauty & Care', value: 'beauty' },
          { name: 'category', type: 'radio', label: 'Tech Help & Diagnostics', value: 'tech' },
        ],
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Activate & Switch',
            handler: async (selectedCategory) => {
              const category = typeof selectedCategory === 'string'
                ? selectedCategory
                : (selectedCategory?.category || selectedCategory?.value || 'repairs');
              try {
                await this.auth.upgradeToPro(category);
                void this.community.refresh();
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
    if (item.action === 'trade') {
      if (this.tradeSaving()) return;
      try { await this.community.catalog(); } catch {
        const toast = await this.toasts.create({ message: 'Could not load your services. Try again.', duration: 2500, position: 'top' });
        await toast.present(); return;
      }
      const alert = await this.alerts.create({
        header: 'Change Service Category',
        subHeader: 'Select your primary trade',
        message: 'Update which services you provide in the neighborhood directory:',
        inputs: [
          { name: 'category', type: 'radio', label: 'Repairs & Maintenance', value: 'repairs', checked: this.currentCategory() === 'repairs' },
          { name: 'category', type: 'radio', label: 'Academic Tutoring', value: 'tutoring', checked: this.currentCategory() === 'tutoring' },
          { name: 'category', type: 'radio', label: 'Errands & Delivery', value: 'errands', checked: this.currentCategory() === 'errands' },
          { name: 'category', type: 'radio', label: 'Beauty & Care', value: 'beauty', checked: this.currentCategory() === 'beauty' },
          { name: 'category', type: 'radio', label: 'Tech Help & Diagnostics', value: 'tech', checked: this.currentCategory() === 'tech' },
        ],
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Update Category',
            handler: async (selectedCategory) => {
              const category = typeof selectedCategory === 'string'
                ? selectedCategory
                : (selectedCategory?.category || selectedCategory?.value);
              if (!category || this.tradeSaving()) return false;
              this.tradeSaving.set(true);
              try {
                await this.auth.updateTrade(category);
                await this.community.refresh();
                const toast = await this.toasts.create({ message: 'Service category updated successfully.', duration: 2000, position: 'top' });
                await toast.present();
              } catch (err) {
                const toast = await this.toasts.create({ message: err instanceof Error ? err.message : 'Could not update category.', duration: 2500, position: 'top' });
                await toast.present();
                return false;
              } finally { this.tradeSaving.set(false); }
              return true;
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
