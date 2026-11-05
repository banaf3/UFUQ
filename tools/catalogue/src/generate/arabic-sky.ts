/**
 * The Arabic (anwāʾ) sky culture for the sky explorer: the curated names, memberships,
 * card text, notes and navigation relationships in data/curation/sky-culture, joined to
 * the display star field. Figure lines are the compilation's line arrays, reproduced
 * unmodified (COMPILATION_LINES_UNMODIFIED, IMP-022); UFUQ adds no segment. Nothing here
 * is approved: the artifact takes its approval from data/approvals like every other one.
 */
import {
  type ApprovalRecord,
  type ArtifactEnvelope,
  canonicalJson,
  envelope,
  sha256Hex,
} from '../canonical-json.js';
import { loadApproval, readJson } from './profile-v1-data.js';

export const ARABIC_SKY_CURATION = 'data/curation/sky-culture/arabic-anwa.v1.json';
export const ARABIC_SKY_ARTIFACT_ID = 'sky-culture-arabic-anwa-v1';
export const LINE_RULE_ID = 'COMPILATION_LINES_UNMODIFIED';

export const EVIDENCE_STATES = [
  'PRIMARY_TEXT_READ',
  'PRIMARY_TEXT_POINTER',
  'COLLECTIVE_NAME_IN_PRIMARY_TEXT',
  'NAMED_WITH_FIGURE',
  'SCHOLARLY_STUDY',
  'COMPILATION_ONLY',
] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export interface CitedText {
  readonly text: string;
  readonly sourceId: string;
  readonly locator: string;
}

export interface SourcePointer {
  readonly sourceId: string;
  readonly locator: string;
  readonly supports?: string;
}

export interface AlternativeName {
  readonly arabic: string;
  readonly transliteration: string | null;
  readonly basis: string;
}

interface CuratedRecordBase {
  readonly arabic: string;
  readonly transliteration: string;
  readonly vocalization: 'FROM_SOURCE_FORM' | 'UNVERIFIED';
  readonly alternativeNames: readonly AlternativeName[];
  readonly evidence: EvidenceState;
  readonly attestation: readonly SourcePointer[];
  readonly notes: readonly CitedText[];
  readonly conflicts: readonly CitedText[];
  readonly compilationEntry: string;
  /** Card text: a UFUQ paraphrase in plain English letters, or null. */
  readonly about: string | null;
  /** The sources the card text combines (the card's References). */
  readonly aboutSources: readonly SourcePointer[];
}

export interface CuratedFigure extends CuratedRecordBase {
  readonly figureId: string;
  readonly style: 'FIGURE' | 'GROUP';
  readonly members: readonly { readonly hip: number; readonly designation: string }[];
  readonly membershipCitations: readonly SourcePointer[];
  /** The compilation's line arrays (polylines of HIP numbers), copied unmodified. */
  readonly lines: readonly (readonly number[])[];
}

export interface CuratedStar extends CuratedRecordBase {
  readonly hip: number;
  readonly designation: string;
}

export interface CuratedRelationship {
  readonly relationshipId: string;
  readonly from: { readonly kind: string; readonly id?: string; readonly hip?: number };
  readonly to: { readonly kind: string; readonly id?: string; readonly hip?: number };
  readonly kind: string;
  readonly statement: string;
  readonly sourceId: string;
  readonly locator: string;
  readonly context: string;
  readonly status: string;
}

export interface ArabicSkyCuration {
  readonly curationType: 'UFUQ_ARABIC_SKY_CULTURE_CURATION';
  readonly schemaVersion: 2;
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly note: string;
  readonly transliteration: Record<string, string>;
  readonly lineRule: {
    readonly ruleId: string;
    readonly layer: string;
    readonly sourceId?: string;
    readonly description: string;
  };
  readonly sources: readonly { readonly sourceId: string; readonly role: string }[];
  readonly figures: readonly CuratedFigure[];
  readonly stars: readonly CuratedStar[];
  readonly relationships: readonly CuratedRelationship[];
  readonly review: Record<string, unknown> & { readonly state: string };
}

