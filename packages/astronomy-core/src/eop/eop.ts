/**
 * ScientificProfileV1 Earth-orientation input: independent final-only field states,
 * four-point Lagrange interpolation of the daily series (UFUQ selection of the IERS
 * Gazette 13 example), UT1 interpolated through continuous UT1-TAI, then the IERS
 * Conventions 2010 subdaily terms restored exactly once.
 */
import { DAS2R } from '../astrometry/constants.js';
import {
  type ArtifactAvailability,
  type ArtifactIdentity,
  type ExecutionScope,
  isApprovedFor,
  type ScientificApproval,
} from '../common/provenance.js';
import {
  type ApprovedLeapState,
  taiMinusUtcAtMjd,
  type TwoPartJulianDate,
  utcQuasiJulianDate,
  type ValidatedUtcInstant,
} from '../time/utc.js';
import {
  librationPolarMotionDiurnal,
  librationUt1Semidiurnal,
  oceanTideEopVariations,
} from './iers2010/subdaily-restoration.js';

export type EopFieldName = 'UT1_MINUS_UTC' | 'XP' | 'YP';
export const REQUIRED_EOP_FIELDS: readonly EopFieldName[] = ['UT1_MINUS_UTC', 'XP', 'YP'];

export type SourceFieldQuality =
  'FINAL' | 'PRELIMINARY' | 'PREDICTED' | 'IERS_ESTIMATE' | 'UNKNOWN';
export type FieldCoverage =
  'COVERED' | 'OUT_OF_RANGE' | 'GAP' | 'INSUFFICIENT_INTERPOLATION_SUPPORT';
export type PublisherValidity =
  'VALID_FOR_REQUEST' | 'EXPIRED_FOR_REQUEST' | 'NOT_DECLARED' | 'UNVERIFIED';

export interface SourceUncertainty {
  readonly value: number;
  readonly unit: 'MILLIARCSECOND' | 'MILLISECOND';
  readonly meaning: string;
}

/** One tabulated field value of one daily sample, with its native unit and quality. */
export interface EopSampleField {
  /** Native value: milliarcseconds for x/y, milliseconds for UT1-UTC (Bulletin B). */
  readonly nativeValue: number;
  readonly quality: SourceFieldQuality;
  readonly uncertainty: SourceUncertainty | null;
}

export interface EopDailySample {
  readonly sampleId: string;
  /** Integer MJD of 0h UTC. */
  readonly mjdUtc: number;
  readonly seriesId: string;
  readonly fields: Readonly<Record<EopFieldName, EopSampleField>>;
}

export interface EopFieldPolicy {
  readonly approval: ScientificApproval;
  readonly publisherValidity: PublisherValidity;
}

export interface EopBundle {
  readonly identity: ArtifactIdentity;
  readonly availability: ArtifactAvailability;
  readonly sourceProductId: string;
  /** The single explicitly reviewed coherent series the samples belong to. */
  readonly coherentSeriesId: string;
  readonly restorationConfigurationId: string;
  readonly fieldPolicies: Readonly<Record<EopFieldName, EopFieldPolicy>>;
  /** Strictly ascending by mjdUtc. */
  readonly samples: readonly EopDailySample[];
}

export interface InterpolationContributor {
  readonly sampleId: string;
  readonly mjdUtc: number;
  readonly weight: number;
  readonly supportValue: number;
}

/** The instantaneous, restored, approved state of one required field. */
export interface ApprovedEopFieldState {
  readonly field: EopFieldName;
  readonly value: number;
  readonly unit: 'SECOND' | 'RADIAN';
  readonly requestedUtc: string;
  readonly sourceProductId: string;
  readonly sourceSeriesId: string;
  readonly bundle: ArtifactIdentity;
  readonly sourceQuality: 'FINAL';
  readonly fieldCoverage: 'COVERED';
  readonly publisherValidity: PublisherValidity;
  readonly scientificApproval: ScientificApproval;
  readonly interpolation: {
    readonly method: 'LAGRANGE_FOUR_POINT_V1';
    readonly interpolatedQuantity: 'UT1_MINUS_TAI' | 'XP' | 'YP';
    readonly argument: 'UTC_MJD';
    readonly contributors: readonly InterpolationContributor[];
    readonly dailyValue: number;
  };
  readonly restoration: {
    readonly configurationId: string;
    readonly timeArgument: 'TT_MJD';
    readonly oceanTide: number;
    readonly libration: number;
    readonly unit: 'SECOND' | 'RADIAN';
  };
  /** Source-declared uncertainties of the contributors (native meaning retained). */
  readonly contributorUncertainties: readonly (SourceUncertainty | null)[];
}

