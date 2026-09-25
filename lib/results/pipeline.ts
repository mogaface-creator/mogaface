/**
 * The results pipeline: existing evidence → interpretation → visualization
 * plan → (optionally) an illustrative image → MogaFaceResult.
 *
 * It builds on the existing analysis and treatment-opportunity output and
 * never recomputes either. An image failure never fails the result: the
 * interpretation and opportunities are always preserved.
 */

import { generateVisualization } from "../image-generation/provider.ts";
import type { ImageGenerationProvider, Visualization } from "../image-generation/types.ts";
import { buildInterpretationInput } from "../interpretation/build.ts";
import type { BuildOptions } from "../interpretation/build.ts";
import { interpretWithFallback, localRulesProvider } from "../interpretation/provider.ts";
import type { InterpretationProvider } from "../interpretation/types.ts";
import { buildVisualizationPlan } from "../visualization/build.ts";
import type { AssessmentSnapshot, MogaFaceResult, ResultStage } from "./types.ts";

export interface PipelineOptions {
  /** Null → no image provider: the visualization is "unavailable". */
  imageProvider: ImageGenerationProvider | null;
  interpretationProvider?: InterpretationProvider;
  onStage?: (stage: ResultStage) => void;
  timeoutMs?: number;
  /** Override the visual-calibration flag (tests only). */
  calibrated?: BuildOptions["calibrated"];
}

/** Yields to the event loop so a UI can paint a stage before the next (synchronous) step runs. Not a delay. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `result-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Throws only if interpretation itself cannot be produced (a bug) — the caller shows a generic error. */
export async function runResultPipeline(snapshot: AssessmentSnapshot, options: PipelineOptions): Promise<MogaFaceResult> {
  options.onStage?.("interpreting");
  await tick();
  const input = buildInterpretationInput(snapshot.assessment, snapshot.analysis, snapshot.opportunities);
  const { result: interpretation } = await interpretWithFallback(options.interpretationProvider ?? localRulesProvider, input, { calibrated: options.calibrated });

  const plan = buildVisualizationPlan({ frontPhoto: snapshot.frontPhoto, opportunities: snapshot.opportunities });

  let visualization: Visualization;
  if (plan.status === "planned") {
    options.onStage?.("preparing_visualization");
    await tick();
    visualization = await generateVisualization({
      sourceImage: plan.sourcePhoto ? { url: plan.sourcePhoto.ref, slot: "front" } : null,
      plan,
      provider: options.imageProvider,
      opportunities: snapshot.opportunities,
      timeoutMs: options.timeoutMs,
    });
  } else {
    visualization = { status: "unavailable", errorCode: "not_eligible" };
  }

  return {
    id: newId(),
    assessmentId: snapshot.assessment.id,
    createdAt: new Date().toISOString(),
    assessmentCreatedAt: snapshot.assessment.createdAt,
    interpretation,
    treatmentOpportunities: snapshot.opportunities,
    visualizationPlan: plan,
    visualization,
    status: visualization.status === "ready" ? "visualization_ready" : "visualization_unavailable",
    limitations: interpretation.limitations,
  };
}
