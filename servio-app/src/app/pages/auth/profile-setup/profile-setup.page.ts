import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile-setup', imports: [IonContent, IonFooter, IonSpinner], template: `
    <ion-content class="servio-page"><div class="wrap">
      <img class="brand" src="assets/logo/servio_app_icon_orange.png" alt="SERVIO" width="88" height="88" />
      <h1 class="servio-display">Complete your profile</h1><p class="servio-subtitle">Your name helps your helper recognize you.</p>
      <label class="field-label" for="full-name">Your name</label><div class="phone-field"><input id="full-name" autocomplete="name" maxlength="80" [value]="name()" (input)="name.set(value($event))" /></div>
      <label class="field-label optional" for="mobile">Philippine mobile (optional)</label><div class="phone-field"><input id="mobile" type="tel" autocomplete="tel" placeholder="+639171234567" [value]="phone()" (input)="phone.set(value($event))" /></div>
      @if (error()) { <p class="help error" role="alert">{{ error() }}</p> }
    </div></ion-content>
    <ion-footer class="ion-no-border"><div class="servio-action-bar"><button type="button" class="pill-btn block" [disabled]="!valid() || saving()" (click)="save()">
      @if (saving()) { <ion-spinner name="crescent"></ion-spinner> } @else { Continue }
    </button></div></ion-footer>`,
  styleUrls: ['../login/login.page.scss', './profile-setup.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSetupPage {
  private readonly auth = inject(AuthService); private readonly router = inject(Router);
  readonly name = signal(this.auth.user()?.fullName ?? ''); readonly phone = signal(this.auth.user()?.phoneNumber ?? '');
  readonly saving = signal(false); readonly error = signal('');
  readonly valid = computed(() => this.name().trim().length >= 2 && this.name().trim().length <= 80 && (!this.phone().trim() || /^\+639\d{9}$/.test(this.phone().trim())));
  value(event: Event): string { return (event.target as HTMLInputElement).value; }
  async save(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try { await this.auth.updateProfile(this.name().trim(), this.phone().trim() || null); await this.router.navigateByUrl(this.auth.landingPath(), { replaceUrl: true }); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { this.saving.set(false); }
  }
}