export interface EarthOrientationInput {
  readonly ut1MinusUtc: ApprovedEopFieldState;
  readonly xp: ApprovedEopFieldState;
  readonly yp: ApprovedEopFieldState;
  /** UT1-TAI (s) after restoration, for constructing the UT1 state. */
  readonly ut1MinusTaiSeconds: number;
}

export type EopFailureOutcome =
  'REQUIRED_ARTIFACT_UNAVAILABLE' | 'EOP_FIELD_UNAVAILABLE' | 'TIME_OR_EOP_STATE_NOT_APPROVED';

export interface EopFailure {
  readonly ok: false;
  readonly outcome: EopFailureOutcome;
  readonly field: EopFieldName | null;
  readonly detail: string;
}

/** Lagrange basis weights for nodes `xs` at argument `x`. */
export function lagrangeWeights(xs: readonly number[], x: number): number[] {
  return xs.map((xk, k) => {
    let w = 1;
    xs.forEach((xj, j) => {
      if (j !== k) w *= (x - xj) / (xk - xj);
    });
    return w;
  });
}

const MAS_TO_RAD = DAS2R / 1000;
const MICROARCSEC_TO_RAD = DAS2R / 1e6;

/**
 * Stage 7: validate the bundle and each required field independently, interpolate, and
 * restore subdaily terms exactly once. `tt` must be the TT state of the same instant.
 */
