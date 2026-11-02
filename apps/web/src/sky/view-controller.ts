/**
 * Per-frame view state of the sky map, kept outside React state (ADR-002): the current
 * view, the target it eases towards, drag inertia and the viewport size. Mutated only
 * through these methods from pointer handlers and the render loop.
 */
import { clampFov, createProjector, type Projector, type ViewState } from './projection.js';

const DEG = Math.PI / 180;
export const MIN_ALTITUDE = -85 * DEG;
export const MAX_ALTITUDE = 89.9 * DEG;

const clampAltitude = (altitude: number) =>
  Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude));

export class ViewController {
  private current: ViewState;
  private goal: ViewState;
  private velocity = { azimuth: 0, altitude: 0 };
  private dragging = false;
  private size = { width: 1, height: 1 };

  constructor(initial: ViewState) {
    this.current = initial;
    this.goal = initial;
  }

  get view(): ViewState {
    return this.current;
  }

  get target(): ViewState {
    return this.goal;
  }

  get width(): number {
    return this.size.width;
  }

  get height(): number {
    return this.size.height;
  }

  get settled(): boolean {
    return this.current === this.goal;
  }

  setSize(width: number, height: number): void {
    this.size = { width: Math.max(1, width), height: Math.max(1, height) };
  }

  projector(): Projector {
    return createProjector(this.current, this.size.width, this.size.height);
  }

  /** Eases towards the change; without animation the view jumps there. */
  setTarget(change: Partial<ViewState>, animate = true): void {
    const projection = change.projection ?? this.goal.projection;
    this.goal = {
      projection,
      azimuth: change.azimuth ?? this.goal.azimuth,
      altitude: clampAltitude(change.altitude ?? this.goal.altitude),
      fov: clampFov(change.fov ?? this.goal.fov, projection),
    };
    this.velocity = { azimuth: 0, altitude: 0 };
    if (!animate) this.current = this.goal;
  }

  /** Multiplies the target field of view (a wheel or button zoom). */
  zoomBy(factor: number): void {
    this.setTarget({ fov: this.goal.fov * factor });
  }

  beginDrag(): void {
    this.dragging = true;
    this.velocity = { azimuth: 0, altitude: 0 };
    this.goal = this.current;
  }

  /** "Grab the sky": the sky follows the pointer by (dx, dy) CSS pixels over dt seconds. */
  dragBy(dx: number, dy: number, dt: number): void {
    const scale = this.projector().scale;
    const dAz = -dx / scale / Math.max(Math.cos(this.current.altitude), 0.25);
    const dAlt = dy / scale;
    this.current = {
      ...this.current,
      azimuth: this.current.azimuth + dAz,
      altitude: clampAltitude(this.current.altitude + dAlt),
    };
    this.goal = this.current;
    this.velocity = { azimuth: dAz / dt, altitude: dAlt / dt };
  }

  zoomTo(fov: number): void {
    this.current = { ...this.current, fov: clampFov(fov, this.current.projection) };
    this.goal = this.current;
  }

  endDrag(keepInertia: boolean): void {
    this.dragging = false;
    if (!keepInertia) this.velocity = { azimuth: 0, altitude: 0 };
  }

  /** Advances inertia and easing by dt seconds; true while still moving. */
  step(dt: number): boolean {
    let moving = false;
    const v = this.velocity;
    if (!this.dragging && (Math.abs(v.azimuth) > 1e-4 || Math.abs(v.altitude) > 1e-4)) {
      this.goal = {
        ...this.goal,
        azimuth: this.goal.azimuth + v.azimuth * dt,
        altitude: clampAltitude(this.goal.altitude + v.altitude * dt),
      };
      const decay = Math.exp(-dt * 4);
      this.velocity = { azimuth: v.azimuth * decay, altitude: v.altitude * decay };
      moving = true;
    }
    const k = 1 - Math.exp(-dt * 14);
    const c = this.current;
    const g = this.goal;
    const dAz = Math.atan2(Math.sin(g.azimuth - c.azimuth), Math.cos(g.azimuth - c.azimuth));
    const far =
      Math.abs(dAz) > 1e-5 ||
      Math.abs(g.altitude - c.altitude) > 1e-5 ||
      Math.abs(Math.log(g.fov / c.fov)) > 1e-5 ||
      g.projection !== c.projection;
    if (far) {
      this.current = {
        projection: g.projection,
        azimuth: c.azimuth + dAz * k,
        altitude: c.altitude + (g.altitude - c.altitude) * k,
        fov: c.fov * Math.exp(Math.log(g.fov / c.fov) * k),
      };
      return true;
    }
    this.current = g;
    return moving;
  }
}
