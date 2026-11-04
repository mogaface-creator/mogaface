# Report portal visual QA

final result: passed

## Scope and reference
Rebuilt the report presentation from the user's 14 supplied QOVES review-video screenshots. Moga branding, this client's evidence and honest unavailable states intentionally replace the reference person's content, scores and ratios. Reviewer webcam and video controls are excluded.

Reference originals are 3024 × 1812. Comparison boards normalize the app area using crop (0,110,3024,1710) to 1512 × 800. Desktop verified at 1512 × 800; mobile at 390 × 844.

## Evidence
Evidence paths relative to the task root (two directories above this repo):
- work/report-portal/overview-final-comparison.png
- work/report-portal/intro-final-comparison.png
- work/report-portal/features-final-comparison.png
- work/report-portal/desktop-feature-cards-verified.png
- work/report-portal/mobile-index-verified.png
- work/report-portal/mobile-navigation-final.png
- outputs/report-portal-desktop.png

Source comparisons include screenshots ending 1ecc9e9d (introduction), ec361068 (overview), fb4317e9 (eyes/nose) and 0763b7c5 (proportions). All supplied reference states informed the two navigation rails, feature cards and ratio tabs.

## Fidelity and repairs
Typography: neutral Arial family, 32px desktop headings, muted second phrases and small uppercase evidence labels. Geometry: two 220px rails, broad content gutter, flat pale panels and two-column feature cards. Color: white canvas, muted gray-green details, restrained borders. Images: personalized original and existing concepts; isolated feature art is labelled illustrative and is not measurement evidence. Copy: personalized source/confidence observations; no borrowed 78/88 scores, demographic comparisons or invented numerical ratios.

Initial comparison exposed unequal overview panel heights; flex sizing now balances them. Mobile table previously obscured confidence; rows now stack. Mobile row titles previously wrapped narrowly; their width is now 100%. Feature art was reduced to 180px and desktop ratio tabs to 84% width to better follow the reference. Final combined feature comparison was inspected after sizing corrections. Remaining minor crop and text-length differences are intentional personalized-content differences, not blocking layout defects.

## Interaction verification
Desktop report navigation, group expansion, sidebar collapse, proportion tabs and keyboard ArrowRight selection verified. Mobile dialog opens/closes, closes after navigation, and preserves usable focus. Original/concept portrait switch verified. Search for Cupid produces 1 of 169 findings with source/confidence visible. Mobile document width equals viewport width (390px). No browser console errors captured. Offline script compiles; page navigation and escaped content covered by tests.

## Engineering checks
12/12 workspace tests pass. TypeScript passes. Changed-source lint and webpack production build passed during implementation. Full suite has 951 passing / 16 failing tests; the same 16 failures existed before this portal change. No patient media or preview data is committed to the application repo. Preview route is development-only and production returns 404. The renderer is integrated into HTML export; deployment and private-provider end-to-end testing are not claimed.
