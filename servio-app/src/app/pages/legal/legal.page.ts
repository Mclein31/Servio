import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

const POLICIES: Record<string, { title: string; paragraphs: string[] }> = {
  terms: { title: 'Terms of Use', paragraphs: ['SERVIO is a service-booking prototype for demonstration. Catalog prices, holds and payouts are simulated; no real money moves.', 'Use the demo respectfully. Select catalog services, keep communication in the booking, and do not upload real identity documents or sensitive information during a demonstration.'] },
  privacy: { title: 'Privacy', paragraphs: ['The prototype stores sign-in email, profile, bookings, messages and uploaded photos in the SERVIO demo environment. Development sign-in codes are printed in the local API log.', 'With permission, the Pro device shares location during an active journey. Use the simulator fallback when demonstrating indoors. Demo reset removes demo records; backups may retain copies.'] },
  escrow: { title: 'Escrow Protection Policy', paragraphs: ['Demo payments are mock holds recorded in a balanced ledger. Only the customer completion PIN releases the service payment; the Pro receives 85% of the service and approved add-ons.', 'Customer cancellation before departure is free; en route costs ₱100 and after arrival ₱200, paid entirely to the Pro. Late no-shows qualify for a full refund. In-progress customer cancellations require a dispute. A Pro cancellation refunds the customer in full. These are prototype assumptions.'] },
};
@Component({
  selector: 'app-legal', imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent],
  template: `<ion-header class="ion-no-border"><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/auth/login"></ion-back-button></ion-buttons><ion-title>{{ policy.title }}</ion-title></ion-toolbar></ion-header>
    <ion-content class="servio-page"><article><h1>{{ policy.title }}</h1><p class="label">Prototype — not legal advice</p>@for (paragraph of policy.paragraphs; track paragraph) { <p>{{ paragraph }}</p> }<p class="address">SERVIO<br />Business address to follow — prototype</p></article></ion-content>`,
  styles: `article { padding: 24px; max-width: 680px; margin: auto; } p { line-height: 1.6; } .label { color: var(--servio-brand-orange); font-weight: 700; } .address { margin-top: 32px; color: var(--servio-text-muted); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPage { readonly policy = POLICIES[inject(ActivatedRoute).snapshot.paramMap.get('type') ?? 'terms'] ?? POLICIES['terms']; }
