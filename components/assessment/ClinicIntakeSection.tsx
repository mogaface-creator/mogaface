"use client";

import type { ReactNode } from "react";
import { StepNav } from "./StepNav";
import { MultiChoiceGroup, SingleChoiceGroup } from "./ChoiceGroup";
import { concernLabel, detailsOfConcern, isAppearanceConcernId, toggleDetail, type AppearanceConcernDetailId } from "@/lib/assessment/appearanceConcerns.ts";
import {
  CLINIC_PLACES,
  DOWNTIME,
  MAX_WILLING,
  projectBody,
  projectPlaces,
  PUFFINESS,
  REPORT_ORDER,
  REPORT_TONE,
  SKIN_PROBLEMS,
  TRAINING_PHASE,
  withIntake,
  type ClinicIntake,
  type ClinicPlace,
} from "@/lib/assessment/clinicIntake.ts";
import type { Assessment } from "@/lib/assessment/types.ts";

const FIELD = "mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-6">
      <p className="text-xs text-muted tabular-nums">{String(n).padStart(2, "0")}</p>
      <h3 className="mt-2 text-base font-medium leading-6">{title}</h3>
      {hint && <p className="mt-2 text-sm leading-6 text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function TextAnswer({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className={FIELD} />
    </label>
  );
}

function placeLabel(place: ClinicPlace): string {
  if (place === "HAIR") return "Hair";
  return isAppearanceConcernId(place) ? concernLabel(place) : place;
}

const YES_NO = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
];

export type IntakeSectionId = "about" | "comfort" | "breathing" | "body" | "skin" | "recovery" | "report";

