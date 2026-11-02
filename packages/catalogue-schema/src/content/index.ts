/**
 * Versioned celestial-guidance content model (IMP-011, IMP-018): SkyPattern,
 * DirectionTarget, GuidanceRelationship, LessonRoute and ScenarioPreset records, with a
 * framework-free referential-integrity and review-state validator.
 */

export type ContentLayer =
  | 'OLD_ARABIAN'
  | 'GRECO_ARABIC_SCHOLARLY'
  | 'MODERN_PEDAGOGICAL'
  | 'MODERN_ASTRONOMICAL'
  | 'HISTORICAL_CONTEXT_ONLY'
  | 'SYNTHETIC_TECHNICAL';

export type ReviewKind = 'CULTURAL' | 'ARABIC_LANGUAGE' | 'EDUCATIONAL' | 'SCIENTIFIC';

export interface SourceCitation {
  readonly sourceId: string;
  readonly locator: string;
  readonly supports: string;
}

export interface ContentReview {
  readonly state: 'APPROVED' | 'NOT_APPROVED' | 'REVIEW_REQUIRED';
  readonly scope: 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';
  readonly requiredReviewKinds: readonly ReviewKind[];
  readonly reviewer: string | null;
  readonly decisionDate: string | null;
  readonly decisionReference: string | null;
}

export interface CulturalLabel {
  readonly languageTag: string;
  /** Native-script form, or null when no verified form exists (never invented). */
  readonly script: string | null;
  readonly transliteration: string | null;
  readonly gloss: string | null;
  readonly layer: ContentLayer;
  readonly citations: readonly SourceCitation[];
}

export interface PatternLineSegment {
  readonly fromStarId: string;
  readonly toStarId: string;
}

export interface SkyPattern {
  readonly stableId: string;
  readonly contentVersion: string;
  readonly patternKind: 'ASTERISM' | 'SINGLE_STAR';
  readonly labels: readonly CulturalLabel[];
  readonly memberStarIds: readonly string[];
  readonly membershipCitations: readonly SourceCitation[];
  readonly lineSegments: readonly PatternLineSegment[];
  /** Line figures are UFUQ teaching aids; historical figures are never imported. */
  readonly lineSegmentLayer: 'MODERN_PEDAGOGICAL' | 'SYNTHETIC_TECHNICAL' | 'NONE';
  readonly shapeHint: string;
  readonly review: ContentReview;
}

export interface DirectionTarget {
  readonly stableId: string;
  readonly contentVersion: string;
  readonly labels: readonly CulturalLabel[];
  readonly definition: {
    readonly kind: 'TERRESTRIAL_TRUE_NORTH';
    /** North-zero, east-positive azimuth of the target direction (rad). */
    readonly azimuthRadians: 0;
  };
  readonly review: ContentReview;
}

export type GuidanceSource =
  | { readonly kind: 'pattern'; readonly stableId: string }
  | { readonly kind: 'star'; readonly catalogueId: string };

export type GuidanceTarget =
  GuidanceSource | { readonly kind: 'direction'; readonly stableId: string };

export type GuidanceInstruction =
  | { readonly kind: 'GREAT_CIRCLE_ARC'; readonly fromStarId: string; readonly toStarId: string }
  | {
      readonly kind: 'POINTER_EXTENSION';
      readonly fromStarId: string;
      readonly throughStarId: string;
      readonly toStarId: string;
    }
  | { readonly kind: 'VERTICAL_TO_HORIZON'; readonly fromStarId: string };

/** Retained for the Phase 0 generic interface. */
export interface InstructionalLineOrVector {
  readonly kind: string;
  readonly payload: unknown;
}

export interface GuidanceRelationship {
  readonly stableId: string;
  readonly relationshipVersion: string;
  readonly source: { readonly kind: 'pattern'; readonly stableId: string };
  readonly target:
    | { readonly kind: 'pattern'; readonly stableId: string }
    | { readonly kind: 'direction'; readonly stableId: string };
  readonly relationshipType: 'LEADS_TO_TARGET_STAR' | 'LEADS_TO_DIRECTION';
  readonly instruction: GuidanceInstruction;
  readonly layer: ContentLayer;
  readonly explanation: string;
  readonly historicalContext: {
    readonly text: string;
    readonly layer: ContentLayer;
    readonly citations: readonly SourceCitation[];
  } | null;
  readonly citations: readonly SourceCitation[];
  readonly review: ContentReview;
}

export type LessonTaskKind =
  'IDENTIFY_PATTERN_MEMBER' | 'IDENTIFY_TARGET_STAR' | 'INDICATE_DIRECTION';

