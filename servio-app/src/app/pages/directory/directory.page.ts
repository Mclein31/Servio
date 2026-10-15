import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import { CATEGORIES, HELPER_CATEGORIES, HELPERS } from '../../core/data/mock-data';
import { SheetsService } from '../../core/services/sheets.service';
import { HelperCardComponent } from '../../shared/components/helper-card/helper-card.component';
import { SearchFilterComponent } from '../../shared/components/search-filter/search-filter.component';

@Component({
  selector: 'app-directory',
  templateUrl: 'directory.page.html',
  styleUrl: 'directory.page.scss',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, SearchFilterComponent, HelperCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryPage {
  private readonly sheets = inject(SheetsService);
  private readonly router = inject(Router);

  readonly chips = [{ id: 'all', label: 'All', icon: 'apps-outline' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))];
  readonly active = signal('all');
  readonly query = signal('');

  readonly helpers = computed(() => {
    const cat = this.active();
    const q = this.query().toLowerCase();
    return HELPERS.filter((h) => cat === 'all' || HELPER_CATEGORIES[h.id]?.includes(cat)).filter(
      (h) => !q || `${h.name} ${h.category} ${h.skus.map((s) => s.name).join(' ')}`.toLowerCase().includes(q),
    );
  });

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const category = params.get('category');
        if (category && this.chips.some((c) => c.id === category)) this.active.set(category);
        const q = params.get('q');
        if (q !== null) this.query.set(q);
        const helper = params.get('helper');
        if (helper) {
          this.sheets.openHelperProfile(helper);
          this.router.navigate([], { queryParams: { helper: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
  }

  open(id: string): void {
    this.sheets.openHelperProfile(id);
  }
}
