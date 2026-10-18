import { inject, Injectable, InjectionToken } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { ApiService } from '../api/api.service';

export const PHONE_DIALER = new InjectionToken<(url: string) => void>('Phone dialer', {
  providedIn: 'root', factory: () => (url) => { window.location.href = url; },
});

@Injectable({ providedIn: 'root' })
export class BookingCallService {
  private readonly api = inject(ApiService);
  private readonly alerts = inject(AlertController);
  private readonly dial = inject(PHONE_DIALER);
  private calling = false;

  async call(bookingId: string): Promise<void> {
    if (this.calling) return;
    this.calling = true;
    try {
      const contact = this.api.settings.useMockApi() ? { phoneNumber: null }
        : await this.api.get<{ phoneNumber: string | null }>(`/bookings/${encodeURIComponent(bookingId)}/contact`);
      const phone = contact.phoneNumber?.trim();
      if (!phone || !/^\+?[0-9]{7,15}$/.test(phone)) {
        await this.show('Call not available. User did not add his number');
        return;
      }
      this.dial(`tel:${phone}`);
    } catch {
      await this.show('Could not connect the call. Please try again.');
    } finally { this.calling = false; }
  }

  private async show(message: string): Promise<void> {
    const alert = await this.alerts.create({ header: 'Call not available', message, buttons: ['OK'] });
    await alert.present();
  }
}
