// Sky-explorer parser tests with synthetic inputs only (no raw source bytes).
import { describe, expect, it } from 'vitest';

import { HIP_MAIN_COLUMNS, type HipMainNativeRow } from '../src/parsers/hipparcos-esa-1997.js';
import {
  arabicScriptFromEtymology,
  decodeHtml,
  parseBscCatalog,
  parseConstellationLines,
  parseNaojConstellations,
  parseWgsnNames,
  sexagesimalToRadians,
  skyFieldRow,
} from '../src/parsers/sky-sources.js';

const DEG = Math.PI / 180;

function row(values: Record<string, string>): HipMainNativeRow {
  return {
    ...Object.fromEntries(HIP_MAIN_COLUMNS.map((column) => [column, ''])),
    ...values,
  } as HipMainNativeRow;
}

describe('sky field rows', () => {
  it('keeps a full astrometric solution', () => {
    const star = skyFieldRow(
      row({
        HIP: '746',
        RAdeg: '2.5',
        DEdeg: '59',
        Plx: '59.89',
        pmRA: '523.39',
        pmDE: '-180.42',
        Vmag: '2.28',
        'B-V': '0.380',
        HD: '432',
      }),
    );
    expect(star).toMatchObject({
      hip: 746,
      astrometry: 'FULL_SOLUTION',
      parallaxMas: 59.89,
      colorIndexBV: 0.38,
      henryDraperNumber: 432,
    });
    expect(star.rightAscensionRadians).toBeCloseTo(2.5 * DEG, 15);
  });

  it('falls back to the coarse h/m/s position without a solution', () => {
    const star = skyFieldRow(
      row({ HIP: '55203', RAhms: '11 18 11.24', DEdms: '+31 31 50.8', Vmag: '3.79', HD: '' }),
    );
    expect(star).toMatchObject({
      astrometry: 'COARSE_POSITION_NO_SOLUTION',
      parallaxMas: 0,
      colorIndexBV: null,
      henryDraperNumber: null,
    });
    const [ra, dec] = sexagesimalToRadians('11 18 11.24', '+31 31 50.8');
    expect(star.rightAscensionRadians).toBe(ra);
    expect(dec / DEG).toBeCloseTo(31 + 31 / 60 + 50.8 / 3600, 12);
    expect(sexagesimalToRadians('00 00 00.00', '-00 30 00.0')[1] / DEG).toBeCloseTo(-0.5, 12);
  });

  it('refuses a row without a magnitude or a readable position', () => {
    expect(() =>
      skyFieldRow(row({ HIP: '1', RAdeg: '1', DEdeg: '1', Plx: '1', pmRA: '0', pmDE: '0' })),
    ).toThrow();
    expect(() => skyFieldRow(row({ HIP: '1', Vmag: '5', RAhms: 'x', DEdms: 'y' }))).toThrow();
  });
});

describe('Bright Star Catalogue fixed-width rows (V/50 ReadMe byte layout)', () => {
  const line = (hr: string, hd: string, ra: string, dec: string) =>
    `${hr.padStart(4)}${' '.repeat(21)}${hd.padStart(6)}${' '.repeat(44)}${ra}${dec}`;

  it('reads HR, HD and the J2000 position', () => {
    const rows = parseBscCatalog(
      `${line('15', '358', '000823.3', '+290526')}\n${line('9999', '', '        ', '       ')}\n`,
    );
    expect(rows.get(15)).toMatchObject({ hr: 15, hd: 358 });
    expect((rows.get(15)?.rightAscensionRadians ?? 0) / DEG).toBeCloseTo(
      (8 / 60 + 23.3 / 3600) * 15,
      9,
    );
    expect((rows.get(15)?.declinationRadians ?? 0) / DEG).toBeCloseTo(29 + 5 / 60 + 26 / 3600, 9);
    expect(rows.get(9999)).toMatchObject({ hd: null, rightAscensionRadians: null });
  });
});

describe('constellation lines (van der Sluys CSV)', () => {
  it('continues a constellation on a line with a blank abbreviation', () => {
    const lines = parseConstellationLines(
      'abr, nr, s01, s02\nCru,  2, 4853, 4656\n   ,  2, 4730, 4763\nCrv,  2, 4623, 4630\n',
    );
    expect(lines).toEqual([
      { abbreviation: 'Cru', hr: [4853, 4656] },
      { abbreviation: 'Cru', hr: [4730, 4763] },
      { abbreviation: 'Crv', hr: [4623, 4630] },
    ]);
  });

  it('rejects a count mismatch and a changed header', () => {
    expect(() => parseConstellationLines('abr, nr, s01\nAnd,  2, 15\n')).toThrow();
    expect(() => parseConstellationLines('name, n\nAnd, 1, 15\n')).toThrow();
  });
});

describe('name tables', () => {
  it('reads the 88 IAU names across split NAOJ tables', () => {
    const table = (rows: [string, string][]) =>
      `<table><tr><th>Abbr.</th><th>Names</th></tr>${rows.map(([a, n]) => `<tr><td>${a}</td><td>${n}</td></tr>`).join('')}</table>`;
    const names = Array.from({ length: 88 }, (_, i): [string, string] => [
      `C${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
      `Name ${i}`,
    ]);
    const map = parseNaojConstellations(
      `<body>${table(names.slice(0, 44))}${table(names.slice(44))}</body>`,
    );
    expect(map.size).toBe(88);
    expect(() => parseNaojConstellations(`<body>${table(names.slice(0, 10))}</body>`)).toThrow();
  });

  it('reads WGSN rows with a HIP number and decodes entities', () => {
    const header = [
      'proper names',
      'NEC+',
      'Designation',
      'HIP',
      'Bayer ID',
      'Simbad spelling',
      'Constellation',
      'Origin',
      'Language',
      'Reference',
    ];
    const html = `<table id="table_1"><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>
<tr><td>Alawaidh</td><td>1</td><td>HR 6555</td><td>85,829</td><td>x</td><td>x</td><td>Dra</td><td>al-&#703;Aw&#257;&#702;idh (العَوائِذ), the camel mothers</td><td>Arabic</td><td>ref</td></tr>
<tr><td>NoHip</td><td>2</td><td>x</td><td></td><td>x</td><td>x</td><td>x</td><td>x</td><td>Latin</td><td>ref</td></tr></table>`;
    const names = parseWgsnNames(html);
    expect(names).toEqual([
      {
        hip: 85829,
        name: 'Alawaidh',
        designation: 'HR 6555',
        constellation: 'Dra',
        language: 'Arabic',
        origin: 'al-ʿAwāʾidh (العَوائِذ), the camel mothers',
      },
    ]);
    expect(arabicScriptFromEtymology(names[0]?.origin ?? '')).toBe('العَوائِذ');
    expect(arabicScriptFromEtymology('no Arabic script here')).toBeNull();
    expect(decodeHtml('a&amp;b &#8220;c&#8221;')).toBe('a&b “c”');
  });
});
