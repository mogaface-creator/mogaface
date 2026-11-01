# Natural refinement workflow

This change turns the appearance directions reviewed on 1 November 2026 into reusable application behavior. It contains no client photos, videos, generated portraits, personal reports, or case-specific diagnoses.

## Select the actual appearance change

The intake now exposes an optional detail screen after selecting areas. Brow framing and lip fullness are selectable areas. The following details independently enable subtle, named local image edits:

- Brow opening: a small brow-position change, preserving eye geometry and brow density.
- Lip fullness: slightly more visible vermilion body with a clear natural border. Preserve mouth width, corners, cutaneous lip, philtrum, fine lines and expression. “Open the pink part” does not mean opening the mouth.
- Lower-face slimming: a modest taper at the lower lateral contour, preserving cheek volume and neck dimensions. A contour difference does not diagnose a masseter condition, and uncertain mirroring does not authorize unilateral correction.
- Mentolabial transition: soften the visible lower-lip–chin groove and shadow while retaining a natural transition. Do not inflate a shelf or flatten all detail.
- Chin projection: a modest appearance direction only where the source profile supports it. Frontal photographs cannot establish projection; preserve when unsupported.

Lower-face, chin and mentolabial preferences sit under Facial contour, so they can be combined with Brow framing and Lip fullness within the existing three-area limit. General lifting, fullness and overall goals do not enable the new local feature edits. A skin-only request cannot unlock them.

Existing skin and under-eye instructions now distinguish pore contrast from scar geometry and lid–cheek transition shading from pigmentation, vessels and swelling. Retain fine pores, normal lid folds, some darkness and natural complexion; do not add cheek volume to manufacture an under-eye result. Hair styling continues to respect source texture and the existing hair-preservation settings. Beard-covered anatomical regions remain uncertain rather than being reconstructed.

## Bound the image change

The original landmarks supply separate feathered patches for brows, vermilion, the mentolabial region, chin and lower lateral contours. Every added patch requires its own flag. Existing records without the new optional geometry remain valid for older edits, but a newly selected refinement fails closed without appropriate geometry. The existing source composite, consent checks and automated quality review remain in place.

The mask is a geometric approximation, not a clinically validated segmentation. A provider can ignore instructions or introduce artifacts within a permitted patch. Compositing preserves source pixels outside the selected blend support; it is not a guarantee of identity preservation within that support. Brow edits keep a separate eye guard. Generated candidates still require automated review, which is fallible. No live provider experiment or clinical validation was performed for this branch.

## Describe evidence honestly

The public explorer uses a shared 169-item, twelve-category descriptive catalog. The counts are catalog coverage, not claims that 169 automated or clinical tests were performed. Each category explains its review method and limits. There are no sub-millimeter precision, universal ideal-ratio, procedural-prescription or 100-percent identity-lock claims in this explorer.

The report author is instructed to distinguish observations, selected preferences and unknowns; retain lighting, pose, beard and laterality limitations; and avoid inferring fat, fluid, muscle or skeletal causes. Newly authored output is instructed to leave aesthetic score arrays empty and visual-age fields null. Existing parser fields are retained for saved-report compatibility; this is not a historical-data migration. AI image captions read AI CONCEPT, and the report distinguishes original evidence from generated illustration.

## Iteration contract

For supervised image iterations, keep the previous approved version and list only the newly requested targets. Do not use a generated image as evidence of the original anatomy or as a confirmed treatment outcome. Do not describe Botox, filler or skin boosters as certain ways to obtain an AI image. This branch does not create a clinical prescribing system, add a revision-storage service, or upload the demonstration cases.

## Validation

Tests cover explicit parent-backed preferences, independent masks, no generic-goal feature unlock, preserved eye/nose regions, source pixels outside a lip-only edit, missing geometry rejection, and all 169 catalog entries. Full-suite failures are compared with an unmodified baseline rather than hidden or disabled. No database changes are needed.
