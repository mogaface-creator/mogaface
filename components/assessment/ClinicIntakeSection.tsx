"use client";

import { StepNav } from "./StepNav";
import { MultiChoiceGroup, SingleChoiceGroup } from "./ChoiceGroup";
import { concernLabel, detailsOfConcern, isAppearanceConcernId, toggleDetail, type AppearanceConcernDetailId } from "@/lib/assessment/appearanceConcerns.ts";
import {
  CLINIC_PLACES,
  askVisible,
  pickedOf,
  projectBody,
  projectPlaces,
  replyOf,
  setAnswer,
  setPicked,
  withIntake,
  type ClinicPlace,
} from "@/lib/assessment/clinicIntake.ts";
import { asksFor, type Ask, type IntakeSectionId } from "@/lib/assessment/intakeQuestions.ts";
import type { Assessment } from "@/lib/assessment/types.ts";
import type { ClinicIntake } from "@/lib/assessment/clinicIntake.ts";

const FIELD = "mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

const TITLES: Record<IntakeSectionId, string> = {
  about: "About you and your goals",
  comfort: "What you are comfortable with",
  breathing: "Breathing, teeth and jaw",
  body: "Body, fitness and weight",
  skin: "Skin and health",
  recovery: "Sleep, recovery and inflammation",
  report: "How you want the report",
};

function placeLabel(place: ClinicPlace): string {
  if (place === "HAIR") return "Hair";
  return isAppearanceConcernId(place) ? concernLabel(place) : place;
}

interface ClinicIntakeSectionProps {
  section: IntakeSectionId;
  assessment: Assessment;
  onChange: (next: Assessment) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ClinicIntakeSection({ section, assessment, onChange, onNext, onBack }: ClinicIntakeSectionProps) {
  const intake = assessment.clinicIntake;
  const questions = asksFor(section);
  const under18 = intake.ageConfirmed === "no";
  const hasFocus = intake.places.length > 0 || intake.dislikes.some((dislike) => dislike.words.trim().length > 0);
  const bodyReady = intake.heightCm !== null && intake.weightKg !== null;
  const nextDisabled = section === "about" ? intake.ageConfirmed !== "yes" || !hasFocus : section === "body" ? !bodyReady : false;

  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight">{TITLES[section]}</h2>
      {section === "about" && <p className="mt-3 text-sm leading-6 text-muted">Answer each part on its own. These answers are for the clinic. They are not a diagnosis.</p>}
      {section === "comfort" && <p className="mt-3 text-sm leading-6 text-muted">This records your own limit. It is not a suggestion, and it does not choose a treatment for you.</p>}
      {section === "skin" && replyOf(intake, "pregnantOrBreastfeeding") === "yes" && <p className="mt-3 text-sm leading-6 text-body-text">Tell the clinic before anything is done. This preview does not decide that.</p>}
      <div className="mt-8 space-y-10">
        {questions.map((question) => (
          <div key={question.n} className="border-t border-border pt-6">
            <p className="text-xs text-muted tabular-nums">{String(question.n).padStart(2, "0")}</p>
            <div className="mt-4 space-y-6">
              {question.asks.filter((ask) => askVisible(intake, ask)).map((ask) => (
                <AskField key={ask.id} ask={ask} assessment={assessment} intake={intake} onChange={onChange} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {under18 && section === "about" && <p className="mt-6 text-sm text-body-text">This is only for people who are 18 or older.</p>}
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} nextLabel={section === "report" ? "Continue to photos" : "Continue"} />
    </div>
  );
}

function AskField({
  ask,
  assessment,
  intake,
  onChange,
}: {
  ask: Ask;
  assessment: Assessment;
  intake: ClinicIntake;
  onChange: (next: Assessment) => void;
}) {
  if (ask.kind === "yesno" || ask.kind === "choice") {
    const value = replyOf(intake, ask.id);
    return (
      <SingleChoiceGroup
        label={ask.prompt}
        options={ask.kind === "yesno" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : ask.options ?? []}
        value={value === "" ? null : value}
        onChange={(next) => onChange(setAnswer(assessment, ask.id, next))}
      />
    );
  }

  if (ask.kind === "multi") {
    return (
      <MultiChoiceGroup
        label={ask.prompt}
        max={ask.max}
        options={ask.options ?? []}
        value={pickedOf(intake, ask.id)}
        onChange={(next) => onChange(setPicked(assessment, ask.id, next))}
      />
    );
  }

  if (ask.kind === "score") {
    const value = replyOf(intake, ask.id);
    return (
      <label className="block">
        <span className="text-sm font-medium leading-6">{ask.prompt}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          value={value}
          onChange={(event) => onChange(setAnswer(assessment, ask.id, event.target.value))}
          className={FIELD}
        />
      </label>
    );
  }

  if (ask.kind === "text") {
    return (
      <label className="block">
        <span className="text-sm font-medium leading-6">{ask.prompt}</span>
        <textarea rows={3} value={replyOf(intake, ask.id)} onChange={(event) => onChange(setAnswer(assessment, ask.id, event.target.value))} className={FIELD} />
      </label>
    );
  }

  if (ask.kind === "height" || ask.kind === "weight") {
    const isHeight = ask.kind === "height";
    const value = isHeight ? intake.heightCm : intake.weightKg;
    return (
      <label className="block">
        <span className="text-sm font-medium leading-6">{ask.prompt}</span>
        <input
          type="number"
          inputMode="numeric"
          min={isHeight ? 100 : 30}
          max={isHeight ? 250 : 300}
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value === "" ? null : Number(event.target.value);
            onChange(projectBody(assessment, isHeight ? next : intake.heightCm, isHeight ? intake.weightKg : next));
          }}
          className={FIELD}
        />
      </label>
    );
  }

  if (ask.kind === "dislikes") {
    return (
      <div>
        <p className="text-sm font-medium leading-6">{ask.prompt}</p>
        <div className="mt-4 space-y-4">
          {intake.dislikes.map((dislike, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-muted">Dislike {index + 1}, in your own words</span>
                <textarea
                  rows={2}
                  value={dislike.words}
                  onChange={(event) => {
                    const dislikes = intake.dislikes.map((item, itemIndex) => (itemIndex === index ? { ...item, words: event.target.value } : item)) as ClinicIntake["dislikes"];
                    onChange(withIntake(assessment, { dislikes }));
                  }}
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted">How long has this bothered you?</span>
                <textarea
                  rows={2}
                  value={dislike.duration}
                  onChange={(event) => {
                    const dislikes = intake.dislikes.map((item, itemIndex) => (itemIndex === index ? { ...item, duration: event.target.value } : item)) as ClinicIntake["dislikes"];
                    onChange(withIntake(assessment, { dislikes }));
                  }}
                  className={FIELD}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <MultiChoiceGroup
        label={ask.prompt}
        helperText="Up to 3."
        max={3}
        options={CLINIC_PLACES.map((place) => ({ value: place, label: placeLabel(place) }))}
        value={intake.places}
        onChange={(places) => onChange(projectPlaces(assessment, places))}
      />
      <div className="mt-4 space-y-4">
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
                for (const detail of chosen.filter((item) => !next.includes(item))) concerns = toggleDetail(concerns, detail);
                for (const detail of next.filter((item) => !chosen.includes(item))) concerns = toggleDetail(concerns, detail as AppearanceConcernDetailId);
                onChange({ ...assessment, appearanceConcerns: concerns });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
