/**
 * Pure astronomy boundary. Phase 1 SPIKE: typed coordinate flow from a caller-supplied
 * local sidereal time to horizontal/ENU/scene vectors. It deliberately contains no
 * catalogue, time-scale, Earth-orientation, precession, aberration or refraction policy
 * (AST-003/004 unresolved), and no tolerance (AST-006 unresolved).
 */
export { normalizeDegrees360, normalizeDegreesSigned } from './angles.js';
export {
  asBearingNorthEastDeg,
  asLocalSiderealTimeHours,
  enuToHorizontal,
  enuToSceneVector,
  equatorialToEnu,
  equatorialToHorizontal,
  hourAngleWestDeg,
  validateObserver,
} from './horizontal.js';
export { bearingDistanceDeg, vectorSeparationDeg } from './separation.js';
export type {
  BearingNorthEastDeg,
  EnuUnitVector,
  EquatorialDirection,
  HorizontalCoordinate,
  HourAngleWestDeg,
  LocalSiderealTimeHours,
  ObserverLocation,
  SceneVector,
} from './types.js';
