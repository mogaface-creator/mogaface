"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface SimulationResult {
  ok: boolean;
  beforeDataUrl: string;
  afterDataUrl: string;
  executiveSummary: string;
  opportunities: Array<{ label: string; description: string; targetRefinement?: string }>;
  harmonyScore: number;
  symmetryIndex: number;
  promptUsed?: string;
  pdfBase64?: string;
}

export default function TestLabPage() {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [clientName, setClientName] = useState("Manoj");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatePdf, setGeneratePdf] = useState(true);

  const [loading, setLoading] = useState(false);
  const [stepMessage, setStepMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
          0.88,
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

    // Optimize image in background for upload
    try {
      const optimized = await optimizeImageForUpload(file);
      setPhotoFile(optimized);
    } catch {
      setPhotoFile(file);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleReset = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setResult(null);
    setError(null);
  };

  const handleRunSimulation = async () => {
    if (!photoFile) {
      setError("Please select or capture a photo first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStepMessage("1/3 Optimizing image & scanning facial anatomy (GPT-4o Vision)...");

    const timer1 = setTimeout(() => {
      setStepMessage("2/3 Rendering photorealistic aesthetic simulation (chatgpt-image-latest)...");
    }, 4500);

    const timer2 = setTimeout(() => {
      setStepMessage("3/3 Finalizing clinical indices & PDF dossier...");
    }, 28000);

    try {
      // Ensure file is optimized before sending across network
      let fileToSend = photoFile;
      if (fileToSend.size > 2 * 1024 * 1024) {
        fileToSend = await optimizeImageForUpload(fileToSend);
      }

      const formData = new FormData();
      formData.append("photo", fileToSend);
      if (clientName) formData.append("clientName", clientName);
      if (customPrompt.trim()) formData.append("customPrompt", customPrompt.trim());
      formData.append("generatePdf", generatePdf ? "true" : "false");

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
          throw new Error("Photo file was too large for the network upload. We have auto-compressed it; please tap Run again.");
        }
        if (res.status === 504 || resText.includes("Gateway Timeout")) {
          throw new Error("OpenAI image generation took longer than usual. Please tap Run again.");
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
    link.download = `MogaFace-After-${clientName || "Simulation"}.jpg`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans antialiased selection:bg-purple-600 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-stone-800 bg-stone-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-300 to-amber-200 bg-clip-text text-transparent">
              MogaFace
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/50">
              ⚡ Rapid Test Lab
            </span>
          </div>
          <p className="text-xs text-stone-400 hidden sm:block">
            Direct Photo & Video Testing • Zero Questions Required
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Aesthetic & Hair Simulation Testing Sandbox
          </h1>
          <p className="mt-2 text-sm text-stone-400 max-w-2xl">
            Upload or capture your portrait to instantly test the latest AI model (<strong className="text-purple-300">chatgpt-image-latest</strong>). 
            No questionnaires, no answers, no email wait. See the transformation live on screen.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Generation Notice</p>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!result ? (
          /* INPUT SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Upload Zone */}
            <div className="lg:col-span-7 space-y-6">
              {/* Photo Input */}
              <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-6">
                <label className="block text-sm font-semibold text-white mb-2">
                  1. Patient Portrait (Required)
                </label>
                <p className="text-xs text-stone-400 mb-4">
                  Take a selfie or upload a photo showing front face and hairline clearly.
                </p>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-stone-700 bg-stone-950 flex flex-col items-center p-2">
                    <div className="relative w-full max-w-sm aspect-[4/5] rounded-lg overflow-hidden">
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
                        className="px-3 py-1.5 rounded-lg text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-medium transition"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 font-medium transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-stone-700 hover:border-purple-500 bg-stone-950/50 hover:bg-purple-950/10 flex flex-col items-center justify-center p-6 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-900/40 text-purple-400 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition">
                      📸
                    </div>
                    <span className="text-sm font-semibold text-stone-200 group-hover:text-purple-300">
                      Tap to take photo or upload image
                    </span>
                    <span className="text-xs text-stone-500 mt-1">
                      JPG, PNG, WebP supported
                    </span>
                  </button>
                )}
              </div>

              {/* Optional Video Input */}
              <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-white">
                    2. Expression Video (Optional)
                  </label>
                  <span className="text-[11px] font-medium text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-stone-400 mb-4">
                  Upload an optional expression video for multi-vector dynamic verification.
                </p>

                <input
                  type="file"
                  accept="video/*"
                  ref={videoInputRef}
                  onChange={handleVideoSelect}
                  className="hidden"
                />

                {videoPreview ? (
                  <div className="rounded-xl overflow-hidden border border-stone-700 bg-stone-950 p-2">
                    <video
                      src={videoPreview}
                      controls
                      className="w-full max-h-56 rounded-lg bg-black object-contain"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoFile(null);
                          setVideoPreview(null);
                        }}
                        className="px-2.5 py-1 rounded text-xs bg-stone-800 hover:bg-stone-700 text-stone-300"
                      >
                        Remove Video
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full py-4 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-950/40 hover:bg-stone-900/40 flex items-center justify-center gap-2 text-xs font-medium text-stone-400 hover:text-stone-300 transition"
                  >
                    <span>🎥</span>
                    <span>Attach optional video clip</span>
                  </button>
                )}
              </div>
            </div>

            {/* Simulation Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-6 space-y-5">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-stone-400">
                  Simulation Parameters
                </h2>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1.5">
                    Client / Patient Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Manoj"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-stone-300">
                      Custom Prompt Override (Optional)
                    </label>
                    <span className="text-[10px] text-stone-400">Leave blank for auto-AI</span>
                  </div>
                  <textarea
                    rows={4}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Leave empty to use automatic GPT-4o Vision diagnosis (hairline restoration, sharp jawline, acne clearance, real skin pores, zero bleaching)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white focus:outline-none focus:border-purple-500 transition resize-none placeholder:text-stone-600 font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    id="genPdf"
                    type="checkbox"
                    checked={generatePdf}
                    onChange={(e) => setGeneratePdf(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 bg-stone-950 border-stone-700 focus:ring-purple-500"
                  />
                  <label htmlFor="genPdf" className="text-xs text-stone-300 cursor-pointer">
                    Also generate & download 2-Page Clinical PDF Dossier
                  </label>
                </div>

                <button
                  type="button"
                  disabled={loading || !photoFile}
                  onClick={handleRunSimulation}
                  className="w-full mt-4 py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Simulation...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Run AI Aesthetic Simulation</span>
                    </>
                  )}
                </button>

                {loading && (
                  <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs flex items-center gap-2">
                    <span className="animate-pulse">✨</span>
                    <span className="font-medium">{stepMessage}</span>
                  </div>
                )}
              </div>

              {/* Instructions banner */}
              <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800/60 text-xs text-stone-400 space-y-1.5">
                <p className="font-semibold text-stone-300">What this test runs:</p>
                <p>• <strong>Hairline Restoration:</strong> Fills frontal hair loss & styles hair.</p>
                <p>• <strong>Jawline Sculpting:</strong> Removes double-chin & carves sharp jawline.</p>
                <p>• <strong>Photorealism Lock:</strong> Erases acne while keeping natural skin pores.</p>
                <p>• <strong>Zero Bleaching:</strong> Strictly preserves authentic skin tone.</p>
              </div>
            </div>
          </div>
        ) : (
          /* RESULT DISPLAY */
          <div className="space-y-8">
            {/* Header / Actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900 border border-stone-800">
              <div>
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                  ✓ Simulation Complete
                </span>
                <h2 className="text-lg font-bold text-white">
                  {clientName} • Before vs. After Aesthetic Simulation
                </h2>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={downloadAfterImage}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🖼️</span>
                  <span>Download Image</span>
                </button>
                {result.pdfBase64 && (
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📄</span>
                    <span>Download PDF Dossier</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition cursor-pointer"
                >
                  Test Another
                </button>
              </div>
            </div>

            {/* Side-by-Side Frames */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before Photo */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Baseline Profile (Current)
                  </span>
                  <span className="text-[11px] text-stone-500">Source Photo</span>
                </div>
                <div className="relative aspect-[4/5] w-full bg-black">
                  <Image
                    src={result.beforeDataUrl}
                    alt="Before"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>

              {/* After Simulation */}
              <div className="bg-stone-900 border border-purple-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-purple-950/50 ring-1 ring-purple-600/30">
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/80 to-stone-950 border-b border-purple-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Targeted Aesthetic Simulation (After)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded-full border border-purple-700/50">
                    chatgpt-image-latest
                  </span>
                </div>
                <div className="relative aspect-[4/5] w-full bg-black">
                  <Image
                    src={result.afterDataUrl}
                    alt="After Simulation"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Clinical Interpretation Card */}
            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-300">
                  Doctor&apos;s Clinical Interpretation & Findings
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-stone-800 text-stone-300 font-medium">
                    Harmony: <strong className="text-purple-300">{result.harmonyScore}/100</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-stone-800 text-stone-300 font-medium">
                    Symmetry: <strong className="text-purple-300">{result.symmetryIndex}%</strong>
                  </span>
                </div>
              </div>

              <p className="text-sm text-stone-300 leading-relaxed">
                {result.executiveSummary}
              </p>

              {result.opportunities && result.opportunities.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {result.opportunities.map((opp, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                      <p className="text-xs font-bold text-purple-300">{opp.label}</p>
                      <p className="text-xs text-stone-400 mt-1">{opp.description}</p>
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
                    className="text-xs text-stone-400 hover:text-purple-300 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{showPromptInspector ? "▼" : "▶"}</span>
                    <span>Inspect Prompt Sent to OpenAI</span>
                  </button>

                  {showPromptInspector && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-black/80 border border-stone-800 font-mono text-[11px] text-stone-300 whitespace-pre-wrap leading-relaxed">
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
