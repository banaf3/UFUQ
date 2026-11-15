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

/**
 * A geodetic destination for a Qibla direction (AST-005). The coordinate is a sourced
 * candidate until a named reviewer approves it; it is never taken from a historical map,
 * table or mosque orientation.
 */
export interface QiblaDestination {
  readonly destinationId: string;
  readonly label: string;
  readonly latitudeDegrees: number;
  /** East-positive. */
  readonly longitudeDegrees: number;
  readonly datum: 'WGS84';
  /** Half the largest extent of the destination footprint (m), as the source gives it. */
  readonly footprintRadiusMetres: number;
  readonly source: SourceCitation;
  readonly crossChecks: readonly SourceCitation[];
}

export type DirectionDefinition =
  | {
      readonly kind: 'TERRESTRIAL_TRUE_NORTH';
      /** North-zero, east-positive azimuth of the target direction (rad). */
      readonly azimuthRadians: 0;
    }
  | {
      /**
       * The Qibla as the initial great-circle bearing on a sphere from the observer to the
       * destination, clockwise from True North (the report's NFR-2 spherical trigonometry;
       * the azimuth is computed per observer by the server).
       */
      readonly kind: 'QIBLA_SPHERICAL_INITIAL_BEARING';
      readonly destination: QiblaDestination;
    };

export interface DirectionTarget {
  readonly stableId: string;
  readonly contentVersion: string;
  readonly labels: readonly CulturalLabel[];
  readonly definition: DirectionDefinition;
  /**
   * Learner answer tolerance for this direction (IMP-012). Null until approved: the answer
   * is then measured, never graded. Synthetic content may carry a synthetic policy.
   */
  readonly learnerTolerance: DirectionTolerancePolicyRecord | null;
  readonly review: ContentReview;
}

export interface DirectionTolerancePolicyRecord {
  readonly policyId: string;
  /** Inclusive maximum wrapped azimuth difference (rad), in (0, pi]. */
  readonly maximumDifferenceRadians: number;
  /**
   * Who chose the value: the project owner (a recorded owner decision, still subject to
   * the record's review), a named reviewer through an approved record, or a synthetic
   * technical fixture. An agent never fills this.
   */
  readonly decidedBy: 'PROJECT_OWNER' | 'NAMED_REVIEWER' | 'SYNTHETIC_TECHNICAL';
  readonly approvalReference: string;
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
  | { readonly kind: 'VERTICAL_TO_HORIZON'; readonly fromStarId: string }
  /**
   * From the horizon point below the star (True North), turn along the horizon to the
   * target direction's azimuth.
   */
  | { readonly kind: 'HORIZON_TURN_FROM_NORTH'; readonly fromStarId: string };

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
  | 'IDENTIFY_PATTERN_MEMBER'
  | 'SELECT_ALL_PATTERN_MEMBERS'
  | 'IDENTIFY_TARGET_STAR'
  | 'INDICATE_DIRECTION';

/** Knowledge-component identifiers of TUTORING_BKT_SPEC.md (KC-01..KC-05). */
export type KnowledgeComponentRef = 'KC-01' | 'KC-02' | 'KC-03' | 'KC-04' | 'KC-05';
export const KNOWLEDGE_COMPONENT_REFS: readonly KnowledgeComponentRef[] = [
  'KC-01',
  'KC-02',
  'KC-03',
  'KC-04',
  'KC-05',
];

export interface LessonRouteStep {
  readonly stepId: string;
  readonly taskKind: LessonTaskKind;
  /**
   * The step's one primary knowledge component (one scored task, one KC). The mapping is
   * an EDU-002 decision and is reviewed with the route; null means the step is not scored
   * for any KC.
   */
  readonly knowledgeComponentId: KnowledgeComponentRef | null;
  /** Pattern tasks: the pattern to find; IDENTIFY_TARGET_STAR: the target pattern. */
  readonly patternId: string | null;
  readonly directionId: string | null;
  /** The relationship that guides the learner to this step's target (null for the first step). */
  readonly guidanceRelationshipId: string | null;
  readonly prompt: string;
  readonly successFeedback: string;
  readonly retryFeedback: string;
}

/**
 * What one walkthrough frame shows. Culture records come from the Arabic sky culture
 * artifact, which supplies their cited card text; content records come from this artifact.
 */
export type WalkthroughFocus =
  | { readonly kind: 'PATTERN'; readonly patternId: string }
  | { readonly kind: 'CULTURE_FIGURE'; readonly figureId: string }
  | { readonly kind: 'CULTURE_STAR'; readonly hip: number }
  | { readonly kind: 'RELATIONSHIP'; readonly relationshipId: string }
  | { readonly kind: 'DIRECTION'; readonly directionId: string };

/**
 * One step of the taught walkthrough that precedes assessment (report storyboard figure
 * 3-5): the camera moves to the focus, its lines and names are drawn, and the frame's
 * teaching instruction is shown with the focus record's cited text. Frames whose focus
 * is below the horizon in the scenario are skipped.
 */
export interface WalkthroughFrame {
  readonly frameId: string;
  readonly focus: WalkthroughFocus;
  /** UFUQ's own teaching instruction (MODERN_PEDAGOGICAL), plain English. */
  readonly instruction: string;
}

export interface LessonRoute {
  readonly stableId: string;
  readonly routeVersion: string;
  readonly title: string;
  /** Lower number is preferred when several routes are eligible (data, not code). */
  readonly selectionPriority: number;
  readonly requiredStarIds: readonly string[];
  /** The taught walkthrough shown before the assessment steps. */
  readonly walkthrough: readonly WalkthroughFrame[];
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
  /**
   * The sky culture's figure ids and named-star HIP numbers, for walkthrough frames; null
   * when no culture is available here (frames that use it are then skipped at runtime).
   */
  culture: {
    readonly figureIds: ReadonlySet<string>;
    readonly starHips: ReadonlySet<number>;
  } | null = { figureIds: new Set(), starHips: new Set() },
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
    if (
      instruction.kind === 'HORIZON_TURN_FROM_NORTH' &&
      relationship.target.kind !== 'direction'
    ) {
      errors.push(`${relationship.stableId} turns along the horizon but has no direction target.`);
    }
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
    const knowledgeComponents = route.steps
      .map((step) => step.knowledgeComponentId)
      .filter((id): id is KnowledgeComponentRef => id !== null);
    if (new Set(knowledgeComponents).size !== knowledgeComponents.length) {
      errors.push(`${route.stableId} credits one knowledge component in two steps.`);
    }
    for (const step of route.steps) {
      if (
        step.knowledgeComponentId !== null &&
        !KNOWLEDGE_COMPONENT_REFS.includes(step.knowledgeComponentId)
      ) {
        errors.push(`${route.stableId}/${step.stepId} names an unknown knowledge component.`);
      }
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
    unique(
      route.walkthrough.map((frame) => frame.frameId),
      `${route.stableId} walkthrough frame`,
    );
    for (const frame of route.walkthrough) {
      const focus = frame.focus;
      const label = `${route.stableId}/${frame.frameId}`;
      if (focus.kind === 'PATTERN' && !patterns.has(focus.patternId))
        errors.push(`${label} names an unknown pattern.`);
      if (focus.kind === 'RELATIONSHIP' && !relationships.has(focus.relationshipId))
        errors.push(`${label} names an unknown relationship.`);
      if (focus.kind === 'DIRECTION' && !directions.has(focus.directionId))
        errors.push(`${label} names an unknown direction.`);
      if (focus.kind === 'CULTURE_FIGURE' && culture && !culture.figureIds.has(focus.figureId))
        errors.push(`${label} names a figure missing from the sky culture.`);
      if (focus.kind === 'CULTURE_STAR' && culture && !culture.starHips.has(focus.hip))
        errors.push(`${label} names a star missing from the sky culture.`);
      if (frame.instruction.trim().length === 0) errors.push(`${label} has no instruction.`);
    }
    for (const alternative of route.allowedAlternativeRouteIds) {
      if (!routes.has(alternative) || alternative === route.stableId) {
        errors.push(`${route.stableId} alternative ${alternative} is not another known route.`);
      }
    }
  }

