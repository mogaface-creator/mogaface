# Live review and saved-report repair

The previous demo depended on optional prepared illustrations that production never supplied. The real fallback used fixed coordinates from a different selfie and a generic polygon silhouette. The editing workspace also retained its previous long-page UI.

The review workspace now uses the same two-rail visual structure as the saved report. Assessment, feature details, before/after, refinement controls and saved links remain in one navigable interface. Findings are restored within the submitting browser tab after refresh. Original source photos and consent/auth/image receipts remain enforced.

Production GET and publish paths prepare compact rectangular display crops from each record's detected portrait geometry. No geometry means a full original-photo fallback; no generic cutout or invented facial landmarks. This changes presentation pixels, not original evidence or analysis findings. Saved report pages prefer supported findings for overview cards. Their overview now displays assessment priorities instead of an empty dimorphism scale. All 169 catalog entries remain available.

Existing saved portal reports receive a narrowly scoped CSS repair on read: remove the polygon mask, disable fixed background crops, center the original and replace the empty dimorphism display. Stored evidence/content is not rewritten. Existing saved links cannot acquire new assessment data or an after-image that was never accepted.

Validation: 14 workspace tests pass, including real landscape-image crops without demo illustrations, missing/invalid geometry fallback and repair of old reports without changing evidence. TypeScript, changed-source ESLint and production webpack build pass. Browser checks at 1512×900 and 390×844 confirm feature navigation, lip detail search, mobile drawer closure and no horizontal overflow. No browser console errors. Screenshots are stored outside the app repository in outputs/review-fix-desktop.png and outputs/review-fix-mobile.png. Development fixture page /workspace-preview is read-only and returns 404 in production. Provider-generated private client edits were not purchased/run during these checks.