/** The display field rows the generator needs: HIP and catalogue-epoch position. */
export interface FieldStarPosition {
  readonly hip: number;
  readonly raRad: number;
  readonly decRad: number;
}

const ARABIC_LETTER = /[ء-ي]/;
/** Card text is plain printable ASCII: no diacritics a general reader cannot type. */
const PLAIN_TEXT = /^[\x20-\x7E]+$/;

/**
 * COMPILATION_LINES_UNMODIFIED: each polyline is read as its consecutive pairs; a pair of
 * the same star is a one-star marker and draws nothing. Each pair is kept once, in the
 * order the compilation gives it. A pair with a star outside the display field is not
 * drawn and is returned as omitted, so nothing is silently re-routed.
 */
export function lineSegments(
  lines: readonly (readonly number[])[],
  inField: (hip: number) => boolean,
): { segments: [number, number][]; omitted: [number, number][] } {
  const segments: [number, number][] = [];
  const omitted: [number, number][] = [];
  const seen = new Set<string>();
  for (const line of lines)
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1] as number;
      const b = line[i] as number;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      (inField(a) && inField(b) ? segments : omitted).push([a, b]);
    }
  return { segments, omitted };
}

const MARKS = /\p{Mn}/gu;
const LATIN_LETTER = /[A-Za-z]/;

/**
 * UFUQ_PLAIN_V1: the IJMES transliteration in plain letters for general readers. Macrons
 * and dots are dropped, ʿ (ayn) becomes an apostrophe between two letters and is dropped
 * at a word edge, ʾ (hamza) is dropped, and the first letter is capitalized. It is a
 * deterministic simplification of the curated form, never a new reading.
 */
