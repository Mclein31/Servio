import { cityProfile } from '../config/cities';
import { ApiError } from './errors';

/** Saved places and booking snapshots use the same configured launch coverage. */
export function validateServiceLocation(location: { city: string; lat: number; lng: number }, launchCity?: string) {
  const profile = cityProfile(launchCity);
  if (location.city.trim().toLowerCase() !== profile.addressCity.toLowerCase()
    || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90
    || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180) {
    throw new ApiError(422, 'OUTSIDE_SERVICE_AREA', `Choose a location in ${profile.name}.`);
  }
}
