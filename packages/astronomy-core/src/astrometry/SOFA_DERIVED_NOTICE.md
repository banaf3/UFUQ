# SOFA-derived code notice

The modules in this directory, other than `cirs-to-horizontal.ts`'s UFUQ result typing
and the UFUQ status wrappers, use routines and computations **derived by the UFUQ
project from software provided by SOFA under licence to the project**. They do **not**
constitute software provided by and/or endorsed by SOFA (the IAU Standards of
Fundamental Astronomy Board).

- Source release: IAU SOFA ANSI C, issue 2023-10-11 (`sofa_c-20231011.zip`, SHA-256
  `375729d8c0a254fd27c55484de5c8b83cccef351e1ef19d9cf7f26f5485e5538`). The SHA-256 of
  every source file used is pinned in `scripts/codegen/sofa-2023-10-11-source-hashes.json`.
- Routine names do not use the `iau` or `sofa` prefixes. Each UFUQ function names the
  SOFA routine it derives from in its documentation comment.

## How the derived work differs from SOFA

1. **Language and calling convention.** C routines writing through pointers become
   TypeScript functions returning new immutable tuples or objects. Matrix-rotation
   routines (`iauRx`, `iauRy`, `iauRz`) return a rotated copy instead of rotating in
   place. Arithmetic order inside each expression follows the C source so that IEEE-754
   double results match.
2. **Tables.** Coefficient tables of `nut00a`, `epv00`, and `dtdb` are extracted
   unchanged as decimal tokens by `scripts/codegen/extract-sofa-tables.mjs` into flat
   row-major arrays (`tables/`).
3. **Status.** Integer status codes are returned explicitly with the result
   (`status`), never discarded, including the `epv00` status that `iauApco13`
   discards.
4. **Observer ellipsoid.** `iauPvtob` hard-codes WGS 84 through `iauGd2gc(1, …)`. The
   UFUQ observer-state function takes the declared ellipsoid's equatorial radius and
   flattening explicitly and uses `iauGd2gce` semantics, so the ellipsoid comes from the
   approved observer record instead of an embedded default.
5. **Refraction and diurnal aberration.** The CIRS-to-horizontal function implements
   only the geometric part of `iauAtioq`: no refraction constants are accepted, and the
   diurnal-aberration term is fixed at zero exactly as `iauApco` sets
   `astrom->diurab = 0`, because observer velocity already carries it. At exact zenith
   or nadir the azimuth is reported as undefined rather than SOFA's `0.0`.
6. **Leap seconds.** No compiled leap-second table (`iauDat`) is ported; UTC handling
   uses the approved leap artifact supplied by the caller (see `../time/`).
7. **Subset.** Only the routines needed by ScientificProfileV1 are ported.

## SOFA Software License requirements (reproduced intact, clause 3)

> 3. You (the user) may copy and distribute SOFA source code to others, and use and
>    adapt its code and algorithms in your own software, on a world-wide, royalty-free
>    basis. That portion of your distribution that does not consist of intact and
>    unchanged copies of SOFA source code files is a "derived work" that must comply
>    with the following requirements:
>
>    a) Your work shall be marked or carry a statement that it (i) uses routines and
>    computations derived by you from software provided by SOFA under license to you;
>    and (ii) does not itself constitute software provided by and/or endorsed by SOFA.
>
>    b) The source code of your derived work must contain descriptions of how the
>    derived work is based upon, contains and/or differs from the original SOFA
>    software.
>
>    c) The names of all routines in your derived work shall not include the prefix
>    "iau" or "sofa" or trivial modifications thereof such as changes of case.
>
>    d) The origin of the SOFA components of your derived work must not be
>    misrepresented; you must not claim that you wrote the original software, nor file
>    a patent application for SOFA software or algorithms embedded in the SOFA
>    software.
>
>    e) These requirements must be reproduced intact in any source distribution and
>    shall apply to anyone to whom you have granted a further right to modify the
>    source code of your derived work.
>
>    Note that, as originally distributed, the SOFA software is intended to be a
>    definitive implementation of the IAU standards, and consequently third-party
>    modifications are discouraged. All variations, no matter how minor, must be
>    explicitly marked as such, as explained above.

The complete SOFA licence (six terms) is in every SOFA source file. Correspondence:
IAU SOFA Center, HM Nautical Almanac Office, UK Hydrographic Office
(www.iausofa.org). Acknowledgement: this software uses routines derived from IAU SOFA.
