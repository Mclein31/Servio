/**
 * RouteTrack — distance-based geometry for a rider moving along a polyline.
 *
 * Works in either geographic space ([lat, lng], metres via an equirectangular
 * projection — accurate to well under 1% at neighbourhood scale) or screen
 * space ([x, y], pixels). Everything is addressed by "distance along route",
 * which is what makes delivery-app tracking feel right: the marker follows
 * the streets at a steady speed instead of cutting corners between GPS fixes.
 */
export type Point = readonly [number, number];

export interface RouteSample {
  point: Point;
  /** Heading in degrees, 0 = north/up, clockwise. */
  bearing: number;
  segmentIndex: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

export class RouteTrack {
  readonly points: Point[];
  readonly total: number;
  private readonly cumulative: number[];

  constructor(points: Point[], private readonly mode: 'geo' | 'screen' = 'geo') {
    if (points.length < 2) throw new Error('RouteTrack needs at least two points');
    this.points = points;
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + this.segmentLength(points[i - 1], points[i]));
    }
    this.total = this.cumulative[this.cumulative.length - 1];
  }

  /** Position and heading at `distance` along the route (clamped). */
  sample(distance: number): RouteSample {
    const d = Math.min(Math.max(distance, 0), this.total);
    const i = this.segmentAt(d);
    const a = this.points[i];
    const b = this.points[i + 1];
    const segLen = this.cumulative[i + 1] - this.cumulative[i];
    const t = segLen === 0 ? 0 : (d - this.cumulative[i]) / segLen;
    return {
      point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      bearing: this.bearing(a, b),
      segmentIndex: i,
    };
  }

  /** Route vertices split at `distance`: [travelled, remaining]. Both include the split point so they join seamlessly. */
  split(distance: number): [Point[], Point[]] {
    const { point, segmentIndex } = this.sample(distance);
    const travelled = [...this.points.slice(0, segmentIndex + 1), point];
    const remaining = [point, ...this.points.slice(segmentIndex + 1)];
    return [travelled, remaining];
  }

  /**
   * 0..1 factor that dips near sharp corners so riders brake into turns and
   * accelerate out — the subtle cue that makes motion read as a real vehicle.
   */
  cornerFactor(distance: number, brakeZone: number, minFactor = 0.45): number {
    let factor = 1;
    for (let i = 1; i < this.points.length - 1; i++) {
      const gap = Math.abs(this.cumulative[i] - distance);
      if (gap >= brakeZone) continue;
      const turn = Math.abs(angleDelta(this.bearing(this.points[i - 1], this.points[i]), this.bearing(this.points[i], this.points[i + 1])));
      if (turn < 25) continue;
      const sharpness = Math.min(turn / 90, 1);
      const proximity = 1 - gap / brakeZone;
      factor = Math.min(factor, 1 - (1 - minFactor) * sharpness * proximity * proximity);
    }
    return factor;
  }

  /** Heading smoothed over a short look-ahead window, so micro-kinks in road geometry don't make the marker twitch. */
  smoothedBearing(distance: number, window: number): number {
    const behind = this.sample(distance - window / 2).point;
    const ahead = this.sample(distance + window / 2).point;
    if (behind[0] === ahead[0] && behind[1] === ahead[1]) return this.sample(distance).bearing;
    return this.bearing(behind, ahead);
  }

  private segmentAt(d: number): number {
    let lo = 0;
    let hi = this.cumulative.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private segmentLength(a: Point, b: Point): number {
    if (this.mode === 'screen') return Math.hypot(b[0] - a[0], b[1] - a[1]);
    const x = toRad(b[1] - a[1]) * Math.cos(toRad((a[0] + b[0]) / 2));
    const y = toRad(b[0] - a[0]);
    return Math.hypot(x, y) * EARTH_RADIUS_M;
  }

  private bearing(a: Point, b: Point): number {
    if (this.mode === 'screen') {
      return (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI;
    }
    const x = toRad(b[1] - a[1]) * Math.cos(toRad((a[0] + b[0]) / 2));
    const y = toRad(b[0] - a[0]);
    return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  }
}

function angleDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}
