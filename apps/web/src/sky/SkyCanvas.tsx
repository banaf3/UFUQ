/**
 * Planetarium renderer (ADR-002: React Three Fiber hosts the Three.js scene).
 *
 * - Background: a full-screen shader inverse-projects every pixel to sky, ground and
 *   horizon, so all zenithal projections render exactly (Calabretta & Greisen 2002).
 * - Stars: one Points buffer; a vertex shader applies the same forward projection and the
 *   magnitude model of star-appearance.ts; additive blending.
 * - Lines and labels: a 2D overlay canvas drawn in the same frame (crisp text, correct
 *   Arabic shaping, real line widths and dashes).
 * - Picking: screen-space nearest star under the pointer, using the same projector; this
 *   replaces Three's Raycaster, which cannot follow non-linear projections.
 *
 * Per-frame view state lives in a ref and never re-renders React (ADR-002).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type IUniform,
  Matrix3,
  type ShaderMaterial,
  Vector2,
} from 'three';

import {
  altAz,
  createProjector,
  directionFromAltAz,
  type Projector,
  PROJECTIONS,
  type ProjectionId,
  type Vec3,
  viewRotation,
  type ViewState,
} from './projection.js';
import { ViewController } from './view-controller.js';
import {
  FADE_RANGE_MAGNITUDES,
  FAINTEST_OPACITY,
  STAR_BASE_RADIUS,
  starColor,
  starSprite,
} from './star-appearance.js';
import {
  type LabelState,
  placeLabels,
  type PlacementResult,
  SECONDARY_FONT,
} from './label-placement.js';
import { type SkyCanvasStar, type SkyLabel, type SkyLine, trimPolyline } from './sky-types.js';

export type { SkyCanvasStar, SkyLabel, SkyLine };

export interface SkyCanvasHandle {
  getView(): ViewState;
  /** Where the view is heading once smoothing settles (the user's intended view). */
  getTarget(): ViewState;
  setView(change: Partial<ViewState>, animate?: boolean): void;
  zoomBy(factor: number): void;
  panBy(deltaAzimuth: number, deltaAltitude: number): void;
}

