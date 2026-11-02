// Verifies the SOFA-derived TypeScript port against the published test values and
// absolute tolerances of the SOFA 2023-10-11 validation program `t_sofa_c.c`
// (SHA-256 pinned in scripts/codegen/sofa-2023-10-11-source-hashes.json). These are
// implementation-fidelity checks of the port, not scientific acceptance tolerances.
import { describe, expect, it } from 'vitest';

import {
  aberration,
  celestialToIntermediateMatrix,
  cioLocatorIau2006,
  contextFromObserverState,
  earthPositionVelocity,
  earthRotationAngle,
  geodeticToGeocentric,
  icrsToCirs,
  lightDeflection,
  meanObliquityIau2006,
  normalizeAnglePositive,
  normalizeAngleSigned,
  nutationIau2000A,
  nutationIau2006A,
  observerAstrometryContext,
  observerPositionVelocity,
  biasPrecessionNutationMatrix,
  catalogueToPosVel,
  cipCoordinatesFromMatrix,
  polarMotionMatrix,
  posVelToCatalogue,
  precessionAnglesIau2006,
  propagateStar,
  propagateStarSafely,
  properMotionAndParallax,
  solarLightDeflection,
  tdbMinusTt,
  tioLocator,
  type Mat3,
  type Vec3,
} from '../src/astrometry/public.js';

/** SOFA `vvd`: absolute agreement within dval. */
function vvd(value: number, expected: number, dval: number) {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(Math.abs(dval));
}

function matrixVvd(m: Mat3, expected: number[][], tolerances: number[][]) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      vvd(
        m[i as 0 | 1 | 2][j as 0 | 1 | 2],
        expected[i]?.[j] as number,
        tolerances[i]?.[j] as number,
      );
    }
  }
}

describe('SOFA-derived angles, rotation and precession-nutation', () => {
  it('normalizes angles like iauAnp/iauAnpm', () => {
    vvd(normalizeAnglePositive(-0.1), 6.183185307179586477, 1e-12);
    vvd(normalizeAngleSigned(-4.0), 2.283185307179586477, 1e-12);
  });

  it('matches iauEra00, iauSp00, iauObl06', () => {
    vvd(earthRotationAngle(2400000.5, 54388.0), 0.4022837240028158102, 1e-12);
    vvd(tioLocator(2400000.5, 52541.0), -0.6216698469981019309e-11, 1e-12);
    vvd(meanObliquityIau2006(2400000.5, 54388.0), 0.4090749229387258204, 1e-14);
  });

  it('matches iauPom00', () => {
    const r = polarMotionMatrix(2.55060238e-7, 1.860359247e-6, -0.136717458072889146e-10);
    matrixVvd(
      r,
      [
        [0.9999999999999674721, -0.1367174580728846989e-10, 0.2550602379999972345e-6],
        [0.1414624947957029801e-10, 0.9999999999982695317, -0.1860359246998866389e-5],
        [-0.2550602379741215021e-6, 0.1860359247002414021e-5, 0.9999999999982370039],
      ],
      [
        [1e-12, 1e-16, 1e-16],
        [1e-16, 1e-12, 1e-16],
        [1e-16, 1e-16, 1e-12],
      ],
    );
  });

  it('matches iauPfw06', () => {
    const a = precessionAnglesIau2006(2400000.5, 50123.9999);
    vvd(a.gamb, -0.224338767099799569e-5, 1e-16);
    vvd(a.phib, 0.4091014602391312808, 1e-12);
    vvd(a.psib, -0.9501954178013031895e-3, 1e-14);
    vvd(a.epsa, 0.4091014316587367491, 1e-12);
  });

  it('matches iauNut00a and iauNut06a', () => {
    const n0 = nutationIau2000A(2400000.5, 53736.0);
    vvd(n0.dpsi, -0.9630909107115518431e-5, 1e-13);
    vvd(n0.deps, 0.406323917400167871e-4, 1e-13);
    const n6 = nutationIau2006A(2400000.5, 53736.0);
    vvd(n6.dpsi, -0.9630912025820308797e-5, 1e-13);
    vvd(n6.deps, 0.4063238496887249798e-4, 1e-13);
  });

  it('matches iauPnm06a and iauBpn2xy', () => {
    const r = biasPrecessionNutationMatrix(2400000.5, 50123.9999);
    matrixVvd(
      r,
      [
        [0.9999995832794205484, 0.8372382772630962111e-3, 0.3639684771140623099e-3],
        [-0.8372533744743683605e-3, 0.9999996486492861646, 0.4132905944611019498e-4],
        [-0.3639337469629464969e-3, -0.4163377605910663999e-4, 0.9999999329094260057],
      ],
      [
        [1e-12, 1e-14, 1e-14],
        [1e-14, 1e-12, 1e-14],
        [1e-14, 1e-14, 1e-12],
      ],
    );
    const { x, y } = cipCoordinatesFromMatrix(r);
    expect(x).toBe(r[2][0]);
    expect(y).toBe(r[2][1]);
  });

  it('matches iauS06 and iauC2ixys', () => {
    vvd(
      cioLocatorIau2006(2400000.5, 53736.0, 0.5791308486706011e-3, 0.4020579816732961219e-4),
      -0.1220032213076463117e-7,
      1e-18,
    );
    const r = celestialToIntermediateMatrix(
      0.5791308486706011e-3,
      0.4020579816732961219e-4,
      -0.1220040848472271978e-7,
    );
    matrixVvd(
      r,
      [
        [0.9999998323037157138, 0.5581984869168499149e-9, -0.579130849161128218e-3],
        [-0.2384261642670440317e-7, 0.9999999991917468964, -0.4020579110169668931e-4],
        [0.5791308486706011e-3, 0.4020579816732961219e-4, 0.999999831495462759],
      ],
      [
        [1e-12, 1e-12, 1e-12],
        [1e-12, 1e-12, 1e-12],
        [1e-12, 1e-12, 1e-12],
      ],
    );
  });
});

