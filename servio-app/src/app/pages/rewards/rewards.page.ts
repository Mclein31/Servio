// rewards page
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { RewardsService } from '../../core/services/rewards.service';
import { PhpPipe } from '../../shared/pipes/php.pipe';

@Component({
  selector: 'app-rewards',
  templateUrl: 'rewards.page.html',
  styleUrl: 'rewards.page.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, PhpPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewardsPage {
  readonly rewards = inject(RewardsService);
  private readonly location = inject(Location);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly offline = computed(() => this.rewards.summary() === null && !this.loading() && !this.error());
  readonly progress = computed(() => {
    const s = this.rewards.summary();
    if (!s?.next) return 100;
    const previous = [...s.milestones].reverse().find((m) => m.reached)?.completedOrders ?? 0;
    return Math.round(((s.completedOrders - previous) / (s.next.completedOrders - previous)) * 100);
  });

  async ionViewWillEnter(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { await this.rewards.refresh(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load your rewards.'); }
    finally { this.loading.set(false); }
  }
  back(): void { this.location.back(); }
}
