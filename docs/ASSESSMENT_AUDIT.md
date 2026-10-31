# Assessment-only audit — 31 October 2026

Verdict: the assessment path and PDF integration pass the checks below, but the whole repository is not release-ready. Changes are local; no deployment, live photo generation or outbound email was performed.

## Removed

- Homepage instant simulation portal and its presets.
- Testing Lab page and navigation links.
- Standalone simulation, sample PDF, test email, test protocol and Gemini preview endpoints and their dedicated implementation.
- All runtime links to those endpoints. Start-plan actions now open `/assessment`.

Automated assessment and security tests remain in the repository.

## Flow verification

1. **Homepage → assessment: passed.** Browser verification confirmed the homepage has no Testing Lab/instant upload portal and Start my plan opens the assessment welcome screen.
2. **Questions, photos and consent: passed automated checks.** All current questions are reachable. Fixed a new-assessment media cleanup race and blocked submission with a requested/consented preview when front-photo geometry is unavailable. The user can replace the photo or choose a report without a preview.
3. **Generation and persistence: passed mocked-provider integration.** Three photo views and saved expression observations reach report generation. Accepted preview bytes are saved before PDF/email processing so a later failure can reuse them. A failed or unavailable image review still excludes the image.
4. **PDF and download: passed.** Repeated renders embed both images on cover, overview and regional comparison pages when quality-screened bytes are supplied. Missing images are never replaced with a duplicate original. Protected downloads reject missing/incorrect session tokens.
5. **Email: not live-verified.** Local `.env.local` lacks database and email configuration. This says nothing about Vercel's production environment. Local development can simulate email success; that does not establish delivery to an inbox.

## Validation

- Assessment suite: **81 passed, 0 failed**.
- Full suite: **914 passed, 16 failed** out of 930, after removal of the dedicated Gemini benchmark tests.
- ESLint: **0 errors**, one existing unused-variable warning in `scripts/generate_blueprint_pdf.ts`.
- Production build: **passed** with `npm run build -- --webpack`, including type checking and route generation. Default Turbopack build was blocked by this execution environment's local-worker port restriction. Webpack is Next.js's supported alternative; no bundler configuration was changed.
- Runtime search: no remaining Testing Lab, old portal-anchor or removed test-endpoint references in `app`, `components`, `lib` or `.env.example`.

## Remaining findings

### Release blocker: remaining test failures

The failures are in `tests/image-generation/portrait-edit.test.ts`, `tests/image-generation/submission-quality.test.ts`, `tests/interpretation/ai-production.test.ts`, `tests/results/frontPhotoStore.test.ts` and `tests/results/product-flow.test.ts`.

Several assert the former `/results` handoff, old consent-screen structure, old mask/aspect behavior or an outdated server-module allowlist. Others expose unsafe behavior in legacy `clinicalVision.ts` helpers: generic fallback targets, fabricated scores and permissive observation parsing. Those scan/combined-preview helpers have no remaining production callers after removal of the simulation endpoint. They still need cleanup or reconciliation; the assessment path uses its questionnaire-derived appearance plan instead. The audit does not treat these failures as harmless or disable them.

### Product-copy accuracy

Corrected active descriptions of the deliverable from a two-page dossier to the 25-page protocol, and made preview inclusion conditional. Other existing homepage claims remain unsubstantiated by this audit: verified case studies, numerical improvements, 100% identity preservation, sub-millimeter accuracy, ancestry calibration and human clinical oversight. These need evidence or revised wording before release. No clinical sign-off workflow was verified.

### Deployment and operational limits

- Verify production database schema, storage credentials, image-provider access and Resend sender settings independently. Local checks cannot establish these.
- `after()` starts processing after submission; status polling also triggers pending jobs. The fallback cron runs daily and handles one job per invocation, so delayed retries/backlogs are still possible.
- A function terminated while `processing` has no stale-job recovery in `claimSubmission`; the current claim accepts only pending/failed rows. A durable queue or reviewed recovery policy is needed for automatic timeout recovery.
- Image generation/review can fail. The PDF and status explain why an after photo was omitted; successful inclusion is not guaranteed.
- A live consented portrait run and inbox delivery remain unverified. No claim about image realism or production delivery is made from mocked-provider tests.
