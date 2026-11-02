# Interactive assessment and refinement workspace

The product now opens `/review?id=<submission>` after a successful consented assessment submission when the browser retains its private report capability. `/submitted` remains the fallback for sessions without browser storage and offers an explicit workspace link for older submissions.

## User journey

1. Upload the original front and oblique photos and optional expression video through the existing assessment and consent flow.
2. Open the private workspace and explicitly build a detailed review. This separate server-side request reads only original photos and permitted, bounded expression context. It returns sourced observations for the 169-item catalog, a summary and priorities. Missing items are explicitly unassessed. Generated concepts never become original evidence.
3. Review a previously quality-screened initial draft, or select the initial appearance targets and generate a natural concept from the original.
4. Accept or discard the draft. Accepting adds a new version without overwriting the original or earlier accepted versions. Only accepted concepts can be selected into the exported report through the UI.
5. For each subsequent round, choose the targets and enter a short direction. The source is the currently selected accepted version. The prompt and composite preserve unrelated approved changes. Hair, existing beard grooming, under-eye transition, inner-cheek texture, brow position, vermilion, lower-face outline, mentolabial transition and chin contour are separate choices. No procedure is prescribed.
6. Compare the new draft with that round's source, accept or discard, and repeat as desired within the session request limit.
7. Create a saved HTML report link containing original photos, bounded video context, all 169 entries, selected accepted concept and accepted history. Its editorial layout follows appearance-review-02.html with navigation, searchable category tables and refinement notes. Access credentials and image receipts are excluded. No PDF is generated or emailed.

## Privacy and trust

- GET and POST require the existing private report session token and verify it against the submission's own analysis record. No anonymous listing or cross-client lookup is provided.
- POST also requires the matching Origin header and existing granted AI-photo consent. No provider call occurs without those checks or after the stored request quota is exhausted.
- Signed six-hour image receipts bind exact image bytes to one submission. A revision source cannot be replaced by arbitrary uploaded image bytes or another submission's concept.
- Requests are streamed with a four-megabyte application limit, and target names and note length are allowlisted/bounded. No free-form note can open an unselected mask.
- Original-photo identity is additionally supplied to automated image review to check cumulative drift; the latest accepted source remains the editable image. Automated review is fallible, not a clinical or identity guarantee.
- Signing uses REVIEW_REVISION_SECRET when configured, otherwise the existing server-only SUPABASE_SERVICE_ROLE_KEY. Production already requires the latter for private analysis storage. The route fails closed without a signing secret.
- Revision images and review text stay in React memory for the current visit, not localStorage/sessionStorage or a new database. Changing the selected submission remounts the session so one client's in-memory history cannot become another client's source. Users are told to create a report link before refreshing/closing. Saved HTML persists independently in a private Supabase Storage bucket.
- The background job prepares only the optional preview; PDF rendering and email attachment delivery are removed from the active flow. The old PDF endpoint returns HTTP 410.
- Saved reports use 256-bit random capability links at `/reports/<key>.html`. Anyone with that link can view the snapshot; creation requires the authenticated original workspace session and signed image receipts. Links contain neither session tokens nor client identifiers. The storage bucket is private; HTML is served with no-store, noindex, no-referrer and a sandbox CSP. Existing public buckets are rejected. Each save creates a new snapshot; it does not update older links.
- Maximum save payload is 4 MB with up to eight accepted versions. Large histories can exceed this limit. There is no in-app link revocation control yet.

## Verification and limits

Tests exercise access, consent, quotas, receipts, tampered-source rejection, chained revision inputs, source preservation, bounded catalog parsing, revision boundaries and credential-free exports. Provider responses are mocked in those tests. A real-client live model test is not claimed. Durable storage has mocked integration tests; a local live-storage probe could not run because local Supabase credentials are absent. Production requires its existing Supabase service-role configuration with Storage bucket/object access. The unauthenticated workspace state was inspected in the local browser. No demonstration client's media is committed or published as a sample.

The new workspace is an explicit assessment-and-approval workflow, not an autonomous clinical planning or prescribing system. Its typed target list and brief cover the visual directions discussed; they do not infer diagnosis, procedural suitability, dose or measured treatment outcomes. Frontal chin concepts are appearance illustrations and cannot establish real forward projection.
