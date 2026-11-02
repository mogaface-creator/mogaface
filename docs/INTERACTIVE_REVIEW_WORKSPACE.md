# Interactive assessment and refinement workspace

The product now opens `/review?id=<submission>` after a successful consented assessment submission when the browser retains its private report capability. `/submitted` remains the fallback for sessions without browser storage and offers an explicit workspace link for older submissions.

## User journey

1. Upload the original front and oblique photos and optional expression video through the existing assessment and consent flow.
2. Open the private workspace and explicitly build a detailed review. This separate server-side request reads only original photos and permitted, bounded expression context. It returns sourced observations for the 169-item catalog, a summary and priorities. Missing items are explicitly unassessed. Generated concepts never become original evidence.
3. Review a previously quality-screened initial draft, or select the initial appearance targets and generate a natural concept from the original.
4. Accept or discard the draft. Accepting adds a new version without overwriting the original or earlier accepted versions. Only accepted concepts can be selected into the exported report through the UI.
5. For each subsequent round, choose the targets and enter a short direction. The source is the currently selected accepted version. The prompt and composite preserve unrelated approved changes. Hair, existing beard grooming, under-eye transition, inner-cheek texture, brow position, vermilion, lower-face outline, mentolabial transition and chin contour are separate choices. No procedure is prescribed.
6. Compare the new draft with that round's source, accept or discard, and repeat as desired within the session request limit.
7. Download a standalone HTML report containing the original photos, bounded video context, all 169 entries, selected accepted concept and accepted history. It can be printed to PDF in the browser. Access credentials and image receipts are never exported.

## Privacy and trust

- GET and POST require the existing private report session token and verify it against the submission's own analysis record. No anonymous listing or cross-client lookup is provided.
- POST also requires the matching Origin header and existing granted AI-photo consent. No provider call occurs without those checks or after the stored request quota is exhausted.
- Signed six-hour image receipts bind exact image bytes to one submission. A revision source cannot be replaced by arbitrary uploaded image bytes or another submission's concept.
- Requests are streamed with a four-megabyte application limit, and target names and note length are allowlisted/bounded. No free-form note can open an unselected mask.
- Original-photo identity is additionally supplied to automated image review to check cumulative drift; the latest accepted source remains the editable image. Automated review is fallible, not a clinical or identity guarantee.
- Signing uses REVIEW_REVISION_SECRET when configured, otherwise the existing server-only SUPABASE_SERVICE_ROLE_KEY. Production already requires the latter for private analysis storage. The route fails closed without a signing secret.
- Revision images and review text stay in React memory for the current visit, not localStorage/sessionStorage or a new database. Changing the selected submission remounts the session so one client's in-memory history cannot become another client's source. Users are told to export before refreshing/closing.
- The earlier queued/emailed protocol continues as a separate baseline artifact. An accepted interactive revision does not overwrite it or email a new report automatically. The updated workspace export is the revised artifact.

## Verification and limits

Tests exercise access, consent, quotas, receipts, tampered-source rejection, chained revision inputs, source preservation, bounded catalog parsing, revision boundaries and credential-free exports. Provider responses are mocked in those tests. A real-client live model test is not claimed. The unauthenticated workspace state was inspected in the local browser. No demonstration client's media is committed or published as a sample.

The new workspace is an explicit assessment-and-approval workflow, not an autonomous clinical planning or prescribing system. Its typed target list and brief cover the visual directions discussed; they do not infer diagnosis, procedural suitability, dose or measured treatment outcomes. Frontal chin concepts are appearance illustrations and cannot establish real forward projection.
