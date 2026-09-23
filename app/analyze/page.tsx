"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { FaceUploader } from "@/components/facial-analysis/FaceUploader";
import { PhotoPreview } from "@/components/facial-analysis/PhotoPreview";
import { PhotoQualityCheck } from "@/components/facial-analysis/PhotoQualityCheck";
import { AnalysisProgress, type AnalysisStep } from "@/components/facial-analysis/AnalysisProgress";
import { detectFace, FaceLandmarkerError } from "@/lib/facial-analysis/faceLandmarker.ts";
import { checkPhotoQuality } from "@/lib/facial-analysis/quality.ts";
import { loadImage, sampleMeanBrightness } from "@/lib/facial-analysis/imageSampling.ts";
import { buildAnalysisResult } from "@/lib/facial-analysis/analysis.ts";
import { saveAnalysisResult } from "@/lib/facial-analysis/resultStore.ts";
import type { PhotoQualityResult } from "@/lib/facial-analysis/types.ts";

type Stage = "select" | "processing" | "blocked" | "error";

export default function AnalyzePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("select");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<AnalysisStep>("Uploading");
  const [quality, setQuality] = useState<PhotoQualityResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleFileSelected = useCallback((selected: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(selected);
    objectUrlRef.current = url;
    setFile(selected);
    setPreviewUrl(url);
    setQuality(null);
    setErrorMessage(null);
    setStage("select");
  }, []);

  const handleRemove = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    setQuality(null);
    setErrorMessage(null);
    setStage("select");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file || !previewUrl) return;
    setStage("processing");
    setErrorMessage(null);
    setQuality(null);

    try {
      setProcessingStep("Uploading");
      const image = await loadImage(previewUrl);

      setProcessingStep("Checking photo");
      const meanBrightness = sampleMeanBrightness(image);

      setProcessingStep("Detecting face");
      const detection = await detectFace(image);

      setProcessingStep("Mapping landmarks");
      const qualityResult = checkPhotoQuality({
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        faceCount: detection.faces.length,
        landmarks: detection.faces[0],
        meanBrightness,
      });

      if (!qualityResult.valid) {
        setQuality(qualityResult);
        setStage("blocked");
        return;
      }

      setProcessingStep("Calculating measurements");
      const landmarks = detection.faces[0];
      const result = buildAnalysisResult(landmarks, qualityResult, image.naturalWidth, image.naturalHeight);

      setProcessingStep("Preparing results");
      saveAnalysisResult({ result, imageUrl: previewUrl, landmarks });
      router.push("/results");
    } catch (err) {
      const message =
        err instanceof FaceLandmarkerError || err instanceof Error
          ? err.message
          : "Something went wrong while analyzing this photo. Please try again.";
      setErrorMessage(message);
      setStage("error");
    }
  }, [file, previewUrl, router]);

  const currentStepIndex = stage === "select" ? 0 : 1;

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <StepIndicator steps={["Photos", "Analysis", "Results"]} currentStep={currentStepIndex} />

          <h1 className="mt-8 font-serif text-3xl tracking-tight">Analyze your photo</h1>
          <p className="mt-2 text-sm text-muted">
            Use a clear, front-facing photo with even lighting. It stays on this device — nothing is uploaded.
          </p>

          <div className="mt-10">
            {stage === "select" && !previewUrl && <FaceUploader onFileSelected={handleFileSelected} />}

            {stage === "select" && previewUrl && (
              <div>
                <PhotoPreview imageUrl={previewUrl} onReplace={handleRemove} onRemove={handleRemove} />
                <div className="mt-6 flex justify-center">
                  <Button onClick={handleAnalyze}>Analyze</Button>
                </div>
              </div>
            )}

            {stage === "processing" && <AnalysisProgress currentStep={processingStep} />}

            {stage === "blocked" && quality && (
              <div className="space-y-6">
                <PhotoQualityCheck quality={quality} />
                {previewUrl && <PhotoPreview imageUrl={previewUrl} onReplace={handleRemove} onRemove={handleRemove} />}
              </div>
            )}

            {stage === "error" && (
              <div className="space-y-6 text-center">
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
                <Button variant="secondary" onClick={handleRemove}>
                  Try a different photo
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
