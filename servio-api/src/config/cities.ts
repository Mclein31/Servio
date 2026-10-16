/** Owner-approved prototype policy. Revalidate fees and travel assumptions before launch. */
export const CANCELLATION_FEES = { enRouteCentavos: 10000, arrivedCentavos: 20000 } as const;

export interface CityProfile {
  name: string;
  center: { lat: number; lng: number };
  roadFactor: number;
  averageSpeedKmh: number;
  minTravelMinutes: number;
  maxTravelMinutes: number;
  defaultTravelMinutes: number;
  freshLocationSeconds: number;
  noShowGraceMinutes: number;
  acceptedTimeoutMinutes: number;
  dispatchRadiusKm: number;
}

/** Add a city here and select it with LAUNCH_CITY; consumers use the same estimator/policy. */
export const CITY_PROFILES: Record<string, CityProfile> = {
  tuguegarao: {
    name: 'Tuguegarao City, Cagayan', center: { lat: 17.613, lng: 121.727 },
    roadFactor: 1.3, averageSpeedKmh: 20,
    minTravelMinutes: 15, maxTravelMinutes: 60, defaultTravelMinutes: 30,
    freshLocationSeconds: 120, noShowGraceMinutes: 30, acceptedTimeoutMinutes: 15,
    dispatchRadiusKm: 10,
  },
};

export const DEFAULT_CITY = 'tuguegarao';

export function cityProfile(city = DEFAULT_CITY): CityProfile {
  if (!Object.hasOwn(CITY_PROFILES, city)) throw new Error('Unsupported SERVIO launch city.');
  return CITY_PROFILES[city]!;
}

interface Location { lat: number; lng: number }

/** Pass null when the Pro has no fix younger than freshLocationSeconds. Replaceable by routing later. */
export function estimateTravelMinutes(from: Location | null, to: Location, profile = cityProfile()): number {
  if (!from) return profile.defaultTravelMinutes;
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(rad(to.lat - from.lat) / 2) ** 2
    + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  return Math.max(profile.minTravelMinutes, Math.min(profile.maxTravelMinutes,
    Math.ceil(distanceKm * profile.roadFactor / profile.averageSpeedKmh * 60)));
}
