import { RouteTrack } from './route-track';

describe('RouteTrack', () => {
  const track = new RouteTrack([[0, 100], [0, 0], [100, 0]], 'screen');

  it('measures total length', () => {
    expect(track.total).toBe(200);
  });

  it('samples position and heading by distance along the street', () => {
    expect(track.sample(50).point).toEqual([0, 50]);
    expect(track.sample(50).bearing).toBeCloseTo(0); // moving up
    expect(track.sample(150).point).toEqual([50, 0]);
    expect(track.sample(150).bearing).toBeCloseTo(90); // moving right
  });

  it('splits into travelled and remaining paths that meet at the rider', () => {
    const [done, left] = track.split(150);
    expect(done[done.length - 1]).toEqual([50, 0]);
    expect(left[0]).toEqual([50, 0]);
    expect(left[left.length - 1]).toEqual([100, 0]);
  });

  it('brakes near sharp corners and cruises on straights', () => {
    expect(track.cornerFactor(100, 30)).toBeLessThan(0.6);
    expect(track.cornerFactor(10, 30)).toBe(1);
  });
});

describe('remaining street route snapping', () => {
  it('projects noisy GPS to a street segment and excludes earlier legs at a crossing', () => {
    const route = new RouteTrack([[0,0],[0,100],[100,100],[100,0],[0,0]], 'screen');
    const first = route.project([3,40]);
    expect(first.distance).toBeCloseTo(40); expect(first.error).toBeCloseTo(3);
    const later = route.project([0,0],250);
    expect(later.distance).toBeCloseTo(400); expect(later.error).toBeCloseTo(0);
    expect(route.project([50,101]).distance).toBeCloseTo(150);
  });
});