describe('SOFA-derived ephemeris, time and geodesy', () => {
  it('matches iauEpv00', () => {
    const e = earthPositionVelocity(2400000.5, 53411.52501161);
    expect(e.status).toBe(0);
    const [ph, vh] = e.heliocentric;
    const [pb, vb] = e.barycentric;
    vvd(ph[0], -0.7757238809297706813, 1e-14);
    vvd(ph[1], 0.5598052241363340596, 1e-14);
    vvd(ph[2], 0.2426998466481686993, 1e-14);
    vvd(vh[0], -0.1091891824147313846e-1, 1e-15);
    vvd(vh[1], -0.1247187268440845008e-1, 1e-15);
    vvd(vh[2], -0.5407569418065039061e-2, 1e-15);
    vvd(pb[0], -0.7714104440491111971, 1e-14);
    vvd(pb[1], 0.5598412061824171323, 1e-14);
    vvd(pb[2], 0.24259962777224524, 1e-14);
    vvd(vb[0], -0.1091874268116823295e-1, 1e-15);
    vvd(vb[1], -0.1246525461732861538e-1, 1e-15);
    vvd(vb[2], -0.5404773180966231279e-2, 1e-15);
  });

  it('reports the epv00 status outside 1900-2100', () => {
    expect(earthPositionVelocity(2400000.5, 15020.0 - 36525 * 2).status).toBe(1);
  });

  it('matches iauDtdb', () => {
    vvd(
      tdbMinusTt(2448939.5, 0.123, 0.76543, 5.0123, 5525.242, 3190.0),
      -0.1280368005936998991e-2,
      1e-15,
    );
  });

  it('matches iauGd2gce and iauPvtob (WGS 84 supplied explicitly)', () => {
    const g = geodeticToGeocentric(6378136.0, 0.0033528, 3.1, -0.5, 2500.0);
    expect(g.status).toBe(0);
    if (g.status !== 0) return;
    vvd(g.xyz[0], -5598999.6665116328, 1e-7);
    vvd(g.xyz[1], 233011.6351463057189, 1e-7);
    vvd(g.xyz[2], -3040909.0517314132, 1e-7);
    const pv = observerPositionVelocity(
      { equatorialRadiusMetres: 6378137.0, flattening: 1.0 / 298.257223563 },
      2.0,
      0.5,
      3000.0,
      1e-6,
      -0.5e-6,
      1e-8,
      5.0,
    );
    expect(pv.status).toBe(0);
    if (pv.status !== 0) return;
    vvd(pv.pv[0][0], 4225081.367071159207, 1e-5);
    vvd(pv.pv[0][1], 3681943.215856198144, 1e-5);
    vvd(pv.pv[0][2], 3041149.399241260785, 1e-5);
    vvd(pv.pv[1][0], -268.4915389365998787, 1e-9);
    vvd(pv.pv[1][1], 308.0977983288903123, 1e-9);
    expect(pv.pv[1][2]).toBe(0);
  });
});