  for (const direction of content.directions) {
    const definition = direction.definition;
    if (definition.kind === 'QIBLA_SPHERICAL_INITIAL_BEARING') {
      const destination = definition.destination;
      if (
        !Number.isFinite(destination.latitudeDegrees) ||
        Math.abs(destination.latitudeDegrees) > 90 ||
        !Number.isFinite(destination.longitudeDegrees) ||
        destination.longitudeDegrees <= -180 ||
        destination.longitudeDegrees > 180
      ) {
        errors.push(`${direction.stableId} destination coordinate is out of range.`);
      }
      if (!(destination.footprintRadiusMetres > 0))
        errors.push(`${direction.stableId} destination footprint must be positive.`);
      if (!destination.source.sourceId || !destination.source.locator)
        errors.push(`${direction.stableId} destination coordinate is uncited (AST-005).`);
    }
    const tolerance = direction.learnerTolerance;
    if (tolerance === null) continue;
    if (
      !Number.isFinite(tolerance.maximumDifferenceRadians) ||
      tolerance.maximumDifferenceRadians <= 0 ||
      tolerance.maximumDifferenceRadians > Math.PI
    ) {
      errors.push(`${direction.stableId} learner tolerance must be in (0, pi] radians.`);
    }
    if (!tolerance.policyId || !tolerance.approvalReference) {
      errors.push(
        `${direction.stableId} learner tolerance lacks an identifier or approval reference.`,
      );
    }
    if (synthetic !== (tolerance.decidedBy === 'SYNTHETIC_TECHNICAL')) {
      errors.push(`${direction.stableId} tolerance decision kind does not match the scope.`);
    }
    if (
      !synthetic &&
      tolerance.decidedBy === 'NAMED_REVIEWER' &&
      direction.review.state !== 'APPROVED'
    ) {
      errors.push(
        `${direction.stableId} carries a reviewer tolerance without approved review (IMP-012).`,
      );
    }
  }

  for (const scenario of content.scenarios) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(scenario.utc)) {
      errors.push(`${scenario.scenarioId} UTC text is not canonical.`);
    }
  }
  return errors;
}