interface ClinicIntakeSectionProps {
  section: IntakeSectionId;
  assessment: Assessment;
  onChange: (next: Assessment) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ClinicIntakeSection({ section, assessment, onChange, onNext, onBack }: ClinicIntakeSectionProps) {
  const intake = assessment.clinicIntake;
  const set = (partial: Partial<ClinicIntake>) => onChange(withIntake(assessment, partial));

  if (section === "about") return <About assessment={assessment} intake={intake} set={set} onChange={onChange} onNext={onNext} onBack={onBack} />;
  if (section === "comfort") return <Comfort intake={intake} set={set} onNext={onNext} onBack={onBack} />;
  if (section === "breathing") return <Breathing intake={intake} set={set} onNext={onNext} onBack={onBack} />;
  if (section === "body") return <Body assessment={assessment} intake={intake} set={set} onChange={onChange} onNext={onNext} onBack={onBack} />;
  if (section === "skin") return <Skin intake={intake} set={set} onNext={onNext} onBack={onBack} />;
  if (section === "recovery") return <Recovery intake={intake} set={set} onNext={onNext} onBack={onBack} />;
  return <Report intake={intake} set={set} onNext={onNext} onBack={onBack} />;
}

function About({
  assessment,
  intake,
  set,
  onChange,
  onNext,
  onBack,
}: {
  assessment: Assessment;
  intake: ClinicIntake;
  set: (partial: Partial<ClinicIntake>) => void;
  onChange: (next: Assessment) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const blocked = intake.ageConfirmed === "no";
  const hasFocus = intake.places.length > 0 || intake.dislikes.some((dislike) => dislike.words.trim().length > 0);
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">About you and your goals</h2>
      <p className="mt-3 text-sm leading-6 text-muted">These answers are for the clinic. They are not a diagnosis. You can leave a question blank, except the age check.</p>
      <div className="mt-8 space-y-8">
        <Question n={1} title="Are you 18 or above? And are you okay with your face being described in plain, direct words?">
          <SingleChoiceGroup label="18 or above" options={YES_NO} value={intake.ageConfirmed} onChange={(ageConfirmed) => set({ ageConfirmed })} />
          <SingleChoiceGroup label="Plain, direct words are okay" options={YES_NO} value={intake.directWordsOk} onChange={(directWordsOk) => set({ directWordsOk })} />
          {blocked && <p className="text-sm text-body-text">This is only for people who are 18 or older.</p>}
        </Question>
        <Question n={2} title="How much does your face bother you in daily life?" hint="0 means not at all. 10 means a lot. Then say how much time you spend looking in the mirror, comparing yourself, or editing your photos.">
          <label className="block">
            <span className="text-sm text-muted">Bother, 0 to 10</span>
            <input type="number" inputMode="numeric" min={0} max={10} value={intake.botherScore ?? ""} onChange={(event) => set({ botherScore: event.target.value === "" ? null : Number(event.target.value) })} className={FIELD} />
          </label>
          <TextAnswer label="Mirror, comparison, or photo editing" value={intake.mirrorTime} onChange={(mirrorTime) => set({ mirrorTime })} rows={2} />
        </Question>
        <Question n={3} title="Has anyone ever told you that you worry about your looks more than needed?">
          <SingleChoiceGroup label="Told you worry more than needed" options={[...YES_NO, { value: "notSure", label: "Not sure" }]} value={intake.toldWorriesMore} onChange={(toldWorriesMore) => set({ toldWorriesMore })} />
        </Question>
        <Question n={4} title="What do you want most from this?">
          <SingleChoiceGroup
            label="What you want most"
            options={[
              { value: "understand", label: "Understand my face" },
              { value: "plan", label: "A step-by-step plan" },
              { value: "secondOpinion", label: "A second opinion on a treatment I am already considering" },
              { value: "reassurance", label: "Just honest reassurance" },
            ]}
            value={intake.reportWant}
            onChange={(reportWant) => set({ reportWant })}
          />
        </Question>
        <Question n={5} title="Which 3 things about your face do you dislike the most?" hint="Write them in your own words, most important first, and how long each has bothered you. Then pick up to 3 places so the illustrative after knows where to look. The picture only changes the places you pick.">
          {intake.dislikes.map((dislike, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-2">
              <TextAnswer label={`Dislike ${index + 1}`} value={dislike.words} onChange={(words) => {
                const dislikes = intake.dislikes.map((item, itemIndex) => (itemIndex === index ? { ...item, words } : item)) as ClinicIntake["dislikes"];
                set({ dislikes });
              }} rows={2} />
              <TextAnswer label="How long" value={dislike.duration} onChange={(duration) => {
                const dislikes = intake.dislikes.map((item, itemIndex) => (itemIndex === index ? { ...item, duration } : item)) as ClinicIntake["dislikes"];
                set({ dislikes });
              }} rows={2} />
            </div>
          ))}
          <MultiChoiceGroup
            label="Places for the illustrative after"
            helperText="Up to 3. This is the only part of these answers that changes the picture."
            max={3}
            options={CLINIC_PLACES.map((place) => ({ value: place, label: placeLabel(place) }))}
            value={intake.places}
            onChange={(places) => onChange(projectPlaces(assessment, places))}
          />
          {assessment.appearanceConcerns.selected.map((id) => {
            const details = detailsOfConcern(id);
            if (details.length === 0) return null;
            const chosen = assessment.appearanceConcerns.details.filter((detail) => details.some((item) => item.id === detail));
            return (
              <MultiChoiceGroup
                key={id}
                label={`Anything more specific about ${concernLabel(id)}? Optional.`}
                options={details.map((detail) => ({ value: detail.id, label: detail.label }))}
                value={chosen}
                onChange={(next) => {
                  let concerns = assessment.appearanceConcerns;
                  for (const id of chosen.filter((detail) => !next.includes(detail))) concerns = toggleDetail(concerns, id);
                  for (const id of next.filter((detail) => !chosen.includes(detail))) concerns = toggleDetail(concerns, id as AppearanceConcernDetailId);
                  onChange({ ...assessment, appearanceConcerns: concerns });
                }}
              />
            );
          })}
        </Question>
        <Question n={6} title="What do you want your face to look like?" hint="Pick your top two. This is for the clinic. It does not change the after image.">
          <MultiChoiceGroup
            label="Top two"
            max={2}
            options={[
              { value: "masculine", label: "More masculine" },
              { value: "feminine", label: "More feminine" },
              { value: "younger", label: "Younger" },
              { value: "fresh", label: "More fresh and awake" },
              { value: "friendly", label: "More friendly" },
              { value: "sharp", label: "More sharp and striking" },
            ]}
            value={intake.lookDirections}
            onChange={(lookDirections) => set({ lookDirections })}
          />
        </Question>
        <Question n={7} title="Is there a date or event you are preparing for?" hint="A wedding, shoot, job change, competition, or anything else. Include the date if you have one.">
          <TextAnswer label="Event and date" value={intake.event} onChange={(event) => set({ event })} rows={2} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={intake.ageConfirmed !== "yes" || !hasFocus} />
    </div>
  );
}

function Comfort({ intake, set, onNext, onBack }: { intake: ClinicIntake; set: (partial: Partial<ClinicIntake>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">What you are comfortable with</h2>
      <p className="mt-3 text-sm leading-6 text-muted">This records your own limit. It is not a suggestion, and it does not name a treatment for you.</p>
      <div className="mt-8 space-y-8">
        <Question n={8} title="How much money are you realistically ready to spend on your face in the next 12 months?">
          <TextAnswer label="Amount" value={intake.spendNext12Months} onChange={(spendNext12Months) => set({ spendNext12Months })} rows={2} />
        </Question>
        <Question n={9} title="What is the maximum you are willing to do?">
          <SingleChoiceGroup
            label="Maximum you are willing to do"
            options={MAX_WILLING.map((value) => ({
              value,
              label: { skincare: "Only skincare and lifestyle changes", laser: "Laser and machine treatments", injections: "Injections like Botox, fillers, skin boosters", threads: "Threads", surgery: "Surgery" }[value],
            }))}
            value={intake.maxWilling}
            onChange={(maxWilling) => set({ maxWilling })}
          />
        </Question>
        <Question n={10} title="How many days of visible swelling, redness, or marks can you manage at one time?">
          <SingleChoiceGroup
            label="Visible downtime"
            options={DOWNTIME.map((value) => ({ value, label: { none: "None", days2to3: "2–3 days", oneWeek: "1 week", twoWeeksOrMore: "2 weeks or more" }[value] }))}
            value={intake.downtime}
            onChange={(downtime) => set({ downtime })}
          />
        </Question>
        <Question n={11} title="Have you already had anything done to your face?" hint="List it with dates if you can. Include injections, threads, laser, nose surgery, braces, implants, hair transplant, or anything else.">
          <TextAnswer label="What has already been done" value={intake.priorTreatments} onChange={(priorTreatments) => set({ priorTreatments })} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function Breathing({ intake, set, onNext, onBack }: { intake: ClinicIntake; set: (partial: Partial<ClinicIntake>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">Breathing, teeth and jaw</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Write what you know. A blank answer is fine.</p>
      <div className="mt-8 space-y-8">
        <Question n={12} title="How do you breathe and sleep?" hint="Mouth breathing or a dry mouth in the morning, snoring, allergies, a blocked nose, a deviated septum, sleep apnoea, and whether tonsils or adenoids were removed as a child.">
          <TextAnswer label="Breathing and sleep" value={intake.breathing} onChange={(breathing) => set({ breathing })} />
        </Question>
        <Question n={13} title="What is your teeth and jaw history?" hint="Braces, an expander, headgear, a retainer, teeth removed, thumb sucking, a bottle or pacifier, tongue tie, pushing the tongue against the teeth, chewing on one side, and whether your food is mostly soft or often hard.">
          <TextAnswer label="Teeth and jaw history" value={intake.teethAndJawHistory} onChange={(teethAndJawHistory) => set({ teethAndJawHistory })} />
        </Question>
        <Question n={14} title="How does your jaw feel now?" hint="Clicking, locking, morning soreness, clenching or grinding, whether the lips close without effort, and whether the head goes forward or the shoulders round at a desk or phone.">
          <TextAnswer label="Jaw now" value={intake.jawNow} onChange={(jawNow) => set({ jawNow })} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function Body({
  assessment,
  intake,
  set,
  onChange,
  onNext,
  onBack,
}: {
  assessment: Assessment;
  intake: ClinicIntake;
  set: (partial: Partial<ClinicIntake>) => void;
  onChange: (next: Assessment) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const ready = intake.heightCm !== null && intake.weightKg !== null;
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">Body, fitness and weight</h2>
      <div className="mt-8 space-y-8">
        <Question n={15} title="Your height, weight, and how you compare with your family." hint="Height and weight are required. Waist, body fat, and puberty can be left blank.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-muted">Height (cm)</span>
              <input type="number" inputMode="numeric" min={100} max={250} value={intake.heightCm ?? ""} onChange={(event) => onChange(projectBody(assessment, event.target.value === "" ? null : Number(event.target.value), intake.weightKg))} className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Weight (kg)</span>
              <input type="number" inputMode="numeric" min={30} max={300} value={intake.weightKg ?? ""} onChange={(event) => onChange(projectBody(assessment, intake.heightCm, event.target.value === "" ? null : Number(event.target.value)))} className={FIELD} />
            </label>
          </div>
          <TextAnswer label="Waist size" value={intake.waist} onChange={(waist) => set({ waist })} rows={2} />
          <TextAnswer label="Body fat, if you know it, and how it was measured" value={intake.bodyFat} onChange={(bodyFat) => set({ bodyFat })} rows={2} />
          <TextAnswer label="Taller or shorter than your family, and roughly when puberty started" value={intake.familyHeightAndPuberty} onChange={(familyHeightAndPuberty) => set({ familyHeightAndPuberty })} rows={2} />
        </Question>
        <Question n={16} title="What exercise do you do?" hint="Hours a week, years without a long break, and any current numbers you have: a 5 km time, a race, lifts, or gym sessions.">
          <TextAnswer label="Exercise" value={intake.exercise} onChange={(exercise) => set({ exercise })} />
        </Question>
        <Question n={17} title="How has your weight changed?" hint="Lowest and highest adult weight, change in the last 2 years, whether you are losing fat, maintaining, or gaining, and whether your face clearly changes with your weight.">
          <TextAnswer label="Weight history" value={intake.weightHistory} onChange={(weightHistory) => set({ weightHistory })} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!ready} />
    </div>
  );
}

function Skin({ intake, set, onNext, onBack }: { intake: ClinicIntake; set: (partial: Partial<ClinicIntake>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">Skin and health</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Tell the clinic what you already know. This does not diagnose anything.</p>
      <div className="mt-8 space-y-8">
        <Question n={18} title="What are your main skin problems?" hint="Also say if you mark or scar easily, what you use every day, and whether you have taken acne tablets or used steroid creams.">
          <MultiChoiceGroup
            label="Skin problems"
            options={SKIN_PROBLEMS.map((value) => ({
              value,
              label: { pimples: "Pimples", darkMarks: "Dark marks after pimples", melasma: "Melasma or patches", redness: "Redness", roughTexture: "Rough texture", looseSkin: "Loose skin", darkCircles: "Dark circles" }[value],
            }))}
            value={intake.skinProblems}
            onChange={(skinProblems) => set({ skinProblems })}
          />
          <SingleChoiceGroup label="Dark marks or thick scars easily" options={[...YES_NO, { value: "notSure", label: "Not sure" }]} value={intake.marksEasily} onChange={(marksEasily) => set({ marksEasily })} />
          <TextAnswer label="Products used daily" value={intake.dailyProducts} onChange={(dailyProducts) => set({ dailyProducts })} rows={2} />
          <TextAnswer label="Acne tablets or steroid creams" value={intake.acneTabletsOrSteroidCreams} onChange={(acneTabletsOrSteroidCreams) => set({ acneTabletsOrSteroidCreams })} rows={2} />
        </Question>
        <Question n={19} title="Any health conditions, medicines, or allergies?" hint="Include thyroid, PCOS or hormones, diabetes or insulin resistance, autoimmune disease, low haemoglobin, keloid scars, pregnancy or breastfeeding, and any bad reaction to local anaesthesia.">
          <TextAnswer label="Health conditions" value={intake.healthConditions} onChange={(healthConditions) => set({ healthConditions })} />
          <TextAnswer label="Medicines and supplements now" value={intake.medicines} onChange={(medicines) => set({ medicines })} />
          <SingleChoiceGroup label="Pregnant or breastfeeding" options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "notApplicable", label: "Not applicable" }]} value={intake.pregnantOrBreastfeeding} onChange={(pregnantOrBreastfeeding) => set({ pregnantOrBreastfeeding })} />
          {intake.pregnantOrBreastfeeding === "yes" && <p className="text-sm leading-6 text-body-text">Tell the clinic before anything is done. This preview does not decide that.</p>}
          <TextAnswer label="Allergies, or a bad reaction to local anaesthesia" value={intake.allergies} onChange={(allergies) => set({ allergies })} rows={2} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function Recovery({ intake, set, onNext, onBack }: { intake: ClinicIntake; set: (partial: Partial<ClinicIntake>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">Sleep, recovery and daily habits</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Think about the last 3 months.</p>
      <div className="mt-8 space-y-8">
        <Question n={20} title="How many hours do you sleep, and is it at the same time each day?">
          <TextAnswer label="Hours" value={intake.sleepHours} onChange={(sleepHours) => set({ sleepHours })} rows={2} />
          <SingleChoiceGroup label="Same time daily" options={YES_NO} value={intake.sleepSameTime} onChange={(sleepSameTime) => set({ sleepSameTime })} />
        </Question>
        <Question n={21} title="Does your face or eyelids look puffy in the morning?">
          <SingleChoiceGroup label="Morning puffiness" options={PUFFINESS.map((value) => ({ value, label: { never: "Never", sometimes: "Sometimes", daily: "Daily" }[value] }))} value={intake.morningPuffiness} onChange={(morningPuffiness) => set({ morningPuffiness })} />
        </Question>
        <Question n={22} title="Do you track resting heart rate or HRV, and is it going up or down?">
          <TextAnswer label="Heart rate or HRV" value={intake.heartRateTrend} onChange={(heartRateTrend) => set({ heartRateTrend })} rows={2} />
        </Question>
        <Question n={23} title="How many days a month do you feel unusually tired, heavy-legged, or sore for more than 3 days?">
          <TextAnswer label="Tired or sore days" value={intake.tiredDays} onChange={(tiredDays) => set({ tiredDays })} rows={2} />
        </Question>
        <Question n={24} title="Illness, digestion, and flare-ups." hint="How often you have been sick, any gas, bloating, acidity or loose motions, and eczema, rosacea, dandruff or pimple flare-ups and what seems to trigger them.">
          <TextAnswer label="Illness and digestion" value={intake.illnessAndDigestion} onChange={(illnessAndDigestion) => set({ illnessAndDigestion })} />
          <TextAnswer label="Flare-ups and triggers" value={intake.flareUps} onChange={(flareUps) => set({ flareUps })} />
        </Question>
        <Question n={25} title="Alcohol, nicotine, water, salt, stress, sun, and how training feels right now.">
          <TextAnswer label="Alcohol and tobacco or nicotine" value={intake.alcoholAndNicotine} onChange={(alcoholAndNicotine) => set({ alcoholAndNicotine })} rows={2} />
          <TextAnswer label="Water and salt, roughly each day" value={intake.waterAndSalt} onChange={(waterAndSalt) => set({ waterAndSalt })} rows={2} />
          <label className="block">
            <span className="text-sm text-muted">Stress, 0 to 10</span>
            <input type="number" inputMode="numeric" min={0} max={10} value={intake.stressOutOf10 ?? ""} onChange={(event) => set({ stressOutOf10: event.target.value === "" ? null : Number(event.target.value) })} className={FIELD} />
          </label>
          <TextAnswer label="Sun, and whether you use sunscreen daily" value={intake.sunAndSunscreen} onChange={(sunAndSunscreen) => set({ sunAndSunscreen })} rows={2} />
          <SingleChoiceGroup label="Training right now" options={TRAINING_PHASE.map((value) => ({ value, label: { heavy: "Heavy training phase", steady: "Steady", burntOut: "Burnt out" }[value] }))} value={intake.trainingPhase} onChange={(trainingPhase) => set({ trainingPhase })} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

function Report({ intake, set, onNext, onBack }: { intake: ClinicIntake; set: (partial: Partial<ClinicIntake>) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">How you want this written</h2>
      <div className="mt-8 space-y-8">
        <Question n={26} title="How should we write this for you?">
          <SingleChoiceGroup label="Tone" options={REPORT_TONE.map((value) => ({ value, label: { blunt: "Very blunt and direct", gentle: "Honest but gentle" }[value] }))} value={intake.reportTone} onChange={(reportTone) => set({ reportTone })} />
        </Question>
        <Question n={27} title="What should come first, and do you want an example after photo?" hint="An after photo is only an example of the direction. It is not a promise of the result.">
          <SingleChoiceGroup label="Order" options={REPORT_ORDER.map((value) => ({ value, label: { measurementsFirst: "Measurements first", planFirst: "Action plan first" }[value] }))} value={intake.reportOrder} onChange={(reportOrder) => set({ reportOrder })} />
          <SingleChoiceGroup label="Example after photo" options={[{ value: "yes", label: "Yes, show an example" }, { value: "no", label: "No" }]} value={intake.wantAfterPhoto} onChange={(wantAfterPhoto) => set({ wantAfterPhoto })} />
        </Question>
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to photos" />
    </div>
  );
}
