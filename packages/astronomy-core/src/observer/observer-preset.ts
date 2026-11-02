/** Generic fail-closed ObserverPreset contract (ScientificProfileV1, 2C.6; data from 2D.3). */
import type {
  ArtifactAvailability,
  ArtifactIdentity,
  ScientificApproval,
} from '../common/provenance.js';

export type ReferenceSystemKind = 'GEODETIC_DATUM' | 'TERRESTRIAL_REFERENCE_FRAME';

export interface ObserverReferenceEllipsoid {
  readonly ellipsoidId: string;
  readonly equatorialRadiusMetres: number;
  readonly inverseFlattening: number;
  readonly source: string;
}

export type CoordinateReferenceEpoch =
  | { readonly state: 'DECLARED'; readonly value: string; readonly scale: string }
  | { readonly state: 'NOT_REQUIRED'; readonly basis: string };

export type ObserverHeight =
  | { readonly kind: 'ELLIPSOIDAL'; readonly valueMetres: number; readonly ellipsoidId: string }
  | { readonly kind: 'ORTHOMETRIC'; readonly valueMetres: number; readonly verticalDatum: string };

export type AccuracyComponent =
  | {
      readonly state: 'SOURCE_DECLARED' | 'DERIVED';
      readonly boundMetres: number;
      readonly meaning: string;
      readonly method: string;
    }
  | { readonly state: 'UNKNOWN_UNBOUNDED'; readonly reason: string };

export interface ObserverPreset {
  readonly schemaVersion: 1;
  readonly presetId: string;
  readonly displayLabel: string;
  readonly siteIdentity: string;
  readonly referencePointDescription: string;
  readonly geodeticLatitudeDegrees: number;
  readonly geodeticLongitudeDegrees: number;
  readonly referenceSystem: {
    readonly kind: ReferenceSystemKind;
    readonly identifier: string;
    readonly realization: string | null;
  };
  readonly referenceEllipsoid: ObserverReferenceEllipsoid;
  readonly coordinateReferenceEpoch: CoordinateReferenceEpoch;
  readonly height: ObserverHeight;
  readonly coordinateAccuracy: {
    readonly horizontal: AccuracyComponent;
    readonly vertical: AccuracyComponent;
  };
  readonly provenance: readonly string[];
  readonly dataVersionId: string;
  readonly identity: ArtifactIdentity;
  readonly availability: ArtifactAvailability;
  readonly approval: ScientificApproval;
}

export type ObserverValidation =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Structural/unit/range/reference-system validation, independent of approval. */
export function validateObserverPreset(preset: ObserverPreset): ObserverValidation {
  const lat = preset.geodeticLatitudeDegrees;
  const lon = preset.geodeticLongitudeDegrees;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, reason: 'Latitude not finite in [-90, 90] degrees.' };
  }
  if (!Number.isFinite(lon) || lon < -180 || lon >= 180) {
    return { ok: false, reason: 'Longitude not finite in canonical [-180, 180) degrees.' };
  }
  const ellipsoid = preset.referenceEllipsoid;
  if (
    !Number.isFinite(ellipsoid.equatorialRadiusMetres) ||
    ellipsoid.equatorialRadiusMetres <= 0 ||
    !Number.isFinite(ellipsoid.inverseFlattening) ||
    ellipsoid.inverseFlattening <= 1
  ) {
    return { ok: false, reason: 'Reference ellipsoid parameters invalid.' };
  }
  if (preset.height.kind !== 'ELLIPSOIDAL') {
    return { ok: false, reason: 'ProfileV1 requires an ellipsoidal height.' };
  }
  if (preset.height.ellipsoidId !== ellipsoid.ellipsoidId) {
    return { ok: false, reason: 'Height ellipsoid differs from the coordinate ellipsoid.' };
  }
  if (!Number.isFinite(preset.height.valueMetres)) {
    return { ok: false, reason: 'Height not finite.' };
  }
  if (preset.referenceSystem.identifier.trim() === '') {
    return { ok: false, reason: 'Reference system must be named; WGS 84 is never inferred.' };
  }
  return { ok: true };
}
