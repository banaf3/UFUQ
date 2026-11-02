// Sky-explorer source acquisition (2026-11-02) into an ignored, never-reused evidence
// directory under data/raw/sky-catalogue-v1/, plus the tracked acquisition manifest.
//
// Usage: node scripts/evidence/acquire-sky-catalogue-v1.mjs
//
// Sources (bytes and hashes only; nothing is approved here):
// - ESA Hipparcos 1997 hip_main, every star with Vmag <= 6.5 (official ESASky Legacy TAP,
//   the service named on ESA's Hipparcos catalogue page), plus the fainter stars that the
//   constellation figures use (selected by HD number);
// - the Yale Bright Star Catalogue (CDS V/50) original files from the official CDS mirror
//   at CfA (the Strasbourg hosts were unreachable on 2026-11-02), for the HR-to-HD
//   cross-reference, because the constellation lines are keyed by HR number;
// - M. van der Sluys, ConstellationLines (CC BY 4.0), pinned to a commit;
// - the IAU WGSN Catalog of Star Names page (names are public domain; etymology texts
//   are CC BY, IAU WGSN / exopla.net).
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..', '..');
const manifestDirectory = 'data/manifests/sky-catalogue-v1';
const userAgent = 'UFUQ-FYP-evidence/1 (+https://github.com/banaf3/UFUQ)';
const ESASKY_TAP = 'https://esaskylegacy.esac.esa.int/esasky-legacy-sl-tap/tap/sync';
const BSC_MIRROR = 'https://vizier.cfa.harvard.edu/ftp/cats/V/50';
const LINES_REPOSITORY = 'MarcvdSluys/ConstellationLines';
const WGSN_PAGE = 'https://exopla.net/star-names/modern-iau-star-names/';
const NAOJ_CONSTELLATIONS = 'https://eco.mtk.nao.ac.jp/koyomi/faq/constellations.html.en';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const utcStamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

async function request(url, init = {}) {
  const requestStartedUtc = new Date().toISOString();
  const response = await fetch(url, {
    ...init,
    headers: { 'User-Agent': userAgent, ...(init.headers ?? {}) },
    redirect: 'error',
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  return { url, requestStartedUtc, response, bytes };
}

function tap(endpoint, query) {
  const body = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'csv',
    MAXREC: '50000',
    QUERY: query,
  });
  return request(endpoint, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

/** Minimal RFC 4180 reader for the TAP CSV responses (quoted fields, no embedded newlines). */
function csvRows(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const fields = [];
      let field = '';
      let quoted = false;
      for (const character of line) {
        if (character === '"') quoted = !quoted;
        else if (character === ',' && !quoted) {
          fields.push(field);
          field = '';
        } else field += character;
      }
      fields.push(field);
      return fields;
    });
}

