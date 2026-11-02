// Verifies the IERS Conventions (2010) derived restoration port against the test cases
// printed in each pinned routine header (official package iersconventions_v1_0_0;
// PMSDNUT2 uses the corrected 2011 header values). Relative agreement 1e-12 is an
// implementation-fidelity check of the port, not a scientific tolerance.
import { describe, expect, it } from 'vitest';

import {
  fundamentalArgumentsIers2010,
  librationPolarMotionDiurnal,
  librationUt1Semidiurnal,
  oceanTideEopVariations,
  tidalPotentialPartials,
} from '../src/eop/iers2010/subdaily-restoration.js';

function close(value: number, expected: number) {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(expected)));
}

describe('IERS Conventions 2010 derived restoration routines', () => {
  it('FUNDARG test case (T = 0.07995893223819302)', () => {
    const a = fundamentalArgumentsIers2010(0.07995893223819302);
    close(a.l, 2.291187512612069099);
    // Finding: the FUNDARG header values for LP and D correspond to the IERS 2003
    // constants 1287104.793048" and 1072260.703692", while the executable code uses
    // 1287104.79305" and 1072260.70369". The port follows the code (whose PMSDNUT2 and
    // UTLIBR test values pass below); each header value differs by exactly 0.000002".
    const das2r = 4.848136811095359935899141e-6;
    close(a.lp + (1287104.793048 - 1287104.79305) * das2r, 6.212931111003726414);
    close(a.f, 3.658025792050572989);
    close(a.d + (1072260.703692 - 1072260.70369) * das2r, 4.554139562402433228);
    close(a.om, -0.5167379217231804489);
  });

  it('CNMTX test case (MJD 54964)', () => {
    const h = tidalPotentialPartials(54964.0);
    const expected = [
      15.3587364193896736, 9.784941251812741214, -5.520740128266865554, 3.575314211234633888,
      -13.93717453496387648, -9.167400321705855504, 5.532815475865292321, 9.558741883500834646,
      -10.225412126272726, 0.8367570529461261231, 1.946355176475630611, -13.55702062247304696,
    ];
    expected.forEach((value, index) => close(h[index] as number, value));
  });

  it('ORTHO_EOP test case (MJD 47100)', () => {
    const e = oceanTideEopVariations(47100.0);
    close(e.xMicroarcseconds, -162.838637327963653);
    close(e.yMicroarcseconds, 117.7907525842668974);
    close(e.ut1Microseconds, -23.39092370609808214);
  });

  it('PMSDNUT2 corrected test case (MJD 54335)', () => {
    const pm = librationPolarMotionDiurnal(54335.0);
    close(pm.xMicroarcseconds, 24.83144238273364834);
    close(pm.yMicroarcseconds, -14.09240692041837661);
  });

  it('UTLIBR test cases (MJD 44239.1 and 55227.4)', () => {
    const a = librationUt1Semidiurnal(44239.1);
    close(a.ut1Microseconds, 2.441143834386761746);
    close(a.lodMicrosecondsPerDay, -14.78971247349449492);
    const b = librationUt1Semidiurnal(55227.4);
    close(b.ut1Microseconds, -2.655705844335680244);
    close(b.lodMicrosecondsPerDay, 27.39445826599846967);
  });
});
