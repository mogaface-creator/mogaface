/** Report-focused questionnaire. Stable answer IDs preserve saved assessment compatibility. */
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

export const IMAGE_PLACE_OPTIONS: AskOption[] = [
  {
    "value": "FACIAL_LINES",
    "label": "Expression lines"
  },
  {
    "value": "FACIAL_DEFINITION",
    "label": "Facial contour"
  },
  {
    "value": "UNDER_EYE",
    "label": "Under-eyes"
  },
  {
    "value": "SKIN_TEXTURE",
    "label": "Skin texture"
  },
  {
    "value": "SKIN_TONE",
    "label": "Skin tone"
  },
  {
    "value": "PIGMENTATION",
    "label": "Dark spots"
  },
  {
    "value": "BLEMISHES",
    "label": "Blemishes"
  },
  {
    "value": "HAIR",
    "label": "Hair"
  }
];

export const INTAKE_QUESTIONS: NumberedAsk[] = [
  {
    "section": "about",
    "n": 1,
    "asks": [
      {
        "id": "ageConfirmed",
        "prompt": "Are you 18 or older?",
        "kind": "yesno"
      }
    ]
  },
  {
    "section": "about",
    "n": 2,
    "asks": [
      {
        "id": "protocolAgeRange",
        "prompt": "What is your age range?",
        "kind": "choice",
        "options": [
          { "value": "18to24", "label": "18-24" },
          { "value": "25to34", "label": "25-34" },
          { "value": "35to44", "label": "35-44" },
          { "value": "45to54", "label": "45-54" },
          { "value": "55plus", "label": "55 or older" },
          { "value": "preferNot", "label": "Prefer not to say" }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 3,
    "asks": [
      {
        "id": "places",
        "prompt": "What would you like to improve?",
        "kind": "places",
        "max": 3,
        "options": [
          {
            "value": "FACIAL_LINES",
            "label": "Expression lines"
          },
          {
            "value": "FACIAL_DEFINITION",
            "label": "Facial contour"
          },
          {
            "value": "UNDER_EYE",
            "label": "Under-eyes"
          },
          {
            "value": "SKIN_TEXTURE",
            "label": "Skin texture"
          },
          {
            "value": "SKIN_TONE",
            "label": "Skin tone"
          },
          {
            "value": "PIGMENTATION",
            "label": "Dark spots"
          },
          {
            "value": "BLEMISHES",
            "label": "Blemishes"
          },
          {
            "value": "HAIR",
            "label": "Hair"
          }
        ],
        "hint": "Choose up to 3 areas."
      }
    ]
  },
  {
    "section": "report",
    "n": 4,
    "asks": [
      {
        "id": "protocolHairTexture",
        "prompt": "What is your natural hair type?",
        "kind": "choice",
        "options": [
          {
            "value": "straight",
            "label": "Straight"
          },
          {
            "value": "wavy",
            "label": "Wavy"
          },
          {
            "value": "curly",
            "label": "Curly"
          },
          {
            "value": "coily",
            "label": "Coily"
          },
          {
            "value": "bald",
            "label": "Bald or shaved"
          },
          {
            "value": "notSure",
            "label": "Not sure"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 5,
    "asks": [
      {
        "id": "protocolHairGoal",
        "prompt": "What hairstyle do you prefer?",
        "kind": "choice",
        "options": [
          {
            "value": "short",
            "label": "Short and neat"
          },
          {
            "value": "texture",
            "label": "Natural and textured"
          },
          {
            "value": "volume",
            "label": "More volume"
          },
          {
            "value": "maintain",
            "label": "Keep my current style"
          },
          {
            "value": "notSure",
            "label": "Not sure yet"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 6,
    "asks": [
      {
        "id": "protocolSkinConcerns",
        "prompt": "What are your main skin concerns?",
        "kind": "multi",
        "options": [
          {
            "value": "breakouts",
            "label": "New breakouts"
          },
          {
            "value": "marks",
            "label": "Flat dark marks"
          },
          {
            "value": "scars",
            "label": "Indented or raised scars"
          },
          {
            "value": "texture",
            "label": "Texture or visible pores"
          },
          {
            "value": "redness",
            "label": "Redness"
          },
          {
            "value": "none",
            "label": "Maintenance only"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 7,
    "asks": [
      {
        "id": "protocolSensitivity",
        "prompt": "Is your skin sensitive?",
        "kind": "choice",
        "options": [
          {
            "value": "yes",
            "label": "Yes"
          },
          {
            "value": "no",
            "label": "No"
          },
          {
            "value": "notSure",
            "label": "Not sure"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 8,
    "asks": [
      {
        "id": "protocolBeardGoal",
        "prompt": "Which facial-hair style do you prefer?",
        "kind": "choice",
        "options": [
          {
            "value": "clean",
            "label": "Clean shaven"
          },
          {
            "value": "stubble",
            "label": "Short stubble"
          },
          {
            "value": "beard",
            "label": "Defined beard"
          },
          {
            "value": "maintain",
            "label": "Keep my current style"
          },
          {
            "value": "notApplicable",
            "label": "Not applicable"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 9,
    "asks": [
      {
        "id": "protocolBudget",
        "prompt": "What is your monthly care budget?",
        "kind": "choice",
        "options": [
          {
            "value": "under1000",
            "label": "Under INR 1,000"
          },
          {
            "value": "1000to3000",
            "label": "INR 1,000-3,000"
          },
          {
            "value": "3000plus",
            "label": "Above INR 3,000"
          },
          {
            "value": "notSure",
            "label": "Not decided"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 10,
    "asks": [
      {
        "id": "maxWilling",
        "prompt": "Which care options would you consider?",
        "kind": "choice",
        "options": [
          {
            "value": "skincare",
            "label": "Grooming and skincare"
          },
          {
            "value": "laser",
            "label": "Non-surgical clinic treatments"
          },
          {
            "value": "injections",
            "label": "Also open to injectables"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 11,
    "asks": [
      {
        "id": "wantAfterPhoto",
        "prompt": "Would you like an after preview?",
        "kind": "yesno",
        "hint": "An illustration, not a promised treatment result."
      }
    ]
  },
  {
    "section": "report",
    "n": 12,
    "asks": [
      {
        "id": "protocolHeight",
        "prompt": "Height (cm)",
        "kind": "height",
        "hint": "Optional - used only to describe your starting point."
      },
      {
        "id": "protocolWeight",
        "prompt": "Weight (kg)",
        "kind": "weight",
        "hint": "Optional - used only to describe your starting point."
      }
    ]
  },
  {
    "section": "report",
    "n": 13,
    "asks": [
      {
        "id": "protocolDiet",
        "prompt": "Which best describes your usual eating pattern?",
        "kind": "choice",
        "options": [
          { "value": "omnivore", "label": "I eat both plant and animal foods" },
          { "value": "vegetarian", "label": "Vegetarian" },
          { "value": "vegan", "label": "Vegan" },
          { "value": "other", "label": "Other" },
          { "value": "preferNot", "label": "Prefer not to say" }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 14,
    "asks": [
      {
        "id": "protocolActivity",
        "prompt": "How often are you physically active in a usual week?",
        "kind": "choice",
        "options": [
          { "value": "lessThanOnce", "label": "Less than once a week" },
          { "value": "1to2PerWeek", "label": "1-2 days" },
          { "value": "3to4PerWeek", "label": "3-4 days" },
          { "value": "5plusPerWeek", "label": "5 or more days" },
          { "value": "preferNot", "label": "Prefer not to say" }
        ]
      }
    ]
  }
];

export function asksFor(section: IntakeSectionId): NumberedAsk[] { return INTAKE_QUESTIONS.filter(question => question.section === section); }
export function allAsks(): Ask[] { return INTAKE_QUESTIONS.flatMap(question => question.asks); }
