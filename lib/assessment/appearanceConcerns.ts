/**
 * Structured, user-reported appearance goals/concerns — "what would you like
 * to improve?", never "which treatment do you want?".
 *
 * Everything here is USER-REPORTED EVIDENCE. A selection is not a diagnosis,
 * not a finding about the person's face, and not a treatment recommendation;
 * it only records what the user said they care about. Wording in the catalog
 * is deliberately appearance-focused (no clinical terms, no treatment names).
 * See docs/ASSESSMENT_APPEARANCE_CONCERNS.md.
 *
 * The catalog is the single source of truth: ID unions, labels, hierarchy
 * and normalized signal names are all derived from it, so they cannot drift.
 * This file has no dependency on the rest of lib/assessment/ (types.ts
 * imports from here, not the other way round).
 */

export const APPEARANCE_CONCERNS_VERSION = "0.1.0";
export const MAX_APPEARANCE_PRIORITIES = 3;

interface DetailShape {
  readonly id: string;
  readonly label: string;
  readonly signal: string;
}
interface ConcernShape {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly signal: string;
  readonly details: readonly DetailShape[];
}

export const APPEARANCE_CONCERN_GROUPS = [
  { id: "lines", label: "Facial lines" },
  { id: "contour", label: "Face shape & contour" },
  { id: "volume", label: "Volume & fullness" },
  { id: "lifting", label: "Lifting & firmness" },
  { id: "underEye", label: "Under-eye" },
  { id: "skin", label: "Skin" },
  { id: "overall", label: "Overall" },
] as const;
export type AppearanceConcernGroupId = (typeof APPEARANCE_CONCERN_GROUPS)[number]["id"];

