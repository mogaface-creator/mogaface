"use client";

import type { ChangeEvent } from "react";
import { StepNav } from "./StepNav";
import { MultiChoiceGroup, SingleChoiceGroup } from "./ChoiceGroup";
import { concernLabel, toggleDetail, type AppearanceConcernDetailId } from "@/lib/assessment/appearanceConcerns.ts";
import {
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
import { whereGroups } from "@/lib/assessment/intakeFlow.ts";
import type { Ask } from "@/lib/assessment/intakeQuestions.ts";
import type { Assessment } from "@/lib/assessment/types.ts";
import type { ClinicIntake } from "@/lib/assessment/clinicIntake.ts";

const FIELD = "mt-2 w-full min-h-12 rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent";

function chipClass(selected: boolean) {
  return selected ? "border-accent bg-accent text-accent-foreground" : "border-border text-foreground hover:border-accent/50";
}

interface ClinicIntakeSectionProps {
  asks: Ask[];
  /** Heading when the screen is more than one field. A single ask uses its own prompt. */
  title?: string;
  counter?: string;
  assessment: Assessment;
  onChange: (next: Assessment) => void;
  onNext: (next?: Assessment) => void;
  onBack: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Yes/no, a single choice, or a score moves on as soon as it is tapped. */
  autoAdvance?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}

type Chunk = { type: "yesno"; asks: Ask[] } | { type: "grid"; asks: Ask[] } | { type: "single"; ask: Ask };

function isLine(ask: Ask): boolean {
  return ask.kind === "height" || ask.kind === "weight" || (ask.kind === "text" && ask.input !== "area");
}

function chunkAsks(asks: Ask[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const ask of asks) {
    const last = chunks[chunks.length - 1];
    if (ask.kind === "yesno") {
      if (last?.type === "yesno") last.asks.push(ask);
      else chunks.push({ type: "yesno", asks: [ask] });
    } else if (isLine(ask)) {
      if (last?.type === "grid") last.asks.push(ask);
      else chunks.push({ type: "grid", asks: [ask] });
    } else {
      chunks.push({ type: "single", ask });
    }
  }
  return chunks;
}

export function ClinicIntakeSection({
  asks,
  title,
  counter,
  assessment,
  onChange,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
  autoAdvance = false,
  skipLabel,
  onSkip,
}: ClinicIntakeSectionProps) {
  const intake = assessment.clinicIntake;
  const visible = asks.filter((ask) => askVisible(intake, ask));
  const solo = visible.length === 1 ? visible[0] : undefined;
  const heading = title ?? solo?.prompt ?? "";
  const hint = solo && !title ? solo.hint : undefined;
  const under18 = solo?.id === "ageConfirmed" && intake.ageConfirmed === "no";
  const pregnant = (intake.picked.clinicFlags ?? []).includes("pregnant") && visible.some((ask) => ask.id === "clinicFlags");

  const commit = (next: Assessment, ask: Ask, value?: string) => {
    onChange(next);
    if (!autoAdvance || !value) return;
    if (ask.kind !== "yesno" && ask.kind !== "choice" && ask.kind !== "score") return;
    if (ask.id === "ageConfirmed" && value === "no") return;
    onNext(next);
  };

  return (
    <div className={autoAdvance ? "" : "pb-28 sm:pb-0"}>
      {counter && <p className="text-xs text-muted tabular-nums">{counter}</p>}
      <h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">{heading}</h2>
      {hint && <p className="mt-3 text-sm leading-6 text-muted">{hint}</p>}
      {solo?.id === "maxWilling" && <p className="mt-3 text-sm leading-6 text-muted">This is your own limit. It does not choose a treatment for you.</p>}
      {pregnant && <p className="mt-3 text-sm leading-6 text-body-text">Tell the clinic before anything is done. This preview does not decide that.</p>}
      <div className="mt-8 space-y-5">
        {chunkAsks(visible).map((chunk) => {
          if (chunk.type === "yesno" && chunk.asks.length > 1) {
            return (
              <div key={chunk.asks[0].id} className="divide-y divide-border rounded-2xl border border-border px-4">
                {chunk.asks.map((ask) => (
                  <YesNoRow key={ask.id} ask={ask} intake={intake} assessment={assessment} onCommit={commit} />
                ))}
              </div>
            );
          }
          if (chunk.type === "grid") {
            return (
              <div key={chunk.asks[0].id} className={chunk.asks.length > 1 ? "grid gap-4 sm:grid-cols-2" : ""}>
                {chunk.asks.map((ask) => (
                  <AskField key={ask.id} ask={ask} assessment={assessment} intake={intake} onCommit={commit} hidePrompt={chunk.asks.length === 1 && !title} />
                ))}
              </div>
            );
          }
          const ask = chunk.type === "yesno" ? chunk.asks[0] : chunk.ask;
          return <AskField key={ask.id} ask={ask} assessment={assessment} intake={intake} onCommit={commit} hidePrompt />;
        })}
      </div>
      {under18 && <p className="mt-6 text-sm text-body-text">This is only for people who are 18 or older.</p>}
      {autoAdvance ? (
        <div className="mt-10 flex items-center justify-between">
          <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center text-base text-muted">
            Back
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} className="inline-flex min-h-12 items-center text-base text-muted">
              {skipLabel ?? "Skip the rest"}
            </button>
          )}
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:z-auto sm:mt-10 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none">
          <StepNav onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} nextLabel={nextLabel} className="" />
          {onSkip && (
            <button type="button" onClick={onSkip} className="mt-2 inline-flex min-h-11 items-center text-base text-muted">
              {skipLabel ?? "Skip the rest"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function YesNoRow({
  ask,
  intake,
  assessment,
  onCommit,
}: {
  ask: Ask;
  intake: ClinicIntake;
  assessment: Assessment;
  onCommit: (next: Assessment, ask: Ask, value?: string) => void;
}) {
  const value = replyOf(intake, ask.id);
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm leading-5">{ask.prompt}</p>
        {ask.hint && <p className="mt-1 text-xs leading-5 text-muted">{ask.hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex" role="radiogroup" aria-label={ask.prompt}>
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onCommit(setAnswer(assessment, ask.id, option), ask, option)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors sm:min-w-16 ${chipClass(value === option)}`}
          >
            {option === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ ask }: { ask: Ask }) {
  return (
    <>
      <span className="text-sm font-medium leading-6">{ask.prompt}</span>
      {ask.hint && <span className="mt-1 block text-xs leading-5 text-muted">{ask.hint}</span>}
    </>
  );
}

function AskField({
  ask,
  assessment,
  intake,
  onCommit,
  hidePrompt,
}: {
  ask: Ask;
  assessment: Assessment;
  intake: ClinicIntake;
  onCommit: (next: Assessment, ask: Ask, value?: string) => void;
  hidePrompt?: boolean;
}) {
  if (ask.kind === "yesno") {
    const value = replyOf(intake, ask.id);
    return (
      <SingleChoiceGroup
        label={ask.prompt}
        hideLabel={hidePrompt}
        options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
        value={value === "" ? null : (value as "yes" | "no")}
        onChange={(next) => onCommit(setAnswer(assessment, ask.id, next), ask, next)}
      />
    );
  }

  if (ask.kind === "choice") {
    const value = replyOf(intake, ask.id);
    return (
      <SingleChoiceGroup
        label={ask.prompt}
        hideLabel={hidePrompt}
        options={ask.options ?? []}
        value={value === "" ? null : value}
        onChange={(next) => onCommit(setAnswer(assessment, ask.id, next), ask, next)}
      />
    );
  }

  if (ask.kind === "multi") {
    return (
      <MultiChoiceGroup
        label={ask.prompt}
        hideLabel={hidePrompt}
        max={ask.max}
        helperText={hidePrompt ? undefined : ask.hint}
        options={ask.options ?? []}
        value={pickedOf(intake, ask.id)}
        onChange={(next) => onCommit(setPicked(assessment, ask.id, next), ask)}
      />
    );
  }

  if (ask.kind === "score") {
    const value = replyOf(intake, ask.id);
    return (
      <div>
        {!hidePrompt && <p className="text-sm font-medium leading-6">{ask.prompt}</p>}
        {!hidePrompt && ask.hint && <p className="mt-1 text-xs leading-5 text-muted">{ask.hint}</p>}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ask.prompt}>
          {Array.from({ length: 11 }, (_, score) => {
            const selected = value === String(score);
            return (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onCommit(setAnswer(assessment, ask.id, String(score)), ask, String(score))}
                className={`h-12 w-12 rounded-full border text-base tabular-nums transition-colors sm:h-10 sm:w-10 sm:text-sm ${chipClass(selected)}`}
              >
                {score}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (ask.kind === "text") {
    const shared = {
      value: replyOf(intake, ask.id),
      placeholder: ask.placeholder,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onCommit(setAnswer(assessment, ask.id, event.target.value), ask),
      className: FIELD,
    };
    return (
      <label className="block">
        {!hidePrompt && <FieldLabel ask={ask} />}
        {ask.input === "area" ? <textarea rows={3} {...shared} /> : <input type="text" inputMode="text" {...shared} />}
      </label>
    );
  }

  if (ask.kind === "height" || ask.kind === "weight") {
    const isHeight = ask.kind === "height";
    const value = isHeight ? intake.heightCm : intake.weightKg;
    return (
      <label className="block">
        <FieldLabel ask={ask} />
        <input
          type="number"
          inputMode="numeric"
          placeholder={isHeight ? "e.g. 175" : "e.g. 70"}
          min={isHeight ? 100 : 30}
          max={isHeight ? 250 : 300}
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value === "" ? null : Number(event.target.value);
            onCommit(projectBody(assessment, isHeight ? next : intake.heightCm, isHeight ? intake.weightKg : next), ask);
          }}
          className={FIELD}
        />
      </label>
    );
  }

  if (ask.kind === "dislikes") {
    const dislike = intake.dislikes[0];
    return (
      <label className="block">
        {!hidePrompt && <FieldLabel ask={ask} />}
        <input
          type="text"
          value={dislike.words}
          placeholder="e.g. Under-eye hollows, jawline definition, forehead lines"
          onChange={(event) => {
            const words = event.target.value;
            const dislikes = intake.dislikes.map((item, index) => (index === 0 ? { ...item, words, duration: words.trim() ? item.duration : "" } : item)) as ClinicIntake["dislikes"];
            onCommit(withIntake(assessment, { dislikes }), ask);
          }}
          className={FIELD}
        />
      </label>
    );
  }

  if (ask.kind === "places") {
    return (
      <MultiChoiceGroup
        label={ask.prompt}
        hideLabel={hidePrompt}
        helperText={hidePrompt ? undefined : ask.hint}
        max={ask.max ?? 3}
        options={ask.options ?? []}
        value={intake.places}
        onChange={(places) => onCommit(projectPlaces(assessment, places as ClinicPlace[]), ask)}
      />
    );
  }

  if (ask.kind === "details") {
    const groups = whereGroups(intake);
    return (
      <div className="space-y-6">
        {groups.map((group) => {
          const chosen = assessment.appearanceConcerns.details.filter((detail) => group.details.some((item) => item.id === detail));
          return (
            <MultiChoiceGroup
              key={group.place}
              label={groups.length === 1 ? ask.prompt : concernLabel(group.place)}
              hideLabel={groups.length === 1 && hidePrompt}
              options={group.details.map((detail) => ({ value: detail.id, label: detail.label }))}
              value={chosen}
              onChange={(next) => {
                let concerns = assessment.appearanceConcerns;
                for (const detail of chosen.filter((item) => !next.includes(item))) concerns = toggleDetail(concerns, detail);
                for (const detail of next.filter((item) => !chosen.includes(item))) concerns = toggleDetail(concerns, detail as AppearanceConcernDetailId);
                onCommit({ ...assessment, appearanceConcerns: concerns }, ask);
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
}
