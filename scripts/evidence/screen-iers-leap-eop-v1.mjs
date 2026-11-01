// Milestone 2D.2 structural screen of the acquired leap/EOP/restoration evidence.
//
// Usage: node scripts/evidence/screen-iers-leap-eop-v1.mjs <evidence-directory>
//
// Prints JSON containing identities, counts, dates, MJD ranges, series labels,
// integrity results, and hashes only. It prints no EOP value. This is evidence
// screening, not the Milestone 2E production parser, and it approves nothing.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const NTP_UNIX_OFFSET_SECONDS = 2208988800;
const MJD_NTP_EPOCH = 15020;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const ntpToIsoDate = (ntp) =>
  new Date((ntp - NTP_UNIX_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10);
const mjdToIsoDate = (mjd) => new Date((mjd - 40587) * 86400 * 1000).toISOString().slice(0, 10);
function civilToMjd(year, month, day) {
  return Date.UTC(year, month - 1, day) / 86400000 + 40587;
}

export function parseNtpLeapList(text) {
  const lines = text.split(/\r?\n/);
  const field = (prefix) => {
    const line = lines.find((entry) => entry.startsWith(prefix));
    return line === undefined ? undefined : line.slice(prefix.length).trim();
  };
  const transitions = lines
    .filter((line) => /^\d+\s+\d+/.test(line))
    .map((line) => {
      const [ntp, dtai] = line.trim().split(/\s+/);
      return { ntp: Number(ntp), taiMinusUtc: Number(dtai) };
    });
  const updateNtp = field('#$');
  const expiryNtp = field('#@');
  const declaredHash = field('#h')?.replace(/\s+/g, '');
  const hashInput = [updateNtp, expiryNtp, ...transitions.map((t) => `${t.ntp}${t.taiMinusUtc}`)]
    .join('')
    .replace(/\s+/g, '');
  const computedHash = hash('sha1', Buffer.from(hashInput, 'ascii'));
  return {
    updateNtp: Number(updateNtp),
    updateUtc: new Date((Number(updateNtp) - NTP_UNIX_OFFSET_SECONDS) * 1000).toISOString(),
    expiryNtp: Number(expiryNtp),
    expiryUtcDate: ntpToIsoDate(Number(expiryNtp)),
    transitions,
    declaredHash,
    computedHash,
    publisherIntegrity: declaredHash === computedHash ? 'VERIFIED' : 'MISMATCH',
    publicDomainStatement: /This file is in the public domain\./.test(text),
  };
}

export function parseLeapSecondDat(text) {
  const transitions = text
    .split(/\r?\n/)
    .filter((line) => /^\s+\d{5}\.\d\s+\d+\s+\d+\s+\d{4}\s+\d+/.test(line))
    .map((line) => {
      const [mjd, , , , dtai] = line.trim().split(/\s+/);
      return { ntp: (Number(mjd) - MJD_NTP_EPOCH) * 86400, taiMinusUtc: Number(dtai) };
    });
  const expiry = /File expires on (\d+ \w+ \d{4})/.exec(text)?.[1];
  const updatedThrough = /Updated through IERS Bulletin (\d+)/.exec(text)?.[1];
  return { transitions, expiry, updatedThroughBulletin: Number(updatedThrough) };
}

export function parseBulletinC(text) {
  const issue = Number(/Bulletin C (\d+)/.exec(text)?.[1]);
  const issued = /Paris,\s+(\d+\s+\w+\s+\d{4})/.exec(text)?.[1];
  let announcement = 'UNCLASSIFIED';
  let opportunity;
  let match = /NO leap second will be introduced at the end of (\w+ \d{4})/.exec(text);
  if (match) {
    announcement = 'NO_LEAP_SECOND';
    opportunity = match[1];
  }
  match = /A positive leap second will be introduced at the end of (\w+ \d{4})/.exec(text);
  if (match) {
    announcement = 'POSITIVE_LEAP_SECOND';
    opportunity = match[1];
  }
  if (/negative leap second will be introduced/i.test(text)) {
    announcement = 'NEGATIVE_LEAP_SECOND';
  }
  const current =
    /from (\d{4}) (\w+)\s+(\d+),\s*0h UTC,\s*until further notice\s*:\s*UTC-TAI\s*=\s*-\s*(\d+)\s*s/.exec(
      text,
    );
  return {
    issue,
    issued,
    announcement,
    opportunity,
    currentFromDate: current
      ? `${current[1]}-${String(MONTHS.indexOf(current[2]) + 1).padStart(2, '0')}-${current[3].padStart(2, '0')}`
      : undefined,
    currentTaiMinusUtc: current ? Number(current[4]) : undefined,
  };
}

const ROW = /^(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{5})((?:\s+-?\d+\.\d+){10})\s*$/;

export function parseBulletinBSection1(text) {
  const lines = text.split(/\r?\n/);
  const issue = Number(/BULLETIN B (\d+)/.exec(text)?.[1]);
  const issued = lines[1]?.trim();
  const seriesLabel = lines.find((line) => /consistent with ITRF/.test(line))?.trim();
  const sectionEnd = lines.findIndex((line) => /^\s*2 - DAILY FINAL VALUES/.test(line));
  const finalStart = lines.findIndex((line) => /^\s*Final values\s*$/.test(line));
  const preliminaryStart = lines.findIndex((line) => /^\s*Preliminary extension\s*$/.test(line));
  const rowsBetween = (from, to) =>
    lines
      .slice(from + 1, to)
      .map((line) => ROW.exec(line))
      .filter(Boolean)
      .map((m) => {
        const values = m[5].trim().split(/\s+/).map(Number);
        return {
          civilMjd: civilToMjd(Number(m[1]), Number(m[2]), Number(m[3])),
          mjd: Number(m[4]),
          values,
        };
      });
  const finals = rowsBetween(finalStart, preliminaryStart);
  const preliminary = rowsBetween(preliminaryStart, sectionEnd);
  const contiguous = finals.every(
    (row, index) => index === 0 || row.mjd === finals[index - 1].mjd + 1,
  );
  const finite = finals.every(
    (row) => row.values.length === 10 && row.values.every(Number.isFinite),
  );
  const positiveRequiredErrors = finals.every(
    (row) => row.values[5] > 0 && row.values[6] > 0 && row.values[7] > 0,
  );
  return {
    issue,
    issued,
    seriesLabel,
    structure:
      finalStart >= 0 && preliminaryStart > finalStart && sectionEnd > preliminaryStart
        ? 'SECTION1_FINAL_THEN_PRELIMINARY'
        : 'UNRECOGNIZED',
    finalRowCount: finals.length,
    finalFirstMjd: finals[0]?.mjd,
    finalLastMjd: finals.at(-1)?.mjd,
    finalFirstDate: finals[0] ? mjdToIsoDate(finals[0].mjd) : undefined,
    finalLastDate: finals.at(-1) ? mjdToIsoDate(finals.at(-1).mjd) : undefined,
    preliminaryRowCount: preliminary.length,
    finalRowsContiguous: contiguous,
    finalRowsCivilDateMatchesMjd: finals.every((row) => row.civilMjd === row.mjd),
    finalRowsAllTenNumericFieldsFinite: finite,
    finalRowsPositiveXYUt1Errors: positiveRequiredErrors,
  };
}

export function listTarMembers(tarBytes) {
  const members = [];
  let offset = 0;
  while (offset + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('latin1')
        .replace(/\0.*$/s, '');
    const name = text(0, 100);
    const prefix = text(345, 155);
    const size = parseInt(text(124, 12).trim() || '0', 8);
    const type = text(156, 1) || '0';
    const path = prefix ? `${prefix}/${name}` : name;
    const dataStart = offset + 512;
    members.push({ path, size, type, bytes: tarBytes.subarray(dataStart, dataStart + size) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return members;
}

function screen(directory) {
  const read = (name) => readFileSync(join(directory, name));
  const log = JSON.parse(read('acquisition-log.json').toString('utf8'));

  const selected = parseNtpLeapList(read('leap-seconds.3992312697').toString('latin1'));
  const ianaBytes = read('iana-tzdb-2026f-leap-seconds.list');
  const iana = parseNtpLeapList(ianaBytes.toString('latin1'));
  const dat = parseLeapSecondDat(read('Leap_Second.dat').toString('latin1'));
  const sameTransitions = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bulletinC = Array.from({ length: 21 }, (_, index) =>
    parseBulletinC(read(`bulletinc.${52 + index}`).toString('latin1')),
  );
  const last = selected.transitions.at(-1);
  const announcing = bulletinC[0];
  const bulletinCConsistency =
    announcing.announcement === 'POSITIVE_LEAP_SECOND' &&
    announcing.opportunity === 'December 2016' &&
    announcing.currentFromDate === ntpToIsoDate(last.ntp) &&
    announcing.currentTaiMinusUtc === last.taiMinusUtc &&
    bulletinC
      .slice(1)
      .every(
        (entry, index) =>
          entry.issue === 53 + index &&
          entry.announcement === 'NO_LEAP_SECOND' &&
          entry.currentFromDate === '2017-01-01' &&
          entry.currentTaiMinusUtc === last.taiMinusUtc,
      );

  const bulletinB = Array.from({ length: 12 }, (_, index) =>
    parseBulletinBSection1(read(`bulletinb.${453 + index}`).toString('latin1')),
  );
  const series = [];
  for (const entry of bulletinB) {
    const current = series.at(-1);
    if (current && current.seriesLabel === entry.seriesLabel) {
      current.issues.push(entry.issue);
      current.contiguousAcrossIssues &&= entry.finalFirstMjd === current.finalLastMjd + 1;
      current.finalLastMjd = entry.finalLastMjd;
      current.finalLastDate = entry.finalLastDate;
      current.finalRowCount += entry.finalRowCount;
    } else {
      series.push({
        seriesLabel: entry.seriesLabel,
        issues: [entry.issue],
        finalFirstMjd: entry.finalFirstMjd,
        finalFirstDate: entry.finalFirstDate,
        finalLastMjd: entry.finalLastMjd,
        finalLastDate: entry.finalLastDate,
        finalRowCount: entry.finalRowCount,
        contiguousAcrossIssues: true,
        boundaryContiguousWithPreviousSeries: current
          ? entry.finalFirstMjd === current.finalLastMjd + 1
          : null,
      });
    }
  }
  for (const entry of series) {
    entry.fourPointSupportPreview = {
      status: 'PREVIEW_NOT_ACTIVATED',
      earliestUtcInclusive: `${mjdToIsoDate(entry.finalFirstMjd + 1)}T00:00:00Z`,
      latestUtcExclusive: `${mjdToIsoDate(entry.finalLastMjd - 1)}T00:00:00Z`,
    };
  }

  const tarBytes = gunzipSync(read('iersconventions_v1_0_0.tar.gz'));
  const members = listTarMembers(tarBytes);
  const wanted = ['PMSDNUT2.F', 'UTLIBR.F', 'FUNDARG.F', 'ORTHO_EOP.F', 'CNMTX.F'];
  const working = Object.fromEntries(
    log.files
      .filter((file) => file.role === 'RESTORATION_SOURCE_WORKING_COMPARISON')
      .map((file) => [file.name.replace(/^working-chapter\d-/, ''), file.sha256]),
  );
  const routines = members
    .filter((member) => member.type === '0' && wanted.includes(member.path.split('/').at(-1)))
    .map((member) => {
      const text = member.bytes.toString('latin1');
      const base = member.path.split('/').at(-1);
      const sha256 = hash('sha256', member.bytes);
      return {
        path: member.path,
        byteLength: member.size,
        sha256,
        identicalToWorkingContentCopy: working[base] === sha256,
        iersSoftwareLicenseNotice: /IERS Conventions Software License/.test(text),
        calls: [
          ...new Set(
            text
              .split(/\r?\n/)
              .filter((line) => !/^[cC*!]/.test(line))
              .flatMap((line) => [...line.matchAll(/\bCALL\s+([A-Z0-9_]+)/gi)])
              .map((m) => m[1].toUpperCase()),
          ),
        ],
        ibandParameter: /PARAMETER\s*\(\s*IBAND\s*=\s*(\d)\s*\)/i.exec(text)?.[1] ?? null,
      };
    });

  return {
    evidenceId: log.evidenceId,
    acquisition: {
      startedUtc: log.startedUtc,
      completedUtc: log.completedUtc,
      fileCount: log.files.length,
      allHttp200: log.files.every((file) => file.httpStatus === 200),
      allHashesMatchBytes: log.files.every(
        (file) => hash('sha256', read(file.name)) === file.sha256,
      ),
    },
    leap: {
      selectedTransport: 'leap-seconds.3992312697',
      updateUtc: selected.updateUtc,
      expiryUtcDate: selected.expiryUtcDate,
      transitionCount: selected.transitions.length,
      firstTransition: {
        date: ntpToIsoDate(selected.transitions[0].ntp),
        taiMinusUtc: selected.transitions[0].taiMinusUtc,
      },
      lastTransition: { date: ntpToIsoDate(last.ntp), taiMinusUtc: last.taiMinusUtc },
      allTransitionsPositiveUnitSteps: selected.transitions.every(
        (t, index) =>
          index === 0 || t.taiMinusUtc === selected.transitions[index - 1].taiMinusUtc + 1,
      ),
      publisherIntegrity: selected.publisherIntegrity,
      publicDomainStatement: selected.publicDomainStatement,
      ianaCopyByteIdentical:
        hash('sha256', ianaBytes) === hash('sha256', read('leap-seconds.3992312697')),
      ianaPublisherIntegrity: iana.publisherIntegrity,
      leapSecondDatTransitionsIdentical: sameTransitions(dat.transitions, selected.transitions),
      leapSecondDatExpiry: dat.expiry,
      leapSecondDatUpdatedThroughBulletin: dat.updatedThroughBulletin,
      bulletinC: bulletinC.map(({ issue, issued, announcement, opportunity }) => ({
        issue,
        issued,
        announcement,
        opportunity,
      })),
      bulletinCConsistency: bulletinCConsistency ? 'CONSISTENT' : 'INCONSISTENT',
    },
    eop: { issues: bulletinB, series },
    restoration: {
      package: 'iersconventions_v1_0_0.tar.gz',
      tarMemberCount: members.length,
      routines,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: screen-iers-leap-eop-v1.mjs <evidence-directory>');
  console.log(JSON.stringify(screen(resolve(directory)), null, 2));
}
