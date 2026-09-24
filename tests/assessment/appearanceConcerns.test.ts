import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPEARANCE_CONCERN_CATALOG,
  APPEARANCE_CONCERN_IDS,
  APPEARANCE_CONCERN_DETAIL_IDS,
  APPEARANCE_CONCERNS_VERSION,
  MAX_APPEARANCE_PRIORITIES,
  createEmptyAppearanceConcerns,
  normalizeAppearanceConcerns,
  sanitizeAppearanceConcerns,
  toggleConcern,
  toggleDetail,
  togglePriority,
  validateAppearanceConcerns,
  type AppearanceConcerns,
} from "../../lib/assessment/appearanceConcerns.ts";
import { sanitizeAssessment } from "../../lib/assessment/schema.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";

function concerns(partial: Partial<AppearanceConcerns>): AppearanceConcerns {
  return { ...createEmptyAppearanceConcerns(), ...partial };
}
const problems = (v: unknown) => validateAppearanceConcerns(v).join(" | ");

test("the 12 required concern ids exist", () => {
  assert.deepEqual(
    [...APPEARANCE_CONCERN_IDS].sort(),
    [
      "BLEMISHES", "FACIAL_BALANCE", "FACIAL_DEFINITION", "FACIAL_LIFTING", "FACIAL_LINES", "FACIAL_VOLUME",
      "NOT_SURE", "OVERALL_APPEARANCE", "PIGMENTATION", "SKIN_TEXTURE", "SKIN_TONE", "UNDER_EYE",
    ],
  );
});

test("valid appearance concern: an empty and a populated value both validate", () => {
  assert.deepEqual(validateAppearanceConcerns(createEmptyAppearanceConcerns()), []);
  assert.deepEqual(
    validateAppearanceConcerns(concerns({ selected: ["FACIAL_LINES", "SKIN_TONE"], priorities: ["SKIN_TONE"] })),
    [],
  );
});

test("invalid appearance concern is rejected", () => {
  assert.match(problems(concerns({ selected: ["BOTOX" as never] })), /valid concern ids/);
  assert.match(problems(concerns({ selected: ["facial_lines" as never] })), /valid concern ids/);
  assert.match(problems(concerns({ details: ["NOT_A_DETAIL" as never] })), /valid detail ids/);
  assert.match(problems(concerns({ version: "9.9.9" as never })), /version/);
});

