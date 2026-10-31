# Current test results — 31 October 2026

Verdict: the current assessment/video/report integration passes its focused checks, but the entire project is not fully passing or live-verified. No application code was changed during this test run.

## Automated checks

| Check | Result |
| --- | --- |
| Full `npm test` | 919 passed, 16 failed; 935 total |
| Assessment, analysis-session and observation suites | 170 passed, 0 failed |
| `npm run lint` | 0 errors; one existing unused-variable warning in `scripts/generate_blueprint_pdf.ts:714` |
| `npm run build -- --webpack` | Passed, including TypeScript and route generation |

The focused tests exercise questionnaire persistence, source-photo validation, three-photo report assembly, stored expression evidence, consent-dependent preview instructions, missing/weak/malformed video evidence, unchanged unselected regions, image-review rejection, actual 25-page PDF rendering and authorised downloads. Provider responses are mocked. These tests do not demonstrate real-world image quality or live video-decoding performance on a user's recording.

The full-suite failure titles match the previously documented 16 failures. They involve legacy image/vision helpers and assertions for an older results-screen handoff, plus an outdated server-module allowlist. They remain visible and were not skipped or weakened during this run. See ASSESSMENT_AUDIT.md for the details.

## Production-mode HTTP smoke test

Started the built application on `127.0.0.1:3001` and verified:

- `/` and `/assessment`: HTTP 200.
- Homepage contains `/assessment` links and no links to the removed Testing Lab/portal/test endpoints.
- `/test-lab`, `/api/test-simulate`, `/api/test-pdf`, `/api/test-email`, `/api/gemini-preview`, `/api/test-protocol`: HTTP 404.
- `/api/submission-report` without credentials: HTTP 401.
- `/api/check-submission-status` without an ID: HTTP 400.
- An empty submission: HTTP 400 with `three_photos_required`; no job was created.

## Browser test

Used an isolated browser origin and synthetic questionnaire answers, without uploading a personal image or video:

1. Assessment welcome screen loaded correctly in the production build.
2. All 14 question screens were reachable. Multi-select goals, auto-advance choices, optional measurement skipping and final progression worked.
3. Photo instructions and upload mode loaded without requesting camera permission.
4. Continuing to review without photos displayed the three missing-photo requirements. The final analysis action remained disabled with photos, contact details and consent missing.
5. Selected answers appeared correctly in the review. The updated consent disclosed sharing a bounded video-expression summary with OpenAI and keeping video files/frames on-device.

## What is not established

- No live AI image generation or email was sent. No inbox-delivery or photographic-realism claim is made.
- Local database credentials, Resend key and sender settings are absent. Production Vercel configuration was not inspected; local absence is not evidence that production is unconfigured.
- Real camera capture, uploaded-video decoding, a live stored submission and a received email attachment were not exercised in this browser run.
- New video integration changes remain local and were not pushed or deployed during testing.

The project still needs the 16 outstanding failures reconciled and a consented, configured live assessment-to-inbox run before it can be described as fully verified.

## Phone follow-up

Tested the rebuilt assessment in Chrome at 320, 375 and 430 CSS pixels. The questionnaire, photo-upload mode and review were navigable. Review content width matched viewport width at all three sizes; there was no horizontal page overflow. Contact fields measured 16px and consent-label touch targets measured at least 48px high. The header action measured 44px high and stayed on one line at 375px.

Fixed the wrapped phone header action, small contact input text, narrow consent targets and unbounded native video input. Long selected video filenames wrap. Photo-upload preparation now uses an HTML image decoder when ImageBitmap is unavailable or rejects a browser-readable image; it retains the 1200px/1.1MB limits and releases decoded resources on failure. Four new tests cover those fallback/error cases. Assessment plus camera suites: **143 passed, 0 failed**. The production Webpack build passed after these fixes.

This was desktop Chrome with a viewport override, not physical iOS Safari or Android Chrome. Native camera permissions, recording, real phone media formats, onscreen keyboards, rotation and slow-network submission still need a real-device run on HTTPS. These phone changes are local and not yet deployed.
