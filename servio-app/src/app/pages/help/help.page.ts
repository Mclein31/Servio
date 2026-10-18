import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { ApiService } from '../../core/api/api.service';
interface SupportRequest { id:string;category:string;message:string;status:string;createdAt:string; }
@Component({selector:'app-help',templateUrl:'help.page.html',styleUrl:'help.page.scss',imports:[IonContent,IonHeader,IonIcon,IonTitle,IonToolbar,RouterLink],changeDetection:ChangeDetectionStrategy.OnPush})
export class HelpPage {
  private readonly api=inject(ApiService);private readonly location=inject(Location);
  readonly categories=['BOOKING','PAYMENT','SAFETY','ACCOUNT','OTHER'];
  readonly category=signal('BOOKING'); readonly message=signal(''); readonly requests=signal<SupportRequest[]>([]);
  readonly saving=signal(false);readonly error=signal('');readonly success=signal('');
  private attempt?:{fingerprint:string;key:string};
  back():void{this.location.back();}
  async ionViewWillEnter():Promise<void>{
    this.error.set('');
    try{await this.refresh();}catch(error){this.error.set(error instanceof Error?error.message:'Could not load your reports.');}
  }
  private async refresh():Promise<void>{
    if(this.api.settings.useMockApi())return;
    const result=await this.api.get<{requests:SupportRequest[]}>('/support/requests');this.requests.set(result.requests);
  }
  async submit():Promise<void>{
    const message=this.message().trim();if(this.saving()||message.length<10||message.length>2000)return;
    this.saving.set(true);this.error.set('');this.success.set('');
    try{
      if(this.api.settings.useMockApi())throw new Error('Connect to SERVIO to submit a report.');
      const fingerprint=JSON.stringify([message,this.category()]);
      if(this.attempt?.fingerprint!==fingerprint)this.attempt={fingerprint,key:crypto.randomUUID()};
      const {request}=await this.api.post<{request:SupportRequest}>('/support/requests',{clientKey:this.attempt.key,category:this.category(),message});
      this.requests.update(rows=>[request,...rows.filter(r=>r.id!==request.id)]);
      this.message.set('');this.attempt=undefined;this.success.set(`Report submitted. Reference: ${request.id}`);
    }catch(error){this.error.set(error instanceof Error?error.message:'Could not submit your report. Your message has been kept.');}
    finally{this.saving.set(false);}
  }
}
