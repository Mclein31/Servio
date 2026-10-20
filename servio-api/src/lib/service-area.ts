import { ApiError } from './errors';

export function validateServiceLocation(location: { lat: number; lng: number }) {
  if (!Number.isFinite(location.lat) || Math.abs(location.lat) > 90
    || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180) {
    throw new ApiError(422, 'INVALID_LOCATION', 'Choose a valid location.');
  }
}
