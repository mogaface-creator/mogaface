import type { FacialAnalysisResult, Point2D } from "@/lib/facial-analysis/types.ts";
import { MeasurementCard } from "./MeasurementCard";
import { SymmetryCard } from "./SymmetryCard";
import { ProportionCard } from "./ProportionCard";
import { LandmarkCanvas } from "./LandmarkCanvas";
import { formatRatio, formatRelative, formatPercent } from "./format";

interface AnalysisResultsProps {
  result: FacialAnalysisResult;
  imageUrl: string;
  landmarks: Point2D[];
}

export function AnalysisResults({ result, imageUrl, landmarks }: AnalysisResultsProps) {
  const { measurements, symmetry, proportions } = result;
  const proportionByName = new Map(proportions.metrics.map((m) => [m.metric, m.value]));
  const thirdPercent = (name: string) => {
    const value = proportionByName.get(name);
    return formatPercent(value != null ? value * 100 : null);
  };

  return (
    <div className="space-y-10">
      <p className="text-xs text-muted">
        Measurements below are relative units derived from your photo&apos;s own geometry (not physical
        centimeters — no calibration reference was used). Ratios and proportions are the most comparable
        values across photos.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MeasurementCard
          title="Face"
          rows={[
            { label: "Width (relative)", value: formatRelative(measurements.face.width) },
            { label: "Height (relative)", value: formatRelative(measurements.face.height) },
            { label: "Width / height ratio", value: formatRatio(measurements.face.widthHeightRatio) },
          ]}
        />
        <MeasurementCard
          title="Eyes"
          rows={[
            { label: "Left eye width (relative)", value: formatRelative(measurements.eyes.leftEyeWidth) },
            { label: "Right eye width (relative)", value: formatRelative(measurements.eyes.rightEyeWidth) },
            { label: "Interocular distance (relative)", value: formatRelative(measurements.eyes.interocularDistance) },
            { label: "Eye-width difference", value: formatPercent(measurements.eyes.eyeWidthDifferencePct) },
          ]}
        />
        <MeasurementCard
          title="Nose"
          rows={[
            { label: "Width (relative)", value: formatRelative(measurements.nose.width) },
            { label: "Height (relative)", value: formatRelative(measurements.nose.height) },
            { label: "Nose / face width ratio", value: formatRatio(measurements.nose.widthToFaceWidthRatio) },
          ]}
        />
        <MeasurementCard
          title="Mouth"
          rows={[
            { label: "Width (relative)", value: formatRelative(measurements.mouth.width) },
            { label: "Mouth / face width ratio", value: formatRatio(measurements.mouth.widthToFaceWidthRatio) },
          ]}
        />
        <MeasurementCard
          title="Jaw"
          rows={[
            { label: "Width (relative)", value: formatRelative(measurements.jaw.width) },
            { label: "Chin height (relative)", value: formatRelative(measurements.jaw.chinHeight) },
            { label: "Lower face height (relative)", value: formatRelative(measurements.jaw.lowerFaceHeight) },
          ]}
        />
        <MeasurementCard
          title="Facial thirds"
          rows={[
            { label: "Upper", value: thirdPercent("Upper third proportion") },
            { label: "Middle", value: thirdPercent("Middle third proportion") },
            { label: "Lower", value: thirdPercent("Lower third proportion") },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SymmetryCard symmetry={symmetry} />
        <ProportionCard proportions={proportions} />
      </div>

      <div>
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">Landmark visualization</h3>
        <LandmarkCanvas imageUrl={imageUrl} landmarks={landmarks} />
      </div>
    </div>
  );
}
