import { Injectable, NgZone, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { NativeAudio } from '@capacitor-community/native-audio';

const ASSET_ID = 'radarAlert';
const ASSET_PATH = 'public/assets/audio/radar_alert.mp3';
const WEB_ASSET_PATH = 'assets/audio/radar_alert.mp3';
const PULSE_MS = 1500;

@Injectable({ providedIn: 'root' })
export class DispatchAlertService {
  private readonly zone = inject(NgZone);
  private readonly isNative = Capacitor.isNativePlatform();
  private preloaded = false;
  private webAudio: HTMLAudioElement | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  async initAudio(): Promise<void> {
    if (this.preloaded) return;
    try {
      if (this.isNative) {
        await NativeAudio.preload({ assetId: ASSET_ID, assetPath: ASSET_PATH, audioChannelNum: 1, isUrl: false });
      } else {
        this.webAudio = new Audio(WEB_ASSET_PATH);
        this.webAudio.loop = true;
        this.webAudio.preload = 'auto';
      }
      this.preloaded = true;
    } catch (err) {
      console.warn('[DispatchAlert] audio preload failed; continuing with haptics only', err);
    }
  }

  async startUrgentRadarAlert(): Promise<void> {
    if (this.active) return;
    this.active = true;
    await this.initAudio();
    if (!this.active) return;

    try {
      if (this.isNative) {
        await NativeAudio.loop({ assetId: ASSET_ID });
      } else if (this.webAudio) {
        this.webAudio.currentTime = 0;
        await this.webAudio.play().catch(() => console.log('[DispatchAlert] web audio blocked until user interaction'));
      }
    } catch (err) {
      console.warn('[DispatchAlert] audio loop failed', err);
    }

    this.pulse();
    this.zone.runOutsideAngular(() => {
      this.pulseTimer = setInterval(() => this.pulse(), PULSE_MS);
    });
  }

  async stopUrgentRadarAlert(): Promise<void> {
    this.active = false;
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.pulseTimer = null;

    if (this.webAudio) {
      this.webAudio.pause();
      this.webAudio.currentTime = 0;
    }
    if (this.isNative && this.preloaded) {
      await NativeAudio.stop({ assetId: ASSET_ID }).catch(() => undefined);
    }
  }

  private pulse(): void {
    if (!this.active) return;
    if (this.isNative) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([180, 90, 180]);
    }
  }
}
