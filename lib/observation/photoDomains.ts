/**
 * Facial structure and eye area — the two domains derived from the
 * multi-photo pipeline's front photo. Both stay empty (not fabricated,
 * not fallback-averaged from a different view) when no complete front
 * photo exists, matching combine.ts's "front is the only source" rule.
 */

import { measuredObservation } from "./helpers.ts";
import { classifyUnderEyeDarkness } from "../facial-analysis/underEye.ts";
import type { MultiPhotoFacialAnalysis, PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";
import type { EyeAreaAnalysis, FacialStructureAnalysis, InferencePlaceholder, Observation } from "./types.ts";

const EYE_SYMMETRY_METRIC_NAMES = ["Eye width symmetry", "Eye vertical position symmetry", "Eyebrow symmetry"];
const STRUCTURE_SYMMETRY_METRIC_NAMES = ["Nose alignment", "Mouth alignment", "Lower-face symmetry"];

function frontRecord(multiPhoto: MultiPhotoFacialAnalysis | null) {
  const front = multiPhoto?.photos.find((p) => p.slot === "front");
  if (!front || !front.measurements || !front.symmetry || !front.proportions) return null;
  return { measurements: front.measurements, symmetry: front.symmetry, proportions: front.proportions };
}

const SLOT_LABELS: Record<PhotoSlot, string> = {
  front: "front",
  leftFortyFive: "left 45°",
  rightFortyFive: "right 45°",
  leftProfile: "left profile",
  rightProfile: "right profile",
};

/**
 * Relative face-outline geometry from every complete front/45° photo that
 * has it. Front contributes both sides plus two ratios; a 45° photo only its
 * near side (the far side is foreshortened). Each observation's source is
 * the photo slot it was measured on. A missing angle simply contributes
 * nothing — never a fallback from another view.
 */
function buildContourObservations(multiPhoto: MultiPhotoFacialAnalysis | null): Observation<number>[] {
  const out: Observation<number>[] = [];
  for (const record of multiPhoto?.photos ?? []) {
    const c = record.contour;
    if (record.status !== "complete" || !c) continue;
    const slot = record.slot;
    const add = (id: string, label: string, value: number | null) => {
      if (value === null || !Number.isFinite(value)) return;
      out.push(measuredObservation({ id: `facialStructure.contour.${id}`, domain: "facial-structure", label: `${label} (${SLOT_LABELS[slot]})`, value, source: slot }));
    };
    for (const side of ["right", "left"] as const) {
      const s = c[side];
      if (!s) continue;
      add(`cheekContourAngle.${slot}.${side}`, `Cheek contour angle, ${side} side`, s.cheekContourAngle);
      add(`jawContourAngle.${slot}.${side}`, `Jaw contour angle, ${side} side`, s.jawContourAngle);
    }
    add("jawToFaceWidthRatio", "Jaw width / face width", c.jawToFaceWidthRatio);
    add("lowerFaceContourRatio", "Lower-face height / jaw width", c.lowerFaceContourRatio);
  }
  return out;
}

export function buildFacialStructureAnalysis(multiPhoto: MultiPhotoFacialAnalysis | null): FacialStructureAnalysis {
  const front = frontRecord(multiPhoto);
  const measured: Observation<number>[] = [];

  if (front) {
    const { measurements: m, symmetry, proportions } = front;
    const m1 = (id: string, label: string, value: number) => measured.push(measuredObservation({ id, domain: "facial-structure", label, value, source: "front" }));

    m1("facialStructure.faceWidth", "Face width", m.face.width);
    m1("facialStructure.faceHeight", "Face height", m.face.height);
    m1("facialStructure.faceWidthHeightRatio", "Face width/height ratio", m.face.widthHeightRatio);
    m1("facialStructure.noseWidth", "Nose width", m.nose.width);
    m1("facialStructure.noseWidthToFaceWidthRatio", "Nose / face width ratio", m.nose.widthToFaceWidthRatio);
    m1("facialStructure.mouthWidth", "Mouth width", m.mouth.width);
    m1("facialStructure.mouthWidthToFaceWidthRatio", "Mouth / face width ratio", m.mouth.widthToFaceWidthRatio);
    m1("facialStructure.jawWidth", "Jaw width", m.jaw.width);
    m1("facialStructure.lowerFaceHeight", "Lower face height", m.jaw.lowerFaceHeight);
    m1("facialStructure.thirdsUpper", "Upper facial third", m.thirds.upper);
    m1("facialStructure.thirdsMiddle", "Middle facial third", m.thirds.middle);
    m1("facialStructure.thirdsLower", "Lower facial third", m.thirds.lower);
    m1("facialStructure.overallSymmetryIndex", "Overall symmetry index", symmetry.overallSymmetryIndex);

    for (const name of STRUCTURE_SYMMETRY_METRIC_NAMES) {
      const metric = symmetry.metrics.find((s) => s.metric === name);
      if (metric) m1(`facialStructure.symmetry.${name}`, name, metric.symmetryIndex);
    }
    for (const p of proportions.metrics) {
      m1(`facialStructure.proportion.${p.metric}`, p.metric, p.value);
    }
  }

  measured.push(...buildContourObservations(multiPhoto));

  const inferences: InferencePlaceholder[] = [
    {
      id: "facialStructure.classification",
      domain: "facial-structure",
      observationType: "inferred",
      status: "not_available",
      evidence: [],
      methodology: null,
    },
  ];

  return { measured, inferences };
}

/** Categories that would need shading/shape analysis a selfie cannot defend. Reported, never silently dropped. */
export const UNDER_EYE_NOT_MEASURED = [
  { id: "eyeArea.visibleUnderEyePuffiness", label: "Visible under-eye puffiness", reason: "Needs 3D shape information a single 2D photo does not provide." },
  { id: "eyeArea.apparentUnderEyeHollowing", label: "Apparent under-eye hollowing", reason: "Shadow and shape cannot be told apart in a single photo; no defensible method exists." },
  { id: "eyeArea.visibleUnderEyeFineLinePattern", label: "Visible under-eye fine-line pattern", reason: "Fine texture is not reliably resolvable from a typical selfie." },
];

export function buildEyeAreaAnalysis(multiPhoto: MultiPhotoFacialAnalysis | null): EyeAreaAnalysis {
  const front = frontRecord(multiPhoto);
  const measured: Observation<number>[] = [];

  if (front) {
    const { measurements: m, symmetry } = front;
    const m1 = (id: string, label: string, value: number) => measured.push(measuredObservation({ id, domain: "eye-area", label, value, source: "front" }));

    m1("eyeArea.leftEyeWidth", "Left eye width", m.eyes.leftEyeWidth);
    m1("eyeArea.rightEyeWidth", "Right eye width", m.eyes.rightEyeWidth);
    m1("eyeArea.interocularDistance", "Interocular distance", m.eyes.interocularDistance);
    m1("eyeArea.eyeWidthDifferencePct", "Eye width difference", m.eyes.eyeWidthDifferencePct);

    for (const name of EYE_SYMMETRY_METRIC_NAMES) {
      const metric = symmetry.metrics.find((s) => s.metric === name);
      if (metric) m1(`eyeArea.symmetry.${name}`, name, metric.symmetryIndex);
    }
  }

  const visual: Observation<boolean>[] = [];
  const underEye = multiPhoto?.photos.find((p) => p.slot === "front" && p.status === "complete")?.underEye;
  if (underEye) {
    const side = (which: "right" | "left") => {
      const u = underEye[which];
      if (u) {
        measured.push(
          measuredObservation({
            id: `eyeArea.underEyeBrightnessRatio.${which}`,
            domain: "eye-area",
            label: `Under-eye brightness relative to adjacent cheek (${which} eye)`,
            value: u.luminanceRatio,
            source: "front",
          }),
        );
      }
      return u;
    };
    side("right");
    side("left");
    // Borderline (close to the threshold) is insufficient evidence: no observation.
    if (classifyUnderEyeDarkness(underEye) === "OBSERVED") {
      visual.push(
        measuredObservation({
          id: "eyeArea.visibleUnderEyeDarkness",
          domain: "eye-area",
          label: "Visible dark-looking under-eye appearance (relative to adjacent cheek)",
          value: true,
          source: "front",
        }),
      );
    }
  }

  return {
    measured,
    visual,
    notMeasured: UNDER_EYE_NOT_MEASURED,
    // Not currently collected by the assessment (glasses use, eyebrow
    // grooming preference, eye-area concerns) — left empty rather than
    // fabricated.
    userReported: [],
    // No defensible methodology exists for eye-shape classification from
    // landmark thresholds — left empty per the project brief.
    inferences: [],
  };
}
