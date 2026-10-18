import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
export const DISCOVERY_GEOLOCATION = new InjectionToken<Pick<typeof Geolocation,'checkPermissions'|'getCurrentPosition'>>('DiscoveryGeolocation',{providedIn:'root',factory:()=>({checkPermissions:()=>Geolocation.checkPermissions(),getCurrentPosition:(options)=>Geolocation.getCurrentPosition(options)})});
@Injectable({providedIn:'root'})
export class DiscoveryLocationService {
  private readonly geolocation=inject(DISCOVERY_GEOLOCATION);
  readonly point=signal<{lat:number;lng:number;at:number}|null>(null);
  private expiry?: ReturnType<typeof setTimeout>;
  readonly locating=signal(false);readonly error=signal('');
  query():Record<string,number>{
    const point=this.point();return point && Date.now()-point.at<120000 ? {lat:point.lat,lng:point.lng} : {};
  }
  async refreshGranted():Promise<void>{
    try{const permission=await this.geolocation.checkPermissions();if(permission.location==='granted'||permission.coarseLocation==='granted')await this.locate();else this.point.set(null);}catch{this.point.set(null);}
  }
  async locate():Promise<boolean>{
    if(this.locating())return false;
    this.locating.set(true);this.error.set('');
    try{
      const fix=await this.geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:10000,maximumAge:60000});
      if(!Number.isFinite(fix.coords.latitude)||!Number.isFinite(fix.coords.longitude)||fix.timestamp>Date.now()+5000||Date.now()-fix.timestamp>120000)throw Error('Fresh location unavailable');
      clearTimeout(this.expiry);this.point.set({lat:fix.coords.latitude,lng:fix.coords.longitude,at:fix.timestamp});
      this.expiry=setTimeout(()=>this.point.set(null),Math.max(0,120000-(Date.now()-fix.timestamp)));return true;
    }catch{this.point.set(null);this.error.set('Location unavailable. Enable location access, then try again.');return false;}
    finally{this.locating.set(false);}
  }
}
