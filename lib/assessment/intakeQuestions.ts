/**
 * The clinic questionnaire, one ask at a time, in the words it was given.
 * A numbered item can contain several asks. Each ask is answered on its own.
 * Nothing here is a diagnosis or a treatment recommendation.
 */

export type IntakeSectionId = "about" | "comfort" | "breathing" | "body" | "skin" | "recovery" | "report";

export interface AskOption {
  value: string;
  label: string;
}

export interface AskWhen {
  /** Show this ask only when every listed answer equals `is`, or when any does if `any` is set. */
  id?: string;
  any?: string[];
  is: string;
}

export interface Ask {
  id: string;
  prompt: string;
  kind: "yesno" | "text" | "score" | "choice" | "multi" | "height" | "weight" | "dislikes" | "places";
  options?: AskOption[];
  max?: number;
  when?: AskWhen;
}

export interface NumberedAsk {
  section: IntakeSectionId;
  n: number;
  asks: Ask[];
}

const yesNo = (id: string, prompt: string, when?: AskWhen): Ask => ({ id, prompt, kind: "yesno", when });
const text = (id: string, prompt: string, when?: AskWhen): Ask => ({ id, prompt, kind: "text", when });

export const INTAKE_QUESTIONS: NumberedAsk[] = [
  {
    section: "about",
    n: 1,
    asks: [
      yesNo("ageConfirmed", "Are you 18 or above?"),
      yesNo("directWordsOk", "Are you okay with us describing your face in plain, direct words, based on measurements?"),
    ],
  },
  {
    section: "about",
    n: 2,
    asks: [
      { id: "botherScore", prompt: "How much does your face bother you in daily life? (0 = not at all, 10 = a lot)", kind: "score" },
      text("mirrorTime", "How much time do you spend every day looking in the mirror, comparing yourself, or editing your photos?"),
    ],
  },
  {
    section: "about",
    n: 3,
    asks: [yesNo("toldWorriesMore", "Has anyone ever told you that you worry about your looks more than needed?")],
  },
  {
    section: "about",
    n: 4,
    asks: [
      {
        id: "reportWant",
        prompt: "What do you want most from this report?",
        kind: "choice",
        options: [
          { value: "understand", label: "Understand my face" },
          { value: "plan", label: "Get a step-by-step plan" },
          { value: "secondOpinion", label: "A second opinion on a treatment I am already considering" },
          { value: "reassurance", label: "Just honest reassurance" },
        ],
      },
    ],
  },
  {
    section: "about",
    n: 5,
    asks: [
      {
        id: "dislikes",
        prompt: "Which 3 things about your face do you dislike the most? Write them in your own words, most important first. Also tell us how long each has bothered you.",
        kind: "dislikes",
      },
      {
        id: "places",
        prompt: "Which of these places should the illustrative after change? Pick up to 3. The picture changes only these places.",
        kind: "places",
      },
    ],
  },
  {
    section: "about",
    n: 6,
    asks: [
      {
        id: "lookDirections",
        prompt: "What do you want your face to look like? Pick your top two.",
        kind: "multi",
        max: 2,
        options: [
          { value: "masculine", label: "More masculine" },
          { value: "feminine", label: "More feminine" },
          { value: "younger", label: "Younger" },
          { value: "fresh", label: "More fresh and awake" },
          { value: "friendly", label: "More friendly" },
          { value: "sharp", label: "More sharp and striking" },
        ],
      },
    ],
  },
  {
    section: "about",
    n: 7,
    asks: [text("event", "Is there any date or event you are preparing for, like a wedding, shoot, job change, or competition? Please mention the date.")],
  },
  {
    section: "comfort",
    n: 8,
    asks: [text("spendNext12Months", "How much money are you realistically ready to spend on your face in the next 12 months?")],
  },
  {
    section: "comfort",
    n: 9,
    asks: [
      {
        id: "maxWilling",
        prompt: "What is the maximum you are willing to do?",
        kind: "choice",
        options: [
          { value: "skincare", label: "Only skincare and lifestyle changes" },
          { value: "laser", label: "Laser and machine treatments" },
          { value: "injections", label: "Injections like Botox, fillers, skin boosters" },
          { value: "threads", label: "Threads" },
          { value: "surgery", label: "Surgery" },
        ],
      },
    ],
  },
  {
    section: "comfort",
    n: 10,
    asks: [
      {
        id: "downtime",
        prompt: "How many days of visible swelling, redness or marks can you manage at one time?",
        kind: "choice",
        options: [
          { value: "none", label: "None" },
          { value: "days2to3", label: "2–3 days" },
          { value: "oneWeek", label: "1 week" },
          { value: "twoWeeksOrMore", label: "2 weeks or more" },
        ],
      },
    ],
  },
  {
    section: "comfort",
    n: 11,
    asks: [
      yesNo("hadPriorWork", "Have you already had anything done to your face?"),
      text(
        "priorTreatments",
        "Please list it with dates — Botox, fillers, threads, laser, nose surgery, braces, implants, hair transplant, anything else.",
        { id: "hadPriorWork", is: "yes" },
      ),
    ],
  },
  {
    section: "breathing",
    n: 12,
    asks: [
      yesNo("mouthBreathing", "Do you breathe through your mouth while sleeping?"),
      yesNo("dryMouth", "Do you wake up with a dry mouth?"),
      yesNo("snore", "Do you snore?"),
      yesNo("allergies", "Do you have dust or seasonal allergies?"),
      yesNo("blockedNose", "Do you have a blocked nose?"),
      yesNo("deviatedSeptum", "Do you have a deviated septum?"),
      yesNo("sleepApnoea", "Do you have sleep apnoea?"),
      yesNo("tonsilsRemoved", "Were your tonsils or adenoids removed as a child?"),
      text("tonsilsAge", "Tell us roughly at what age.", { id: "tonsilsRemoved", is: "yes" }),
    ],
  },
  {
    section: "breathing",
    n: 13,
    asks: [
      yesNo("hadBraces", "Did you have braces?"),
      yesNo("hadExpander", "Did you have an expander?"),
      yesNo("hadHeadgear", "Did you have headgear?"),
      yesNo("hadRetainer", "Did you have a retainer?"),
      yesNo("teethRemoved", "Were any teeth removed?"),
      text("teethRemovedDetail", "Which ones, and at what age?", { id: "teethRemoved", is: "yes" }),
      yesNo("thumbSuck", "As a child, did you suck your thumb?"),
      yesNo("bottlePacifier", "Did you use a bottle or pacifier for a long time?"),
      yesNo("tongueTie", "Do you have tongue tie?"),
      yesNo("tonguePush", "Do you push your tongue against your teeth?"),
      yesNo("chewOneSide", "Do you chew mostly on one side?"),
      {
        id: "foodTexture",
        prompt: "Is your daily food mostly soft (rice, dal, bread), or do you chew hard foods often?",
        kind: "choice",
        options: [
          { value: "soft", label: "Mostly soft (rice, dal, bread)" },
          { value: "hard", label: "I chew hard foods often" },
          { value: "both", label: "Both" },
        ],
      },
    ],
  },
  {
    section: "breathing",
    n: 14,
    asks: [
      yesNo("jawClick", "Does your jaw click?"),
      yesNo("jawLock", "Does your jaw lock?"),
      yesNo("jawSore", "Does your jaw feel sore in the morning?"),
      yesNo("clenchGrind", "Do you clench or grind your teeth?"),
      yesNo("lipsClose", "Can you keep your lips gently closed without any effort?"),
      yesNo("forwardHead", "Do you notice your head going forward or shoulders rounding while sitting at a desk or phone?"),
    ],
  },
  {
    section: "body",
    n: 15,
    asks: [
      { id: "heightCm", prompt: "Your height (cm).", kind: "height" },
      { id: "weightKg", prompt: "Your current weight (kg).", kind: "weight" },
      text("waist", "Your waist size."),
      text("bodyFat", "Your body fat percentage, if you know it."),
      {
        id: "bodyFatMethod",
        prompt: "How was that body fat measured?",
        kind: "choice",
        options: [
          { value: "dexa", label: "DEXA" },
          { value: "inbody", label: "InBody" },
          { value: "gym", label: "Machine at the gym" },
          { value: "guess", label: "Just a guess" },
          { value: "unknown", label: "I don't know it" },
        ],
      },
      {
        id: "familyHeight",
        prompt: "Are you taller or shorter than your family?",
        kind: "choice",
        options: [
          { value: "taller", label: "Taller" },
          { value: "shorter", label: "Shorter" },
          { value: "same", label: "About the same" },
        ],
      },
      text("pubertyAge", "At roughly what age did puberty start for you?"),
    ],
  },
  {
    section: "body",
    n: 16,
    asks: [
      text("exerciseType", "What exercise do you do?"),
      text("exerciseHours", "How many hours a week?"),
      text("exerciseYears", "For how many years without long breaks?"),
      text("run5k", "Your best current 5 km run time, if you have it."),
      text("hyrox", "Your best current HYROX or race timing, if you have it."),
      text("lifts", "Your heaviest lifts, if you have them."),
      text("gymSessions", "Gym sessions per week, if you have them."),
    ],
  },
  {
    section: "body",
    n: 17,
    asks: [
      text("lowestWeight", "What is the lowest weight you have been as an adult?"),
      text("highestWeight", "What is the highest weight you have been as an adult?"),
      text("weightChange2y", "How much weight have you gained or lost in the last 2 years?"),
      {
        id: "weightNow",
        prompt: "Right now, are you losing fat, maintaining, or gaining muscle/weight?",
        kind: "choice",
        options: [
          { value: "losing", label: "Losing fat" },
          { value: "maintaining", label: "Maintaining" },
          { value: "gaining", label: "Gaining muscle/weight" },
        ],
      },
      yesNo("faceChangesWithWeight", "Does your face clearly look different when your weight changes?"),
    ],
  },
  {
    section: "skin",
    n: 18,
    asks: [
      {
        id: "skinProblems",
        prompt: "What are your main skin problems?",
        kind: "multi",
        options: [
          { value: "pimples", label: "Pimples" },
          { value: "darkMarks", label: "Dark marks left after pimples" },
          { value: "melasma", label: "Melasma or patches" },
          { value: "redness", label: "Redness" },
          { value: "roughTexture", label: "Rough texture" },
          { value: "looseSkin", label: "Loose skin" },
          { value: "darkCircles", label: "Dark circles" },
        ],
      },
      yesNo("marksEasily", "Do you get dark marks or thick scars easily after a pimple or cut?"),
      text("dailyProducts", "What products do you use daily?"),
      yesNo("isotretinoin", "Have you ever taken isotretinoin (acne tablets)?"),
      yesNo("steroidCreams", "Have you used steroid creams?"),
    ],
  },
  {
    section: "skin",
    n: 19,
    asks: [
      yesNo("thyroid", "Do you have a thyroid condition?"),
      yesNo("pcos", "Do you have PCOS or hormone issues?"),
      yesNo("diabetes", "Do you have diabetes or insulin resistance?"),
      yesNo("autoimmune", "Do you have an autoimmune disease?"),
      yesNo("lowHaemoglobin", "Do you have low haemoglobin?"),
      yesNo("keloid", "Do you get keloid scars?"),
      text("medicines", "What medicines and supplements do you take now?"),
      {
        id: "pregnantOrBreastfeeding",
        prompt: "Are you pregnant or breastfeeding?",
        kind: "choice",
        options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
          { value: "notApplicable", label: "Not applicable" },
        ],
      },
      text("allergies", "Any allergies?"),
      yesNo("anaesthesiaReaction", "Have you had a bad reaction to local anaesthesia in the past?"),
    ],
  },
  {
    section: "recovery",
    n: 20,
    asks: [
      text("sleepHours", "Thinking about the last 3 months: how many hours do you sleep?"),
      yesNo("sleepSameTime", "Is it at the same time daily?"),
    ],
  },
  {
    section: "recovery",
    n: 21,
    asks: [
      {
        id: "morningPuffiness",
        prompt: "Does your face or eyelids look puffy in the morning?",
        kind: "choice",
        options: [
          { value: "never", label: "Never" },
          { value: "sometimes", label: "Sometimes" },
          { value: "daily", label: "Daily" },
        ],
      },
    ],
  },
  {
    section: "recovery",
    n: 22,
    asks: [
      yesNo("tracksHeart", "Do you track resting heart rate or HRV?"),
      {
        id: "heartTrend",
        prompt: "Is it going up or down?",
        kind: "choice",
        when: { id: "tracksHeart", is: "yes" },
        options: [
          { value: "up", label: "Going up" },
          { value: "down", label: "Going down" },
          { value: "neither", label: "Neither" },
        ],
      },
    ],
  },
  {
    section: "recovery",
    n: 23,
    asks: [text("tiredDays", "How many days a month do you feel unusually tired, heavy-legged, or sore for more than 3 days?")],
  },
  {
    section: "recovery",
    n: 24,
    asks: [
      yesNo("sickOften", "Have you fallen sick often?"),
      yesNo("gas", "Any gas?"),
      yesNo("bloating", "Any bloating?"),
      yesNo("acidity", "Any acidity?"),
      yesNo("looseMotions", "Any loose motions?"),
      yesNo("eczema", "Do you get eczema?"),
      yesNo("rosacea", "Do you get rosacea?"),
      yesNo("dandruff", "Do you get dandruff?"),
      yesNo("pimpleFlares", "Do you get pimple flare-ups?"),
      text("flareTriggers", "What seems to trigger them?", { any: ["eczema", "rosacea", "dandruff", "pimpleFlares"], is: "yes" }),
    ],
  },
  {
    section: "recovery",
    n: 25,
    asks: [
      text("alcohol", "How much alcohol do you use?"),
      text("nicotine", "How much tobacco or nicotine do you use?"),
      text("water", "Roughly how much water do you take daily?"),
      text("salt", "Roughly how much salt do you take daily?"),
      { id: "stressOutOf10", prompt: "Stress level out of 10?", kind: "score" },
      text("sun", "How much sun do you get?"),
      yesNo("sunscreen", "Do you use sunscreen daily?"),
      {
        id: "trainingPhase",
        prompt: "Right now, are you in a heavy training phase, or feeling burnt out?",
        kind: "choice",
        options: [
          { value: "heavy", label: "Heavy training phase" },
          { value: "burntOut", label: "Feeling burnt out" },
          { value: "neither", label: "Neither" },
        ],
      },
    ],
  },
  {
    section: "report",
    n: 26,
    asks: [
      {
        id: "reportTone",
        prompt: "How should we write your report?",
        kind: "choice",
        options: [
          { value: "blunt", label: "Very blunt and direct" },
          { value: "gentle", label: "Honest but gentle" },
        ],
      },
    ],
  },
  {
    section: "report",
    n: 27,
    asks: [
      {
        id: "reportOrder",
        prompt: "Do you want the measurements first, or the action plan first?",
        kind: "choice",
        options: [
          { value: "measurementsFirst", label: "Measurements first" },
          { value: "planFirst", label: "Action plan first" },
        ],
      },
      yesNo("wantAfterPhoto", "Do you want an edited after photo? Any such photo is only an example of the direction, not a promise of the result."),
    ],
  },
];

export function asksFor(section: IntakeSectionId): NumberedAsk[] {
  return INTAKE_QUESTIONS.filter((question) => question.section === section);
}

export function allAsks(): Ask[] {
  return INTAKE_QUESTIONS.flatMap((question) => question.asks);
}