describe('SOFA-derived space motion', () => {
  const star = {
    ra: 0.01686756,
    dec: -1.093989828,
    pmr: -1.78323516e-5,
    pmd: 2.336024047e-6,
    px: 0.74723,
    rv: -21.6,
  };

  it('matches iauStarpv and iauPvstar', () => {
    const { status, pv } = catalogueToPosVel(star);
    expect(status).toBe(0);
    vvd(pv[0][0], 126668.5912743160601, 1e-10);
    vvd(pv[0][1], 2136.792716839935195, 1e-12);
    vvd(pv[0][2], -245251.2339876830091, 1e-10);
    vvd(pv[1][0], -0.4051854008955659551e-2, 1e-13);
    vvd(pv[1][1], -0.625391975441477797e-2, 1e-15);
    vvd(pv[1][2], 0.1189353714588109341e-1, 1e-13);
    const back = posVelToCatalogue([
      [126668.5912743160601, 2136.792716839935195, -245251.2339876830091],
      [-0.4051854035740712739e-2, -0.6253919754866173866e-2, 0.1189353719774107189e-1],
    ]);
    expect(back.status).toBe(0);
    if (back.status !== 0) return;
    vvd(back.star.ra, 0.1686756e-1, 1e-12);
    vvd(back.star.dec, -1.093989828, 1e-12);
    vvd(back.star.pmr, -0.1783235160000472788e-4, 1e-16);
    vvd(back.star.pmd, 0.2336024047000619347e-5, 1e-16);
    vvd(back.star.px, 0.74723, 1e-12);
    vvd(back.star.rv, -21.6000001010730601, 1e-11);
  });

  it('matches iauStarpm', () => {
    const r = propagateStar(star, 2400000.5, 50083.0, 2400000.5, 53736.0);
    expect(r.status).toBe(0);
    vvd(r.star!.ra, 0.01668919069414256149, 1e-13);
    vvd(r.star!.dec, -1.093966454217127897, 1e-13);
    vvd(r.star!.pmr, -0.1783662682153176524e-4, 1e-17);
    vvd(r.star!.pmd, 0.2338092915983989595e-5, 1e-17);
    vvd(r.star!.px, 0.7473533835317719243, 1e-13);
    vvd(r.star!.rv, -21.59905170476417175, 1e-11);
  });

  it('matches iauPmsafe', () => {
    const r = propagateStarSafely(
      { ra: 1.234, dec: 0.789, pmr: 1e-5, pmd: -2e-5, px: 1e-2, rv: 10.0 },
      2400000.5,
      48348.5625,
      2400000.5,
      51544.5,
    );
    expect(r.status).toBe(0);
    vvd(r.star!.ra, 1.234087484501017061, 1e-12);
    vvd(r.star!.dec, 0.7888249982450468567, 1e-12);
    vvd(r.star!.pmr, 0.9996457663586073988e-5, 1e-12);
    vvd(r.star!.pmd, -0.2000040085106754565e-4, 1e-16);
    vvd(r.star!.px, 0.9999997295356830666e-2, 1e-12);
    vvd(r.star!.rv, 10.38468380293920069, 1e-10);
  });

  it('preserves the pmsafe distance-override status bit', () => {
    const r = propagateStarSafely(
      { ra: 1.0, dec: 0.5, pmr: 1e-5, pmd: 1e-5, px: 0.0, rv: 0.0 },
      2400000.5,
      48348.5625,
      2400000.5,
      51544.5,
    );
    expect(r.status % 2).toBe(1);
  });
});

