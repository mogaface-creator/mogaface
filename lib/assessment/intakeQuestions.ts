/**
 * Eighteen questions. Each one is a single answer, and each answer is used:
 * the places and the "where" chips decide the after photo, and the rest is
 * what the clinic reads with the three photos. Nothing here is a diagnosis
 * or a treatment recommendation.
 */

export type IntakeSectionId = "about" | "comfort" | "breathing" | "body" | "skin" | "recovery" | "report";

export interface AskOption {
  value: string;
  label: string;
}

export interface AskWhen {
  id?: string;
  any?: string[];
  is?: string;
  filled?: boolean;
}

export interface Ask {
  id: string;
  prompt: string;
  kind: "yesno" | "text" | "score" | "choice" | "multi" | "height" | "weight" | "dislikes" | "places" | "details";
  options?: AskOption[];
  max?: number;
  when?: AskWhen;
  hint?: string;
  input?: "line" | "area";
  placeholder?: string;
}

export interface NumberedAsk {
  section: IntakeSectionId;
  n: number;
  asks: Ask[];
}

const yesNo = (id: string, prompt: string, when?: AskWhen): Ask => ({ id, prompt, kind: "yesno", when });
const line = (id: string, prompt: string, placeholder?: string, when?: AskWhen): Ask => ({ id, prompt, kind: "text", input: "line", placeholder, when });
const choice = (id: string, prompt: string, options: AskOption[], extra?: Partial<Ask>): Ask => ({ id, prompt, kind: "choice", options, ...extra });

/** Places the after photo can actually change. Volume, lifting, and "overall" are not here, because they do not become an image. */
export const IMAGE_PLACE_OPTIONS: AskOption[] = [
  { value: "FACIAL_LINES", label: "Expression lines" },
  { value: "FACIAL_DEFINITION", label: "Facial contour" },
  { value: "UNDER_EYE", label: "Under-eyes" },
  { value: "SKIN_TEXTURE", label: "Skin texture" },
  { value: "SKIN_TONE", label: "Skin tone" },
  { value: "PIGMENTATION", label: "Dark spots" },
  { value: "BLEMISHES", label: "Blemishes" },
  { value: "HAIR", label: "Hair" },
];

