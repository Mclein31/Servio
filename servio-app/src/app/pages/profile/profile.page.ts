import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonToolbar, ToastController } from '@ionic/angular';
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
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastController);

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

  readonly settings: SettingItem[] = [
    { label: 'My Requests & Bookings', caption: 'Active and past orders', icon: 'receipt-outline', tint: 'var(--servio-cat-repairs)', ink: '#D04A00', route: '/tabs/tracking' },
    { label: 'Saved Helpers', caption: 'Neighbors you trust', icon: 'heart-outline', tint: 'var(--servio-cat-beauty)', ink: '#DB2777', route: '/tabs/directory' },
    { label: 'Payment Methods (GCash / Card)', caption: 'Escrow-protected payments', icon: 'card-outline', tint: 'var(--servio-cat-errands)', ink: '#059669' },
    { label: 'Help & Community Safety', caption: 'Disputes, safety and support', icon: 'shield-checkmark-outline', tint: 'var(--servio-cat-tutoring)', ink: '#2563EB' },
    { label: 'Switch to Servio Pro', caption: 'Accept jobs and track earnings', icon: 'swap-horizontal-outline', tint: 'var(--servio-cat-tech)', ink: '#7C3AED', route: '/pro' },
  ];

  async open(item: SettingItem): Promise<void> {
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
