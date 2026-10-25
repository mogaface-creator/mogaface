# Image quality corrections (25 October 2026)

The submission pipeline now builds a bounded plan from the intake's explicit places. Only selected areas with a usable photo observation appear in the report and illustration. Hair requires an explicit HAIR selection. There are no fabricated scores, no default findings when the scan fails, and no generic makeover fallback. The report uses catalogued consultation topics rather than prescription recommendations.

Before-image and after-image comparison uses a separate vision call to reject obvious identity drift, plastic skin, lighting changes, changes outside the selected areas, and excessive changes. This is fallible automated triage, not a verified identity lock or clinical validation. The local forehead test now uses a landmark-derived mask, a square source crop, and a lossless PNG composite into the original. Original fine texture is retained by applying a bounded low-frequency correction (at most 12 levels per colour channel) only within a feathered forehead ellipse. Pixel-level tests verify exact preservation outside that ellipse. This is an experimental forehead-only correction, not a calibrated treatment simulation. Other areas and the submission pipeline do not yet use this region path; cross-angle reference conditioning is not implemented. Side-photo/video measurements remain in the local analysis, but their pixels are not supplied to this image pipeline.

## Local test

Run `npm run dev`, open `/test-lab`, upload a clean original portrait, and leave Forehead lines only selected. The image is sent to OpenAI for observation, editing and review. No email is sent by this route. The result should retain pores, expression, exposure, hair, background and unselected features. Repeat with a second selected area only after the first comparison is acceptable. Test across several consented portraits before releasing the change. The route returns an explicit failure if assessment or quality review fails. A live whole-photo comparison was rejected for texture/lighting changes. The masked forehead comparison completed successfully and passed automated review using the uploaded portrait. Visual inspection showed preserved framing and identity with a very subtle forehead correction. This is a preservation experiment, not validation of a broader transformation or treatment outcome.

The API's image `quality` defaults to high in this path. The existing model is retained. `input_fidelity=high` is sent only for gpt-image-1.5; it is omitted for the existing alias, where support is not established. Official reference: https://developers.openai.com/api/reference/resources/images/methods/edit

## Deployment requirements

1. Apply `supabase/migrations/20261025000000_submission_photo_consent.sql` BEFORE deploying the new app. Existing submissions default to declined and cannot enable AI processing without new consent. This migration was not run against the live database.
2. The processor now declares 180 seconds and processes one submission per invocation, to budget for scan + edit + review + PDF + email. Verify the hosting plan supports that duration.
3. The checked-in Vercel cron is still daily. For timely delivery, configure an appropriate schedule supported by the hosting plan; the current schedule does not deliver within 30 minutes. No production schedule was changed by this patch.
4. Test simulation, PDF and email routes return 404 in production. `/api/test-simulate` also requires a matching browser origin in development.
5. The submission flow requires an explicit granted/declined choice, persists it, and requires a valid analysis session before AI processing can be requested. Declined consent avoids AI photo processing and produces a clinic-review-only report. Failed submissions retain browser media for retry.
6. Generated images from the previous pipeline are not reused. Email retries regenerate and review an image, so retries can incur additional image charges. A versioned approved-preview cache is future work.

No production deployment, migration or outbound email was performed. Live local image testing has been performed using the uploaded portrait.
