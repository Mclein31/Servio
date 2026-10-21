// bottom sheets
import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class SheetsService {
  private readonly modals = inject(ModalController);

  async openHelperProfile(helperId: string): Promise<void> {
    const { HelperProfileModalComponent } = await import('../../shared/modals/helper-profile-modal/helper-profile-modal.component');
    const modal = await this.modals.create({
      component: HelperProfileModalComponent,
      componentProps: { helperId },
      breakpoints: [0, 0.6, 0.95],
      initialBreakpoint: 0.6,
      handle: true,
      expandToScroll: false,
      cssClass: 'servio-sheet',
    });
    await modal.present();
  }

  async openPostBulletin(): Promise<void> {
    const { PostBulletinModalComponent } = await import('../../shared/modals/post-bulletin-modal/post-bulletin-modal.component');
    const modal = await this.modals.create({ component: PostBulletinModalComponent, cssClass: 'servio-fullscreen' });
    await modal.present();
  }
}
