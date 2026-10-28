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
        "prompt": "Confirm you are 18 or older.",
        "kind": "yesno"
      }
    ]
  },
  {
    "section": "about",
    "n": 2,
    "asks": [
      {
        "id": "dislikes",
        "prompt": "What would you most like to improve?",
        "hint": "Tell us your main goal in your own words.",
        "kind": "dislikes"
      },
      {
        "id": "places",
        "prompt": "Choose the areas you want to focus on.",
        "hint": "Choose up to three. These selections also control which areas an optional preview may edit.",
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
        ]
      }
    ]
  },
  {
    "section": "comfort",
    "n": 3,
    "asks": [
      {
        "id": "placeDetails",
        "prompt": "Which specific spots would you like us to focus on?",
        "hint": "Select the locations that match your concern.",
        "kind": "details"
      }
    ]
  },
  {
    "section": "about",
    "n": 4,
    "asks": [
      {
        "id": "protocolHairTexture",
        "prompt": "How would you describe your natural hair?",
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
      },
      {
        "id": "protocolHairGoal",
        "prompt": "What would you most like to change about your hair?",
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
      },
      {
        "id": "protocolHairRoutine",
        "prompt": "What do you currently use on your hair?",
        "kind": "text",
        "input": "line",
        "placeholder": "Shampoo, conditioner, styling products - or none"
      },
      {
        "id": "protocolHairReference",
        "prompt": "Describe your preferred haircut or paste a reference link",
        "kind": "text",
        "input": "line",
        "placeholder": "Keep curls, less width at the sides, natural top"
      },
      {
        "id": "protocolStylingTime",
        "prompt": "How much time would you spend styling each day?",
        "kind": "choice",
        "options": [
          {
            "value": "minimal",
            "label": "Under 5 minutes"
          },
          {
            "value": "moderate",
            "label": "5-10 minutes"
          },
          {
            "value": "flexible",
            "label": "More than 10 minutes"
          }
        ]
      }
    ]
  },
  {
    "section": "skin",
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
      },
      {
        "id": "protocolSensitivity",
        "prompt": "Does skincare often sting or irritate your skin?",
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
      },
      {
        "id": "protocolSkinRoutine",
        "prompt": "What skincare and prescribed treatments do you use?",
        "kind": "text",
        "input": "line",
        "placeholder": "Product names, frequency, or none"
      },
      {
        "id": "protocolSkinConcerns",
        "prompt": "Which skin concerns should the report address?",
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
    "section": "comfort",
    "n": 6,
    "asks": [
      {
        "id": "protocolBeardGoal",
        "prompt": "How would you like to wear your facial hair?",
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
      },
      {
        "id": "protocolGlasses",
        "prompt": "Would you like eyewear suggestions?",
        "kind": "choice",
        "options": [
          {
            "value": "yes",
            "label": "Yes"
          },
          {
            "value": "no",
            "label": "No"
          }
        ]
      }
    ]
  },
  {
    "section": "body",
    "n": 7,
    "asks": [
      {
        "id": "heightCm",
        "prompt": "Height (cm)",
        "kind": "height"
      },
      {
        "id": "weightKg",
        "prompt": "Weight (kg)",
        "kind": "weight"
      },
      {
        "id": "sleepHours",
        "prompt": "On a usual night, how much sleep do you get?",
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
      },
      {
        "id": "protocolDiet",
        "prompt": "Which eating pattern fits you?",
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
      },
      {
        "id": "protocolActivity",
        "prompt": "How often do you exercise now?",
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
      },
      {
        "id": "protocolEquipment",
        "prompt": "Where would you prefer to exercise?",
        "kind": "choice",
        "options": [
          {
            "value": "home",
            "label": "Home or outdoors"
          },
          {
            "value": "gym",
            "label": "Gym"
          },
          {
            "value": "none",
            "label": "No exercise plan wanted"
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
        "id": "protocolStyle",
        "prompt": "Which wardrobe direction suits your life?",
        "kind": "choice",
        "options": [
          {
            "value": "casual",
            "label": "Casual"
          },
          {
            "value": "smart",
            "label": "Smart casual"
          },
          {
            "value": "professional",
            "label": "Professional"
          },
          {
            "value": "maintain",
            "label": "Keep my current style"
          }
        ]
      },
      {
        "id": "protocolBudget",
        "prompt": "Monthly skincare and grooming budget?",
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
      },
      {
        "id": "protocolClinicBudget",
        "prompt": "Separate budget for a clinic consultation or treatment?",
        "kind": "text",
        "input": "line",
        "placeholder": "Optional - this does not change your monthly budget"
      }
    ]
  },
  {
    "section": "comfort",
    "n": 9,
    "asks": [
      {
        "id": "maxWilling",
        "prompt": "Which care options would you consider?",
        "kind": "choice",
        "options": [
          {
            "value": "skincare",
            "label": "Grooming, skincare and lifestyle only"
          },
          {
            "value": "laser",
            "label": "Also open to non-surgical clinic treatments"
          },
          {
            "value": "injections",
            "label": "Also open to injectable treatments"
          },
          {
            "value": "threads",
            "label": "Open to discussing other non-surgical options with a clinician"
          }
        ]
      },
      {
        "id": "downtime",
        "prompt": "What recovery time would fit your schedule?",
        "kind": "choice",
        "options": [
          {
            "value": "none",
            "label": "None"
          },
          {
            "value": "days2to3",
            "label": "2\u20133 days"
          },
          {
            "value": "oneWeek",
            "label": "1 week"
          },
          {
            "value": "twoWeeksOrMore",
            "label": "2 weeks or more"
          }
        ]
      },
      {
        "id": "priorTreatments",
        "prompt": "Any previous treatments the clinician should know about?",
        "kind": "text",
        "input": "line",
        "placeholder": "Optional - treatment and approximate date",
        "when": undefined
      },
      {
        "id": "clinicFlags",
        "prompt": "Do any of these apply to you?",
        "hint": "For clinician review only. This does not determine treatment suitability.",
        "kind": "multi",
        "options": [
          {
            "value": "pregnant",
            "label": "Pregnant or breastfeeding"
          },
          {
            "value": "isotretinoin",
            "label": "I have taken isotretinoin (acne tablets)"
          },
          {
            "value": "keloid",
            "label": "I get keloid scars"
          },
          {
            "value": "none",
            "label": "None of these"
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
        "id": "protocolPreserve",
        "prompt": "What must stay unchanged in your after image?",
        "kind": "text",
        "input": "line",
        "placeholder": "My face shape, curls, complexion, beard, or other features"
      },
      {
        "id": "wantAfterPhoto",
        "prompt": "Would you like an illustrative appearance preview?",
        "hint": "Optional. It shows a possible direction, not a promised treatment result.",
        "kind": "yesno"
      }
    ]
  }
];

export function asksFor(section: IntakeSectionId): NumberedAsk[] { return INTAKE_QUESTIONS.filter(question => question.section === section); }
export function allAsks(): Ask[] { return INTAKE_QUESTIONS.flatMap(question => question.asks); }
