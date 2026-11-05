/**
 * The Arabic (anwāʾ) sky culture for the sky explorer: the curated names, memberships,
 * notes and navigation relationships in data/curation/sky-culture, joined to the display
 * star field. Figure lines are drawn by the UFUQ_TREE_V1 rule (MODERN_PEDAGOGICAL), never
 * copied from a compilation. Nothing here is approved: the artifact takes its approval
 * from data/approvals like every other artifact.
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

export const EVIDENCE_STATES = [
  'PRIMARY_TEXT_READ',
  'PRIMARY_TEXT_POINTER',
  'COLLECTIVE_NAME_IN_PRIMARY_TEXT',
  'NAMED_WITH_FIGURE',
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
}

export interface CuratedFigure extends CuratedRecordBase {
  readonly figureId: string;
  readonly style: 'FIGURE' | 'GROUP';
  readonly shape: 'TREE' | 'RING';
  readonly members: readonly { readonly hip: number; readonly designation: string }[];
  readonly membershipCitations: readonly SourcePointer[];
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
  readonly schemaVersion: 1;
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly note: string;
  readonly transliteration: Record<string, string>;
  readonly lineRule: {
    readonly ruleId: string;
    readonly layer: string;
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

/** Framework-free structural checks; a failure stops generation (never cultural approval). */
export function validateArabicSkyCuration(curation: ArabicSkyCuration): string[] {
  const errors: string[] = [];
  if (curation.curationType !== 'UFUQ_ARABIC_SKY_CULTURE_CURATION')
    errors.push('curationType must be UFUQ_ARABIC_SKY_CULTURE_CURATION.');
  if (curation.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (curation.lineRule?.ruleId !== 'UFUQ_TREE_V1') errors.push('lineRule must be UFUQ_TREE_V1.');
  if (curation.review?.state === 'APPROVED' && !curation.review.reviewer)
    errors.push('An APPROVED curation needs a named reviewer.');
  const sources = new Set(curation.sources.map((source) => source.sourceId));
  const checkRecord = (label: string, record: CuratedRecordBase) => {
    if (!ARABIC_LETTER.test(record.arabic)) errors.push(`${label}: arabic must be Arabic script.`);
    if (!record.transliteration?.trim()) errors.push(`${label}: transliteration required.`);
    if (!EVIDENCE_STATES.includes(record.evidence)) errors.push(`${label}: unknown evidence.`);
    for (const cited of [...record.notes, ...record.conflicts, ...record.attestation]) {
      if (!sources.has(cited.sourceId)) errors.push(`${label}: unknown source ${cited.sourceId}.`);
      if (!cited.locator) errors.push(`${label}: a citation needs a locator.`);
    }
  };
  const figureIds = new Set<string>();
  for (const figure of curation.figures) {
    const label = `figure ${figure.figureId}`;
    if (!/^anwa-[a-z0-9-]+$/.test(figure.figureId)) errors.push(`${label}: bad figureId.`);
    if (figureIds.has(figure.figureId)) errors.push(`${label}: duplicate figureId.`);
    figureIds.add(figure.figureId);
    if (!['FIGURE', 'GROUP'].includes(figure.style)) errors.push(`${label}: unknown style.`);
    if (!['TREE', 'RING'].includes(figure.shape)) errors.push(`${label}: unknown shape.`);
    if (figure.members.length === 0) errors.push(`${label}: no members.`);
    if (figure.membershipCitations.length === 0) errors.push(`${label}: membership uncited.`);
    if (figure.members.some((member) => !Number.isInteger(member.hip) || member.hip <= 0))
      errors.push(`${label}: members must be HIP numbers.`);
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

const unit = (star: FieldStarPosition): [number, number, number] => [
  Math.cos(star.decRad) * Math.cos(star.raRad),
  Math.cos(star.decRad) * Math.sin(star.raRad),
  Math.sin(star.decRad),
];

function separation(a: [number, number, number], b: [number, number, number]): number {
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...cross), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * UFUQ_TREE_V1: a spanning tree over the members by great-circle separation, seeded with
 * the segments of every smaller figure whose members it contains. A RING figure also
 * joins the two ends of its tree when that tree is a simple path.
 */
export function treeSegments(
  members: readonly number[],
  position: ReadonlyMap<number, [number, number, number]>,
  seeds: readonly (readonly [number, number])[],
  ring: boolean,
): [number, number][] {
  const parent = new Map(members.map((hip) => [hip, hip]));
  const find = (hip: number): number => {
    let root = hip;
    while (parent.get(root) !== root) root = parent.get(root) as number;
    parent.set(hip, root);
    return root;
  };
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number) => {
    const key = pairKey(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(a < b ? [a, b] : [b, a]);
    parent.set(find(a), find(b));
  };
  for (const [a, b] of seeds) if (parent.has(a) && parent.has(b)) add(a, b);
  const candidates: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < members.length; i += 1)
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i] as number;
      const b = members[j] as number;
      candidates.push({
        a: Math.min(a, b),
        b: Math.max(a, b),
        d: separation(
          position.get(a) as [number, number, number],
          position.get(b) as [number, number, number],
        ),
      });
    }
  candidates.sort((x, y) => x.d - y.d || x.a - y.a || x.b - y.b);
  for (const { a, b } of candidates) if (find(a) !== find(b)) add(a, b);
  if (ring && members.length >= 3 && edges.length === members.length - 1) {
    const degree = new Map<number, number>();
    for (const [a, b] of edges) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    const ends = members.filter((hip) => degree.get(hip) === 1);
    if (ends.length === 2 && [...degree.values()].every((d) => d <= 2))
      add(ends[0] as number, ends[1] as number);
  }
  return edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

const normalizeArabic = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

/** Builds the culture payload from a curation record and the display field positions. */
export function buildArabicSkyCulture(
  curation: ArabicSkyCuration,
  field: readonly FieldStarPosition[],
  starField: { artifactId: string; payloadSha256: string },
  curationSha256: string,
) {
  const errors = validateArabicSkyCuration(curation);
  if (errors.length > 0) throw new Error(`Arabic sky curation invalid:\n${errors.join('\n')}`);
  const position = new Map(field.map((star) => [star.hip, unit(star)]));
  const inField = (hip: number) => position.has(hip);

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
  // Children before parents, so a parent inherits its children's segments.
  const bySize = [...drawable].sort(
    (a, b) => a.members.length - b.members.length || a.order - b.order,
  );
  const segments = new Map<string, [number, number][]>();
  for (const entry of bySize) {
    const seeds = bySize
      .filter((other) => other !== entry && contains(entry.figure.figureId, other.figure.figureId))
      .flatMap((other) => segments.get(other.figure.figureId) ?? []);
    segments.set(
      entry.figure.figureId,
      treeSegments(entry.members, position, seeds, entry.figure.shape === 'RING'),
    );
  }
  const parentOf = (id: string) =>
    bySize.find((other) => other.figure.figureId !== id && contains(other.figure.figureId, id))
      ?.figure.figureId ?? null;

  const figures = drawable.map(({ figure, members, omitted }) => ({
    figureId: figure.figureId,
    parentId: parentOf(figure.figureId),
    arabic: figure.arabic,
    transliteration: figure.transliteration,
    vocalization: figure.vocalization,
    alternativeNames: figure.alternativeNames,
    style: figure.style,
    shape: figure.shape,
    members,
    omittedMembersNotInField: omitted,
    segments: segments.get(figure.figureId) ?? [],
    membershipCitations: figure.membershipCitations,
    evidence: figure.evidence,
    attestation: figure.attestation,
    notes: figure.notes,
    conflicts: figure.conflicts,
    compilationEntry: figure.compilationEntry,
  }));
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
        transliteration: star.transliteration,
        vocalization: star.vocalization,
        alternativeNames: star.alternativeNames,
        evidence: star.evidence,
        attestation: star.attestation,
        notes: star.notes,
        conflicts: star.conflicts,
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
  return envelope('UFUQ_ARABIC_SKY_CULTURE', ARABIC_SKY_ARTIFACT_ID, '1', payload, approval);
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
  });
  const members = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      hip: 900001 + offset + i,
      designation: 'synthetic',
    }));
  const curation: ArabicSkyCuration = {
    curationType: 'UFUQ_ARABIC_SKY_CULTURE_CURATION',
    schemaVersion: 1,
    cultureId: 'synthetic-arabic-culture',
    title: 'Synthetic culture (technical fixture)',
    layer: 'SYNTHETIC_TECHNICAL',
    note: 'SYNTHETIC TECHNICAL FIXTURE: invented labels, not Arabic sky lore.',
    transliteration: { system: 'none (synthetic)' },
    lineRule: { ruleId: 'UFUQ_TREE_V1', layer: 'SYNTHETIC_TECHNICAL', description: 'test' },
    sources: [{ sourceId: 'SYNTHETIC', role: 'synthetic technical fixture' }],
    figures: [
      {
        ...record('سين-أ', 'Synthetic A'),
        figureId: 'anwa-synthetic-a',
        style: 'FIGURE',
        shape: 'TREE',
        members: members(0, 4),
        membershipCitations: [source],
      },
      {
        ...record('سين-ب', 'Synthetic B'),
        figureId: 'anwa-synthetic-b',
        style: 'GROUP',
        shape: 'RING',
        members: members(10, 4),
        membershipCitations: [source],
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
    '1',
    payload,
    approval,
  );
}