export const APPEARANCE_CONCERN_CATALOG = [
  {
    id: "FACIAL_LINES",
    label: "Lines that become more visible with facial expressions",
    group: "lines",
    signal: "user_reports_facial_lines_concern",
    details: [
      { id: "FOREHEAD_LINES", label: "Forehead lines", signal: "user_reports_forehead_line_concern" },
      { id: "FROWN_LINES", label: "Frown lines between the brows", signal: "user_reports_frown_line_concern" },
      { id: "EYE_AREA_LINES", label: "Lines around the eyes", signal: "user_reports_eye_area_line_concern" },
      { id: "MOUTH_AREA_LINES", label: "Lines around the mouth", signal: "user_reports_mouth_area_line_concern" },
      { id: "GENERAL_EXPRESSION_LINES", label: "Expression lines in general", signal: "user_reports_general_expression_line_concern" },
      { id: "FACIAL_LINES_NOT_SURE", label: "Not sure which", signal: "user_reports_uncertainty_about_facial_lines" },
    ],
  },
  {
    id: "FACIAL_DEFINITION",
    label: "Facial definition and contour",
    group: "contour",
    signal: "user_reports_facial_definition_goal",
    details: [
      { id: "JAW_DEFINITION", label: "Jaw definition", signal: "user_reports_jaw_definition_goal" },
      { id: "CHEEK_DEFINITION", label: "Cheek definition", signal: "user_reports_cheek_definition_goal" },
      { id: "LOWER_FACE_DEFINITION", label: "Lower-face definition", signal: "user_reports_lower_face_definition_goal" },
      { id: "OVERALL_CONTOUR", label: "Overall facial contour", signal: "user_reports_overall_contour_goal" },
      { id: "CONTOUR_BALANCE", label: "Balance within my facial contour", signal: "user_reports_contour_balance_goal" },
      { id: "FACIAL_DEFINITION_NOT_SURE", label: "Not sure which", signal: "user_reports_uncertainty_about_facial_definition" },
    ],
  },
  {
    id: "FACIAL_BALANCE",
    label: "Balance between my features",
    group: "contour",
    signal: "user_reports_facial_balance_goal",
    details: [],
  },
  {
    id: "FACIAL_VOLUME",
    label: "Fullness in my face",
    group: "volume",
    signal: "user_reports_facial_volume_goal",
    details: [
      { id: "CHEEK_FULLNESS", label: "More fullness in my cheeks", signal: "user_reports_cheek_fullness_goal" },
      { id: "MIDFACE_FULLNESS", label: "More fullness in my mid-face", signal: "user_reports_midface_fullness_goal" },
      { id: "LIP_FULLNESS", label: "More fullness in my lips", signal: "user_reports_lip_fullness_goal" },
      { id: "FACIAL_VOLUME_BALANCE", label: "More even fullness across my face", signal: "user_reports_facial_volume_balance_goal" },
      { id: "FACIAL_VOLUME_NOT_SURE", label: "Not sure which", signal: "user_reports_uncertainty_about_facial_volume" },
    ],
  },
  {
    id: "FACIAL_LIFTING",
    label: "A firmer or more lifted look",
    group: "lifting",
    signal: "user_reports_facial_lifting_goal",
    details: [
      { id: "FACIAL_FIRMNESS", label: "A firmer look", signal: "user_reports_facial_firmness_goal" },
      { id: "LOWER_FACE_LIFTING", label: "A more lifted lower face", signal: "user_reports_lower_face_lifting_goal" },
      { id: "JAWLINE_LIFTING", label: "A more lifted jawline", signal: "user_reports_jawline_lifting_goal" },
      { id: "OVERALL_LIFTED_APPEARANCE", label: "An overall more lifted look", signal: "user_reports_overall_lifted_appearance_goal" },
      { id: "FACIAL_LIFTING_NOT_SURE", label: "Not sure which", signal: "user_reports_uncertainty_about_facial_lifting" },
    ],
  },
  {
    id: "UNDER_EYE",
    label: "Under-eye appearance",
    group: "underEye",
    signal: "user_reports_under_eye_concern",
    details: [
      { id: "DARK_LOOKING_UNDER_EYES", label: "Dark-looking under-eyes", signal: "user_reports_dark_looking_under_eye_concern" },
      { id: "UNDER_EYE_PUFFINESS", label: "Under-eye puffiness", signal: "user_reports_under_eye_puffiness_concern" },
      { id: "UNDER_EYE_HOLLOW_APPEARANCE", label: "Hollow-looking under-eyes", signal: "user_reports_under_eye_hollow_appearance_concern" },
      { id: "UNDER_EYE_FINE_LINES", label: "Fine lines under the eyes", signal: "user_reports_under_eye_fine_line_concern" },
      { id: "UNDER_EYE_APPEARANCE_GENERAL", label: "Under-eye appearance in general", signal: "user_reports_general_under_eye_concern" },
      { id: "UNDER_EYE_NOT_SURE", label: "Not sure which", signal: "user_reports_uncertainty_about_under_eye" },
    ],
  },
  {
    id: "SKIN_TEXTURE",
    label: "Skin texture",
    group: "skin",
    signal: "user_reports_skin_texture_concern",
    details: [
      { id: "UNEVEN_TEXTURE", label: "Uneven-looking texture", signal: "user_reports_uneven_texture_concern" },
      { id: "ROUGH_LOOKING_SKIN", label: "Rough-looking skin", signal: "user_reports_rough_looking_skin_concern" },
      { id: "VISIBLE_PORES", label: "Visible pores", signal: "user_reports_visible_pores_concern" },
      { id: "FINE_LINES", label: "Fine lines in my skin", signal: "user_reports_skin_fine_line_concern" },
      { id: "GENERAL_TEXTURE", label: "Skin texture in general", signal: "user_reports_general_skin_texture_concern" },
    ],
  },
  {
    id: "SKIN_TONE",
    label: "Skin tone",
    group: "skin",
    signal: "user_reports_skin_tone_concern",
    details: [
      { id: "UNEVEN_TONE", label: "Uneven-looking tone", signal: "user_reports_uneven_tone_concern" },
      { id: "DULL_LOOKING_SKIN", label: "Dull-looking skin", signal: "user_reports_dull_looking_skin_concern" },
      { id: "REDNESS", label: "Redness", signal: "user_reports_redness_concern" },
      { id: "GENERAL_TONE", label: "Skin tone in general", signal: "user_reports_general_skin_tone_concern" },
    ],
  },
  {
    id: "PIGMENTATION",
    label: "Pigmentation",
    group: "skin",
    signal: "user_reports_pigmentation_concern",
    details: [
      { id: "DARK_SPOTS", label: "Dark spots", signal: "user_reports_dark_spots_concern" },
      { id: "UNEVEN_PIGMENTATION", label: "Uneven-looking colour", signal: "user_reports_uneven_pigmentation_concern" },
      { id: "GENERAL_PIGMENTATION", label: "Pigmentation in general", signal: "user_reports_general_pigmentation_concern" },
    ],
  },
  {
    id: "BLEMISHES",
    label: "Blemishes",
    group: "skin",
    signal: "user_reports_blemish_concern",
    details: [
      { id: "ACTIVE_BLEMISHES", label: "Blemishes I have now", signal: "user_reports_active_blemishes_concern" },
      { id: "BLEMISH_MARKS", label: "Marks left by blemishes", signal: "user_reports_blemish_marks_concern" },
      { id: "GENERAL_BLEMISH_CONCERN", label: "Blemishes in general", signal: "user_reports_general_blemish_concern" },
    ],
  },
  {
    id: "OVERALL_APPEARANCE",
    label: "An overall improvement in my appearance",
    group: "overall",
    signal: "user_reports_overall_appearance_goal",
    details: [],
  },
  {
    id: "NOT_SURE",
    label: "I'm not sure yet",
    group: "overall",
    signal: "user_reports_uncertainty_about_areas",
    details: [],
  },
] as const satisfies readonly ConcernShape[];

