/**
 * Pure astronomy boundary (ScientificProfileV1).
 *
 * Contains UFUQ-owned TypeScript derived from IAU SOFA 2023-10-11 (`astrometry/`) and
 * from IERS Conventions (2010) software (`eop/iers2010/`). Neither is SOFA or IERS
 * software, nor endorsed by them; see the notices in those directories.
 */
export * from './common/provenance.js';
export * from './time/calendar.js';
export * from './time/utc.js';
export * from './time/supported-domain.js';
export * from './eop/eop.js';
export * from './eop/iers2010/subdaily-restoration.js';
export * from './observer/observer-preset.js';
export * from './catalogue/catalogue-star.js';
export * from './profile/evaluate.js';
export * as astrometry from './astrometry/public.js';
