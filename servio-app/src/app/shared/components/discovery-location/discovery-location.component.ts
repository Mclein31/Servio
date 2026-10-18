import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommunityService } from '../../../core/services/community.service';
@Component({selector:'app-discovery-location',changeDetection:ChangeDetectionStrategy.OnPush,
 template:`<div class="location"><button type="button" class="text-btn" [disabled]="community.location.locating()" (click)="locate()">{{community.location.locating() ? 'Finding location…' : 'Use my location'}}</button><span>{{community.location.point() ? 'Approximate straight-line distances from your location.' : 'Enable location to measure distances.'}}</span>@if(community.location.error()){<p role="alert">{{community.location.error()}}</p>}</div>`,
 styles:`.location{padding:0 var(--servio-gutter) 12px;font-size:12px;color:var(--servio-text-muted);}span{display:block;margin-top:5px;}`})
export class DiscoveryLocationComponent {
 readonly community=inject(CommunityService);
 async locate():Promise<void>{if(await this.community.location.locate())await this.community.refresh(false);}
}
