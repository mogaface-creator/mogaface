import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { parseAuthored } from "../../lib/submissions/reportAuthor.ts";
import { generateProtocolPdf } from "../../lib/submissions/protocolPdf.ts";
import { buildProtocolPages } from "../../lib/submissions/protocolContent.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { isStaleProcessing } from "../../lib/submissions/store.ts";

const t = (title: string) => ({ title, text: `${title} text` });
const model = {
  faceShape: "oval", apparentAge: 30, achievableAge: 27,
  scope: [{ area: "Skin", now: 70, achievable: 60 }, { area: "Eyes", now: 65, achievable: 80 }],
  holding: "Jaw and hairline.", outcomes: [t("A"), t("B"), t("C"), t("D"), t("E")],
  hair: { summary: "Wavy, medium density.", tags: ["Wavy"], cut: "Textured quiff", why: "Suits an oval face.", barber: "2 inches on top, tapered sides.", styling: "Cream on damp hair.", hairlineStage: "mature", hairline: "Temples are settled." },
  eyes: { features: [{ label: "Eye shape", value: "almond" }], assessment: "Mild under-eye shadow.", care: "Caffeine serum.", browShape: "straight", browPlan: "Soft arch.", glasses: "Rectangle." },
  jaw: { structure: "Broad.", softTissue: "Lean.", methods: [t("Hydration")] },
  facialHair: { now: "", plan: "" },
  skin: { condition: "Even tone.", type: "Combination", concerns: [{ title: "Pores", seen: "Visible on nose.", action: "2% salicylic acid, 3 nights a week." }] },
  clinic: [{ area: "Skin", option: "chemical peel", why: "Texture.", downtime: "2 to 3 days" }],
  exercise: "Lift 3 times a week.", nutrition: "Protein at each meal.",
  style: { fit: "Tailored.", palette: "Navy.", casual: "Polo.", smart: "Blazer." },
  toolkit: [{ category: "Sunscreen", budget: { name: "Re'equil SPF 50", priceInr: 695, note: "Daily" }, premium: { name: "ISDIN Fusion Water", priceInr: 1950, note: "Light" } }],
  strengths: [t("Jaw")], weaknesses: [t("Pores")], priorities: [t("Skin")], potential: "Solid gains.",
};

test("author output is parsed defensively: essentials required, scores clamped, junk dropped", () => {
  assert.equal(parseAuthored(null), null);
  assert.equal(parseAuthored({ ...model, outcomes: [] }), null);
  const r = parseAuthored({ ...model, scope: [...model.scope, { area: "Bad", now: "x", achievable: 1 }], apparentAge: 500 })!;
  assert.equal(r.scope.length, 2);
  assert.equal(r.scope[0].achievable, 70, "achievable can never be below now");
  assert.equal(r.apparentAge, 90);
});

test("authored protocol renders a clean MogaFace PDF; facial-hair page is dropped when empty", async () => {
  const author = parseAuthored(model)!;
  const photo = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#777777" } }).jpeg().toBuffer();
  const pages = buildProtocolPages({ name: "Asha", assessment: createEmptyAssessment(), author, realAge: 31 });
  assert.equal(pages.find(p => p.id === "facial-hair")?.title, "Eyebrows and glasses", "no facial-hair content means the page is brows and glasses only");
  assert.deepEqual(pages.find(p => p.id === "overview")!.ages, { now: "30", nowLabel: "LOOKS AROUND", achievable: "27" });
  const text = JSON.stringify(pages);
  assert.doesNotMatch(text, /NEXT FACE|Next Face|TEST LAB|Not supplied/);
  const bytes = await generateProtocolPdf({ clientName: "Asha", referenceId: "TEST", beforeImageBytes: photo, assessment: createEmptyAssessment(), author, realAge: 31, reportSummary: "", detectedAreas: [] });
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), pages.length);
});

test("a processing row with no write for 10 minutes is recoverable; a fresh one is not", () => {
  const now = Date.now();
  assert.equal(isStaleProcessing({ status: "processing", updated_at: new Date(now - 11 * 60_000).toISOString() }, now), true);
  assert.equal(isStaleProcessing({ status: "processing", updated_at: new Date(now - 60_000).toISOString() }, now), false);
  assert.equal(isStaleProcessing({ status: "pending", updated_at: new Date(now - 99 * 60_000).toISOString() }, now), false);
});
