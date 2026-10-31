import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { parseFace, parseBody } from "../../lib/submissions/reportAuthor.ts";
import { generateProtocolPdf } from "../../lib/submissions/protocolPdf.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { isStaleProcessing } from "../../lib/submissions/store.ts";

const t = (title: string) => ({ title, text: `${title} text for this person.` });
const face = {
  faceShape: "round", apparentAge: 30, achievableAge: 27,
  scope: [{ area: "Skin", now: 70, achievable: 60 }, { area: "Eyes", now: 65, achievable: 80 }],
  holding: "Jaw and hairline.", outcomes: [t("A"), t("B"), t("C"), t("D"), t("E")], whereYouAre: "A clear overall read.",
  hair: { scalp: "Curly, medium density.", tags: ["Curly"], care: [t("Cleansing"), t("Conditioner"), t("Drying"), t("Scalp")], cut: "Textured crop", cutLength: "short", why: "Suits a round face.", barber: "2 inches on top, tapered sides.", styling: "Cream on damp hair.", summary: "Summary.", hairlineStage: "receded temples", hairlineText: "Temples have moved back.", protect: [t("Handling"), t("Diet"), t("Stress")] },
  eyes: { features: [{ label: "Eye shape", value: "almond" }], assessment: "Mild under-eye shadow.", care: [t("Serum"), t("Sleep")], summary: "Summary.", browNow: "straight", browTarget: "soft arch", browWhat: "Soften the tail.", browSteps: [t("Tidy"), t("Trim")], glassesWhy: "Structure helps.", frames: [{ style: "rectangle", text: "Rectangular." }, { style: "wayfarer", text: "Wayfarer." }, { style: "browline", text: "Browline." }] },
  jaw: { structure: "Soft and rounded.", fatFluid: "Some fullness.", methods: [t("Hydration"), t("Body fat"), t("Posture"), t("Sleep")], summary: "Summary." },
  facialHair: null,
  skin: { condition: "Even tone.", bullets: ["Pores on the nose"], type: "Combination - Type IV", concerns: [{ title: "Pores", seen: "Visible on nose.", action: "2% salicylic acid, 3 nights a week." }], summary: "Summary." },
  clinic: [{ area: "Skin", option: "chemical peel", why: "Texture.", downtime: "2 to 3 days" }],
  strengths: [t("Jaw")], weaknesses: [t("Pores")], priorities: [t("Skin")], potential: "Solid gains.",
};
const body = {
  exercise: { intro: "Training changes your frame.", weights: "Lift 3 times a week.", cardio: "Walk daily.", bullets: ["30 minutes"], expert: "Progressive overload.", summary: "Summary." },
  training: [{ title: "Upper back", text: "Rows 3x12.", image: "upper_back" }, { title: "Shoulders", text: "Press 3x10.", image: "shoulders" }, { title: "Neck", text: "Chin tucks.", image: "neck" }],
  facialExercises: [{ title: "Tongue posture", text: "Rest the tongue up.", image: "tongue" }],
  nutrition: { approach: "Protein at each meal.", goals: [t("Protein"), t("Water")], summary: "Summary." },
  supplements: [{ name: "Omega-3", dose: "500-1000 mg", when: "With a meal", why: "Skin barrier." }],
  style: { fit: "Tailored.", bodyType: "Average", palette: "Navy.", casual: t("Polo"), professional: t("Blazer"), summary: "Summary." },
  toolkit: [{ category: "Sunscreen", budget: { name: "Re'equil SPF 50", priceInr: 695, note: "Daily" }, premium: { name: "ISDIN Fusion Water", priceInr: 1950, note: "Light" } }],
};

test("author output is parsed defensively: essentials required, scores clamped, enums coerced", () => {
  assert.equal(parseFace(null), null);
  assert.equal(parseFace({ ...face, outcomes: [] }), null);
  assert.equal(parseBody({ ...body, nutrition: { approach: "", goals: [] } }), null);
  const r = parseFace({ ...face, scope: [...face.scope, { area: "Bad", now: "x", achievable: 1 }], apparentAge: 500, faceShape: "triangle", hair: { ...face.hair, hairlineStage: "bald" } })!;
  assert.equal(r.scope.length, 2);
  assert.equal(r.scope[0].achievable, 70, "achievable can never be below now");
  assert.equal(r.apparentAge, 90);
  assert.equal(r.faceShape, "oval", "unknown enum falls back instead of failing the report");
  assert.equal(r.hair.hairlineStage, "mature");
  assert.equal(parseFace(face)!.facialHair, null);
});

test("authored report renders the iMorph-structure PDF: facial-hair page dropped, body pages included", async () => {
  const author = { face: parseFace(face)!, body: parseBody(body) };
  const photo = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#777777" } }).jpeg().toBuffer();
  const bytes = await generateProtocolPdf({ clientName: "Asha", referenceId: "TEST", beforeImageBytes: photo, afterImageBytes: photo, previewStatus: "quality_checked", assessment: createEmptyAssessment(), author, reportSummary: "", detectedAreas: [] });
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  // cover, disclaimer, index, protocol, hair x3, eye x3, jaw x2, skin x2, clinic, exercises x3, nutrition, supplements, style, toolkit, summary, focus, closing
  assert.equal(pages, 25, "no facial-hair page and no expression-video page for this person");
  const noBody = await generateProtocolPdf({ clientName: "Asha", referenceId: "TEST", beforeImageBytes: photo, assessment: createEmptyAssessment(), author: { face: author.face, body: null }, reportSummary: "", detectedAreas: [] });
  assert.ok((await PDFDocument.load(noBody)).getPageCount() < pages, "a failed body part only omits its own pages");
});

test("a processing row with no write for 10 minutes is recoverable; a fresh one is not", () => {
  const now = Date.now();
  assert.equal(isStaleProcessing({ status: "processing", updated_at: new Date(now - 11 * 60_000).toISOString() }, now), true);
  assert.equal(isStaleProcessing({ status: "processing", updated_at: new Date(now - 60_000).toISOString() }, now), false);
  assert.equal(isStaleProcessing({ status: "pending", updated_at: new Date(now - 99 * 60_000).toISOString() }, now), false);
});