export const INTAKE_QUESTIONS: NumberedAsk[] = [
  {
    section: "about",
    n: 1,
    asks: [yesNo("ageConfirmed", "Are you 18 or above?")],
  },
  {
    section: "about",
    n: 2,
    asks: [yesNo("directWordsOk", "Okay with plain, direct words, based on measurements?")],
  },
  {
    section: "about",
    n: 3,
    asks: [
      choice("reportWant", "What do you want most from this?", [
        { value: "understand", label: "Understand my face" },
        { value: "plan", label: "Get a step-by-step plan" },
        { value: "secondOpinion", label: "A second opinion on something I am already considering" },
        { value: "reassurance", label: "Just honest reassurance" },
      ]),
    ],
  },
  {
    section: "about",
    n: 4,
    asks: [
      {
        id: "dislikes",
        prompt: "What bothers you most about your face?",
        hint: "One thing, in your own words.",
        kind: "dislikes",
      },
    ],
  },
  {
    section: "about",
    n: 5,
    asks: [
      choice("dislikeDuration", "How long has that bothered you?", [
        { value: "under1", label: "Under a year" },
        { value: "1to2", label: "1–2 years" },
        { value: "3to5", label: "3–5 years" },
        { value: "over5", label: "More than 5 years" },
      ]),
    ],
  },
  {
    section: "comfort",
    n: 6,
    asks: [
      {
        id: "places",
        prompt: "Which places should the after photo change?",
        hint: "Pick up to 3. The photo changes only these places.",
        kind: "places",
        max: 3,
        options: IMAGE_PLACE_OPTIONS,
      },
    ],
  },
  {
    section: "comfort",
    n: 7,
    asks: [
      {
        id: "placeDetails",
        prompt: "Where should that change show?",
        hint: "Pick the spots that match what you see. The photo uses these.",
        kind: "details",
      },
    ],
  },
  {
    section: "about",
    n: 8,
    asks: [
      {
        id: "lookDirections",
        prompt: "How do you want your face to come across?",
        hint: "Pick up to 2. This is for the clinic. It does not change the photo.",
        kind: "multi",
        max: 2,
        options: [
          { value: "masculine", label: "More masculine" },
          { value: "feminine", label: "More feminine" },
          { value: "fresh", label: "More fresh and awake" },
          { value: "friendly", label: "More friendly" },
          { value: "sharp", label: "More sharp" },
        ],
      },
    ],
  },
  {
    section: "comfort",
    n: 9,
    asks: [
      choice("maxWilling", "What is the most you are willing to do?", [
        { value: "skincare", label: "Skincare and lifestyle only" },
        { value: "laser", label: "Laser and machine treatments" },
        { value: "injections", label: "Injections like Botox, fillers, skin boosters" },
        { value: "threads", label: "Threads" },
        { value: "surgery", label: "Surgery" },
      ]),
    ],
  },
  {
    section: "comfort",
    n: 10,
    asks: [
      choice("downtime", "How much visible downtime can you manage?", [
        { value: "none", label: "None" },
        { value: "days2to3", label: "2–3 days" },
        { value: "oneWeek", label: "1 week" },
        { value: "twoWeeksOrMore", label: "2 weeks or more" },
      ]),
    ],
  },
  {
    section: "comfort",
    n: 11,
    asks: [yesNo("hadPriorWork", "Have you already had anything done to your face?")],
  },
  {
    section: "comfort",
    n: 12,
    asks: [
      line("priorTreatments", "What was done, and when?", "Botox, fillers, laser, surgery", { id: "hadPriorWork", is: "yes" }),
    ],
  },
  {
    section: "body",
    n: 13,
    asks: [
      { id: "heightCm", prompt: "Height (cm)", kind: "height" },
      { id: "weightKg", prompt: "Weight (kg)", kind: "weight" },
    ],
  },
  {
    section: "recovery",
    n: 14,
    asks: [
      choice("sleepHours", "How many hours do you sleep?", [
        { value: "5orLess", label: "5 or less" },
        { value: "6", label: "6" },
        { value: "7", label: "7" },
        { value: "8", label: "8" },
        { value: "9orMore", label: "9 or more" },
      ]),
    ],
  },
  {
    section: "skin",
    n: 15,
    asks: [
      {
        id: "clinicFlags",
        prompt: "Should the clinic know any of these?",
        hint: "Pick every one that applies.",
        kind: "multi",
        options: [
          { value: "pregnant", label: "Pregnant or breastfeeding" },
          { value: "isotretinoin", label: "I have taken isotretinoin (acne tablets)" },
          { value: "keloid", label: "I get keloid scars" },
          { value: "none", label: "None of these" },
        ],
      },
    ],
  },
  {
    section: "report",
    n: 16,
    asks: [yesNo("hasEvent", "Are you preparing for a date or event?")],
  },
  {
    section: "report",
    n: 17,
    asks: [line("event", "What is it, and when?", "Wedding, June 2027", { id: "hasEvent", is: "yes" })],
  },
  {
    section: "report",
    n: 18,
    asks: [
      {
        id: "wantAfterPhoto",
        prompt: "Do you want an edited after photo?",
        hint: "Only an example of the direction, not a promise of the result.",
        kind: "yesno",
      },
    ],
  },
];

export function asksFor(section: IntakeSectionId): NumberedAsk[] {
  return INTAKE_QUESTIONS.filter((question) => question.section === section);
}

export function allAsks(): Ask[] {
  return INTAKE_QUESTIONS.flatMap((question) => question.asks);
}