export function earthOrientationAt(
  instant: ValidatedUtcInstant,
  tt: TwoPartJulianDate<'TT'>,
  bundle: EopBundle | undefined,
  leap: ApprovedLeapState,
  scope: ExecutionScope,
): { readonly ok: true; readonly value: EarthOrientationInput } | EopFailure {
  const fail = (outcome: EopFailureOutcome, field: EopFieldName | null, detail: string) =>
    ({ ok: false, outcome, field, detail }) as const;
  if (bundle === undefined) return fail('REQUIRED_ARTIFACT_UNAVAILABLE', null, 'No EOP bundle.');
  if (bundle.availability !== 'AVAILABLE') {
    return fail('REQUIRED_ARTIFACT_UNAVAILABLE', null, `EOP bundle ${bundle.availability}.`);
  }
  const samples = bundle.samples;
  const t = utcQuasiJulianDate(instant).part2;

  // Locate the interval [i, i+1) containing t; an exact sample uses itself as node i.
  let i = -1;
  for (let index = 0; index < samples.length; index++) {
    if ((samples[index] as EopDailySample).mjdUtc <= t) i = index;
    else break;
  }
  const window = [i - 1, i, i + 1, i + 2];
  const coverageFailure = (): FieldCoverage | null => {
    const last = samples[samples.length - 1];
    if (i < 0 || last === undefined || t > last.mjdUtc) return 'OUT_OF_RANGE';
    if (window[0]! < 0 || window[3]! > samples.length - 1) {
      return 'INSUFFICIENT_INTERPOLATION_SUPPORT';
    }
    for (let k = 1; k < 4; k++) {
      const previous = samples[window[k - 1]!] as EopDailySample;
      const current = samples[window[k]!] as EopDailySample;
      if (current.mjdUtc - previous.mjdUtc !== 1) return 'GAP';
    }
    return null;
  };
  const coverage = coverageFailure();
  const nodes = coverage === null ? window.map((k) => samples[k] as EopDailySample) : [];

  const results = new Map<
    EopFieldName,
    { daily: number; contributors: InterpolationContributor[] }
  >();
  for (const field of REQUIRED_EOP_FIELDS) {
    const policy = bundle.fieldPolicies[field];
    if (
      policy.publisherValidity === 'EXPIRED_FOR_REQUEST' ||
      policy.publisherValidity === 'UNVERIFIED'
    ) {
      return fail(
        'EOP_FIELD_UNAVAILABLE',
        field,
        `Publisher validity ${policy.publisherValidity}.`,
      );
    }
    if (coverage !== null)
      return fail('EOP_FIELD_UNAVAILABLE', field, `Field coverage ${coverage}.`);
    for (const node of nodes) {
      if (node.seriesId !== bundle.coherentSeriesId) {
        return fail(
          'EOP_FIELD_UNAVAILABLE',
          field,
          `Sample ${node.sampleId} crosses a series boundary.`,
        );
      }
      const value = node.fields[field];
      if (!Number.isFinite(value.nativeValue)) {
        return fail('EOP_FIELD_UNAVAILABLE', field, `Sample ${node.sampleId} has no finite value.`);
      }
      if (value.quality !== 'FINAL') {
        return fail(
          'TIME_OR_EOP_STATE_NOT_APPROVED',
          field,
          `Sample ${node.sampleId} quality ${value.quality}.`,
        );
      }
    }
    if (!isApprovedFor(policy.approval, scope)) {
      return fail(
        'TIME_OR_EOP_STATE_NOT_APPROVED',
        field,
        `Field approval is ${policy.approval.state} for ${policy.approval.scope}.`,
      );
    }
    const xs = nodes.map((node) => node.mjdUtc);
    const weights = lagrangeWeights(xs, t);
    const contributors = nodes.map((node, k) => {
      const native = node.fields[field].nativeValue;
      let supportValue: number;
      if (field === 'UT1_MINUS_UTC') {
        const dat = taiMinusUtcAtMjd(leap, node.mjdUtc);
        if (dat === undefined) throw new RangeError('Leap state does not cover an EOP sample.');
        supportValue = native / 1000 - dat; // UT1-TAI (s)
      } else {
        supportValue = native * MAS_TO_RAD;
      }
      return {
        sampleId: node.sampleId,
        mjdUtc: node.mjdUtc,
        weight: weights[k] as number,
        supportValue,
      };
    });
    const daily = contributors.reduce((sum, c) => sum + c.weight * c.supportValue, 0);
    results.set(field, { daily, contributors });
  }

  const ttMjd = tt.part1 - 2400000.5 + tt.part2;
  const ocean = oceanTideEopVariations(ttMjd);
  const polarLibration = librationPolarMotionDiurnal(ttMjd);
  const ut1Libration = librationUt1Semidiurnal(ttMjd);

  const make = (
    field: EopFieldName,
    unit: 'SECOND' | 'RADIAN',
    quantity: 'UT1_MINUS_TAI' | 'XP' | 'YP',
    oceanTerm: number,
    librationTerm: number,
    value: number,
  ): ApprovedEopFieldState => {
    const result = results.get(field)!;
    const policy = bundle.fieldPolicies[field];
    return {
      field,
      value,
      unit,
      requestedUtc: instant.text,
      sourceProductId: bundle.sourceProductId,
      sourceSeriesId: bundle.coherentSeriesId,
      bundle: bundle.identity,
      sourceQuality: 'FINAL',
      fieldCoverage: 'COVERED',
      publisherValidity: policy.publisherValidity,
      scientificApproval: policy.approval,
      interpolation: {
        method: 'LAGRANGE_FOUR_POINT_V1',
        interpolatedQuantity: quantity,
        argument: 'UTC_MJD',
        contributors: result.contributors,
        dailyValue: result.daily,
      },
      restoration: {
        configurationId: bundle.restorationConfigurationId,
        timeArgument: 'TT_MJD',
        oceanTide: oceanTerm,
        libration: librationTerm,
        unit,
      },
      contributorUncertainties: nodes.map((node) => node.fields[field].uncertainty),
    };
  };

  const ut1Ocean = ocean.ut1Microseconds / 1e6;
  const ut1Lib = ut1Libration.ut1Microseconds / 1e6;
  const ut1MinusTai = results.get('UT1_MINUS_UTC')!.daily + ut1Ocean + ut1Lib;
  const ut1MinusUtc = ut1MinusTai + instant.taiMinusUtcSeconds;
  const xOcean = ocean.xMicroarcseconds * MICROARCSEC_TO_RAD;
  const yOcean = ocean.yMicroarcseconds * MICROARCSEC_TO_RAD;
  const xLib = polarLibration.xMicroarcseconds * MICROARCSEC_TO_RAD;
  const yLib = polarLibration.yMicroarcseconds * MICROARCSEC_TO_RAD;
  return {
    ok: true,
    value: {
      ut1MinusUtc: make('UT1_MINUS_UTC', 'SECOND', 'UT1_MINUS_TAI', ut1Ocean, ut1Lib, ut1MinusUtc),
      xp: make('XP', 'RADIAN', 'XP', xOcean, xLib, results.get('XP')!.daily + xOcean + xLib),
      yp: make('YP', 'RADIAN', 'YP', yOcean, yLib, results.get('YP')!.daily + yOcean + yLib),
      ut1MinusTaiSeconds: ut1MinusTai,
    },
  };
}
