// onboarding page
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { prefersReducedMotion } from '../../shared/utils/motion';
import { TrackVisualComponent } from './visuals/track-visual.component';
import { TrustVisualComponent } from './visuals/trust-visual.component';

interface Slide {
  id: 'discover' | 'trust' | 'track';
  eyebrow: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-onboarding',
  templateUrl: 'onboarding.page.html',
  styleUrl: 'onboarding.page.scss',
  imports: [IonContent, TrustVisualComponent, TrackVisualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPage {
  @ViewChild('track', { static: true }) trackEl!: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly slides: Slide[] = [
    {
      id: 'discover',
      eyebrow: '01 · Find your person',
      title: 'Neighborhood Help, Standardized & On-Demand',
      body: 'Connect with verified local pros for fixed-price home repairs, tutoring, and everyday tasks.',
    },
    {
      id: 'trust',
      eyebrow: '02 · Stay in control',
      title: '100% Escrow Protected',
      body: 'Your payment stays safely locked. Providers are only paid after you inspect the work and share your unique completion PIN.',
    },
    {
      id: 'track',
      eyebrow: '03 · Know what’s next',
      title: 'Live Tracking & Direct Chat',
      body: 'Watch your helper arrive on the map and coordinate tasks through in-app messaging.',
    },
  ];

  readonly index = signal(0);
  readonly seen = signal<Set<number>>(new Set([0]));

  get isLast(): boolean {
    return this.index() === this.slides.length - 1;
  }

  onScroll(): void {
    const el = this.trackEl.nativeElement;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== this.index() && i >= 0 && i < this.slides.length) {
      this.index.set(i);
      this.seen.update((s) => new Set(s).add(i));
    }
  }

  goTo(i: number): void {
    const el = this.trackEl.nativeElement;
    el.scrollTo({ left: i * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  next(): void {
    if (this.isLast) this.finish();
    else this.goTo(this.index() + 1);
  }

  async skip(): Promise<void> {
    await this.auth.markOnboardingSeen();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async finish(): Promise<void> {
    await this.auth.markOnboardingSeen();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' && !this.isLast) this.goTo(this.index() + 1);
    if (event.key === 'ArrowLeft' && this.index() > 0) this.goTo(this.index() - 1);
  }
}