async function main() {
  const started = new Date();
  const evidenceId = `sky-catalogue-v1-${utcStamp(started)}`;
  const rawDirectory = `data/raw/sky-catalogue-v1/${evidenceId}`;
  const directory = join(root, rawDirectory);
  if (existsSync(directory)) throw new Error(`Refusing to reuse ${directory}`);
  mkdirSync(directory, { recursive: true });

  const files = [];
  const save = (name, role, result, extra = {}) => {
    writeFileSync(join(directory, name), result.bytes, { flag: 'wx' });
    files.push({
      path: `${rawDirectory}/${name}`,
      role,
      url: result.url,
      requestStartedUtc: result.requestStartedUtc,
      httpStatus: result.response.status,
      contentType: result.response.headers.get('content-type'),
      byteLength: result.bytes.length,
      sha256: sha256(result.bytes),
      ...extra,
    });
  };
  const queryFile = (name) => readFileSync(join(root, manifestDirectory, name), 'utf8');

  // 1. Hipparcos naked-eye stars.
  const nakedEye = await tap(ESASKY_TAP, queryFile('hip-main-naked-eye.v1.adql'));
  save('hip-main-naked-eye.csv', 'HIPPARCOS_NAKED_EYE_ROWS', nakedEye, {
    query: `${manifestDirectory}/hip-main-naked-eye.v1.adql`,
  });

  // 2. Bright Star Catalogue original files (ReadMe fixes the byte layout).
  save('bsc-ReadMe', 'BSC_README_BYTE_LAYOUT', await request(`${BSC_MIRROR}/ReadMe`));
  const bsc = await request(`${BSC_MIRROR}/catalog.gz`);
  save('bsc-catalog.gz', 'BSC_CATALOG_FIXED_WIDTH_GZIP', bsc);

  // 3. Constellation lines pinned to the current commit.
  const commit = await request(`https://api.github.com/repos/${LINES_REPOSITORY}/commits/master`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  const commitSha = JSON.parse(commit.bytes.toString('utf8')).sha;
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('Unexpected commit identifier.');
  for (const [name, role] of [
    ['ConstellationLines.csv', 'CONSTELLATION_LINES_CC_BY_4_0'],
    ['LICENSE', 'CONSTELLATION_LINES_LICENCE'],
    ['CITATION.cff', 'CONSTELLATION_LINES_CITATION'],
    ['readme.org', 'CONSTELLATION_LINES_README'],
  ]) {
    const result = await request(
      `https://raw.githubusercontent.com/${LINES_REPOSITORY}/${commitSha}/${name}`,
    );
    save(`constellation-lines-${name}`, role, result, { commit: commitSha });
  }

  // 4. Fainter Hipparcos rows needed by the figures (HR -> HD -> hip_main by HD).
  const linesText = readFileSync(
    join(directory, 'constellation-lines-ConstellationLines.csv'),
    'utf8',
  );
  const lineHr = new Set();
  for (const row of csvRows(linesText).slice(1)) {
    for (const value of row.slice(2)) if (/^\s*\d+\s*$/.test(value)) lineHr.add(Number(value));
  }
  // ReadMe: HR is bytes 1-4 and HD bytes 26-31 (1-based, inclusive).
  const lineHd = [
    ...new Set(
      gunzipSync(bsc.bytes)
        .toString('latin1')
        .split('\n')
        .filter((line) => lineHr.has(Number(line.slice(0, 4))))
        .map((line) => Number(line.slice(25, 31)))
        .filter((hd) => Number.isInteger(hd) && hd > 0),
    ),
  ].sort((a, b) => a - b);
  const lineQuery = `SELECT *\nFROM hipparcos1.hip_main\nWHERE Vmag > 6.5 AND HD IN (${lineHd.join(', ')})\nORDER BY HIP\n`;
  writeFileSync(join(root, manifestDirectory, 'hip-main-line-stars.v1.adql'), lineQuery);
  const lineStars = await tap(ESASKY_TAP, lineQuery);
  save('hip-main-line-stars.csv', 'HIPPARCOS_FIGURE_STARS_FAINTER_THAN_6_5', lineStars, {
    query: `${manifestDirectory}/hip-main-line-stars.v1.adql`,
  });

  // 5. IAU WGSN star names (page snapshot).
  save('wgsn-star-names.html', 'IAU_WGSN_STAR_NAMES_PAGE', await request(WGSN_PAGE));

  // 6. The 88 IAU constellation names and abbreviations (NAOJ table).
  save(
    'naoj-constellations.html',
    'IAU_CONSTELLATION_NAMES_TABLE',
    await request(NAOJ_CONSTELLATIONS),
  );

  const queryHashes = ['hip-main-naked-eye.v1.adql', 'hip-main-line-stars.v1.adql'].map((name) => {
    const bytes = readFileSync(join(root, manifestDirectory, name));
    return {
      path: `${manifestDirectory}/${name}`,
      byteLength: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const manifest = {
    manifestType: 'UFUQ_SKY_CATALOGUE_SOURCE_EVIDENCE_MANIFEST',
    schemaVersion: 1,
    manifestId: evidenceId,
    authorityStatus: 'SOURCE_EVIDENCE_VERIFIED',
    scientificApproval: 'REVIEW_REQUIRED',
    culturalApproval: 'REVIEW_REQUIRED',
    scope:
      'Sky-explorer background: every Hipparcos star with Vmag <= 6.5, the stars used by the 88 IAU constellation figures, the figures themselves and the IAU WGSN star names.',
    sources: {
      hipparcos: {
        citation: 'ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200',
        table: 'hipparcos1.hip_main',
        service: ESASKY_TAP,
        licence:
          'ESA Hipparcos data, credit ESA (CC BY-NC 3.0 IGO), as recorded for the route stars',
      },
      brightStarCatalogue: {
        citation:
          'Hoffleit, D., and Warren, W. H. Jr. (1991), The Bright Star Catalogue, 5th Revised Ed. (Preliminary Version), CDS V/50',
        files: ['ReadMe', 'catalog.gz'],
        mirror: BSC_MIRROR,
        use: 'HR-to-HD cross-reference only',
      },
      constellationLines: {
        citation:
          'van der Sluys, M. (2005-2026), ConstellationLines v1.4, DOI 10.5281/zenodo.10397192',
        repository: `https://github.com/${LINES_REPOSITORY}`,
        commit: commitSha,
        licence: 'CC BY 4.0',
      },
      constellationNames: {
        citation:
          'National Astronomical Observatory of Japan, Ephemeris Computation Office, "Constellations" (the 88 IAU constellations and abbreviations)',
        url: NAOJ_CONSTELLATIONS,
        use: 'Abbreviation-to-name table only (names are the IAU standard names)',
      },
      starNames: {
        citation:
          'IAU Working Group on Star Names (WGSN), IAU Catalog of Star Names, hosted at exopla.net',
        url: WGSN_PAGE,
        licence:
          'Names: free to use, not subject to copyright (WGSN statement on the page). Etymology texts: Creative Commons Attribution (IAU WGSN).',
      },
    },
    queries: queryHashes,
    acquisition: {
      startedUtc: started.toISOString(),
      completedUtc: new Date().toISOString(),
      tool: `node ${process.version} fetch`,
      userAgent,
      authentication: 'ANONYMOUS',
      redirects: 'REJECTED',
    },
    rawEvidence: {
      repositoryPolicy: 'IGNORED_LOCAL_ONLY_UNTIL_DERIVED_ARTIFACT_POLICY_APPLIED',
      directory: rawDirectory,
      files,
    },
  };
  writeFileSync(
    join(root, manifestDirectory, 'acquisition-manifest.v1.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Acquired ${files.length} files into ${rawDirectory}`);
  for (const file of files)
    console.log(`  ${file.path.split('/').pop()}  ${file.byteLength} bytes`);
}

await main();
