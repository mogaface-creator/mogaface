# Screenshot recreation target

Source: fourteen user-supplied QOVES portal frames from a review video, supplied 03 November 2026. Use their application content as the visual target; exclude browser chrome, video playback controls, reviewer webcam and YouTube overlays.

Desktop reference normalization: 3024 px source screenshots correspond approximately to 1512 CSS px at 2x density. App starts near y=110 source px. Primary rail approximately 220 CSS px; secondary rail approximately 220 CSS px. Content starts at x=440 CSS px with about 72–82 px inner padding. White canvas, near-black sans-serif headings, cool gray secondary words, very pale gray panels, thin quiet borders, almost no shadows. Heading approximately 30–32 px, body approximately 14 px, small mono-style field labels approximately 10 px.

Screens: introduction with a narrow reading column; dimorphism overview with large portrait left and stacked evidence/explanation panels right; two-column feature cards with centered isolated feature imagery; three portrait comparison panels; averageness summary; proportions overview with portrait guides and tabbed Ear/Nose/Mouth/Eye comparison cards. Reference data (78, 88, ratios, population labels) belongs to the reviewer and is not the current client's measurement.

Moga adaptation: retain the layout and navigation hierarchy with Moga name. Use original client photo and existing AI concepts as supplied assets. Preserve actual source pixels via presentation crops, not regenerated originals. Unsupported measurements and reference scores show unavailable states with no fabricated plotted marker. Feature copy comes from the 169 original-evidence observations. Clinical labels, inferred demographics, treatment promises and third-party privacy statements are not copied as claims about this service.

Mobile: same hierarchy through an accessible native dialog drawer; one content column, usable proportion tabs, no horizontal page overflow; comparison panels stack. Desktop uses both rails. No PDF workflow.

## Delivery
The HTML export now delegates to `portal.ts`, with offline styles, navigation and embedded assets. The development-only `/report-preview` route loads the locally specified `REPORT_PREVIEW_DATA` fixture; no fixture media belongs in the application repository. Final visual evidence and known verification limits are recorded in `design-qa.md`.
