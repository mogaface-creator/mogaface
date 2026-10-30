# Local hidden prompt update — portrait-realism-v2

No deployment or UI change.

The server renderer now instructs the image model to inspect visibility, distinguish shadows/marks/scars, and preserve uncertain or absent concerns before editing. These instructions are not a separate validated vision-analysis API call.

Local test requests consistently use the shared renderer; explicit targets restrict selected masks, and older callers without controls preserve contour by default. Skin, forehead, under-eye and jaw instructions are conservative. Eyebrows and facial hair remain protected: independent grooming requires suitable regional masks and explicit selection, which this update does not add.

Validation: 10 focused prompt tests pass; TypeScript --noEmit passes. The broader image-generation suite fails in several other areas and is not a clean release gate. No model quality improvement has been demonstrated by these code checks.

Next: open http://127.0.0.1:3000/test-lab. Configure OPENAI_API_KEY and IMAGE_GENERATION_PROVIDER=openai in a local .env.local if missing, then restart the server. Never commit credentials. Upload the same portrait, start with Skin only and subtle intensity, then test under-eye and forehead independently before Combined. Compare identity, complexion, texture, mask boundaries and untouched pixels across repeated results. No generation request has been made as part of this update.

## Comparison reporting update
The post-composite vision review now returns validated observations for hair, skin, jaw, under-eye and forehead in the same API request. Reports describe visible differences, no clear change, or uncertainty; no invented improvement scores. Approved comparisons are included in the preview response and appended to the PDF. Production submissions save the comparison in report_summary, allowing downloads and email retries to retain it. Existing questionnaire guidance remains separate from this comparison.

The Test Lab remains development-only; deployment updates the production assessment flow without publishing the development test endpoint. Vercel needs its own server environment credentials and provider configuration; local Windows settings are not deployed. No .env files or credentials are committed.
