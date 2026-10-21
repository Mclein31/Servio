// demo connection
import { inject, Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DemoConnectionService {
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly auth = inject(AuthService);
  readonly available = environment.demo;

  async open(): Promise<void> {
    if (!this.available) return;
    await this.auth.settings.ready;
    const save = async (apiUrl: string, useMockApi: boolean) => {
      try {
        await this.auth.settings.configure({ apiUrl, useMockApi }); await this.auth.clearLocal();
        return true;
      } catch (error) {
        const toast = await this.toasts.create({ message: error instanceof Error ? error.message : 'Check the API address.', duration: 3500, position: 'top' });
        await toast.present(); return false;
      }
    };
    const alert = await this.alerts.create({ header: 'Demo connection', message: 'For phones, use the Mac’s Wi-Fi IP. For the Android emulator, use 10.0.2.2.',
      inputs: [{ name: 'apiUrl', type: 'url', placeholder: 'http://192.168.1.10:8787/api/v1', value: this.auth.settings.apiUrl() }],
      buttons: [{ text: 'Cancel', role: 'cancel' },
        { text: 'Offline demo', handler: (data) => save(data.apiUrl, true) },
        { text: 'Use API', handler: (data) => save(data.apiUrl, false) }],
    });
    await alert.present();
  }
}
