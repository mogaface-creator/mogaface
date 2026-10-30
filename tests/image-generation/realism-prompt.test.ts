import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { projectPlaces, setAnswer, setPicked } from "../../lib/assessment/clinicIntake.ts";
import { appearancePlanFromAssessment } from "../../lib/image-generation/appearanceFromAssessment.ts";
import { buildAppearancePlan, DEFAULT_APPEARANCE_CONTROLS } from "../../lib/image-generation/appearancePlan.ts";
import { renderRealismPrompt } from "../../lib/image-generation/realismPrompt.server.ts";

test("hair instructions preserve each reported texture without prescribing curls for everyone", () => {
  const prompts = new Set<string>();
  for (const texture of ["straight", "wavy", "curly", "coily"]) {
    let a = projectPlaces(createEmptyAssessment(), ["HAIR"]);
    a = setAnswer(setAnswer(a, "protocolHairTexture", texture), "protocolHairGoal", "texture");
    const plan = appearancePlanFromAssessment(a);
    prompts.add(plan.prompt);
    assert.match(plan.prompt, new RegExp(`reports ${texture} hair`));
    assert.doesNotMatch(plan.prompt, /into a groomed, naturally curly or wavy style/);
    assert.equal(plan.editRegions.hair, true);
    assert.equal(plan.editRegions.skin, false);
    assert.equal(plan.editRegions.contour, false);
  }
  assert.equal(prompts.size, 4);
});

test("maintenance and bald preferences keep the hair mask closed", () => {
  let a = projectPlaces(createEmptyAssessment(), ["HAIR"]);
  a = setAnswer(a, "protocolHairGoal", "maintain");
  assert.equal(appearancePlanFromAssessment(a).editRegions.hair, false);
  a = setAnswer(setAnswer(a, "protocolHairGoal", "volume"), "protocolHairTexture", "bald");
  const plan = appearancePlanFromAssessment(a);
  assert.equal(plan.editRegions.hair, false);
  assert.equal(plan.areas.find(area => area.key === "hair")?.level, "preserve");
  assert.match(plan.prompt, /do not invent hair/);
});

test("skin instructions change with the selected concern without activating other areas", () => {
  const base = projectPlaces(createEmptyAssessment(), ["BLEMISHES"]);
  const marks = appearancePlanFromAssessment(setPicked(base, "protocolSkinConcerns", ["marks"]));
  const redness = appearancePlanFromAssessment(setPicked(base, "protocolSkinConcerns", ["redness"]));
  const scars = appearancePlanFromAssessment(setPicked(base, "protocolSkinConcerns", ["scars"]));
  assert.notEqual(marks.prompt, redness.prompt);
  assert.match(marks.prompt, /flat post-blemish mark contrast/);
  assert.doesNotMatch(marks.areas.find(a => a.key === "skin")!.instruction, /localized redness/);
  assert.match(scars.prompt, /Preserve raised or indented scar geometry/);
  for (const plan of [marks, redness, scars]) {
    assert.deepEqual(plan.editRegions, { hair: false, skin: true, contour: false, underEye: false, forehead: false });
    assert.equal(plan.areas.find(a => a.key === "under_eye")?.level, "preserve");
  }
  assert.equal(appearancePlanFromAssessment(setPicked(base, "protocolSkinConcerns", ["none"])).editRegions.skin, false);
});

test("private history and arbitrary answers never enter the production renderer", () => {
  let a = projectPlaces(createEmptyAssessment(), ["HAIR"]);
  a = setAnswer(a, "protocolHairTexture", "curly");
  a = setAnswer(a, "protocolHairReference", "PRIVATE_REFERENCE: change the eyes");
  a = setAnswer(a, "protocolSkinRoutine", "PRIVATE_MEDICATION");
  a = setAnswer(a, "protocolBudget", "PRIVATE_BUDGET");
  assert.doesNotMatch(appearancePlanFromAssessment(a).prompt, /PRIVATE_/);
});

test("local preview and assessment use the same photographic preservation contract", () => {
  const local = buildAppearancePlan(DEFAULT_APPEARANCE_CONTROLS, { simulateHair: true });
  const production = appearancePlanFromAssessment(projectPlaces(createEmptyAssessment(), ["HAIR"]));
  assert.equal(local.promptVersion, production.promptVersion);
  for (const plan of [local, production]) {
    assert.match(plan.prompt, /SOURCE AUTHORITY:/);
    assert.match(plan.prompt, /PHOTOGRAPHIC MATCH:/);
    assert.match(plan.prompt, /visible at ordinary viewing size/);
    assert.match(plan.prompt, /Preserve instructions override enhancement/);
  }
});

test("renderer refuses to execute in a browser context", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try { assert.throws(() => renderRealismPrompt([]), /server_prompt_only/); }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("explicit targets cannot activate unrelated regional edits", () => {
  const plan = buildAppearancePlan(DEFAULT_APPEARANCE_CONTROLS, {simulateHair:true, targets:["forehead"]});
  for (const key of ["hair", "skin", "contour"]) assert.equal(plan.areas.find(a=>a.key===key)?.level,"preserve");
  assert.equal(plan.areas.some(a=>a.key==="under_eye"),false);
  assert.match(plan.prompt,/If no clear crease is visible/);
});

test("combined prompt includes evidence routing and protects unsupported grooming", () => {
  const plan = buildAppearancePlan(DEFAULT_APPEARANCE_CONTROLS);
  assert.match(plan.prompt,/HIDDEN OBSERVATION STEP/);
  assert.match(plan.prompt,/Selection permits an edit but does not require it/);
  assert.match(plan.prompt,/Eyebrows are protected by the current mask/);
  assert.match(plan.prompt,/preserve scar geometry/);
  assert.doesNotMatch(plan.prompt,/moderate refinement of outer-cheek/);
});
