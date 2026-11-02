import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  type Material,
} from 'three';

import type { SkyOverlayV2, SkyStarV2 } from '@ufuq/contracts';

import {
  enuToScene,
  greatCirclePoints,
  horizonPointBelow,
  SKY_RADIUS,
  starRadius,
  type Vector3Tuple,
  viewDirection,
} from './mapping.js';

export interface SkySceneProps {
  readonly stars: readonly SkyStarV2[];
  readonly overlays: readonly SkyOverlayV2[];
  readonly headingRadians: number;
  readonly pitchRadians: number;
  readonly focusedHandle: string | null;
  readonly selectedHandles: readonly string[];
  readonly showCardinalLabels: boolean;
  readonly onSelectStar: (handle: string) => void;
}

function CameraRig({ heading, pitch }: { heading: number; pitch: number }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(0, 0, 0);
    camera.lookAt(
      ...(viewDirection(heading, pitch).map((v) => v * SKY_RADIUS) as [number, number, number]),
    );
  }, [camera, heading, pitch]);
  return null;
}

function textTexture(text: string, color: string, fontPx = 48): CanvasTexture {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  if (context) {
    context.font = `600 ${fontPx}px 'Noto Naskh Arabic', 'Segoe UI', system-ui, sans-serif`;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 64);
  }
  return new CanvasTexture(canvas);
}

function Label({
  text,
  position,
  color = '#f6e7b4',
  scale = 12,
}: {
  text: string;
  position: Vector3Tuple;
  color?: string;
  scale?: number;
}) {
  const texture = useMemo(() => textTexture(text, color), [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[...position]} scale={[scale, scale / 4, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function Polyline({
  points,
  color,
  dashed = false,
}: {
  points: Vector3Tuple[];
  color: string;
  dashed?: boolean;
}) {
  const key = points.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';');
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        points.flatMap((p) => [...p]),
        3,
      ),
    );
    const material = dashed
      ? new LineDashedMaterial({
          color,
          dashSize: 2,
          gapSize: 1.4,
          transparent: true,
          opacity: 0.95,
        })
      : new LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const object = new Line(geometry, material);
    if (dashed) object.computeLineDistances();
    return object;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, color, dashed]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

export function SkyScene(props: SkySceneProps) {
  const byHandle = useMemo(() => new Map(props.stars.map((s) => [s.handle, s])), [props.stars]);
  const scenePoint = (handle: string, scale = 0.985): Vector3Tuple =>
    enuToScene(byHandle.get(handle)?.enu ?? [0, 0, 1], SKY_RADIUS * scale);
  const arcPoints = (from: string, to: string): Vector3Tuple[] =>
    greatCirclePoints(byHandle.get(from)?.enu ?? [0, 0, 1], byHandle.get(to)?.enu ?? [0, 0, 1]).map(
      (p) => enuToScene(p, SKY_RADIUS * 0.98),
    );

  return (
    <Canvas
      camera={{ fov: 70, near: 0.1, far: 1000, position: [0, 0, 0] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      aria-hidden="true"
    >
      <CameraRig heading={props.headingRadians} pitch={props.pitchRadians} />
      <color attach="background" args={['#050b1a']} />
      {/* Ground: everything below the geometric horizon is hidden by an opaque hemisphere. */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[SKY_RADIUS * 1.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#0d1a12" side={BackSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SKY_RADIUS * 0.995, SKY_RADIUS * 1.005, 128]} />
        <meshBasicMaterial color="#3d6b5c" side={BackSide} />
      </mesh>
      {props.showCardinalLabels &&
        (
          [
            ['N', [0, 1, 0.05]],
            ['E', [1, 0, 0.05]],
            ['S', [0, -1, 0.05]],
            ['W', [-1, 0, 0.05]],
          ] as const
        ).map(([text, enu]) => (
          <Label
            key={text}
            text={text}
            position={enuToScene(enu, SKY_RADIUS * 0.9)}
            color="#9fd8c4"
            scale={26}
          />
        ))}
      {props.stars
        .filter((star) => !star.belowGeometricHorizon)
        .map((star) => {
          const position = enuToScene(star.enu, SKY_RADIUS * 0.99);
          const focused = props.focusedHandle === star.handle;
          const selected = props.selectedHandles.includes(star.handle);
          const radius = starRadius(star.visualMagnitude);
          return (
            <group key={star.handle} position={[...position]}>
              <mesh
                name={star.handle}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onSelectStar(star.handle);
                }}
              >
                <sphereGeometry args={[radius * 2.6, 12, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh>
                <sphereGeometry args={[radius, 16, 16]} />
                <meshBasicMaterial color={selected ? '#ffd27a' : '#f4f7ff'} />
              </mesh>
              {focused && (
                <mesh>
                  <ringGeometry args={[radius * 2.4, radius * 2.9, 32]} />
                  <meshBasicMaterial color="#7fe3ff" side={BackSide} />
                </mesh>
              )}
            </group>
          );
        })}
      {props.overlays.map((overlay, index) => {
        if (overlay.kind === 'PATTERN_OUTLINE') {
          return overlay.segments.map(([from, to], segment) => (
            <Polyline key={`o${index}-${segment}`} points={arcPoints(from, to)} color="#e8b44f" />
          ));
        }
        if (overlay.kind === 'GUIDE_ARC') {
          const handles = overlay.handles;
          const points = handles
            .slice(1)
            .flatMap((handle, i) => arcPoints(handles[i] as string, handle));
          return <Polyline key={`g${index}`} points={points} color="#7fe3ff" dashed />;
        }
        if (overlay.kind === 'GUIDE_ARC_PARTIAL') {
          const star = byHandle.get(overlay.fromHandle);
          if (!star) return null;
          const points = greatCirclePoints(star.enu, overlay.endEnu).map((p) =>
            enuToScene(p, SKY_RADIUS * 0.98),
          );
          return <Polyline key={`p${index}`} points={points} color="#7fe3ff" dashed />;
        }
        if (overlay.kind === 'VERTICAL_TO_HORIZON') {
          const star = byHandle.get(overlay.fromHandle);
          if (!star) return null;
          const points = greatCirclePoints(star.enu, horizonPointBelow(star.enu)).map((p) =>
            enuToScene(p, SKY_RADIUS * 0.98),
          );
          return <Polyline key={`v${index}`} points={points} color="#a6f7c8" dashed />;
        }
        const label = overlay.labels.find((l) => l.script) ?? overlay.labels[0];
        if (!label) return null;
        const above = scenePoint(overlay.handle, 0.97);
        return (
          <Label
            key={`l${index}`}
            text={label.script ?? label.transliteration ?? ''}
            position={[above[0], above[1] + 4, above[2]]}
          />
        );
      })}
    </Canvas>
  );
}
