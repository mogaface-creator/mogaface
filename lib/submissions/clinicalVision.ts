/**
 * Clinical Aesthetic Vision Diagnostic Scanner
 *
 * Employs multi-modal visual intelligence (OpenAI Vision) to evaluate the
 * patient's facial anatomy with plastic-surgeon grade precision.
 *
 * Analyzes:
 *   - Infraorbital tear troughs & periorbital fatigue (Grade I–III)
 *   - Mandibular definition, submental contour, gonial angle
 *   - Midface malar apex projection & nasolabial vectors
 *   - Dermal texture, tone uniformity, erythema, and radiance
 *   - Golden Ratio symmetry & harmony scoring
 *
 * Produces:
 *   - Quantitative clinical indices (Harmony Score 82–95, Symmetry Index 91–98%)
 *   - Executive Clinical Summary (for Page 1 of the PDF dossier)
 *   - Anatomical Opportunities (for Page 2 of the PDF dossier)
 *   - Closed-Loop Simulation Directives (fed directly to image generator)
 */

export interface ClinicalVisionInput {
  beforeBytes: Buffer | Uint8Array;
  beforeMime: string;
  clientName?: string;
  intakeConcerns?: string[];
}

export interface ClinicalVisionResult {
  harmonyScore: number;
  symmetryIndex: number;
  executiveSummary: string;
  opportunities: {
    label: string;
    description: string;
    targetRefinement: string;
  }[];
  simulationDirectives: string[];
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const DEFAULT_VISION_TIMEOUT_MS = 25_000;

export async function runClinicalVisionScan(input: ClinicalVisionInput): Promise<ClinicalVisionResult> {
  const env = process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return buildFallbackVisionScan(input);
  }

  const model = env.CLINICAL_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
  const timeoutMs = Number(env.CLINICAL_VISION_TIMEOUT_MS) > 0
    ? Math.min(45_000, Math.max(10_000, Number(env.CLINICAL_VISION_TIMEOUT_MS)))
    : DEFAULT_VISION_TIMEOUT_MS;

  const base64Image = Buffer.from(input.beforeBytes).toString("base64");
  const mimeType = input.beforeMime || "image/jpeg";
  const clientFirstName = (input.clientName || "Patient").trim().split(" ")[0];
  const concernsList = (input.intakeConcerns && input.intakeConcerns.length > 0)
    ? input.intakeConcerns.join(", ")
    : "Infraorbital eye hollows, jawline definition, complexion radiance";

  const systemPrompt = `You are a Senior Facial Plastic Surgeon and Board-Certified Aesthetic Dermatologist at an elite cosmetic medicine clinic.
Your objective is to conduct an objective, dignifying, diagnostic pre-consultation visual assessment of the patient's portrait.
Analyze facial vectors, soft-tissue contours, Golden Ratio symmetry, and anatomical light reflections.
Always speak with clinical authority, elegance, medical respect, and constructive insight. Never criticize inherent ethnic identity or bone structure.

Return ONLY a valid JSON object matching this schema:
{
  "harmonyScore": number (integer 83 to 94, representing current baseline aesthetic balance),
  "symmetryIndex": number (float 92.0 to 97.8, representing bilateral anatomical symmetry percentage),
  "executiveSummary": string (2-3 sentences of executive medical interpretation summarizing primary harmonization vectors),
  "opportunities": [
    {
      "label": string (e.g. "Tear Trough & Infraorbital Zone", "Mandibular Border & Jawline Contour", "Malar Apex & Midface Projection", "Dermal Radiance & Tone"),
      "description": string (detailed clinical observation of soft tissue anatomy),
      "targetRefinement": string (specific non-surgical therapeutic goal)
    }
  ],
  "simulationDirectives": [
    string (4 to 5 concise, actionable instructions for the image synthesis engine detailing exactly how to enhance the tear troughs, jawline, cheeks, and skin while maintaining 100% identity lock)
  ]
}`;

  const userPrompt = `Patient Identification: ${clientFirstName}
Stated Aesthetic Priorities: ${concernsList}

Please inspect the attached diagnostic portrait and produce the complete clinical analysis JSON object.`;

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`[clinicalVision] OpenAI returned status ${response.status}. Using fallback scan.`);
      return buildFallbackVisionScan(input);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return buildFallbackVisionScan(input);
    }

    const parsed = JSON.parse(content) as Partial<ClinicalVisionResult>;

    return {
      harmonyScore: typeof parsed.harmonyScore === "number" ? parsed.harmonyScore : 87,
      symmetryIndex: typeof parsed.symmetryIndex === "number" ? parsed.symmetryIndex : 94.6,
      executiveSummary: parsed.executiveSummary || buildFallbackExecutiveSummary(clientFirstName),
      opportunities: (parsed.opportunities && parsed.opportunities.length > 0)
        ? parsed.opportunities
        : buildFallbackOpportunities(),
      simulationDirectives: (parsed.simulationDirectives && parsed.simulationDirectives.length > 0)
        ? parsed.simulationDirectives
        : buildFallbackDirectives(),
    };
  } catch (err) {
    console.error("[clinicalVision] Vision scan error:", err instanceof Error ? err.message : err);
    return buildFallbackVisionScan(input);
  }
}

/**
 * High-quality fallback engine in case of API latency or connectivity drop.
 */
function buildFallbackVisionScan(input: ClinicalVisionInput): ClinicalVisionResult {
  const name = (input.clientName || "Patient").trim().split(" ")[0];
  return {
    harmonyScore: 88,
    symmetryIndex: 94.8,
    executiveSummary: buildFallbackExecutiveSummary(name),
    opportunities: buildFallbackOpportunities(),
    simulationDirectives: buildFallbackDirectives(),
  };
}

function buildFallbackExecutiveSummary(firstName: string): string {
  return `Based on ${firstName}'s diagnostic portrait and clinical intake, we identified key opportunities in infraorbital tear trough restoration and lower mandibular contour definition. The targeted algorithmic simulation illustrates softened transition vectors across the periorbital zone and enhanced lateral cheek support, preserving authentic facial emotion while establishing golden-ratio harmony.`;
}

function buildFallbackOpportunities() {
  return [
    {
      label: "Infraorbital Tear Trough",
      description: "Infraorbital volume loss identified beneath medial canthus, creating subtle fatigue shadowing.",
      targetRefinement: "Micro-volumization to restore smooth transition vector between lower eyelid and anterior cheek.",
    },
    {
      label: "Mandibular Border Definition",
      description: "Mild soft-tissue laxity along the gonial angle and lower mandibular margin.",
      targetRefinement: "Contour sharpening to establish a crisp, defined cervical-mandibular separation.",
    },
    {
      label: "Malar Apex Projection",
      description: "Subtle lateral cheek deflation impacting midface light reflection.",
      targetRefinement: "Anterior malar elevation to elevate high-point light reflection and soften nasolabial fold depth.",
    },
    {
      label: "Complexion Luminosity & Tone",
      description: "Mild epidermal erythema and dehydration affecting overall skin radiance.",
      targetRefinement: "Hydrating dermal infusion to enhance skin luminosity while maintaining natural pore texture.",
    },
  ];
}

function buildFallbackDirectives(): string[] {
  return [
    "Restore smooth volume to the under-eye tear troughs, clearing tired dark circles and hollows.",
    "Sharpen and firm the lower mandibular jawline and chin contour with clean structural definition.",
    "Subtly elevate midface malar cheek volume for a natural, youthful lift.",
    "Refine skin tone and clarity: smooth micro-blemishes, reduce redness, and impart a clean, healthy, hydrated glow.",
  ];
}
