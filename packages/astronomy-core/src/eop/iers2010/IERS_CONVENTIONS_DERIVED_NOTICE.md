# IERS Conventions software derived-work notice

`subdaily-restoration.ts` is a **derived work** of IERS Conventions (2010) software. It
is clearly identified as UFUQ code: it is **neither distributed by nor endorsed by the
IERS Conventions Center**.

## Origin

Official package `iersconventions_v1_0_0.tar.gz` (pinned in
`data/manifests/iers-leap-eop-v1/acquisition-manifest.v1.json`), routines:

| Original routine | Chapter | SHA-256 (official package member) | UFUQ function                  |
| ---------------- | ------- | --------------------------------- | ------------------------------ |
| `ORTHO_EOP`      | 8       | `dfd1524b…5022`                   | `oceanTideEopVariations`       |
| `CNMTX`          | 8       | `8a29c599…fc93`                   | `tidalPotentialPartials`       |
| `PMSDNUT2`       | 5       | `a959ccd8…77e8`                   | `librationPolarMotionDiurnal`  |
| `UTLIBR`         | 5       | `f523335d…2406`                   | `librationUt1Semidiurnal`      |
| `FUNDARG`        | 5       | `18263cbb…ae78`                   | `fundamentalArgumentsIers2010` |

The full hashes are in the manifest's `selection.restorationSource.routines`.

## How the derived work is based on and differs from the original

1. **Translation.** Fortran 77 subroutines are translated to TypeScript functions that
   return values. Loop order and expression order follow the Fortran source.
2. **Renaming.** Every routine is renamed (table above), as clause 3(c) requires.
3. **Default-REAL literals.** Several Fortran `DATA` coefficients and one GMST
   coefficient (`-0.0000062`) are written without a `D` exponent, so Fortran stores them
   as single-precision `REAL` values before conversion to double precision. The port
   reproduces that rounding with `Math.fround`, so it matches the published test
   values. This is a deliberate fidelity choice, not a numerical change.
4. **Configuration.** `PMSDNUT2` is ported with its distributed `IBAND = 1` (quasi-diurnal
   terms only, no long-period terms or secular rate), as Section 5.5.1.1 of the
   Conventions explains and the UFUQ 2D.2 configuration pins. The unused `PER` (period)
   arrays are omitted because the original uses them only as documentation.
5. **Units.** Outputs keep the original units (microarcseconds, microseconds,
   microseconds per day); the caller converts.
6. **Test values.** The published test case in each original header is reproduced in
   `packages/astronomy-core/tests/iers2010-restoration.test.ts`. For `PMSDNUT2` the test
   uses the corrected 2011 header values (24.83144238273364834 and
   -14.09240692041837661 microarcseconds), not the pre-correction values that the
   v1.0.0 package header still prints.

## IERS Conventions Software License (reproduced intact)

```
  Copyright (C) 2008
  IERS Conventions Center

  ==================================
  IERS Conventions Software License
  ==================================

  NOTICE TO USER:

  BY USING THIS SOFTWARE YOU ACCEPT THE FOLLOWING TERMS AND CONDITIONS
  WHICH APPLY TO ITS USE.

  1. The Software is provided by the IERS Conventions Center ("the
     Center").

  2. Permission is granted to anyone to use the Software for any
     purpose, including commercial applications, free of charge,
     subject to the conditions and restrictions listed below.

  3. You (the user) may adapt the Software and its algorithms for your
     own purposes and you may distribute the resulting "derived work"
     to others,provided that the derived work complies with the
     following requirements:

     a) Your work shall be clearly identified so that it cannot be
        mistaken for IERS Conventions software and that it has been
        neither distributed by nor endorsed by the Center.

     b) Your work (including source code) must contain descriptions of
        how the derived work is based upon and/or differs from the
        original Software.

     c) The name(s) of all modified routine(s) that you distribute
        shall be changed.

     d) The origin of the IERS Conventions components of your derived
        work must not be misrepresented; you must not claim that you
        wrote the original Software.

     e) The source code must be included for all routine(s) that you
        distribute.  This notice must be reproduced intact in any
        source distribution.

  4. In any published work produced by the user and which includes
     results achieved by using the Software, you shall acknowledge
     that the Software was used in obtaining those results.

  5. The Software is provided to the user "as is" and the Center makes
     no warranty as to its use or performance.   The Center does not
     and cannot warrant the performance or results which the user may
     obtain by using the Software.  The Center makes no warranties,
     express or implied, as to non-infringement of third party rights,
     merchantability, or fitness for any particular purpose.  In no
     event will the Center be liable to the user for any consequential,
     incidental, or special damages, including any lost profits or lost
     savings, even if a Center representative has been advised of such
     damages, or for any claim by any third party.

  Correspondence concerning IERS Conventions software should be
  addressed as follows:

                     Gerard Petit
     Internet email: gpetit[at]bipm.org
     Postal address: IERS Conventions Center
                     Time, frequency and gravimetry section, BIPM
                     Pavillon de Breteuil
                     92312 Sevres  FRANCE

     or

                     Brian Luzum
     Internet email: brian.luzum[at]usno.navy.mil
     Postal address: IERS Conventions Center
                     Earth Orientation Department
                     3450 Massachusetts Ave, NW
                     Washington, DC 20392
```

Acknowledgement (clause 4): results from UFUQ that apply subdaily Earth-orientation
restoration were obtained using software derived from the IERS Conventions (2010)
software collection.
