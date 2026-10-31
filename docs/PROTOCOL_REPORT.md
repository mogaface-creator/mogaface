# Next Face full protocol

## What is implemented

The report now uses a fixed 25-page structure with Next Face branding. Every reader receives hair, eye area, jaw, facial hair, skin, exercise, nutrition, style, toolkit and summary chapters. Answers personalise the text within these chapters; missing answers remain explicitly unknown. Clinic options are labelled for clinician review.

`lib/submissions/pdfReport.ts` delegates to `protocolPdf.ts`. The previous compact renderer is retained as `generateLegacyPdfReport`. The submission worker supplies the stored assessment. No deployment or email was triggered during implementation.

## Where to edit the questions

Edit `lib/assessment/intakeQuestions.ts`: prompts, hints, choices and stable IDs. Edit `lib/assessment/intakeFlow.ts` to place questions on screens. Generic `reply` and `picked` storage preserve and validate those answers through `clinicIntake.ts`; no database migration is needed for these fields inside the existing assessment JSON.

The five additional screens group questions about hair, skin, grooming, lifestyle, and style/budget/preservation. They use the existing form components. Existing intake and consent questions remain present.

## How an answer changes the report

| Question IDs | Output |
| --- | --- |
| `protocolHairTexture`, `protocolHairGoal` | Hair assessment wording, haircut direction, styling guidance, density discussion |
| `protocolHairRoutine`, `protocolHairReference`, `protocolStylingTime` | Current routine, barber brief and maintenance instructions |
| `protocolSkinType`, `protocolSensitivity`, `protocolSkinRoutine`, `protocolSkinConcerns` | Skin summary, concern distinctions, baseline routine and sensitivity branch |
| `protocolBeardGoal`, `protocolGlasses` | Facial-hair direction and whether eyewear suggestions are wanted |
| `protocolDiet` | Diet-compatible food examples; no invented calorie target |
| `protocolActivity`, `protocolEquipment` | Starting context and home/gym/no-plan branches |
| `protocolStyle` | Casual, smart, professional or maintenance outfit direction |
| `protocolBudget` | Recurring product/grooming purchase priorities |
| `protocolClinicBudget`, `maxWilling`, `downtime`, `priorTreatments` | Separate clinic discussion boundaries; not suitability decisions |
| `protocolPreserve` | Preservation preferences recorded in the report |
| Existing `places` | User-selected visual areas; full report coverage never selects an edit automatically |

`lib/submissions/protocolContent.ts` owns the section order, content and `PROTOCOL_QUESTION_MAP`. Change the question options and content branches together. Do not recycle an existing stable value for a new meaning.

## What reaches the image editor

`lib/image-generation/appearanceFromAssessment.ts` converts only selected areas and allowlisted cosmetic enums into visual instructions. Hair maintenance or bald/shaved selections preserve hair. Skin maintenance preserves skin. Unselected eyes, forehead and contour remain unchanged. Raw history, medication, budget, free-text reference URLs and unrestricted instructions are not copied into the image prompt.

A free-text haircut reference is recorded for review; it is not fetched automatically or used as an image reference. A later approved reference-image upload will need explicit integration. This implementation does not claim that these changes solve the existing image realism problem.

## Assessment delivery and image inclusion

The public entry point is `/assessment`. The homepage simulation portal, Testing Lab and standalone test PDF/email/image routes have been removed. No public button calls a development-only image endpoint.

The assessment stores validated portrait geometry, three photo views, questionnaire answers and separate photo-processing consent. If an after photo is requested with consent, the browser requires usable front-photo geometry before submitting. The background worker generates and quality-reviews the illustration, saves an accepted image before PDF/email processing, then includes the same image pair in the PDF. Retries reuse a stored current preview. Downloads require the assessment session token.

Generation or quality-review failures can still produce a written report without an after image. The report and submission status explain the reason; inclusion is not guaranteed. Clinic review remains pending.

## How expression video is used

The browser samples up to 24 frames and compares neutral and expression frames for brow raise, frown, smile and squint. Saved observations now populate page 19, **Your expression video**, including usable/missing expression coverage, evidence completeness, supported changes in line contrast and recording/review guidance. Inconclusive video is kept distinct from an absent video; neither becomes an invented finding. The eye-area chapter also uses the same validated coverage. The report stays 25 pages.

Moderate/high-completeness movement comparisons can add preservation constraints to a selected forehead or under-eye edit. For example, brow movement constrains brow position and natural folds; smile/squint movement constrains eyelid folds and smile creases. Video does not unlock unselected regions, prescribe a treatment or predict movement after treatment. Raw notes, percentages, video frames and the video file are not sent to the image service.

The assessment's consent wording now includes a short video-expression summary. Its permission is saved as `videoPreviewContextConsent` in the existing private analysis-record JSON. The image worker uses video-derived context only when that field is `granted` and photo processing is also permitted. Missing permission on older records is treated as not granted; their video observations can still appear in the written report. No database column migration is needed. This is per-assessment analysis, not model training.

## Review limits

The PDF text is a deterministic educational and preference-based draft. It does not automatically diagnose images, verify product prices or assign medical treatment. No clinician sign-off system is implemented; clinical review remains pending. Real treatment selection and a current product shortlist require separate review. General sources are linked on the final page.

## Validation

TypeScript and the production Webpack build passed. All 81 assessment tests pass, including repeated PDF image inclusion and the mocked-provider report journey. The full suite recorded 914 passing / 16 failing tests; existing image-generation and results-flow expectations still need reconciliation before release. See ASSESSMENT_AUDIT.md for the remaining findings and live-verification limits.

## Authored content (person-specific report)

`lib/submissions/reportAuthor.ts` makes one OpenAI vision call (front and both 45-degree photos plus the questionnaire facts) and returns structured content: face shape, scope scores and ages, the named haircut with barber brief, eye/brow/jaw/skin observations, skin actions, clinic options to discuss, toolkit with indicative INR prices. `protocolAuthored.ts` turns it into pages (23-24 pages; pages with no content, such as facial hair for someone with none, are dropped). It runs in parallel with the preview and only when photo consent is granted. If it fails, the fixed 25-page template above is used. Model: `REPORT_AUTHOR_MODEL` (default `gpt-4.1`).

Stuck jobs: a submission left in `processing` for more than 10 minutes is counted as a failed attempt and re-run by the next status poll or cron run (max 3 attempts).
