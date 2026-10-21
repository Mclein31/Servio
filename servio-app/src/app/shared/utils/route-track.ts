// route track
export type Point = readonly [number, number];

export interface RouteSample {
  point: Point;
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

  split(distance: number): [Point[], Point[]] {
    const { point, segmentIndex } = this.sample(distance);
    const travelled = [...this.points.slice(0, segmentIndex + 1), point];
    const remaining = [point, ...this.points.slice(segmentIndex + 1)];
    return [travelled, remaining];
  }

  project(point: Point, minimumDistance = 0): { distance: number; error: number; point: Point } {
    let best = { distance: Math.min(this.total, Math.max(0, minimumDistance)), error: Infinity, point: this.sample(minimumDistance).point };
    for (let i = 0; i < this.points.length - 1; i++) {
      if (this.cumulative[i + 1] < minimumDistance) continue;
      const a = this.points[i], b = this.points[i + 1];
      const longitudeScale = this.mode === 'geo' ? Math.cos(toRad(point[0])) : 1;
      const x = this.mode === 'geo' ? (b[1] - a[1]) * longitudeScale : b[0] - a[0];
      const y = this.mode === 'geo' ? b[0] - a[0] : b[1] - a[1];
      const px = this.mode === 'geo' ? (point[1] - a[1]) * longitudeScale : point[0] - a[0];
      const py = this.mode === 'geo' ? point[0] - a[0] : point[1] - a[1];
      const length = this.cumulative[i + 1] - this.cumulative[i];
      const lower = length ? Math.max(0, (minimumDistance - this.cumulative[i]) / length) : 0;
      const fraction = Math.max(lower, Math.min(1, x * x + y * y ? (px * x + py * y) / (x * x + y * y) : 0));
      const snapped: Point = [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])];
      const error = this.segmentLength(point, snapped);
      if (error < best.error) best = { distance: this.cumulative[i] + fraction * length, error, point: snapped };
    }
    return best;
  }

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
