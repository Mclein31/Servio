// legal page
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { POLICIES } from './policies';

@Component({
  selector: 'app-legal', imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent],
  template: `<ion-header class="ion-no-border"><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/auth/login"></ion-back-button></ion-buttons><ion-title>{{ policy.title }}</ion-title></ion-toolbar></ion-header>
    <ion-content class="servio-page"><article>
      <h1>{{ policy.title }}</h1>
      <p class="updated">Last updated {{ policy.updated }}</p>
      <p>{{ policy.intro }}</p>
      @for (section of policy.sections; track section.heading) {
        <h2>{{ section.heading }}</h2>
        @for (paragraph of section.paragraphs; track paragraph) { <p>{{ paragraph }}</p> }
      }
      <p class="address">SERVIO · Tuguegarao City, Cagayan<br />Questions? Use Help &amp; Community Safety in the app.</p>
    </article></ion-content>`,
  styles: `article { padding: 24px; max-width: 680px; margin: auto; } h1 { margin-bottom: 4px; } h2 { margin: 24px 0 6px; font-size: 17px; font-weight: 700; } p { margin: 0 0 10px; line-height: 1.6; color: var(--servio-text-secondary); } .updated { color: var(--servio-text-muted); font-size: 13px; margin-bottom: 16px; } .address { margin-top: 32px; color: var(--servio-text-muted); font-size: 13px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPage { readonly policy = POLICIES[inject(ActivatedRoute).snapshot.paramMap.get('type') ?? 'terms'] ?? POLICIES['terms']; }
