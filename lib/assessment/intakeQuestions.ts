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
    "section": "report",
    "n": 2,
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
    "n": 3,
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
    "n": 4,
    "asks": [
      {
        "id": "protocolHairGoal",
        "prompt": "What is your main hair goal?",
        "kind": "choice",
        "options": [
          {
            "value": "styling",
            "label": "Haircut and styling"
          },
          {
            "value": "frizz",
            "label": "Frizz and manageability"
          },
          {
            "value": "density",
            "label": "Thinning or density"
          },
          {
            "value": "maintain",
            "label": "Keep it as it is"
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
        "id": "protocolSkinType",
        "prompt": "How does your skin usually feel?",
        "kind": "choice",
        "options": [
          {
            "value": "oily",
            "label": "Oily"
          },
          {
            "value": "dry",
            "label": "Dry or tight"
          },
          {
            "value": "combination",
            "label": "Oily in some areas, dry in others"
          },
          {
            "value": "balanced",
            "label": "Comfortable"
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
        "id": "sleepHours",
        "prompt": "How much do you usually sleep?",
        "kind": "choice",
        "options": [
          {
            "value": "5orLess",
            "label": "5 or less"
          },
          {
            "value": "6",
            "label": "6"
          },
          {
            "value": "7",
            "label": "7"
          },
          {
            "value": "8",
            "label": "8"
          },
          {
            "value": "9orMore",
            "label": "9 or more"
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
        "id": "protocolDiet",
        "prompt": "What is your diet?",
        "kind": "choice",
        "options": [
          {
            "value": "mixed",
            "label": "Mixed diet"
          },
          {
            "value": "vegetarian",
            "label": "Vegetarian"
          },
          {
            "value": "vegan",
            "label": "Vegan"
          },
          {
            "value": "other",
            "label": "Other or prefer not to say"
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
        "id": "protocolActivity",
        "prompt": "How often do you exercise?",
        "kind": "choice",
        "options": [
          {
            "value": "none",
            "label": "Not regularly"
          },
          {
            "value": "light",
            "label": "1-2 days a week"
          },
          {
            "value": "regular",
            "label": "3 or more days a week"
          }
        ]
      }
    ]
  },
  {
    "section": "report",
    "n": 12,
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
    "n": 13,
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
    "n": 14,
    "asks": [
      {
        "id": "wantAfterPhoto",
        "prompt": "Would you like an after preview?",
        "kind": "yesno",
        "hint": "An illustration, not a promised treatment result."
      }
    ]
  }
];

export function asksFor(section: IntakeSectionId): NumberedAsk[] { return INTAKE_QUESTIONS.filter(question => question.section === section); }
export function allAsks(): Ask[] { return INTAKE_QUESTIONS.flatMap(question => question.asks); }