export function plainTransliteration(ijmes: string): string {
  const base = ijmes.normalize('NFD').replace(MARKS, '');
  let out = '';
  for (let i = 0; i < base.length; i += 1) {
    const c = base[i] as string;
    if (c === 'ʾ') continue;
    if (c === 'ʿ') {
      if (LATIN_LETTER.test(base[i - 1] ?? '') && LATIN_LETTER.test(base[i + 1] ?? '')) out += "'";
      continue;
    }
    out += c;
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Framework-free structural checks; a failure stops generation (never cultural approval). */
export function validateArabicSkyCuration(curation: ArabicSkyCuration): string[] {
  const errors: string[] = [];
  if (curation.curationType !== 'UFUQ_ARABIC_SKY_CULTURE_CURATION')
    errors.push('curationType must be UFUQ_ARABIC_SKY_CULTURE_CURATION.');
  if (curation.schemaVersion !== 2) errors.push('schemaVersion must be 2.');
  if (curation.lineRule?.ruleId !== LINE_RULE_ID) errors.push(`lineRule must be ${LINE_RULE_ID}.`);
  if (curation.review?.state === 'APPROVED' && !curation.review.reviewer)
    errors.push('An APPROVED curation needs a named reviewer.');
  const sources = new Set(curation.sources.map((source) => source.sourceId));
  const checkRecord = (label: string, record: CuratedRecordBase) => {
    if (!ARABIC_LETTER.test(record.arabic)) errors.push(`${label}: arabic must be Arabic script.`);
    if (!record.transliteration?.trim()) errors.push(`${label}: transliteration required.`);
    if (!EVIDENCE_STATES.includes(record.evidence)) errors.push(`${label}: unknown evidence.`);
    const pointers = [
      ...record.notes,
      ...record.conflicts,
      ...record.attestation,
      ...record.aboutSources,
    ];
    for (const pointer of pointers) {
      if (!sources.has(pointer.sourceId))
        errors.push(`${label}: unknown source ${pointer.sourceId}.`);
      if (!pointer.locator) errors.push(`${label}: a citation needs a locator.`);
    }
    if (record.about !== null) {
      if (!PLAIN_TEXT.test(record.about)) errors.push(`${label}: about must be plain ASCII text.`);
      if (record.aboutSources.length === 0) errors.push(`${label}: about uncited.`);
    }
  };
  const figureIds = new Set<string>();
  for (const figure of curation.figures) {
    const label = `figure ${figure.figureId}`;
    if (!/^anwa-[a-z0-9-]+$/.test(figure.figureId)) errors.push(`${label}: bad figureId.`);
    if (figureIds.has(figure.figureId)) errors.push(`${label}: duplicate figureId.`);
    figureIds.add(figure.figureId);
    if (!['FIGURE', 'GROUP'].includes(figure.style)) errors.push(`${label}: unknown style.`);
    if (figure.members.length === 0) errors.push(`${label}: no members.`);
    if (figure.membershipCitations.length === 0) errors.push(`${label}: membership uncited.`);
    if (figure.members.some((member) => !Number.isInteger(member.hip) || member.hip <= 0))
      errors.push(`${label}: members must be HIP numbers.`);
    const wellFormed =
      Array.isArray(figure.lines) &&
      figure.lines.every(
        (line) =>
          Array.isArray(line) &&
          line.length > 0 &&
          line.every((hip) => Number.isInteger(hip) && hip > 0),
      );
    if (!wellFormed) errors.push(`${label}: lines must be arrays of HIP numbers.`);
    else {
      const memberHips = new Set(figure.members.map((member) => member.hip));
      const joined = lineSegments(figure.lines, () => true).segments.flat();
      if (joined.some((hip) => !memberHips.has(hip)))
        errors.push(`${label}: a line joins a star that is not a member.`);
    }
    checkRecord(label, figure);
  }
  const starHips = new Set<number>();
  for (const star of curation.stars) {
    const label = `star HIP ${star.hip}`;
    if (starHips.has(star.hip)) errors.push(`${label}: duplicate.`);
    starHips.add(star.hip);
    checkRecord(label, star);
  }
  for (const relation of curation.relationships) {
    for (const end of [relation.from, relation.to]) {
      if (end.kind === 'FIGURE' && !figureIds.has(end.id ?? ''))
        errors.push(`${relation.relationshipId}: unknown figure ${end.id}.`);
      if (end.kind === 'STAR' && !starHips.has(end.hip ?? -1))
        errors.push(`${relation.relationshipId}: unknown star ${end.hip}.`);
    }
    if (!sources.has(relation.sourceId))
      errors.push(`${relation.relationshipId}: unknown source ${relation.sourceId}.`);
  }
  return errors;
}

const normalizeArabic = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

const plainNames = (names: readonly AlternativeName[]) =>
  names.map((name) => ({
    arabic: name.arabic,
    transliteration:
      name.transliteration === null ? null : plainTransliteration(name.transliteration),
    transliterationScholarly: name.transliteration,
    basis: name.basis,
  }));

/** Builds the culture payload from a curation record and the display field positions. */
export function buildArabicSkyCulture(
  curation: ArabicSkyCuration,
  field: readonly FieldStarPosition[],
  starField: { artifactId: string; payloadSha256: string },
  curationSha256: string,
) {
  const errors = validateArabicSkyCuration(curation);
  if (errors.length > 0) throw new Error(`Arabic sky curation invalid:\n${errors.join('\n')}`);
  const fieldHips = new Set(field.map((star) => star.hip));
  const inField = (hip: number) => fieldHips.has(hip);

  const prepared = curation.figures.map((figure, order) => {
    const hips = [...new Set(figure.members.map((member) => member.hip))];
    return {
      figure,
      order,
      members: hips.filter(inField).sort((a, b) => a - b),
      omitted: hips.filter((hip) => !inField(hip)).sort((a, b) => a - b),
    };
  });
  const drawable = prepared.filter((entry) => entry.members.length >= 2);
  const memberSet = new Map(
    drawable.map((entry) => [entry.figure.figureId, new Set(entry.members)]),
  );
  const contains = (outer: string, inner: string) => {
    const big = memberSet.get(outer) as Set<number>;
    const small = memberSet.get(inner) as Set<number>;
    return big.size > small.size && [...small].every((hip) => big.has(hip));
  };
  const bySize = [...drawable].sort(
    (a, b) => a.members.length - b.members.length || a.order - b.order,
  );
  const parentOf = (id: string) =>
    bySize.find((other) => other.figure.figureId !== id && contains(other.figure.figureId, id))
      ?.figure.figureId ?? null;

  const figures = drawable.map(({ figure, members, omitted }) => {
    const lines = lineSegments(figure.lines, inField);
    return {
      figureId: figure.figureId,
      parentId: parentOf(figure.figureId),
      arabic: figure.arabic,
      transliteration: plainTransliteration(figure.transliteration),
      transliterationScholarly: figure.transliteration,
      vocalization: figure.vocalization,
      alternativeNames: plainNames(figure.alternativeNames),
      style: figure.style,
      members,
      omittedMembersNotInField: omitted,
      segments: lines.segments,
      omittedSegmentsNotInField: lines.omitted,
      membershipCitations: figure.membershipCitations,
      evidence: figure.evidence,
      attestation: figure.attestation,
      notes: figure.notes,
      conflicts: figure.conflicts,
      about: figure.about,
      aboutSources: figure.aboutSources,
      compilationEntry: figure.compilationEntry,
    };
  });
  const singleMemberFigures = prepared
    .filter((entry) => entry.members.length < 2)
    .map((entry) => entry.figure.figureId);

  const nameCount = new Map<string, number>();
  for (const star of curation.stars) {
    const key = normalizeArabic(star.arabic);
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const stars = curation.stars
    .filter((star) => inField(star.hip))
    .map((star) => {
      const key = normalizeArabic(star.arabic);
      const namedFigure = figures.some(
        (figure) => normalizeArabic(figure.arabic) === key && figure.members.includes(star.hip),
      );
      return {
        hip: star.hip,
        designation: star.designation,
        arabic: star.arabic,
        transliteration: plainTransliteration(star.transliteration),
        transliterationScholarly: star.transliteration,
        vocalization: star.vocalization,
        alternativeNames: plainNames(star.alternativeNames),
        evidence: star.evidence,
        attestation: star.attestation,
        notes: star.notes,
        conflicts: star.conflicts,
        about: star.about,
        aboutSources: star.aboutSources,
        // A shared pair/group name or a figure's own name is shown by the figure label.
        labelOnSky: (nameCount.get(key) ?? 0) === 1 && !namedFigure,
        compilationEntry: star.compilationEntry,
      };
    });

  return {
    cultureId: curation.cultureId,
    title: curation.title,
    layer: curation.layer,
    starFieldArtifact: starField,
    curation: { path: ARABIC_SKY_CURATION, sha256: curationSha256 },
    transliteration: curation.transliteration,
    lineRule: curation.lineRule,
    sources: curation.sources,
    counts: {
      figures: figures.length,
      segments: figures.reduce((sum, figure) => sum + figure.segments.length, 0),
      segmentsNotInField: figures.reduce(
        (sum, figure) => sum + figure.omittedSegmentsNotInField.length,
        0,
      ),
      stars: stars.length,
      relationships: curation.relationships.length,
      singleMemberFiguresNotDrawn: singleMemberFigures.length,
      starsNotInField: curation.stars.length - stars.length,
    },
    singleMemberFiguresNotDrawn: singleMemberFigures,
    figures,
    stars,
    relationships: curation.relationships,
    curationReview: curation.review,
  };
}

export function generateArabicSkyCulture(
  root: string,
  field: ArtifactEnvelope<unknown>,
): ArtifactEnvelope<unknown> {
  const curation = readJson<ArabicSkyCuration>(root, ARABIC_SKY_CURATION);
  const payload = buildArabicSkyCulture(
    curation,
    fieldPositions(field),
    { artifactId: field.artifactId, payloadSha256: field.payloadSha256 },
    sha256Hex(canonicalJson(curation)),
  );
  const { approval } = loadApproval(
    root,
    ARABIC_SKY_ARTIFACT_ID,
    sha256Hex(canonicalJson(payload)),
  );
  return envelope('UFUQ_ARABIC_SKY_CULTURE', ARABIC_SKY_ARTIFACT_ID, '2', payload, approval);
}

/** Reads HIP and position from a UFUQ_SKY_DISPLAY_FIELD envelope (columnar rows). */
export function fieldPositions(field: ArtifactEnvelope<unknown>): FieldStarPosition[] {
  const payload = field.payload as { columns: readonly string[]; stars: readonly unknown[][] };
  const hip = payload.columns.indexOf('hip');
  const ra = payload.columns.indexOf('raRad');
  const dec = payload.columns.indexOf('decRad');
  return payload.stars.map((row) => ({
    hip: row[hip] as number,
    raRad: row[ra] as number,
    decRad: row[dec] as number,
  }));
}

/**
 * Visibly synthetic counterpart for tests: invented Latin labels on synthetic stars, no
 * Arabic names and no cultural claim.
 */
export function generateSyntheticArabicSkyCulture(
  field: ArtifactEnvelope<unknown>,
  approval: ApprovalRecord,
): ArtifactEnvelope<unknown> {
  const source = { sourceId: 'SYNTHETIC', locator: 'synthetic technical fixture' };
  const record = (arabic: string, transliteration: string) => ({
    arabic,
    transliteration,
    vocalization: 'FROM_SOURCE_FORM' as const,
    alternativeNames: [],
    evidence: 'COMPILATION_ONLY' as const,
    attestation: [],
    notes: [
      { text: 'Invented text for a synthetic technical fixture; not a cultural claim.', ...source },
    ],
    conflicts: [],
    compilationEntry: 'SYNTHETIC',
    about: 'Invented card text for a synthetic technical fixture; not a cultural claim.',
    aboutSources: [source],
  });
  const members = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      hip: 900001 + offset + i,
      designation: 'synthetic',
    }));
  const curation: ArabicSkyCuration = {
    curationType: 'UFUQ_ARABIC_SKY_CULTURE_CURATION',
    schemaVersion: 2,
    cultureId: 'synthetic-arabic-culture',
    title: 'Synthetic culture (technical fixture)',
    layer: 'SYNTHETIC_TECHNICAL',
    note: 'SYNTHETIC TECHNICAL FIXTURE: invented labels, not Arabic sky lore.',
    transliteration: { system: 'none (synthetic)' },
    lineRule: { ruleId: LINE_RULE_ID, layer: 'SYNTHETIC_TECHNICAL', description: 'test' },
    sources: [{ sourceId: 'SYNTHETIC', role: 'synthetic technical fixture' }],
    figures: [
      {
        ...record('سين-أ', 'Synthetic A'),
        figureId: 'anwa-synthetic-a',
        style: 'FIGURE',
        members: members(0, 4),
        membershipCitations: [source],
        lines: [[900001, 900002, 900003, 900004]],
      },
      {
        ...record('سين-ب', 'Synthetic B'),
        figureId: 'anwa-synthetic-b',
        style: 'GROUP',
        members: members(10, 4),
        membershipCitations: [source],
        lines: [[900011, 900012, 900013, 900014, 900011]],
      },
    ],
    stars: [{ ...record('سين-١', 'Synthetic One'), hip: 900001, designation: 'synthetic' }],
    relationships: [],
    review: { state: 'SYNTHETIC_TECHNICAL_FIXTURE' },
  };
  const payload = buildArabicSkyCulture(
    curation,
    fieldPositions(field),
    { artifactId: field.artifactId, payloadSha256: field.payloadSha256 },
    sha256Hex(canonicalJson(curation)),
  );
  return envelope(
    'UFUQ_ARABIC_SKY_CULTURE',
    'synthetic-arabic-sky-culture-v1',
    '2',
    payload,
    approval,
  );
}
