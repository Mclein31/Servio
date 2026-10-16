import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent, IonFooter, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/api/api.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-profile-setup', imports: [IonContent, IonFooter, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner, AvatarComponent], template: `
    @if (editing) {
      <ion-header class="ion-no-border"><ion-toolbar class="servio-detail-bar"><button type="button" class="icon-btn" slot="start" (click)="cancel()" aria-label="Cancel profile editing"><ion-icon name="arrow-back"></ion-icon></button><ion-title>Edit profile</ion-title></ion-toolbar></ion-header>
    }
    <ion-content class="servio-page"><div class="wrap">
      @if (!editing) { <img class="brand" src="assets/logo/servio_app_icon_orange.png" alt="SERVIO" width="88" height="88" /> }
      <h1 class="servio-display">{{ editing ? 'Your profile' : 'Complete your profile' }}</h1><p class="servio-subtitle">Your name helps your helper recognize you.</p>
      <div class="photo"><app-avatar [src]="photoUrl()" [name]="name() || 'Your photo'" [size]="88"></app-avatar>
        @if (!auth.settings.useMockApi()) {
          <button type="button" class="text-btn" [disabled]="uploading() || saving()" (click)="choosePhoto()">{{ uploading() ? 'Uploading…' : 'Choose photo' }}</button>
          @if (photoUrl()) { <button type="button" class="text-btn" [disabled]="uploading() || saving()" (click)="removePhoto()">Remove photo</button> }
        }
      </div>
      <label class="field-label" for="full-name">Your name</label><div class="phone-field"><input id="full-name" autocomplete="name" maxlength="80" [value]="name()" (input)="name.set(value($event))" /></div>
      <label class="field-label optional" for="mobile">Philippine mobile (optional)</label><div class="phone-field"><input id="mobile" type="tel" autocomplete="tel" maxlength="13" placeholder="+639171234567" [value]="phone()" (input)="phone.set(value($event))" /></div>
      <label class="field-label optional" for="profile-email">Sign-in email</label><div class="phone-field"><input id="profile-email" type="email" readonly [value]="auth.user()?.email ?? ''" /></div>
      <p class="help">Sign-in codes are sent to this email. Your mobile number stays private from helpers.</p>
      @if (error()) { <p class="help error" role="alert">{{ error() }}</p> }
    </div></ion-content>
    <ion-footer class="ion-no-border"><div class="servio-action-bar"><button type="button" class="pill-btn block" [disabled]="!valid() || saving() || uploading()" (click)="save()">
      @if (saving()) { <ion-spinner name="crescent"></ion-spinner> } @else { {{ editing ? 'Save changes' : 'Continue' }} }
    </button></div></ion-footer>`,
  styleUrls: ['../login/login.page.scss', './profile-setup.page.scss'],
  styles: `.photo { display:flex; align-items:center; gap:12px; margin:20px 0; flex-wrap:wrap; } input[readonly] { color:var(--ion-color-medium); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSetupPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly editing = inject(ActivatedRoute).snapshot.data['editing'] === true;
  readonly name = signal(this.auth.user()?.fullName ?? ''); readonly phone = signal(this.auth.user()?.phoneNumber ?? '');
  private readonly avatarKey = signal<string | null | undefined>(undefined);
  private readonly preview = signal('');
  readonly photoUrl = computed(() => this.avatarKey() === null ? '' : this.preview() || this.auth.avatarUrl());
  readonly uploading = signal(false); readonly saving = signal(false); readonly error = signal('');
  readonly valid = computed(() => this.name().trim().length >= 2 && this.name().trim().length <= 80 && (!this.phone().trim() || /^\+639\d{9}$/.test(this.phone().trim())));
  value(event: Event): string { return (event.target as HTMLInputElement).value; }
  cancel(): void { void this.router.navigateByUrl('/tabs/profile'); }
  removePhoto(): void { this.avatarKey.set(null); this.preview.set(''); }
  async choosePhoto(): Promise<void> {
    if (this.uploading() || this.saving()) return;
    this.uploading.set(true); this.error.set('');
    try {
      const shot = await Camera.getPhoto({ source: CameraSource.Photos, resultType: CameraResultType.DataUrl, quality: 80, width: 640, webUseInput: true });
      if (!shot.dataUrl) return;
      const blob = await (await fetch(shot.dataUrl)).blob();
      const key = await this.api.upload(blob,'avatar');
      this.avatarKey.set(key); this.preview.set(shot.dataUrl);
    } catch (error) { if (!String(error).toLowerCase().includes('cancel')) this.error.set('The photo could not be saved. Please choose a JPEG or PNG up to 5 MB.'); }
    finally { this.uploading.set(false); }
  }
  async save(): Promise<void> {
    if (!this.valid() || this.saving() || this.uploading()) return;
    this.saving.set(true); this.error.set('');
    try {
      await this.auth.updateProfile(this.name().trim(), this.phone().trim() || null, this.avatarKey());
      await this.router.navigateByUrl(this.editing ? '/tabs/profile' : this.auth.landingPath(), { replaceUrl: true });
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { this.saving.set(false); }
  }
}
