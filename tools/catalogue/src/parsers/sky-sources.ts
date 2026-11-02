/**
 * Parsers for the sky-explorer sources (data/manifests/sky-catalogue-v1). Each fails
 * closed on a layout it does not recognise.
 */
import { parseCsv } from './csv.js';
import type { HipMainNativeRow } from './hipparcos-esa-1997.js';

const DD2R = Math.PI / 180;

/** Hipparcos row reduced to what the display field needs; coarse rows have no solution. */
export interface SkyFieldRow {
  readonly hip: number;
  readonly astrometry: 'FULL_SOLUTION' | 'COARSE_POSITION_NO_SOLUTION';
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
  readonly parallaxMas: number;
  readonly muAlphaStarMasPerYear: number;
  readonly muDeltaMasPerYear: number;
  readonly visualMagnitude: number;
  readonly colorIndexBV: number | null;
  readonly henryDraperNumber: number | null;
}

const value = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new SyntaxError(`Not a number: ${text}`);
  return parsed;
};

/** "hh mm ss.ss" and "+dd mm ss.s" (hip_main H3/H4, ICRS at J1991.25) to radians. */
export function sexagesimalToRadians(ra: string, dec: string): [number, number] {
  const r = ra.trim().split(/\s+/).map(Number);
  const match = /^([+-])(\d+)\s+(\d+)\s+([\d.]+)$/.exec(dec.trim());
  if (r.length !== 3 || r.some((n) => !Number.isFinite(n)) || !match) {
    throw new SyntaxError(`Unreadable coarse position ${ra} ${dec}.`);
  }
  const [h, m, s] = r as [number, number, number];
  const sign = match[1] === '-' ? -1 : 1;
  const d = Number(match[2]) + Number(match[3]) / 60 + Number(match[4]) / 3600;
  return [(h + m / 60 + s / 3600) * 15 * DD2R, sign * d * DD2R];
}

export function skyFieldRow(row: HipMainNativeRow): SkyFieldRow {
  const hip = Number(row.HIP);
  const vmag = value(row.Vmag);
  if (vmag === null) throw new SyntaxError(`HIP ${hip} has no Vmag.`);
  const hdText = row.HD.trim();
  const base = {
    hip,
    visualMagnitude: vmag,
    colorIndexBV: value(row['B-V']),
    henryDraperNumber: /^\d+$/.test(hdText) ? Number(hdText) : null,
  };
  const ra = value(row.RAdeg);
  const dec = value(row.DEdeg);
  const plx = value(row.Plx);
  const pmRa = value(row.pmRA);
  const pmDe = value(row.pmDE);
  if (ra !== null && dec !== null && plx !== null && pmRa !== null && pmDe !== null) {
    return {
      ...base,
      astrometry: 'FULL_SOLUTION',
      rightAscensionRadians: ra * DD2R,
      declinationRadians: dec * DD2R,
      parallaxMas: plx,
      muAlphaStarMasPerYear: pmRa,
      muDeltaMasPerYear: pmDe,
    };
  }
  const [raRad, decRad] = sexagesimalToRadians(row.RAhms, row.DEdms);
  return {
    ...base,
    astrometry: 'COARSE_POSITION_NO_SOLUTION',
    rightAscensionRadians: raRad,
    declinationRadians: decRad,
    parallaxMas: 0,
    muAlphaStarMasPerYear: 0,
    muDeltaMasPerYear: 0,
  };
}

/** Bright Star Catalogue (V/50) fixed-width rows: HR 1-4, HD 26-31, J2000 RA 76-83, Dec 84-90. */
export interface BscRow {
  readonly hr: number;
  readonly hd: number | null;
  readonly rightAscensionRadians: number | null;
  readonly declinationRadians: number | null;
}

export function parseBscCatalog(text: string): Map<number, BscRow> {
  const rows = new Map<number, BscRow>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const hr = Number(line.slice(0, 4));
    if (!Number.isInteger(hr) || hr < 1)
      throw new SyntaxError(`Bad BSC HR field: ${line.slice(0, 4)}`);
    const hdText = line.slice(25, 31).trim();
    const raParts = [line.slice(75, 77), line.slice(77, 79), line.slice(79, 83)].map((t) =>
      t.trim(),
    );
    const decSign = line.slice(83, 84);
    const decParts = [line.slice(84, 86), line.slice(86, 88), line.slice(88, 90)].map((t) =>
      t.trim(),
    );
    const hasPosition = raParts.every((t) => t !== '') && decParts.every((t) => t !== '');
    rows.set(hr, {
      hr,
      hd: /^\d+$/.test(hdText) ? Number(hdText) : null,
      rightAscensionRadians: hasPosition
        ? (Number(raParts[0]) + Number(raParts[1]) / 60 + Number(raParts[2]) / 3600) * 15 * DD2R
        : null,
      declinationRadians: hasPosition
        ? (decSign === '-' ? -1 : 1) *
          (Number(decParts[0]) + Number(decParts[1]) / 60 + Number(decParts[2]) / 3600) *
          DD2R
        : null,
    });
  }
  return rows;
}