describe('SOFA-derived astrometry context and ICRS to CIRS', () => {
  it('matches iauPmpx, iauLd, iauLdsun and iauAb', () => {
    const pco = properMotionAndParallax(
      1.234,
      0.789,
      1e-5,
      -2e-5,
      1e-2,
      10.0,
      8.75,
      [0.9, 0.4, 0.1],
    );
    vvd(pco[0], 0.2328137623960308438, 1e-12);
    vvd(pco[1], 0.6651097085397855328, 1e-12);
    vvd(pco[2], 0.7095257765896359837, 1e-12);
    const p: Vec3 = [-0.763276255, -0.608633767, -0.216735543];
    const ld = lightDeflection(
      0.00028574,
      p,
      p,
      [0.76700421, 0.605629598, 0.211937094],
      8.91276983,
      3e-10,
    );
    vvd(ld[0], -0.7632762548968159627, 1e-12);
    vvd(ld[1], -0.6086337670823762701, 1e-12);
    vvd(ld[2], -0.2167355431320546947, 1e-12);
    const ls = solarLightDeflection(p, [-0.973644023, -0.20925523, -0.0907169552], 0.999809214);
    vvd(ls[0], -0.7632762580731413169, 1e-12);
    vvd(ls[1], -0.60863376352626479, 1e-12);
    vvd(ls[2], -0.2167355419322321302, 1e-12);
    const ab = aberration(
      [-0.76321968546737951, -0.60869453983060384, -0.21676408580639883],
      [2.1044018893653786e-5, -8.9108923304429319e-5, -3.8633714797716569e-5],
      0.99980921395708788,
      0.99999999506209258,
    );
    vvd(ab[0], -0.7631631094219556269, 1e-12);
    vvd(ab[1], -0.6087553082505590832, 1e-12);
    vvd(ab[2], -0.2167926269368471279, 1e-12);
  });

  it('matches iauApco (refraction fields are not ported; diurab is zero)', () => {
    const result = observerAstrometryContext({
      date1: 2456384.5,
      date2: 0.970031644,
      ebpv: [
        [-0.974170438, -0.211520082, -0.0917583024],
        [0.00364365824, -0.0154287319, -0.00668922024],
      ],
      ehp: [-0.973458265, -0.209215307, -0.0906996477],
      x: 0.0013122272,
      y: -2.92808623e-5,
      s: 3.05749468e-8,
      theta: 3.14540971,
      elong: -0.527800806,
      phi: -1.2345856,
      hm: 2738.0,
      ellipsoid: { equatorialRadiusMetres: 6378137.0, flattening: 1.0 / 298.257223563 },
      xp: 2.47230737e-7,
      yp: 1.82640464e-6,
      sp: -3.01974337e-11,
    });
    expect(result.status).toBe(0);
    if (result.status !== 0) return;
    const a = result.context;
    vvd(a.pmt, 13.25248468622587269, 1e-11);
    vvd(a.eb[0], -0.974182711063032272, 1e-12);
    vvd(a.eb[1], -0.2115130190135344832, 1e-12);
    vvd(a.eb[2], -0.09179840186949532298, 1e-12);
    vvd(a.eh[0], -0.9736425571689739035, 1e-12);
    vvd(a.eh[1], -0.2092452125849330936, 1e-12);
    vvd(a.eh[2], -0.09075578152243272599, 1e-12);
    vvd(a.em, 0.9998233241709957653, 1e-12);
    vvd(a.v[0], 0.2078704992916728762e-4, 1e-16);
    vvd(a.v[1], -0.8955360107151952319e-4, 1e-16);
    vvd(a.v[2], -0.3863338994288951082e-4, 1e-16);
    vvd(a.bm1, 0.9999999950277561236, 1e-12);
    matrixVvd(
      a.bpn,
      [
        [0.9999991390295159156, -0.113633665377160963e-7, -0.1312227200895260194e-2],
        [0.4978650072505016932e-7, 0.9999999995713154868, 0.292808221787231568e-4],
        [0.13122272e-2, -0.292808623e-4, 0.9999991386008323373],
      ],
      [
        [1e-12, 1e-12, 1e-12],
        [1e-12, 1e-12, 1e-12],
        [1e-12, 1e-12, 1e-12],
      ],
    );
    vvd(a.along, -0.5278008060295995734, 1e-12);
    vvd(a.xpl, 0.1133427418130752958e-5, 1e-17);
    vvd(a.ypl, 0.1453347595780646207e-5, 1e-17);
    vvd(a.sphi, -0.9440115679003211329, 1e-12);
    vvd(a.cphi, 0.3299123514971474711, 1e-12);
    expect(a.diurab).toBe(0);
    vvd(a.eral, 2.617608903970400427, 1e-12);
  });

  it('matches iauAtciq with an iauApci13-equivalent geocentric context', () => {
    const date1 = 2456165.5;
    const date2 = 0.401182685;
    const e = earthPositionVelocity(date1, date2);
    const r = biasPrecessionNutationMatrix(date1, date2);
    const { x, y } = cipCoordinatesFromMatrix(r);
    const s = cioLocatorIau2006(date1, date2, x, y);
    const motion = contextFromObserverState(
      date1,
      date2,
      [
        [0, 0, 0],
        [0, 0, 0],
      ],
      e.barycentric,
      e.heliocentric[0],
    );
    const context = {
      ...motion,
      bpn: celestialToIntermediateMatrix(x, y, s),
      along: 0,
      xpl: 0,
      ypl: 0,
      sphi: 0,
      cphi: 1,
      diurab: 0 as const,
      eral: 0,
    };
    const { ri, di } = icrsToCirs(2.71, 0.174, 1e-5, 5e-6, 0.1, 55.0, context);
    vvd(ri, 2.710121572968696744, 1e-12);
    vvd(di, 0.1729371367219539137, 1e-12);
  });
});
