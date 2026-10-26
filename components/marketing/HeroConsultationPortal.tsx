"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { BeforeAfterToggle } from "./BeforeAfterToggle";

interface SimulationResult {
  ok: boolean;
  beforeDataUrl: string;
  afterDataUrl: string;
  executiveSummary: string;
  opportunities: Array<{ label: string; description: string; targetRefinement?: string }>;
  pillars?: Array<{ key: string; title: string; summary: string; modality: string }>;
  harmonyScore: number;
  symmetryIndex: number;
  pdfBase64?: string;
}

const PRESET_ARCHETYPES = [
  {
    id: "elena",
    name: "Elena R.",
    age: "32",
    tag: "Tear Trough & Midface",
    metric: "+35% Lift",
    beforeSrc: "/images/transformations/female_studio_before.webp",
    afterSrc: "/images/transformations/female_studio_after.webp",
    finding: "Tear trough hollowing softened with gentle anterior malar lift, restoring youthful light reflection.",
    harmonyScore: 94,
    symmetryIndex: 96,
    pillars: [
      { key: "tear_trough", title: "Under-Eye Tear Trough", summary: "Diminished dark fatigue hollows", modality: "(Micro-filler / PRF)" },
      { key: "midface", title: "Mid-Face Cheek Apex", summary: "Elevated youthful light reflection", modality: "(Structural Dermal Filler)" },
      { key: "dermal", title: "Skin Luminosity", summary: "Refined texture & smooth tone", modality: "(Clinical Peel)" },
    ],
  },
  {
    id: "lucas",
    name: "Lucas M.",
    age: "32",
    tag: "Mandibular Jawline",
    metric: "+28% Definition",
    beforeSrc: "/images/transformations/male_jawline_before.webp",
    afterSrc: "/images/transformations/male_jawline_after.webp",
    finding: "Crisp lower mandibular angle and submental soft-tissue contouring, eliminating fatigue while locking masculine anatomy.",
    harmonyScore: 92,
    symmetryIndex: 95,
    pillars: [
      { key: "jawline", title: "Mandibular Jawline", summary: "Sharp jaw-to-neck separation", modality: "(Jaw Filler / HIFU)" },
      { key: "submental", title: "Submental Soft Tissue", summary: "Streamlined chin transition", modality: "(Kybella / Contouring)" },
      { key: "periorbital", title: "Periorbital Rest", summary: "Energized lower eyelid transition", modality: "(Neuromodulator)" },
    ],
  },
  {
    id: "sofia",
    name: "Sofia V.",
    age: "28",
    tag: "Skin Tone & Malar Apex",
    metric: "Hydrated Radiance",
    beforeSrc: "/images/transformations/female_glow_before.webp",
    afterSrc: "/images/transformations/female_glow_after.webp",
    finding: "Luminous complexion enhancement paired with subtle cheek contouring, softening nasolabial shadows with zero skin bleaching.",
    harmonyScore: 96,
    symmetryIndex: 98,
    pillars: [
      { key: "skin", title: "Dermal Pore Texture", summary: "Micro-pore grain preserved with zero blemishes", modality: "(Pico Laser / Peels)" },
      { key: "malar", title: "Malar Cheek Definition", summary: "Refined cheek apex light reflection", modality: "(Micro-volumizing)" },
      { key: "melanin", title: "Melanin Integrity", summary: "100% natural undertone preserved", modality: "(Strict AI Lock)" },
    ],
  },
  {
    id: "marcus",
    name: "Marcus D.",
    age: "35",
    tag: "Forehead & Facial Balancing",
    metric: "-45% Crease Depth",
    beforeSrc: "/images/transformations/male_lifestyle_before.webp",
    afterSrc: "/images/transformations/male_lifestyle_after.webp",
    finding: "Forehead dynamic crease relaxation and periorbital brightening, projecting refreshed clinical vitality.",
    harmonyScore: 91,
    symmetryIndex: 94,
    pillars: [
      { key: "forehead", title: "Forehead Dynamic Lines", summary: "Relaxed horizontal & glabellar 11s", modality: "(Botox / Dysport)" },
      { key: "tear_trough", title: "Under-Eye Volume", summary: "Restored infraorbital support", modality: "(Micro-filler)" },
      { key: "hairline", title: "Hairline Authenticity", summary: "Authentic follicular texture locked", modality: "(Density Lock)" },
    ],
  },
];

const TARGET_AREAS = [
  { id: "jawline", label: "Jawline & Submental", icon: "✨" },
  { id: "under_eye", label: "Tear Troughs & Eyes", icon: "👁️" },
  { id: "forehead", label: "Forehead Dynamic Lines", icon: "💆" },
  { id: "skin", label: "Dermal Clarity & Pores", icon: "🌟" },
  { id: "hairline", label: "Hairline Density", icon: "💇" },
];