test("valid detail: belongs to a selected parent", () => {
  assert.deepEqual(validateAppearanceConcerns(concerns({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES", "FROWN_LINES"] })), []);
});

test("detail belonging to the wrong parent is rejected", () => {
  assert.match(problems(concerns({ selected: ["SKIN_TONE"], details: ["FOREHEAD_LINES"] })), /"FOREHEAD_LINES" belongs to "FACIAL_LINES"/);
  assert.match(problems(concerns({ selected: [], details: ["JAW_DEFINITION"] })), /not selected/);
});

test("duplicate selections are rejected", () => {
  assert.match(problems(concerns({ selected: ["FACIAL_LINES", "FACIAL_LINES"] })), /selected contains duplicates/);
  assert.match(problems(concerns({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES", "FOREHEAD_LINES"] })), /details contains duplicates/);
  assert.match(
    problems(concerns({ selected: ["FACIAL_LINES"], priorities: ["FACIAL_LINES", "FACIAL_LINES"] })),
    /priorities contains duplicates/,
  );
});

test("at most 3 priorities: validation rejects 4, the toggle helper refuses a 4th", () => {
  const four = concerns({
    selected: ["FACIAL_LINES", "FACIAL_DEFINITION", "FACIAL_VOLUME", "SKIN_TONE"],
    priorities: ["FACIAL_LINES", "FACIAL_DEFINITION", "FACIAL_VOLUME", "SKIN_TONE"],
  });
  assert.match(problems(four), /at most 3/);

  let state = concerns({ selected: ["FACIAL_LINES", "FACIAL_DEFINITION", "FACIAL_VOLUME", "SKIN_TONE"] });
  for (const c of ["FACIAL_LINES", "FACIAL_DEFINITION", "FACIAL_VOLUME", "SKIN_TONE"] as const) state = togglePriority(state, c);
  assert.equal(state.priorities.length, MAX_APPEARANCE_PRIORITIES);
  assert.deepEqual(validateAppearanceConcerns(state), []);
});

test("a priority must be a selected concern", () => {
  assert.match(problems(concerns({ selected: ["FACIAL_LINES"], priorities: ["SKIN_TONE"] })), /priority "SKIN_TONE" is not a selected concern/);
  assert.deepEqual(togglePriority(concerns({ selected: ["FACIAL_LINES"] }), "SKIN_TONE").priorities, []);
});

test("NOT_SURE: exclusive in the UI helpers, cannot be a priority or carry details", () => {
  const withLines = concerns({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] });
  const unsure = toggleConcern(withLines, "NOT_SURE");
  assert.deepEqual(unsure, concerns({ selected: ["NOT_SURE"] }));
  assert.deepEqual(toggleConcern(unsure, "SKIN_TONE").selected, ["SKIN_TONE"]);

  assert.match(problems(concerns({ selected: ["NOT_SURE"], priorities: ["NOT_SURE"] })), /NOT_SURE cannot be a priority/);
  assert.deepEqual(togglePriority(unsure, "NOT_SURE").priorities, []);
  assert.deepEqual(validateAppearanceConcerns(unsure), []);
});

test("deselecting a concern also removes its details and priority", () => {
  const state = concerns({
    selected: ["FACIAL_LINES", "SKIN_TONE"],
    details: ["FOREHEAD_LINES", "REDNESS"],
    priorities: ["FACIAL_LINES", "SKIN_TONE"],
  });
  const next = toggleConcern(state, "FACIAL_LINES");
  assert.deepEqual(next, concerns({ selected: ["SKIN_TONE"], details: ["REDNESS"], priorities: ["SKIN_TONE"] }));
  assert.deepEqual(validateAppearanceConcerns(next), []);
});

test("toggleDetail ignores a detail whose parent is not selected and can toggle off", () => {
  assert.deepEqual(toggleDetail(createEmptyAppearanceConcerns(), "FOREHEAD_LINES").details, []);
  const on = toggleDetail(concerns({ selected: ["FACIAL_LINES"] }), "FOREHEAD_LINES");
  assert.deepEqual(on.details, ["FOREHEAD_LINES"]);
  assert.deepEqual(toggleDetail(on, "FOREHEAD_LINES").details, []);
});

test("serialization + deserialization round-trip through JSON", () => {
  const original = concerns({
    selected: ["FACIAL_LINES", "UNDER_EYE"],
    details: ["FOREHEAD_LINES", "DARK_LOOKING_UNDER_EYES"],
    priorities: ["UNDER_EYE"],
  });
  const restored = sanitizeAppearanceConcerns(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored, original);
  assert.equal(restored?.version, APPEARANCE_CONCERNS_VERSION);
});

test("malformed appearance concern data is rejected safely (never throws)", () => {
  for (const bad of [null, undefined, 42, "x", [], { selected: "FACIAL_LINES" }, { version: "0.1.0", selected: [], details: null, priorities: [] }]) {
    assert.doesNotThrow(() => validateAppearanceConcerns(bad));
    assert.equal(sanitizeAppearanceConcerns(bad), null);
    assert.deepEqual(normalizeAppearanceConcerns(bad as never), []);
  }
});

test("backward compatibility: an assessment saved before this field existed loads with empty concerns", () => {
  const older: Record<string, unknown> = JSON.parse(JSON.stringify(createEmptyAssessment()));
  delete older.appearanceConcerns;
  const loaded = sanitizeAssessment(older);
  assert.notEqual(loaded, null);
  assert.deepEqual(loaded?.appearanceConcerns, createEmptyAppearanceConcerns());
});

test("an assessment with valid appearance concerns sanitizes; a malformed one is discarded", () => {
  const good = createEmptyAssessment();
  good.appearanceConcerns = concerns({ selected: ["SKIN_TEXTURE"], details: ["VISIBLE_PORES"] });
  assert.deepEqual(sanitizeAssessment(JSON.parse(JSON.stringify(good)))?.appearanceConcerns, good.appearanceConcerns);

  const bad: Record<string, unknown> = { ...good, appearanceConcerns: { ...good.appearanceConcerns, details: ["FOREHEAD_LINES"] } };
  assert.equal(sanitizeAssessment(bad), null);
});

// ---- normalization ----

const signalsOf = (c: AppearanceConcerns) => normalizeAppearanceConcerns(c).map((s) => s.signal);

test("normalization: facial-lines signals (concern and detail)", () => {
  assert.deepEqual(signalsOf(concerns({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] })), [
    "user_reports_facial_lines_concern",
    "user_reports_forehead_line_concern",
  ]);
});

test("normalization: facial-definition signal", () => {
  assert.deepEqual(signalsOf(concerns({ selected: ["FACIAL_DEFINITION"], details: ["JAW_DEFINITION"] })), [
    "user_reports_facial_definition_goal",
    "user_reports_jaw_definition_goal",
  ]);
});

test("normalization: facial-volume signal", () => {
  assert.deepEqual(signalsOf(concerns({ selected: ["FACIAL_VOLUME"], details: ["CHEEK_FULLNESS"] })), [
    "user_reports_facial_volume_goal",
    "user_reports_cheek_fullness_goal",
  ]);
});

test("normalization: facial-lifting signal", () => {
  assert.deepEqual(signalsOf(concerns({ selected: ["FACIAL_LIFTING"], details: ["JAWLINE_LIFTING"] })), [
    "user_reports_facial_lifting_goal",
    "user_reports_jawline_lifting_goal",
  ]);
});

test("normalization: under-eye signal uses the user's appearance wording, not a diagnosis", () => {
  const [parent, detail] = normalizeAppearanceConcerns(concerns({ selected: ["UNDER_EYE"], details: ["DARK_LOOKING_UNDER_EYES"] }));
  assert.equal(parent.signal, "user_reports_under_eye_concern");
  assert.equal(detail.signal, "user_reports_dark_looking_under_eye_concern");
  assert.equal(detail.label, "Dark-looking under-eyes");
});

test("normalization: skin signals", () => {
  assert.deepEqual(
    signalsOf(concerns({ selected: ["SKIN_TEXTURE", "SKIN_TONE", "PIGMENTATION", "BLEMISHES"] })),
    [
      "user_reports_skin_texture_concern",
      "user_reports_skin_tone_concern",
      "user_reports_pigmentation_concern",
      "user_reports_blemish_concern",
    ],
  );
});

test("normalization carries label, stable question id, detail and priority flag", () => {
  const out = normalizeAppearanceConcerns(concerns({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] }));
  assert.deepEqual(out[1], {
    signal: "user_reports_forehead_line_concern",
    concern: "FACIAL_LINES",
    detail: "FOREHEAD_LINES",
    label: "Forehead lines",
    questionId: "appearanceConcerns.details.FOREHEAD_LINES",
    isPriority: true,
  });
  assert.equal(out[0].detail, null);
});

test("normalization: NOT_SURE yields only an uncertainty signal", () => {
  assert.deepEqual(signalsOf(concerns({ selected: ["NOT_SURE"] })), ["user_reports_uncertainty_about_areas"]);
});

test("catalog integrity: every signal is unique and every detail id is unique across parents", () => {
  const signals = APPEARANCE_CONCERN_CATALOG.flatMap((c) => [c.signal, ...c.details.map((d) => d.signal)]);
  assert.equal(new Set(signals).size, signals.length);
  assert.ok(signals.every((s) => s.startsWith("user_reports_")));
  const detailCount = APPEARANCE_CONCERN_CATALOG.reduce((n, c) => n + c.details.length, 0);
  assert.equal(APPEARANCE_CONCERN_DETAIL_IDS.length, detailCount);
});

test("catalog wording: no treatment names and no diagnostic terms in any user-facing label", () => {
  const labels = APPEARANCE_CONCERN_CATALOG.flatMap((c) => [c.label, ...c.details.map((d) => d.label)]);
  const banned = /botox|filler|thread|neuromodulator|injectable|acne|melasma|rosacea|dermatitis|scar|hyperpigment|laxity|sagging|wrinkle|aging|diagnos/i;
  for (const label of labels) assert.doesNotMatch(label, banned, label);
});