export interface SkyCanvasProps {
  readonly stars: readonly SkyCanvasStar[];
  readonly lines: readonly SkyLine[];
  readonly labels: readonly SkyLabel[];
  readonly initialView: ViewState;
  readonly showGround: boolean;
  readonly showCardinals: boolean;
  readonly highlighted?: readonly number[];
  readonly limitingMagnitude?: number;
  readonly onPick?: (index: number | null) => void;
  /** A click on a label that has an id; star picking is skipped when it returns true. */
  readonly onPickLabel?: (id: string) => boolean;
  readonly onViewChange?: (view: ViewState) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

const DEG = Math.PI / 180;

const PROJECT_GLSL = /* glsl */ `
uniform mat3 uRot;
uniform int uProjection;
uniform float uScale;
uniform vec2 uHalf;
uniform float uMaxRho;
float radial(float rho) {
  if (uProjection == 0) return 2.0 * tan(rho * 0.5);
  if (uProjection == 1) return tan(rho);
  if (uProjection == 2) return rho;
  if (uProjection == 3) return 2.0 * sin(rho * 0.5);
  return sin(min(rho, 1.5707963));
}
`;

const BACKGROUND_VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BACKGROUND_FRAGMENT = /* glsl */ `
uniform mat3 uRotT;
uniform int uProjection;
uniform float uScale;
uniform vec2 uHalf;
uniform float uMaxRho;
uniform float uPixelRatio;
uniform float uGround;
void main() {
  vec2 p = gl_FragCoord.xy / uPixelRatio - uHalf;
  float len = length(p);
  float r = len / uScale;
  float rho;
  bool ok = true;
  if (uProjection == 0) rho = 2.0 * atan(r * 0.5);
  else if (uProjection == 1) rho = atan(r);
  else if (uProjection == 2) { rho = r; ok = r <= 3.14159265; }
  else if (uProjection == 3) { ok = r <= 2.0; rho = 2.0 * asin(min(r * 0.5, 1.0)); }
  else { ok = r <= 1.0; rho = asin(min(r, 1.0)); }
  if (!ok || rho > uMaxRho) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 d = len > 0.0 ? p / len : vec2(0.0);
  vec3 enu = uRotT * vec3(sin(rho) * d, -cos(rho));
  float alt = asin(clamp(enu.z, -1.0, 1.0));
  vec3 zenith = vec3(0.006, 0.012, 0.035);
  vec3 horizon = vec3(0.035, 0.068, 0.15);
  vec3 color = mix(horizon, zenith, smoothstep(0.0, 1.1, max(alt, 0.0)));
  if (uGround > 0.5 && alt < 0.0) {
    color = mix(vec3(0.045, 0.07, 0.05), vec3(0.018, 0.03, 0.022), smoothstep(0.0, 0.6, -alt));
  }
  float w = fwidth(alt) * 1.2;
  float line = 1.0 - smoothstep(0.0, w, abs(alt));
  color = mix(color, vec3(0.24, 0.45, 0.38), line * 0.9);
  gl_FragColor = vec4(color, 1.0);
}
`;

const STAR_VERTEX = /* glsl */ `
${PROJECT_GLSL}
attribute float aMag;
attribute vec3 aColor;
uniform float uLimitMag;
uniform float uBase;
uniform float uFade;
uniform float uFaintAlpha;
uniform float uPixelRatio;
uniform float uGround;
varying vec3 vColor;
varying float vAlpha;
varying float vRadius;
varying float vSize;
void main() {
  vec3 v = uRot * position;
  float rho = acos(clamp(-v.z, -1.0, 1.0));
  if (rho > uMaxRho || aMag > uLimitMag || (uGround > 0.5 && position.z < 0.0)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  float planar = length(v.xy);
  vec2 dir = planar > 1e-9 ? v.xy / planar : vec2(0.0);
  gl_Position = vec4(dir * radial(rho) * uScale / uHalf, 0.0, 1.0);
  float perceived = pow(10.0, -0.2 * (aMag - uLimitMag));
  float radius = uBase * sqrt(perceived);
  float ramp = min(1.0, (uLimitMag - aMag) / uFade);
  float alpha = uFaintAlpha + (1.0 - uFaintAlpha) * ramp;
  vRadius = radius * uPixelRatio;
  vSize = ceil(vRadius * 7.0) + 2.0;
  gl_PointSize = vSize;
  vColor = aColor;
  vAlpha = alpha;
}
`;

const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vRadius;
varying float vSize;
void main() {
  float d = length(gl_PointCoord - 0.5) * vSize;
  // A solid disc of the computed radius with a soft core and a halo that grows with size.
  float disc = 1.0 - smoothstep(0.7 * vRadius, vRadius, d);
  float core = exp(-0.5 * (d * d) / (0.3 * vRadius * vRadius));
  float halo = exp(-0.5 * (d * d) / (4.0 * vRadius * vRadius)) * clamp(0.08 * vRadius, 0.08, 0.35);
  float intensity = (max(disc * 0.95, core) + halo) * vAlpha;
  if (intensity < 0.003) discard;
  gl_FragColor = vec4(vColor * intensity, intensity);
}
`;

function useStarGeometry(stars: readonly SkyCanvasStar[]) {
  return useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(stars.length * 3);
    const magnitudes = new Float32Array(stars.length);
    const colors = new Float32Array(stars.length * 3);
    stars.forEach((star, i) => {
      positions.set(star.enu, i * 3);
      magnitudes[i] = star.magnitude;
      colors.set(starColor(star.colorIndexBV), i * 3);
    });
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aMag', new BufferAttribute(magnitudes, 1));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    return geometry;
  }, [stars]);
}

function sharedUniforms() {
  return {
    uRot: { value: new Matrix3() },
    uRotT: { value: new Matrix3() },
    uProjection: { value: 0 },
    uScale: { value: 1 },
    uHalf: { value: new Vector2(1, 1) },
    uMaxRho: { value: Math.PI },
    uPixelRatio: { value: 1 },
    uGround: { value: 1 },
  };
}

interface LayersProps {
  readonly controller: ViewController;
  readonly stars: readonly SkyCanvasStar[];
  readonly showGround: boolean;
  readonly limitingMagnitude: number;
  /** Draws lines and labels; true while labels are still fading. */
  readonly drawOverlay: (dt: number) => boolean;
  readonly onFrameView: (view: ViewState) => void;
}

/** Writes the per-frame uniforms (outside React, so mutation stays out of render). */
function writeUniforms(
  uniforms: Record<string, IUniform>,
  view: ViewState,
  projector: Projector,
  size: { width: number; height: number },
  pixelRatio: number,
  showGround: boolean,
  limitingMagnitude?: number,
) {
  const projection = PROJECTIONS[view.projection];
  const m = viewRotation(view.azimuth, view.altitude);
  uniforms.uRot!.value.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
  uniforms.uRotT!.value.set(m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]);
  uniforms.uProjection!.value = projection.shaderIndex;
  uniforms.uScale!.value = projector.scale;
  uniforms.uHalf!.value.set(size.width / 2, size.height / 2);
  uniforms.uMaxRho!.value = projection.maxRho;
  uniforms.uPixelRatio!.value = pixelRatio;
  uniforms.uGround!.value = showGround ? 1 : 0;
  if (limitingMagnitude !== undefined && uniforms.uLimitMag)
    uniforms.uLimitMag.value = limitingMagnitude;
}

function SkyLayers({
  controller,
  stars,
  showGround,
  limitingMagnitude,
  drawOverlay,
  onFrameView,
}: LayersProps) {
  const background = useRef<ShaderMaterial>(null);
  const starMaterial = useRef<ShaderMaterial>(null);
  const geometry = useStarGeometry(stars);
  const { size, gl } = useThree();
  const invalidateRoot = useThree((state) => state.invalidate);
  useEffect(() => {
    controller.bindRequestFrame(() => invalidateRoot());
    invalidateRoot();
  }, [controller, invalidateRoot]);
  const backgroundUniforms = useMemo(() => sharedUniforms(), []);
  const starUniforms = useMemo(
    () => ({
      ...sharedUniforms(),
      uLimitMag: { value: 6.5 },
      uBase: { value: STAR_BASE_RADIUS },
      uFade: { value: FADE_RANGE_MAGNITUDES },
      uFaintAlpha: { value: FAINTEST_OPACITY },
    }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    controller.setSize(size.width, size.height);
    controller.requestFrame();
  }, [size.width, size.height, controller]);
  useEffect(() => {
    controller.requestFrame();
  }, [showGround, limitingMagnitude, stars, controller]);

  useFrame((_, delta) => {
    const moving = controller.step(Math.min(delta, 0.05));
    const view = controller.view;
    const projector = controller.projector();
    const dimensions = { width: controller.width, height: controller.height };
    const ratio = gl.getPixelRatio();
    // R3F copies the uniforms prop into the material, so write the material's own object.
    writeUniforms(
      background.current?.uniforms ?? backgroundUniforms,
      view,
      projector,
      dimensions,
      ratio,
      showGround,
    );
    writeUniforms(
      starMaterial.current?.uniforms ?? starUniforms,
      view,
      projector,
      dimensions,
      ratio,
      showGround,
      limitingMagnitude,
    );
    const fading = drawOverlay(Math.min(delta, 0.05));
    onFrameView(view);
    if (moving || fading) controller.requestFrame();
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={0}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={background}
          vertexShader={BACKGROUND_VERTEX}
          fragmentShader={BACKGROUND_FRAGMENT}
          uniforms={backgroundUniforms}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <points frustumCulled={false} renderOrder={1} geometry={geometry}>
        <shaderMaterial
          ref={starMaterial}
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={starUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </>
  );
}

const CARDINALS: readonly (readonly [string, number])[] = [
  ['N', 0],
  ['NE', 45],
  ['E', 90],
  ['SE', 135],
  ['S', 180],
  ['SW', 225],
  ['W', 270],
  ['NW', 315],
];

export const SkyCanvas = forwardRef<SkyCanvasHandle, SkyCanvasProps>(
  function SkyCanvas(props, ref) {
    const [controller] = useState(() => new ViewController(props.initialView));
    const container = useRef<HTMLDivElement>(null);
    const overlay = useRef<HTMLCanvasElement>(null);
    /** Screen boxes (CSS px from the top left) of the clickable labels drawn last frame. */
    const labelHits = useRef<PlacementResult['hits']>([]);
    /** Each label's place and fade, kept between frames so names stay steady. */
    const labelStates = useRef(new Map<string, LabelState>());
    /** Measured text widths by font and text (cleared when the name font loads). */
    const textWidths = useRef(new Map<string, number>());
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef({
      moved: false,
      startX: 0,
      startY: 0,
      pinchDistance: 0,
      pinchFov: 0,
      lastTime: 0,
    });
    const latest = useRef(props);
    useLayoutEffect(() => {
      latest.current = props;
    });
    const lastReported = useRef(0);

    const setTarget = useCallback(
      (change: Partial<ViewState>, animate = true) => {
        controller.setTarget(change, animate);
        controller.requestFrame();
      },
      [controller],
    );

    useImperativeHandle(
      ref,
      () => ({
        getView: () => controller.view,
        getTarget: () => controller.target,
        setView: setTarget,
        zoomBy: (factor) => setTarget({ fov: controller.target.fov * factor }),
        panBy: (deltaAzimuth, deltaAltitude) =>
          setTarget(
            {
              azimuth: controller.target.azimuth + deltaAzimuth,
              altitude: controller.target.altitude + deltaAltitude,
            },
            false,
          ),
      }),
      [setTarget, controller],
    );

    const drawOverlay = useCallback(
      (dt: number): boolean => {
        const canvas = overlay.current;
        const p = latest.current;
        if (!canvas) return false;
        const ratio = window.devicePixelRatio || 1;
        const width = controller.width;
        const height = controller.height;
        if (
          canvas.width !== Math.round(width * ratio) ||
          canvas.height !== Math.round(height * ratio)
        ) {
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const projector = controller.projector();
        const cx = width / 2;
        const cy = height / 2;
        const toScreen = (direction: Vec3): [number, number] | null => {
          if (p.showGround && direction[2] < -0.002) return null;
          const point = projector.project(direction);
          return point === null ? null : [cx + point[0], cy - point[1]];
        };
        const jump = Math.min(width, height) * 0.45;
        // A line stops short of each star by its drawn radius (with its soft edge) plus
        // 0.2 degrees, as Stellarium Web Engine does, and never by less than 2 pixels.
        const limitingMagnitude = p.limitingMagnitude ?? 6.5;
        const gap = Math.max(2, 0.2 * DEG * projector.scale);
        const endTrim = (magnitude: number | undefined, fallback: number) =>
          magnitude === undefined
            ? fallback
            : 1.25 * starSprite(magnitude, limitingMagnitude).radius + gap;

        for (const line of p.lines) {
          ctx.beginPath();
          // Split into continuous screen runs; trim only the line's own two ends.
          const runs: [number, number][][] = [];
          let run: [number, number][] = [];
          for (const point of line.points) {
            const screen = toScreen(point);
            const last = run[run.length - 1];
            if (screen && (!last || Math.hypot(screen[0] - last[0], screen[1] - last[1]) < jump)) {
              run.push(screen);
            } else {
              if (run.length > 1) runs.push(run);
              run = screen ? [screen] : [];
            }
          }
          if (run.length > 1) runs.push(run);
          const trimFirst = endTrim(line.endMagnitudes?.[0], line.trim ?? 0);
          const trimLast = endTrim(line.endMagnitudes?.[1], line.trim ?? 0);
          const firstVisible = line.points[0] !== undefined && toScreen(line.points[0]) !== null;
          const lastPoint = line.points[line.points.length - 1];
          const lastVisible = lastPoint !== undefined && toScreen(lastPoint) !== null;
          runs.forEach((points, index) => {
            const startTrim = firstVisible && index === 0 ? trimFirst : 0;
            const finishTrim = lastVisible && index === runs.length - 1 ? trimLast : 0;
            const drawn =
              startTrim + finishTrim > 0 ? trimPolyline(points, startTrim, finishTrim) : points;
            drawn.forEach((point, i) =>
              i === 0 ? ctx.moveTo(point[0], point[1]) : ctx.lineTo(point[0], point[1]),
            );
          });
          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.width;
          ctx.setLineDash(line.dash ? [...line.dash] : []);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // The compass letters on the horizon, which names keep clear of.
        const cardinals: { text: string; x: number; y: number }[] = [];
        if (p.showCardinals)
          for (const [text, degrees] of CARDINALS) {
            const screen = toScreen(directionFromAltAz(0.0, degrees * DEG));
            if (screen) cardinals.push({ text, x: screen[0], y: screen[1] - 14 });
          }
        const { drawn, hits, fading } = placeLabels({
          obstacles: cardinals.map(({ text, x, y }): [number, number, number, number] => {
            const half = text.length * 6;
            return [x - half, y - 10, x + half, y + 10];
          }),
          labels: p.labels,
          fov: controller.view.fov,
          width,
          height,
          toScreen,
          measure: (font, text) => {
            const key = `${font}\n${text}`;
            let measured = textWidths.current.get(key);
            if (measured === undefined) {
              ctx.font = font;
              measured = ctx.measureText(text).width;
              textWidths.current.set(key, measured);
            }
            return measured;
          },
          states: labelStates.current,
          dt,
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        for (const { label, x, y, gap: lineGap, opacity } of drawn) {
          ctx.globalAlpha = opacity;
          ctx.shadowBlur = 4;
          ctx.fillStyle = label.color;
          ctx.font = label.font;
          ctx.fillText(label.text, x, y);
          if (label.secondary) {
            ctx.font = label.secondaryFont ?? SECONDARY_FONT;
            ctx.fillText(label.secondary, x, y + lineGap);
          }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        labelHits.current = hits;

        ctx.font = '600 15px Inter, ui-sans-serif, system-ui, sans-serif';
        for (const { text, x, y } of cardinals) {
          ctx.fillStyle = text.length === 1 ? '#9fd8c4' : 'rgba(159, 216, 196, 0.6)';
          ctx.fillText(text, x, y);
        }

        for (const index of p.highlighted ?? []) {
          const star = p.stars[index];
          if (!star) continue;
          const screen = toScreen(star.enu);
          if (!screen) continue;
          ctx.beginPath();
          ctx.arc(screen[0], screen[1], 11, 0, 2 * Math.PI);
          ctx.strokeStyle = '#ffd27a';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        return fading;
      },
      [controller],
    );

    const onFrameView = useCallback(
      (view: ViewState) => {
        const now = performance.now();
        if (now - lastReported.current < 80 && !controller.settled) return;
        lastReported.current = now;
        latest.current.onViewChange?.(view);
      },
      [controller],
    );

    useEffect(() => {
      controller.requestFrame();
    }, [props.lines, props.labels, props.highlighted, props.showCardinals, controller]);

    // Canvas text does not wait for web fonts: load the name font, then draw again.
    useEffect(() => {
      const fonts = typeof document === 'undefined' ? undefined : document.fonts;
      if (!fonts) return;
      let active = true;
      // The 500 weight for every name, 700 for the star the guidance leads to (al-Jady).
      const fonts500 = ['500 16px Tajawal', '500 12px Tajawal', '700 12px Tajawal'];
      void Promise.all(fonts500.map((font) => fonts.load(font, 'الجدي Al-Jady')))
        .catch(() => undefined)
        .then(() => {
          if (!active) return;
          // Widths measured with a fallback font before Tajawal arrived are wrong.
          textWidths.current.clear();
          controller.requestFrame();
        });
      return () => {
        active = false;
      };
    }, [controller]);

    // Wheel zoom needs a non-passive listener to prevent page scrolling.
    useEffect(() => {
      const element = container.current;
      if (!element) return;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const factor = Math.exp(Math.max(-200, Math.min(200, event.deltaY)) * 0.0015);
        controller.zoomBy(factor);
        controller.requestFrame();
      };
      element.addEventListener('wheel', onWheel, { passive: false });
      return () => element.removeEventListener('wheel', onWheel);
    }, [controller]);

    const pick = (clientX: number, clientY: number) => {
      const element = container.current;
      const p = latest.current;
      if (!element || !p.onPick) return;
      const rect = element.getBoundingClientRect();
      const left = clientX - rect.left;
      const top = clientY - rect.top;
      const label = labelHits.current.find(
        ({ box }) => left >= box[0] && left <= box[2] && top >= box[1] && top <= box[3],
      );
      if (label && p.onPickLabel?.(label.id)) return;
      const x = clientX - rect.left - rect.width / 2;
      const y = rect.height / 2 - (clientY - rect.top);
      const projector = createProjector(controller.view, rect.width, rect.height);
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      const limit = p.limitingMagnitude ?? 6.5;
      p.stars.forEach((star, index) => {
        if (star.magnitude > limit || (p.showGround && star.enu[2] < 0)) return;
        const screen = projector.project(star.enu);
        if (!screen) return;
        const distance = Math.hypot(screen[0] - x, screen[1] - y);
        const tolerance = 9 + Math.max(0, 3 - star.magnitude) * 2;
        if (distance > tolerance) return;
        const score = distance - (6.5 - star.magnitude) * 0.8;
        if (score < bestScore) {
          bestScore = score;
          best = index;
        }
      });
      p.onPick(best === -1 ? null : best);
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      controller.beginDrag();
      gesture.current = {
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        pinchDistance: 0,
        pinchFov: controller.view.fov,
        lastTime: performance.now(),
      };
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        gesture.current.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        gesture.current.pinchFov = controller.view.fov;
      }
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (gesture.current.pinchDistance > 0) {
          controller.zoomTo(gesture.current.pinchFov * (gesture.current.pinchDistance / distance));
          gesture.current.moved = true;
          controller.requestFrame();
        }
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (
        Math.hypot(event.clientX - gesture.current.startX, event.clientY - gesture.current.startY) >
        4
      )
        gesture.current.moved = true;
      const now = performance.now();
      const dt = Math.max(1, now - gesture.current.lastTime) / 1000;
      gesture.current.lastTime = now;
      controller.dragBy(dx, dy, dt);
      controller.requestFrame();
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size > 0) return;
      controller.endDrag(performance.now() - gesture.current.lastTime <= 80);
      if (!gesture.current.moved) pick(event.clientX, event.clientY);
      controller.requestFrame();
    };

    const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
      const element = container.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const direction = createProjector(controller.view, rect.width, rect.height).unproject(
        event.clientX - rect.left - rect.width / 2,
        rect.height / 2 - (event.clientY - rect.top),
      );
      if (!direction) return;
      const { altitude, azimuth } = altAz(direction);
      setTarget({ altitude, azimuth });
    };

    return (
      <div
        ref={container}
        className={`sky-canvas ${props.className ?? ''}`}
        role="img"
        aria-label={props.ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          aria-hidden="true"
        >
          <SkyLayers
            controller={controller}
            stars={props.stars}
            showGround={props.showGround}
            limitingMagnitude={props.limitingMagnitude ?? 6.5}
            drawOverlay={drawOverlay}
            onFrameView={onFrameView}
          />
        </Canvas>
        <canvas ref={overlay} className="sky-overlay" aria-hidden="true" />
      </div>
    );
  },
);

export type { ProjectionId, ViewState };
