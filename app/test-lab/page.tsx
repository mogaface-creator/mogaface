"use client";

import { DEFAULT_APPEARANCE_CONTROLS, type AppearanceControls, type EditLevel } from "@/lib/image-generation/appearancePlan";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ClinicalTransformationCard } from "@/components/visualization/ClinicalTransformationCard";
import type { ImageReview } from "@/lib/submissions/imageReview";
import type { ClinicalTreatmentPillar } from "@/lib/submissions/clinicalVision";
import { findPortraitGeometry } from "@/lib/image-generation/localEditClient";

interface SimulationResult {
  ok: boolean;
  beforeDataUrl: string;
  afterDataUrl: string;
  executiveSummary: string;
  opportunities: Array<{ label: string; description: string; targetRefinement?: string }>;
  pillars?: ClinicalTreatmentPillar[];
  harmonyScore?: number;
  symmetryIndex?: number;
  promptUsed?: string;
  pdfBase64?: string;
  review?: ImageReview;
  model?: string;
  resolution?: string;
}

export default function TestLabPage() {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [clientName, setClientName] = useState("Manoj");
  const [imageModel, setImageModel] = useState("");
  const [openaiConsent, setOpenaiConsent] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null);
  const checkOpenaiConfiguration = () => {
    void fetch("/api/test-simulate", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { setOpenaiConfigured(data?.configured === true); setImageModel(data?.model || ""); }).catch(() => setOpenaiConfigured(false));
  };
  useEffect(() => { checkOpenaiConfiguration(); }, []);
  const [simulateHair, setSimulateHair] = useState(true);
  const [focus, setFocus] = useState("all");
  const intensity = "balanced";
  const [appearanceControls, setAppearanceControls] = useState<AppearanceControls>(DEFAULT_APPEARANCE_CONTROLS);
  const [customDirective, setCustomDirective] = useState("");

  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const optimizeImageForUpload = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      img.onload = () => {
        const maxDim = 1536;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          "image/jpeg",
          0.88
        );
      };
      img.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhotoPreview(URL.createObjectURL(file));

    try {
      const optimized = await optimizeImageForUpload(file);
      setPhotoFile(optimized);
    } catch {
      setPhotoFile(file);
    }
  };

  const handleReset = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setOpenaiConsent(false);
    setResult(null);
    setError(null);
  };

  const handleRunSimulation = async () => {
    if (!photoFile) {
      setError("Please select or capture a photo first.");
      return;
    }

    if (!openaiConsent) { setError("Please agree to sending this photo to OpenAI before running the preview."); return; }
    if (!openaiConfigured) { setError("Add OPENAI_API_KEY to .env.local, then check key configuration."); return; }
    setLoading(true);
    setError(null);
    setStepMessage("Sending the selected photo and goals to OpenAI...");

    const timer1 = setTimeout(() => {
      setStepMessage("OpenAI is generating the preview; no other image provider is used...");
    }, 4000);

    const timer2 = setTimeout(() => {
      setStepMessage("Waiting for the image from OpenAI...");
    }, 18000);

    try {
      let fileToSend = photoFile;
      if (fileToSend.size > 2 * 1024 * 1024) {
        fileToSend = await optimizeImageForUpload(fileToSend);
      }

      setStepMessage("Locating the face locally so unselected areas can be protected...");
      const portraitGeometry = await findPortraitGeometry(fileToSend);

      const formData = new FormData();
      formData.append("photo", fileToSend);
      formData.append("portraitGeometry", JSON.stringify(portraitGeometry));
      if (clientName) formData.append("clientName", clientName);
      formData.append("openaiConsent", "granted");
      formData.append("simulateHair", simulateHair ? "true" : "false");
      formData.append("focus", focus);
      formData.append("intensity", intensity);
      formData.append("appearanceControls", JSON.stringify(appearanceControls));
      if (customDirective.trim()) {
        formData.append("customDirective", customDirective.trim());
      }

      const res = await fetch("/api/test-simulate", {
        method: "POST",
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const resText = await res.text();
      let data: SimulationResult;
      try {
        data = JSON.parse(resText);
      } catch {
        if (res.status === 413 || resText.includes("Request Entity Too Large")) {
          throw new Error("Photo file was too large. It has been auto-compressed; please click Run again.");
        }
        if (res.status === 504 || resText.includes("Gateway Timeout")) {
          throw new Error("OpenAI did not complete in time. Retrying may incur another charge.");
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || !data.ok) {
        throw new Error((data as unknown as { error?: string }).error || "Simulation failed. Please try again.");
      }

      setResult(data);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setStepMessage("");
    }
  };

  const downloadPdf = () => {
    if (!result?.pdfBase64) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${result.pdfBase64}`;
    link.download = `MogaFace-Aesthetic-Dossier-${clientName || "Simulation"}.pdf`;
    link.click();
  };

  const downloadAfterImage = () => {
    if (!result?.afterDataUrl) return;
    const link = document.createElement("a");
    link.href = result.afterDataUrl;
    const mime = result.afterDataUrl.slice(5).split(";")[0];
    const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    link.download = `MogaFace-OpenAI-${clientName || "Preview"}.${extension}`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased">
      {/* Top Banner */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-slate-900">
                MogaFace
              </span>
            </Link>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
              OpenAI Preview Test
            </span>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-600 hover:text-violet-700 transition"
          >
            ← Back to Homepage
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Intro */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct OpenAI API</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-slate-900">
            OpenAI Before & After Test
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Compare one OpenAI edit with your original. Select appearance goals and inspect identity, skin texture, hair and contour. This is an illustration, not a treatment report; selected regions are composited locally with the source photo.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          {openaiConfigured === null ? "Checking OpenAI key configuration..." : openaiConfigured ? "OpenAI key is configured. The configured image model is shown below." : "OpenAI key is missing. Add OPENAI_API_KEY to the project's .env.local file. Keep it private; do not paste it into chat."}
          <button type="button" onClick={checkOpenaiConfiguration} className="ml-3 font-semibold text-violet-700 underline">Check key configuration</button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!result ? (
          /* INPUT SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Upload Zone */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <label className="block text-sm font-bold text-slate-900 mb-1">
                  1. Patient Portrait (Required)
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Take a selfie or upload a front-facing photo showing face and hairline clearly.
                </p>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center p-3">
                    <div className="relative w-full max-w-sm aspect-[4/5] rounded-xl overflow-hidden bg-slate-100">
                      <Image
                        src={photoPreview}
                        alt="Preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer px-3.5 py-1.5 rounded-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="cursor-pointer px-3.5 py-1.5 rounded-full text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-500 bg-slate-50/60 hover:bg-violet-50/20 flex flex-col items-center justify-center p-6 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                      📸
                    </div>
                    <span className="text-sm font-bold text-slate-900 group-hover:text-violet-700">
                      Tap to take photo or upload image
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      JPG, PNG, WebP supported • Auto-optimized on client
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Simulation Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Simulation Parameters
                </h2>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Client / Patient Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Manoj"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-violet-600 focus:bg-white transition"
                  />
                </div>

                <p className="text-xs text-slate-500">OpenAI model: {imageModel || "checking configuration"}. One high-quality edit per run, followed by automated review. Compare every result manually.</p>
                {/* Focus Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Appearance goal
                    </label>
                    <span className="text-[10px] text-violet-600 font-medium">Illustrative</span>
                  </div>
                  <select
                    aria-label="Area to preview"
                    value={focus}
                    onChange={(e) => {
                      setFocus(e.target.value);
                      if (e.target.value === "hair") setSimulateHair(true);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-600 transition cursor-pointer"
                  >
                    <option value="all">✨ Full Aesthetic Transformation (All 5 Pillars: Skin + Jawline + Under-Eye + Forehead)</option>
                    <option value="skin">✨ Dermal Clarity &amp; Acne Clearance</option>
                    <option value="jawline">✨ Mandibular Jawline &amp; Submental Tightening</option>
                    <option value="under_eye">✨ Tear Trough &amp; Dark Circle Revitalization</option>
                    <option value="forehead">✨ Forehead Dynamic Expression Smoothing</option>
                    <option value="midface">✨ Mid-Face Malar Cheek Apex Support</option>
                    <option value="hair">✨ Hairline Density &amp; Precision Styling</option>
                  </select>
                </div>

                {/* Intensity Selector */}
                <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-xs font-bold text-slate-700">Refinement controls</legend>
                  <p className="text-xs text-slate-500">Independent controls replace the overall strength setting. Defaults keep contour changes restrained.</p>
                  {([['hair','Hair styling and fullness'],['skin','Skin marks and clarity'],['contour','Face and jaw contour']] as const).map(([key,label]) => (
                    <label key={key} className="block text-xs font-semibold text-slate-700">{label}
                      <select aria-label={label} value={appearanceControls[key]} onChange={e=>setAppearanceControls(c=>({...c,[key]:e.target.value as EditLevel}))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                        <option value="preserve">Preserve unchanged</option><option value="subtle">Subtle refinement</option><option value="balanced">Visible, balanced refinement</option>
                      </select>
                    </label>
                  ))}
                </fieldset>

                {/* Custom Focus Note / Directive */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Specific Focus Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDirective}
                    onChange={(e) => setCustomDirective(e.target.value)}
                    placeholder="e.g. Focus on clearing cheek acne and sharpening jawline"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-violet-600 focus:bg-white transition"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-2.5 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <input
                      id="simHair"
                      type="checkbox"
                      checked={simulateHair}
                      onChange={(e) => setSimulateHair(e.target.checked)}
                      className="w-4 h-4 rounded text-violet-600 bg-slate-100 border-slate-300 focus:ring-violet-500 cursor-pointer"
                    />
                    <label htmlFor="simHair" className="text-xs text-slate-700 font-semibold cursor-pointer">
                      Include Hair Density &amp; Modern Styling
                    </label>
                  </div>

                  <label className="flex items-start gap-3 text-xs text-slate-700">
                    <input type="checkbox" aria-label="Consent to OpenAI photo processing" checked={openaiConsent} onChange={e => setOpenaiConsent(e.target.checked)} />
                    I agree to send this photo and selected appearance goals to OpenAI for an illustrative preview. No clinical assessment is performed by this test.
                  </label>
                </div>

                <button
                  type="button"
                  disabled={loading || !photoFile || !openaiConsent || !openaiConfigured}
                  onClick={handleRunSimulation}
                  className="w-full mt-4 py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Generating Photorealistic Simulation...</span>
                    </>
                  ) : (
                    <>
                      <span>Run OpenAI Preview</span>
                    </>
                  )}
                </button>

                {loading && (
                  <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-xs flex items-center gap-2">
                    <span className="animate-pulse">✨</span>
                    <span className="font-semibold">{stepMessage}</span>
                  </div>
                )}
              </div>

              {/* Guarantees banner */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 space-y-1.5 shadow-2xs">
                <p className="font-bold text-slate-900">What to check in the result:</p>
                <p>• <strong>Identity:</strong> Check that eyes, nose, mouth and overall proportions still match the original.</p>
                <p>• <strong>Melanin Integrity:</strong> Check that the original skin colour and lighting remain believable.</p>
                <p>• <strong>Authentic Pore Texture:</strong> Reject plastic skin, excessive smoothing or invented texture.</p>
                <p>• <strong>Hair Authenticity:</strong> Hair should only change when selected and should retain a natural texture.</p>
              </div>
            </div>
          </div>
        ) : (
          /* RESULT DISPLAY */
          <div className="space-y-8">
            {/* Header / Actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  OpenAI image returned - manual review required
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {clientName} • Before vs. After Aesthetic Simulation
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={downloadAfterImage}
                  className="cursor-pointer px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition flex items-center gap-1.5"
                >
                  <span>🖼️</span>
                  <span>Download Image</span>
                </button>
                {result.pdfBase64 && (
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="cursor-pointer px-4 py-2 rounded-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>📄</span>
                    <span>Download PDF Dossier</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="cursor-pointer px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Test Another
                </button>
              </div>
            </div>

            {/* Clinical Transformation Card with Interactive Wipe Slider */}
            <ClinicalTransformationCard
              beforeSrc={result.beforeDataUrl}
              afterSrc={result.afterDataUrl}
              clientName={clientName}
              pillars={result.pillars}
            />

            {/* Clinical Interpretation Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Preview information
                </h3>
                {result.harmonyScore && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Harmony: {result.harmonyScore}/100 • Symmetry: {result.symmetryIndex ?? 95}%
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-violet-700">{result.model} / Direct OpenAI API</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {result.executiveSummary}
              </p>

              {result.opportunities && result.opportunities.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {result.opportunities.map((opp, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <p className="text-xs font-bold text-violet-700">{opp.label}</p>
                      <p className="text-xs text-slate-600 mt-1">{opp.description}</p>
                      {opp.targetRefinement && (
                        <p className="text-[11px] font-medium text-slate-400 mt-1.5 border-t border-slate-200/50 pt-1">
                          Modality: {opp.targetRefinement}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Prompt Inspector */}
              {result.promptUsed && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPromptInspector(!showPromptInspector)}
                    className="cursor-pointer text-xs text-slate-500 hover:text-violet-700 flex items-center gap-1.5 transition"
                  >
                    <span>{showPromptInspector ? "▼" : "▶"}</span>
                    <span>Inspect Exact Prompt Sent to OpenAI</span>
                  </button>

                  {showPromptInspector && (
                    <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {result.promptUsed}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