export interface LessonRouteStep {
  readonly stepId: string;
  readonly taskKind: LessonTaskKind;
  /** IDENTIFY_PATTERN_MEMBER: the helper pattern; IDENTIFY_TARGET_STAR: the target pattern. */
  readonly patternId: string | null;
  readonly directionId: string | null;
  /** The relationship whose guide is revealed after this step (null for the first step). */
  readonly guidanceRelationshipId: string | null;
  readonly prompt: string;
  readonly successFeedback: string;
  readonly retryFeedback: string;
}

export interface LessonRoute {
  readonly stableId: string;
  readonly routeVersion: string;
  readonly title: string;
  /** Lower number is preferred when several routes are eligible (data, not code). */
  readonly selectionPriority: number;
  readonly requiredStarIds: readonly string[];
  readonly steps: readonly LessonRouteStep[];
  readonly allowedAlternativeRouteIds: readonly string[];
  readonly review: ContentReview;
}

export interface ScenarioPreset {
  readonly scenarioId: string;
  readonly label: string;
  /** Canonical V1 UTC text; local-time labels are presentation only. */
  readonly utc: string;
  readonly observerPresetId: string;
  readonly purpose: string;
  readonly review: ContentReview;
}

export interface LessonContentPayload {
  readonly contentVersion: string;
  readonly contentScope: 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';
  readonly starArtifact: { readonly artifactId: string; readonly payloadSha256: string };
  readonly patterns: readonly SkyPattern[];
  readonly directions: readonly DirectionTarget[];
  readonly relationships: readonly GuidanceRelationship[];
  readonly routes: readonly LessonRoute[];
  readonly scenarios: readonly ScenarioPreset[];
}

/** Labels that must never be attached to the Cassiopeia-region helper (2D.1C guards). */
const FORBIDDEN_CASSIOPEIA_LABELS = ['Kursī al-Jawzāʾ', 'Kursi al-Jawza'];

/**
 * Validates referential integrity, ordering, layer guards and review scopes. Returns a
 * list of violations; an empty list means the content is structurally valid. Structural
 * validity is not cultural, Arabic, educational or scientific approval.
 */
