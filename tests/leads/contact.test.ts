import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLeadContact } from "../../lib/leads/contact.ts";
import { createAnalysisRecord, getAnalysisRecord, __clearAnalysisRecordsForTests } from "../../lib/analysis-session/store.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { illustrationPromptFor } from "../../lib/image-generation/provider.ts";

const CONTACT = { name: "Asha Rao", phone: "+91 98450 11223", email: "Asha@Example.com", location: "Bengaluru" };

test("a complete contact is kept, and a missing field is refused", () => {
  const lead = parseLeadContact(CONTACT);
  assert.deepEqual(lead, { name: "Asha Rao", phone: "+919845011223", email: "asha@example.com", location: "Bengaluru" });
  assert.equal(parseLeadContact({ ...CONTACT, email: "not-an-email" }), null);
  assert.equal(parseLeadContact({ ...CONTACT, phone: "123" }), null);
  assert.equal(parseLeadContact({ ...CONTACT, name: " " }), null);
});

test("contact is stored on the session and stays out of the assessment and the image instruction", async () => {
  __clearAnalysisRecordsForTests();
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["SKIN_TONE"], details: ["DULL_LOOKING_SKIN"], priorities: ["SKIN_TONE"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  const handle = await createAnalysisRecord({ assessment, analysis, photoQualityValid: true, contact: CONTACT });
  assert.ok(handle);
  const record = await getAnalysisRecord(handle!.analysisId, handle!.sessionToken);
  assert.equal(record?.contact?.email, "asha@example.com");
  assert.equal(JSON.stringify(record?.assessment).includes("asha@example.com"), false);
  assert.equal(illustrationPromptFor(record!.predictionPlan).includes("asha@example.com"), false);
  assert.equal(illustrationPromptFor(record!.predictionPlan).includes("98450"), false);
});
