# Connected report delivery

The live intake remains ten questions. Its saved assessment is joined to all three required photo views and any usable browser-computed expression observations.

## Data path

1. AssessmentReview analyses photo views and optional video locally and creates a server analysis session.
2. The client compresses front/left-45/right-45 photos into bounded JPEG uploads. Raw video stays on-device; its descriptive observations are already included in the saved analysis.
3. submitHandler validates the session and all three uploads, stores side photos in the private analysis record JSON, and creates a submission. Failed submission preserves the browser's files for retry.
4. Next.js after() starts processOne after the submission response; status polling and cron remain fallback triggers. claimSubmission uses a conditional update to prevent duplicate paid generation/email work.
5. If the reader requested a preview and consented to external processing, OpenAI edits the original front photo using only allowlisted appearance preferences. Unselected features are preserved. A failed or unavailable quality review blocks delivery of the draft.
6. protocolInput joins the answers, still views, video observations and quality-screened draft into the full 25-page PDF. Draft comparisons are labelled illustrative and not clinically approved.
7. Resend delivers the PDF when configured. The same report can be downloaded with the submitter's analysis-session token. Email-only failure does not prevent downloading an already completed report.

## Boundaries

No new database columns are required: side photos use the existing record JSON field. Raw video is not uploaded. The video observations are client-computed descriptive data, not server-independent clinical findings. Lifestyle items not asked in the short intake remain general guidance, not invented personal facts. Treatment sections require clinician review.

The protected download uses a Bearer token from sessionStorage and never places that token in a URL. Download access follows the existing analysis-session expiry. The emailed attachment remains independent of browser session access.

Automated quality review does not prove identity preservation or guarantee a treatment outcome. User/clinician approval is not inferred from that review.

## Verification

136 assessment and session tests pass, including a complete mocked-provider journey with real PDF rendering, three views, saved video evidence, duplicate-job protection and download authorisation. The isolated production build passes. The full suite has the same 15 failures as the deployed baseline; no new failing test titles were introduced. No live AI request or test email was sent during these integration checks.
