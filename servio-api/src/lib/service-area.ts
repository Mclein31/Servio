import { cityProfile, haversineKm } from '../config/cities';
import { ApiError } from './errors';

/** Saved places and booking snapshots use the same configured launch coverage. */
export function validateServiceLocation(location: { city: string; lat: number; lng: number }, launchCity?: string) {
  const profile = cityProfile(launchCity);
  if (location.city.toLowerCase() !== profile.addressCity.toLowerCase()
    || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
    || haversineKm(profile.center, location) > profile.dispatchRadiusKm) {
    throw new ApiError(422, 'OUTSIDE_SERVICE_AREA', `Choose a location in ${profile.name}, within ${profile.dispatchRadiusKm} km of the city center.`);
  }
}
