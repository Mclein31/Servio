// payment methods page
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { PaymentMethodsService } from '../../core/services/payment-methods.service';
import { PaymentMethod } from '../../shared/models/domain.models';
@Component({selector:'app-payment-methods',templateUrl:'payment-methods.page.html',styleUrl:'payment-methods.page.scss',
  imports:[IonContent,IonHeader,IonIcon,IonTitle,IonToolbar],changeDetection:ChangeDetectionStrategy.OnPush})
export class PaymentMethodsPage {
  readonly methods=inject(PaymentMethodsService); private readonly location=inject(Location);
  readonly selected=signal<PaymentMethod>('GCASH'); readonly saving=signal(false); readonly loading=signal(true);
  readonly error=signal(''); readonly success=signal('');
  async ionViewWillEnter():Promise<void> {
    this.loading.set(true); this.error.set(''); this.success.set('');
    try { await this.methods.refresh(); this.selected.set(this.methods.preferred()); }
    catch(error){this.error.set(error instanceof Error?error.message:'Could not load payment methods.');}
    finally{this.loading.set(false);}
  }
  back():void{this.location.back();}
  async save():Promise<void>{
    if(this.saving()||this.loading())return;
    this.saving.set(true);this.error.set('');this.success.set('');
    try{await this.methods.save(this.selected());this.success.set('Preferred payment method saved.');}
    catch(error){this.error.set(error instanceof Error?error.message:'Could not save payment method.');}
    finally{this.saving.set(false);}
  }
}