type Catalog = typeof APPEARANCE_CONCERN_CATALOG;
export type AppearanceConcernId = Catalog[number]["id"];
export type AppearanceConcernDetailId = Catalog[number]["details"][number]["id"];
export type AppearanceConcernSignalId = Catalog[number]["signal"] | Catalog[number]["details"][number]["signal"];

export const APPEARANCE_CONCERN_IDS: readonly AppearanceConcernId[] = APPEARANCE_CONCERN_CATALOG.map((c) => c.id);

const CONCERN_BY_ID = new Map<string, Catalog[number]>(APPEARANCE_CONCERN_CATALOG.map((c) => [c.id, c]));
/** detail id → its parent concern id */
const PARENT_OF_DETAIL = new Map<string, AppearanceConcernId>(
  APPEARANCE_CONCERN_CATALOG.flatMap((c) => c.details.map((d) => [d.id, c.id] as const)),
);

export const APPEARANCE_CONCERN_DETAIL_IDS: readonly AppearanceConcernDetailId[] = [...PARENT_OF_DETAIL.keys()] as AppearanceConcernDetailId[];

export function isAppearanceConcernId(value: unknown): value is AppearanceConcernId {
  return typeof value === "string" && CONCERN_BY_ID.has(value);
}
export function isAppearanceConcernDetailId(value: unknown): value is AppearanceConcernDetailId {
  return typeof value === "string" && PARENT_OF_DETAIL.has(value);
}
export function parentOfDetail(detail: AppearanceConcernDetailId): AppearanceConcernId {
  return PARENT_OF_DETAIL.get(detail)!;
}
export function detailsOfConcern(concern: AppearanceConcernId): readonly { id: AppearanceConcernDetailId; label: string; signal: string }[] {
  return CONCERN_BY_ID.get(concern)?.details ?? [];
}
export function concernLabel(concern: AppearanceConcernId): string {
  return CONCERN_BY_ID.get(concern)?.label ?? concern;
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

export interface AppearanceConcerns {
  version: typeof APPEARANCE_CONCERNS_VERSION;
  selected: AppearanceConcernId[];
  /** Optional refinements; each must belong to a selected concern. */
  details: AppearanceConcernDetailId[];
  /** "What is most important?" — at most 3, each drawn from `selected`. */
  priorities: AppearanceConcernId[];
}

export function createEmptyAppearanceConcerns(): AppearanceConcerns {
  return { version: APPEARANCE_CONCERNS_VERSION, selected: [], details: [], priorities: [] };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasDuplicates = (list: unknown[]) => new Set(list).size !== list.length;

/** Returns a list of problems; an empty list means `value` is a well-formed AppearanceConcerns. Never throws. */
export function validateAppearanceConcerns(value: unknown): string[] {
  if (!isObject(value)) return ["appearanceConcerns must be an object"];
  const problems: string[] = [];

  if (value.version !== APPEARANCE_CONCERNS_VERSION) problems.push(`version must be "${APPEARANCE_CONCERNS_VERSION}"`);

  const { selected, details, priorities } = value;
  if (!Array.isArray(selected) || !selected.every(isAppearanceConcernId)) problems.push("selected must be an array of valid concern ids");
  else if (hasDuplicates(selected)) problems.push("selected contains duplicates");

  if (!Array.isArray(details) || !details.every(isAppearanceConcernDetailId)) problems.push("details must be an array of valid detail ids");
  else if (hasDuplicates(details)) problems.push("details contains duplicates");

  if (!Array.isArray(priorities) || !priorities.every(isAppearanceConcernId)) problems.push("priorities must be an array of valid concern ids");
  else if (hasDuplicates(priorities)) problems.push("priorities contains duplicates");
  else if (priorities.length > MAX_APPEARANCE_PRIORITIES) problems.push(`priorities may contain at most ${MAX_APPEARANCE_PRIORITIES} entries`);

  if (problems.length > 0) return problems;

  const selectedIds = selected as AppearanceConcernId[];
  for (const d of details as AppearanceConcernDetailId[]) {
    const parent = parentOfDetail(d);
    if (!selectedIds.includes(parent)) problems.push(`detail "${d}" belongs to "${parent}", which is not selected`);
  }
  for (const p of priorities as AppearanceConcernId[]) {
    if (!selectedIds.includes(p)) problems.push(`priority "${p}" is not a selected concern`);
    if (p === "NOT_SURE") problems.push("NOT_SURE cannot be a priority");
  }
  return problems;
}

/** A validated, copied AppearanceConcerns — or null if `value` is malformed. */
export function sanitizeAppearanceConcerns(value: unknown): AppearanceConcerns | null {
  if (validateAppearanceConcerns(value).length > 0) return null;
  const v = value as AppearanceConcerns;
  return { version: APPEARANCE_CONCERNS_VERSION, selected: [...v.selected], details: [...v.details], priorities: [...v.priorities] };
}

// ---------------------------------------------------------------------------
// Pure edit helpers — keep every invariant so the UI cannot produce invalid state.
// ---------------------------------------------------------------------------

/**
 * Selecting NOT_SURE replaces everything else (it records uncertainty, not a
 * concern); selecting any real concern removes NOT_SURE. Deselecting a
 * concern also removes its details and its priority.
 */
export function toggleConcern(current: AppearanceConcerns, concern: AppearanceConcernId): AppearanceConcerns {
  if (current.selected.includes(concern)) {
    return {
      ...current,
      selected: current.selected.filter((c) => c !== concern),
      details: current.details.filter((d) => parentOfDetail(d) !== concern),
      priorities: current.priorities.filter((p) => p !== concern),
    };
  }
  if (concern === "NOT_SURE") return { ...current, selected: ["NOT_SURE"], details: [], priorities: [] };
  return { ...current, selected: [...current.selected.filter((c) => c !== "NOT_SURE"), concern] };
}

/** Ignored when the parent concern is not selected. */
export function toggleDetail(current: AppearanceConcerns, detail: AppearanceConcernDetailId): AppearanceConcerns {
  if (!current.selected.includes(parentOfDetail(detail))) return current;
  return current.details.includes(detail)
    ? { ...current, details: current.details.filter((d) => d !== detail) }
    : { ...current, details: [...current.details, detail] };
}

/** Ignored when the concern is not selected, is NOT_SURE, or the maximum is already reached. */
export function togglePriority(current: AppearanceConcerns, concern: AppearanceConcernId): AppearanceConcerns {
  if (current.priorities.includes(concern)) return { ...current, priorities: current.priorities.filter((p) => p !== concern) };
  if (!current.selected.includes(concern) || concern === "NOT_SURE") return current;
  if (current.priorities.length >= MAX_APPEARANCE_PRIORITIES) return current;
  return { ...current, priorities: [...current.priorities, concern] };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * One normalized piece of user-reported evidence. It records only that the
 * user said something — never a diagnosis and never a treatment.
 */
export interface AppearanceConcernSignal {
  /** e.g. "user_reports_forehead_line_concern" */
  signal: AppearanceConcernSignalId;
  concern: AppearanceConcernId;
  /** Null for a concern-level signal. */
  detail: AppearanceConcernDetailId | null;
  /** The user-facing wording, e.g. "Forehead lines". */
  label: string;
  /** Stable id for evidence traceability. */
  questionId: string;
  isPriority: boolean;
}

/**
 * Turns questionnaire answers into normalized signals: one per selected
 * concern, then one per detail. Malformed input yields no signals rather
 * than trusting it. NOT_SURE yields an uncertainty signal that downstream
 * code must not treat as a concern.
 */
export function normalizeAppearanceConcerns(value: AppearanceConcerns | null | undefined): AppearanceConcernSignal[] {
  const valid = sanitizeAppearanceConcerns(value);
  if (!valid) return [];

  const out: AppearanceConcernSignal[] = [];
  for (const id of valid.selected) {
    const def = CONCERN_BY_ID.get(id)!;
    out.push({
      signal: def.signal,
      concern: id,
      detail: null,
      label: def.label,
      questionId: `appearanceConcerns.selected.${id}`,
      isPriority: valid.priorities.includes(id),
    });
    for (const d of def.details) {
      if (!valid.details.includes(d.id)) continue;
      out.push({
        signal: d.signal,
        concern: id,
        detail: d.id,
        label: d.label,
        questionId: `appearanceConcerns.details.${d.id}`,
        isPriority: valid.priorities.includes(id),
      });
    }
  }
  return out;
}
