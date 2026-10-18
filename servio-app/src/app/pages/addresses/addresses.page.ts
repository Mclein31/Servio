import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { AddressService, SavedAddress } from '../../core/services/address.service';
import { TUGUEGARAO_CENTER } from '../../core/data/launch-city';
import * as L from 'leaflet';
import { ReverseGeocodingService } from '../../core/services/reverse-geocoding.service';
import { servioTileLayer } from '../../shared/utils/map-tiles';

@Component({
  selector: 'app-addresses', standalone: true, imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header class="ion-no-border"><ion-toolbar class="servio-detail-bar">
      <button type="button" slot="start" class="text-btn" (click)="back()">Back</button><ion-title>{{ editing() ? 'Pin your address' : 'Saved addresses' }}</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="servio-page"><div class="wrap">
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (editing()) {
        <p>Tap the map or drag the pin to your entrance. Choose your address in Tuguegarao City.</p>
        <div #mapHost class="map" role="region" aria-label="Choose service location on map"></div>
        <button class="pill-btn-outline" type="button" (click)="locate()" [disabled]="locating()">{{ locating() ? 'Finding location…' : 'Use my current location' }}</button>
        <p class="pin-status" aria-live="polite">{{ pin() ? 'Pin selected: ' + pin()![0].toFixed(5) + ', ' + pin()![1].toFixed(5) : 'Select a pin before saving.' }}</p>
        <p class="pin-status" aria-live="polite">{{ geocoding() ? 'Finding address…' : 'Review the address and add any missing house or barangay details.' }}</p>
        <form (ngSubmit)="save()">
          <label>Label<input name="label" [(ngModel)]="label" maxlength="50" required placeholder="Home or work"></label>
          <label>Address / landmark<input name="street" [(ngModel)]="street" maxlength="200" required placeholder="House, building or entrance"></label>
          <label>Barangay<input name="barangay" [(ngModel)]="barangay" maxlength="100" required placeholder="e.g. Ugac Norte"></label>
          <label>City<input name="city" [(ngModel)]="city" required></label>
          <label>Directions (optional)<input name="landmark" [(ngModel)]="landmark" maxlength="200" placeholder="How your Pro can find you"></label>
          <label class="check"><input type="checkbox" name="default" [(ngModel)]="isDefault" [disabled]="wasDefault">Use as default address</label>
          @if (wasDefault) { <p class="pin-status">This is your default. Make another address the default to change it.</p> }
          <button class="pill-btn" type="submit" [disabled]="saving() || geocoding() || !pin() || !label.trim() || !street.trim() || !barangay.trim() || !city.trim()">{{ saving() ? 'Saving…' : 'Confirm pin & save address' }}</button>
          <button class="text-btn" type="button" (click)="closeEditor()" [disabled]="saving()">Cancel</button>
        </form>
      } @else {
        @for (a of addresses.addresses(); track a.id) {
          <section class="servio-card address">
            <strong>{{ a.label }}{{ a.isDefault ? ' · Default' : '' }}</strong><p>{{ a.street }}<br>{{ a.barangay }}, {{ a.city }}</p>
            @if (a.landmark) { <p>{{ a.landmark }}</p> }
            <div class="actions">
              @if (choosing) { <button class="pill-btn" (click)="choose(a)">Use this address</button> }
              <button class="text-btn" (click)="edit(a)">Edit</button>
              @if (!a.isDefault) { <button class="text-btn" (click)="setDefault(a)" [disabled]="saving()">Make default</button> }
              <button class="text-btn danger" (click)="remove(a)" [disabled]="saving()">Delete</button>
            </div>
          </section>
        } @empty { <p>You haven't saved an address yet. Add one and pinpoint where your Pro should meet you.</p> }
        <button class="pill-btn" (click)="edit()">Add address</button>
      }
    </div></ion-content>`,
  styles: [`
    .wrap{max-width:600px;margin:auto;padding:20px 20px 40px}.map{height:310px;border-radius:20px;overflow:hidden;margin:16px 0;z-index:0}
    .address{padding:20px;margin-bottom:16px}.actions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
    p{font-size:14px;line-height:1.5;color:var(--servio-text-secondary)}label{display:block;font-weight:600;font-size:14px;margin:16px 0}
    input:not([type=checkbox]){display:block;width:100%;padding:14px;border:1px solid var(--servio-border,#ddd);border-radius:14px;margin-top:8px;background:var(--servio-surface,#fff);color:inherit}
    .check{display:flex;align-items:center;gap:10px}.error,.danger{color:#b42318}.pin-status{font-size:12px}form>.text-btn{margin-left:16px}
  `], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressesPage implements AfterViewChecked, OnDestroy {
  readonly addresses = inject(AddressService);
  private readonly location = inject(Location);
  readonly choosing = inject(ActivatedRoute).snapshot.queryParamMap.get('choose') === '1';
  @ViewChild('mapHost') host?: ElementRef<HTMLElement>;
  readonly editing = signal(false); readonly saving = signal(false); readonly locating = signal(false); readonly error = signal('');
  readonly pin = signal<readonly [number,number] | null>(null);
  private readonly geocoder = inject(ReverseGeocodingService);
  readonly geocoding = signal(false);
  city = 'Tuguegarao City';
  private geocodeRevision = 0;
  private lookupTimer?: ReturnType<typeof setTimeout>;
  label = 'Home'; street = ''; barangay = ''; landmark = ''; isDefault = false; wasDefault = false;
  private editorRevision = 0; private locationRevision = 0;
  private id?: string; private map?: L.Map; private marker?: L.Marker;
  async ionViewWillEnter(): Promise<void> { try { await this.addresses.refresh(); } catch (e) { this.fail(e); } }
  back(): void { this.closeEditor(); this.location.back(); }
  ionViewWillLeave(): void { this.closeEditor(); }
  edit(a?: SavedAddress): void {
    this.closeEditor(); this.error.set(''); this.id = a?.id; this.label = a?.label ?? 'Home'; this.street = a?.street ?? '';
    this.city = a?.city ?? 'Tuguegarao City'; this.barangay = a?.barangay ?? ''; this.landmark = a?.landmark ?? ''; this.isDefault = a?.isDefault ?? !this.addresses.addresses().length; this.wasDefault = a?.isDefault ?? false;
    this.pin.set(a ? [a.lat,a.lng] : null); this.editing.set(true);
  }
  ngAfterViewChecked(): void {
    if (!this.host || this.map || !this.editing()) return;
    this.map = L.map(this.host.nativeElement).setView([...(this.pin() ?? TUGUEGARAO_CENTER)] as [number,number],16);
    servioTileLayer().addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => this.selectPin(event.latlng.lat,event.latlng.lng));
    const pin = this.pin(); if(pin) this.moveMarker(...pin);
    requestAnimationFrame(() => this.map?.invalidateSize());
  }
  private moveMarker(lat: number, lng: number): void {
    if(!this.map) return;
    if(!this.marker) {
      this.marker = L.marker([lat,lng], { draggable:true, title:'Service entrance', icon:L.divIcon({ className:'address-pin', html:'<span style="display:block;width:28px;height:28px;border:4px solid white;border-radius:50%;background:#ef6500;box-shadow:0 2px 8px #555"></span>', iconSize:[28,28], iconAnchor:[14,14] }) }).addTo(this.map);
      this.marker.on('dragend', () => { const point=this.marker!.getLatLng(); this.selectPin(point.lat,point.lng); });
    } else this.marker.setLatLng([lat,lng]);
  }
  selectPin(lat: number, lng: number): void {
    this.locationRevision++; this.locating.set(false);
    this.pin.set([lat,lng]);
    this.moveMarker(lat,lng);
    clearTimeout(this.lookupTimer);
    const revision = ++this.geocodeRevision;
    this.street = ''; this.barangay = ''; this.city = '';
    this.geocoding.set(true); this.error.set('');
    this.lookupTimer = setTimeout(() => { void this.fillAddress(lat,lng,revision); }, 350);
  }
  private async fillAddress(lat: number,lng: number,revision: number): Promise<void> {
    try {
      const fields = await this.geocoder.lookup(lat,lng);
      if(revision !== this.geocodeRevision || !this.editing()) return;
      this.street = fields.street; this.barangay = fields.barangay; this.city = fields.city;
      if(!fields.street || !fields.barangay || !fields.city) this.error.set('Some address details could not be found. Fill in the missing fields before saving.');
    } catch { if(revision === this.geocodeRevision) this.error.set('Could not look up this address. Enter the address details manually or move the pin to try again.'); }
    finally { if(revision === this.geocodeRevision) { this.geocoding.set(false); } }
  }
  async locate(): Promise<void> {
    const editor = this.editorRevision; const request = ++this.locationRevision;
    this.locating.set(true); this.error.set('');
    try { const fix = await Geolocation.getCurrentPosition({ enableHighAccuracy:true, timeout:15000, maximumAge:0 }); if (editor !== this.editorRevision || request !== this.locationRevision) return; this.selectPin(fix.coords.latitude,fix.coords.longitude); this.map?.setView([fix.coords.latitude,fix.coords.longitude],17); }
    catch { if (editor === this.editorRevision && request === this.locationRevision) this.error.set('Location is unavailable. Allow location access or choose your entrance on the map.'); }
    finally { if (editor === this.editorRevision && request === this.locationRevision) this.locating.set(false); }
  }
  async save(): Promise<void> {
    const pin = this.pin(); if (!pin || this.geocoding() || !this.city.trim() || this.saving() || !this.label.trim() || !this.street.trim() || !this.barangay.trim()) return;
    this.saving.set(true); this.error.set('');
    try { await this.addresses.save({ label:this.label.trim(),street:this.street.trim(),barangay:this.barangay.trim(),city:this.city.trim(),landmark:this.landmark.trim() || null,lat:pin[0],lng:pin[1],isDefault:this.isDefault },this.id); this.closeEditor(); if(this.choosing) this.back(); }
    catch (e) { this.fail(e); } finally { this.saving.set(false); }
  }
  choose(a: SavedAddress): void { this.addresses.selectedId.set(a.id); this.back(); }
  async setDefault(a: SavedAddress): Promise<void> { await this.mutate(() => this.addresses.makeDefault(a.id)); }
  async remove(a: SavedAddress): Promise<void> { await this.mutate(() => this.addresses.remove(a.id)); }
  private async mutate(action: () => Promise<void>): Promise<void> { if(this.saving()) return; this.saving.set(true); this.error.set(''); try { await action(); } catch(e) { this.fail(e); } finally { this.saving.set(false); } }
  private fail(e: unknown): void { this.error.set(e instanceof Error ? e.message : 'Could not save address.'); }
  closeEditor(): void { this.editorRevision++; this.locationRevision++; this.locating.set(false); this.geocodeRevision++; this.geocoding.set(false); clearTimeout(this.lookupTimer); this.map?.remove(); this.map=undefined; this.marker=undefined; this.editing.set(false); }
  ngOnDestroy(): void { this.closeEditor(); }
}