export function HeroConsultationPortal() {
  const [activeTab, setActiveTab] = useState<"upload" | "presets">("upload");
  const [selectedPreset, setSelectedPreset] = useState(PRESET_ARCHETYPES[0]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([
    "jawline",
    "under_eye",
    "forehead",
    "skin",
  ]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [clientName, setClientName] = useState("Guest");
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Client-side auto-compression under 1536px and ~700KB
  const optimizeImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      img.onload = () => {
        const maxDim = 1536;
        let { width, height } = img;
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
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
            );
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
      const optimized = await optimizeImage(file);
      setPhotoFile(optimized);
    } catch {
      setPhotoFile(file);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const optimized = await optimizeImage(file);
      setPhotoFile(optimized);
    } catch {
      setPhotoFile(file);
    }
  }, []);

  const handleRunSimulation = async () => {
    if (!photoFile) {
      setError("Please select or capture your portrait first.");
      return;
    }

    setLoading(true);
    setError(null);
    setScanStep("Scanning 468 facial anatomical landmarks...");

    const t1 = setTimeout(() => {
      setScanStep("Measuring Golden Ratio symmetry & submental contour...");
    }, 4000);

    const t2 = setTimeout(() => {
      setScanStep("Projecting identity-locked clinical simulation...");
    }, 18000);

    try {
      let fileToSend = photoFile;
      if (fileToSend.size > 2 * 1024 * 1024) {
        fileToSend = await optimizeImage(fileToSend);
      }

      const formData = new FormData();
      formData.append("photo", fileToSend);
      formData.append("clientName", clientName || "Guest");
      formData.append("generatePdf", "true");
      formData.append("simulateHair", selectedTargets.includes("hairline") ? "true" : "false");
      formData.append("targets", JSON.stringify(selectedTargets));

      const res = await fetch("/api/test-simulate", {
        method: "POST",
        body: formData,
      });

      clearTimeout(t1);
      clearTimeout(t2);

      const resText = await res.text();
      let data: SimulationResult;
      try {
        data = JSON.parse(resText);
      } catch {
        if (res.status === 413) {
          throw new Error("Image file was too large. It has been auto-compressed; please tap run again.");
        }
        throw new Error(`Simulation failed (Code: ${res.status}). Please retry.`);
      }

      if (!res.ok || !data.ok) {
        throw new Error((data as unknown as { error?: string }).error || "Simulation failed. Please try again.");
      }

      setResult(data);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setScanStep("");
    }
  };

  const downloadPdf = () => {
    if (!result?.pdfBase64) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${result.pdfBase64}`;
    link.download = `MogaFace-Clinical-Dossier-${clientName || "Consultation"}.pdf`;
    link.click();
  };

  return (
    <div
      id="portal"
      className="relative w-full rounded-3xl border border-slate-200/90 bg-white/95 p-4 sm:p-6 shadow-2xl backdrop-blur-xl transition-all"
    >
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Instant Clinical AI Consultation
          </span>
          <span className="hidden sm:inline-block rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-200/60">
            Zero Questions Required
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-full bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
              activeTab === "upload"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ⚡ Test Your Photo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
              activeTab === "presets"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🌟 Clinical Presets
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: UPLOAD & SIMULATE */}
      {activeTab === "upload" && (
        <div className="mt-5">
          {!result ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Photo Upload Area */}
              <div className="lg:col-span-7">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2">
                    <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-100">
                      <Image
                        src={photoPreview}
                        alt="Your Upload"
                        fill
                        unoptimized
                        className="object-cover"
                      />

                      {/* Scanning HUD Animation when loading */}
                      {loading && (
                        <div className="absolute inset-0 bg-violet-950/20 backdrop-blur-[1px]">
                          {/* Animated laser scan line */}
                          <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_15px_#8b5cf6] animate-scanline" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <div className="rounded-2xl bg-white/90 p-4 shadow-xl border border-violet-100 max-w-xs">
                              <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                              <p className="text-xs font-bold text-slate-900">{scanStep}</p>
                              <p className="text-[10px] text-slate-500 mt-1">Preserving bone structure & melanin</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {!loading && (
                      <div className="mt-2.5 flex items-center justify-between px-1">
                        <span className="text-xs font-medium text-slate-600">
                          ✓ Photo ready for scan
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer text-xs font-semibold text-violet-700 hover:underline"
                          >
                            Change Photo
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview(null);
                            }}
                            className="cursor-pointer text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative cursor-pointer aspect-[4/3] sm:aspect-[16/11] w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-500 bg-slate-50/70 hover:bg-violet-50/20 transition-all flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100/70 text-violet-700 text-2xl group-hover:scale-110 transition-transform shadow-xs">
                      📸
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900 group-hover:text-violet-700">
                      Snap a selfie or upload portrait photo
                    </p>
                    <p className="mt-1 text-xs text-slate-500 max-w-xs">
                      Drag &amp; drop or tap here. Front-facing with natural lighting produces the sharpest simulation.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 shadow-2xs">
                      <span>🔒 100% Identity-Locked &amp; Confidential</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Clinical Parameters & Trigger */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Your First Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-violet-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Target Clinical Priorities
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TARGET_AREAS.map((target) => {
                      const active = selectedTargets.includes(target.id);
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => toggleTarget(target.id)}
                          className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                            active
                              ? "bg-violet-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                          }`}
                        >
                          <span>{target.icon}</span>
                          <span>{target.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span>🛡️</span>
                    <span>Medical Identity Lock Guarantee</span>
                  </div>
                  <p>
                    Preserves your exact skull structure, eye shape, nose bridge, and natural melanin. Zero generic face-swaps or artificial skin bleaching.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loading || !photoFile}
                  onClick={handleRunSimulation}
                  className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 py-3.5 px-6 font-bold text-sm tracking-wide text-white shadow-lg shadow-violet-600/25 transition-all hover:from-violet-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>{scanStep || "Processing Clinical Simulation..."}</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Run AI Clinical Simulation</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">~60s</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* SIMULATION RESULT DISPLAY */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    ✓
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-950">
                      Simulation Complete for {clientName}
                    </h3>
                    <p className="text-[11px] text-emerald-700">
                      Bilateral Symmetry: <strong>{result.symmetryIndex}%</strong> • Facial Harmony:{" "}
                      <strong>{result.harmonyScore}/100</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {result.pdfBase64 && (
                    <button
                      type="button"
                      onClick={downloadPdf}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700 transition"
                    >
                      <span>📄</span>
                      <span>Download 2-Page PDF</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Test Another
                  </button>
                </div>
              </div>

              {/* Interactive Wipe Slider with Live Output */}
              <div className="mx-auto max-w-lg">
                <BeforeAfterToggle
                  beforeSrc={result.beforeDataUrl}
                  afterSrc={result.afterDataUrl}
                  beforeLabel="Your Baseline"
                  afterLabel="Targeted AI Simulation"
                  aspectRatio="aspect-[4/5]"
                />
              </div>

              {/* Executive Clinical Findings */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Clinical Anatomical Interpretation
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {result.executiveSummary}
                </p>

                {result.opportunities && result.opportunities.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.opportunities.map((opp, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs"
                      >
                        <p className="text-xs font-bold text-violet-700">{opp.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">{opp.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INSTANT PATIENT ARCHETYPES */}
      {activeTab === "presets" && (
        <div className="mt-5 space-y-5">
          {/* Preset Selector Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_ARCHETYPES.map((preset) => {
              const active = selectedPreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  className={`cursor-pointer rounded-2xl border p-2.5 sm:p-3 text-left transition-all ${
                    active
                      ? "border-violet-600 bg-violet-50/50 shadow-sm"
                      : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 hover:border-slate-300"
                  }`}
                >
                  <p className="font-heading text-xs font-bold text-slate-900">{preset.name}</p>
                  <p className="text-[10px] font-semibold text-violet-700 mt-0.5 truncate">
                    {preset.tag}
                  </p>
                  <span className="mt-1.5 inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    {preset.metric}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Archetype Comparison Spotlight */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6">
              <BeforeAfterToggle
                beforeSrc={selectedPreset.beforeSrc}
                afterSrc={selectedPreset.afterSrc}
                beforeLabel="Baseline"
                afterLabel="Simulated Outcome"
                aspectRatio="aspect-[4/5]"
              />
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-xl font-bold text-slate-900">
                    {selectedPreset.name} (Age {selectedPreset.age})
                  </span>
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
                    {selectedPreset.metric}
                  </span>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {selectedPreset.finding}
                </p>
              </div>

              {/* Pillars list */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Achievable Non-Surgical Pillars:
                </p>
                {selectedPreset.pillars.map((pillar) => (
                  <div
                    key={pillar.key}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{pillar.title}</span>
                      <span className="text-[11px] text-slate-500 ml-2">{pillar.summary}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200/50">
                      {pillar.modality}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className="cursor-pointer flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 text-center shadow-xs transition"
                >
                  ⚡ Try on Your Face Now
                </button>
                <a
                  href="/api/test-pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition"
                >
                  View Sample PDF ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