export function validateLessonContent(
  content: LessonContentPayload,
  availableStarIds: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const unique = (ids: readonly string[], label: string) => {
    if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${label} identifiers.`);
  };
  unique(
    content.patterns.map((p) => p.stableId),
    'pattern',
  );
  unique(
    content.directions.map((d) => d.stableId),
    'direction',
  );
  unique(
    content.relationships.map((r) => r.stableId),
    'relationship',
  );
  unique(
    content.routes.map((r) => r.stableId),
    'route',
  );
  unique(
    content.scenarios.map((s) => s.scenarioId),
    'scenario',
  );
  const patterns = new Map(content.patterns.map((p) => [p.stableId, p]));
  const directions = new Set(content.directions.map((d) => d.stableId));
  const relationships = new Map(content.relationships.map((r) => [r.stableId, r]));
  const routes = new Set(content.routes.map((r) => r.stableId));
  const reviews = [
    ...content.patterns.map((p) => p.review),
    ...content.directions.map((d) => d.review),
    ...content.relationships.map((r) => r.review),
    ...content.routes.map((r) => r.review),
    ...content.scenarios.map((s) => s.review),
  ];
  for (const review of reviews) {
    if (review.scope !== content.contentScope)
      errors.push('A record review scope differs from the content scope.');
    if (
      review.state === 'APPROVED' &&
      (!review.reviewer || !review.decisionDate || !review.decisionReference)
    ) {
      errors.push('An APPROVED record lacks a named reviewer, date or decision reference.');
    }
  }
  const synthetic = content.contentScope === 'SYNTHETIC_TECHNICAL_FIXTURE';
  const layerAllowed = (layer: ContentLayer) =>
    synthetic ? layer === 'SYNTHETIC_TECHNICAL' : layer !== 'SYNTHETIC_TECHNICAL';

  for (const pattern of content.patterns) {
    if (pattern.memberStarIds.length === 0) errors.push(`${pattern.stableId} has no members.`);
    if (pattern.patternKind === 'SINGLE_STAR' && pattern.memberStarIds.length !== 1) {
      errors.push(
        `${pattern.stableId} is SINGLE_STAR but has ${pattern.memberStarIds.length} members.`,
      );
    }
    for (const starId of pattern.memberStarIds) {
      if (!availableStarIds.has(starId))
        errors.push(`${pattern.stableId} member ${starId} has no star row.`);
    }
    const members = new Set(pattern.memberStarIds);
    for (const segment of pattern.lineSegments) {
      if (!members.has(segment.fromStarId) || !members.has(segment.toStarId)) {
        errors.push(`${pattern.stableId} line segment uses a non-member star.`);
      }
    }
    if (pattern.lineSegments.length > 0 && pattern.lineSegmentLayer === 'NONE') {
      errors.push(`${pattern.stableId} has line segments without a declared layer.`);
    }
    for (const label of pattern.labels) {
      if (!layerAllowed(label.layer))
        errors.push(`${pattern.stableId} label layer ${label.layer} not allowed here.`);
      if (
        label.transliteration !== null &&
        FORBIDDEN_CASSIOPEIA_LABELS.includes(label.transliteration)
      ) {
        errors.push(
          `${pattern.stableId}: ${label.transliteration} is not Cassiopeia evidence (negative guard).`,
        );
      }
      if (label.transliteration === 'Dhāt al-Kursī' && label.layer === 'OLD_ARABIAN') {
        errors.push(
          `${pattern.stableId}: Dhāt al-Kursī is GRECO_ARABIC_SCHOLARLY, never OLD_ARABIAN.`,
        );
      }
      if (
        label.layer !== 'MODERN_PEDAGOGICAL' &&
        label.layer !== 'SYNTHETIC_TECHNICAL' &&
        label.citations.length === 0
      ) {
        errors.push(`${pattern.stableId}: ${label.layer} label lacks a citation.`);
      }
    }
    if (!synthetic && pattern.membershipCitations.length === 0) {
      errors.push(`${pattern.stableId} membership lacks a citation.`);
    }
  }

  for (const relationship of content.relationships) {
    const source = patterns.get(relationship.source.stableId);
    if (!source) errors.push(`${relationship.stableId} source pattern is missing.`);
    if (relationship.target.kind === 'pattern' && !patterns.has(relationship.target.stableId)) {
      errors.push(`${relationship.stableId} target pattern is missing.`);
    }
    if (relationship.target.kind === 'direction' && !directions.has(relationship.target.stableId)) {
      errors.push(`${relationship.stableId} target direction is missing.`);
    }
    const instruction = relationship.instruction;
    const starIds =
      instruction.kind === 'GREAT_CIRCLE_ARC'
        ? [instruction.fromStarId, instruction.toStarId]
        : instruction.kind === 'POINTER_EXTENSION'
          ? [instruction.fromStarId, instruction.throughStarId, instruction.toStarId]
          : [instruction.fromStarId];
    for (const starId of starIds) {
      if (!availableStarIds.has(starId))
        errors.push(`${relationship.stableId} instruction star ${starId} has no row.`);
    }
    if (!layerAllowed(relationship.layer))
      errors.push(`${relationship.stableId} layer not allowed here.`);
  }

  for (const route of content.routes) {
    if (route.steps.length === 0) errors.push(`${route.stableId} has no steps.`);
    unique(
      route.steps.map((s) => s.stepId),
      `${route.stableId} step`,
    );
    const required = new Set(route.requiredStarIds);
    for (const starId of route.requiredStarIds) {
      if (!availableStarIds.has(starId))
        errors.push(`${route.stableId} required star ${starId} has no row.`);
    }
    for (const step of route.steps) {
      if (step.taskKind === 'INDICATE_DIRECTION') {
        if (step.directionId === null || !directions.has(step.directionId)) {
          errors.push(`${route.stableId}/${step.stepId} needs a known direction.`);
        }
      } else {
        const pattern = step.patternId === null ? undefined : patterns.get(step.patternId);
        if (!pattern) errors.push(`${route.stableId}/${step.stepId} needs a known pattern.`);
        for (const starId of pattern?.memberStarIds ?? []) {
          if (!required.has(starId))
            errors.push(`${route.stableId} must require step star ${starId}.`);
        }
      }
      if (step.guidanceRelationshipId !== null) {
        const relationship = relationships.get(step.guidanceRelationshipId);
        if (!relationship) errors.push(`${route.stableId}/${step.stepId} relationship is missing.`);
      }
    }
    for (const alternative of route.allowedAlternativeRouteIds) {
      if (!routes.has(alternative) || alternative === route.stableId) {
        errors.push(`${route.stableId} alternative ${alternative} is not another known route.`);
      }
    }
  }

  for (const scenario of content.scenarios) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(scenario.utc)) {
      errors.push(`${scenario.scenarioId} UTC text is not canonical.`);
    }
  }
  return errors;
}
