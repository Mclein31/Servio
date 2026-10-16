import { describe, expect, it } from 'vitest';
import { cityProfile, estimateTravelMinutes } from '../src/config/cities';

describe('Tuguegarao ETA policy', () => {
  const destination = { lat: 17.618111, lng: 121.718927 };
  it('uses a 30 minute fallback and 15–60 minute clamps', () => {
    expect(estimateTravelMinutes(null, destination)).toBe(30);
    expect(estimateTravelMinutes(destination, destination)).toBe(15);
    expect(estimateTravelMinutes({ lat: 18, lng: 122 }, destination)).toBe(60);
  });
  it('uses haversine distance, road factor 1.3, 20 km/h and rounds up', () => {
    // Exactly 0.05 degrees of latitude = ~5.56 km; 5.56 * 1.3 / 20 * 60 = 21.68 min.
    expect(estimateTravelMinutes({ lat: 17.663, lng: 121.727 }, { lat: 17.613, lng: 121.727 })).toBe(22);
    expect(cityProfile().noShowGraceMinutes).toBe(30);
    expect(cityProfile().acceptedTimeoutMinutes).toBe(15);
    expect(cityProfile().freshLocationSeconds).toBe(120);
  });
  it('selects profiles by configuration and fails closed on an unknown city', () => {
    expect(cityProfile('tuguegarao').name).toBe('Tuguegarao City, Cagayan');
    expect(() => cityProfile('unknown')).toThrow('Unsupported SERVIO launch city');
    expect(() => cityProfile('toString')).toThrow('Unsupported SERVIO launch city');
  });
});