/** van der Sluys ConstellationLines.csv: abbreviation, count, then HR numbers. */
export function parseConstellationLines(
  text: string,
): { readonly abbreviation: string; readonly hr: readonly number[] }[] {
  const records = parseCsv(text).filter((record) => record.some((field) => field.trim() !== ''));
  const header = records[0]?.map((field) => field.trim());
  if (header?.[0] !== 'abr' || header[1] !== 'nr')
    throw new SyntaxError('Unexpected lines header.');
  let previous = '';
  return records.slice(1).map((record) => {
    // A blank abbreviation continues the previous constellation (README: Cru has two lines).
    const abbreviation = (record[0] ?? '').trim() || previous;
    previous = abbreviation;
    const count = Number((record[1] ?? '').trim());
    const hr = record
      .slice(2)
      .map((field) => field.trim())
      .filter((field) => field !== '')
      .map(Number);
    if (
      !/^[A-Z][A-Za-z]{2}$/.test(abbreviation) ||
      hr.length !== count ||
      hr.some((n) => !(n > 0))
    ) {
      throw new SyntaxError(`Malformed constellation line for ${abbreviation}.`);
    }
    return { abbreviation, hr };
  });
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(html: string, marker: RegExp): string[][] {
  const table = html.match(marker);
  if (!table) throw new SyntaxError('Expected table not found.');
  return [...table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...(row[1] as string).matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
      decodeHtml(cell[1] as string),
    ),
  );
}

/** NAOJ table of the 88 IAU constellations: abbreviation to name. */
export function parseNaojConstellations(html: string): Map<string, string> {
  // The page splits the list over several tables, each with its own header row.
  const rows = tableRows(html, /<body[\s\S]*<\/body>/);
  if (!rows.some((row) => row[0] === 'Abbr.' && row[1] === 'Names')) {
    throw new SyntaxError('NAOJ constellation table header changed.');
  }
  const names = new Map<string, string>();
  for (const row of rows) {
    const [abbreviation, name] = row;
    if (abbreviation && name && /^[A-Z][A-Za-z]{2}$/.test(abbreviation))
      names.set(abbreviation, name);
  }
  if (names.size !== 88) throw new SyntaxError(`Expected 88 constellations, found ${names.size}.`);
  return names;
}

export interface WgsnName {
  readonly hip: number;
  readonly name: string;
  readonly designation: string;
  readonly constellation: string;
  readonly language: string;
  readonly origin: string;
}

const WGSN_HEADER = [
  'proper names',
  'NEC+',
  'Designation',
  'HIP',
  'Bayer ID',
  'Simbad spelling',
  'Constellation',
  'Origin',
  'Language',
];

/** IAU WGSN Catalog of Star Names table (exopla.net); rows without a HIP number are skipped. */
export function parseWgsnNames(html: string): WgsnName[] {
  const rows = tableRows(html, /<table[^>]*id="table_[^"]*"[\s\S]*?<\/table>/);
  const header = rows[0] ?? [];
  if (WGSN_HEADER.some((name, index) => header[index] !== name)) {
    throw new SyntaxError('WGSN table header changed.');
  }
  const names: WgsnName[] = [];
  for (const row of rows.slice(1)) {
    const hipText = (row[3] ?? '').replace(/,/g, '');
    if (!/^\d+$/.test(hipText)) continue;
    names.push({
      hip: Number(hipText),
      name: row[0] ?? '',
      designation: row[2] ?? '',
      constellation: row[6] ?? '',
      language: row[8] ?? '',
      origin: row[7] ?? '',
    });
  }
  return names;
}

/** The first Arabic-script run of an etymology text (WGSN), or null. */
export function arabicScriptFromEtymology(origin: string): string | null {
  // Arabic, Arabic Supplement and the Arabic presentation-form blocks; zero-width joiners allowed.
  const match = new RegExp(
    '[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF][\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF\\s\\u200c\\u200d]*',
  ).exec(origin);
  const text = match?.[0].trim();
  return text ? text : null;
}
