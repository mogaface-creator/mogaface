"use client";

import { StepNav } from "./StepNav";
import { MultiChoiceGroup } from "./ChoiceGroup";
import {
  APPEARANCE_CONCERN_CATALOG,
  APPEARANCE_CONCERN_GROUPS,
  MAX_APPEARANCE_PRIORITIES,
  detailsOfConcern,
  toggleConcern,
  toggleDetail,
  togglePriority,
  type AppearanceConcernId,
  type AppearanceConcerns,
} from "@/lib/assessment/appearanceConcerns.ts";

interface AppearanceConcernsStepProps {
  value: AppearanceConcerns;
  onChange: (next: AppearanceConcerns) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * ChoiceGroup reports the whole next list; the lib helpers take one toggle at
 * a time and keep every invariant (parent/detail links, NOT_SURE, max priorities).
 */
function applyChange<T extends string>(
  state: AppearanceConcerns,
  current: T[],
  next: T[],
  toggle: (s: AppearanceConcerns, id: T) => AppearanceConcerns,
): AppearanceConcerns {
  let result = state;
  for (const id of current.filter((c) => !next.includes(c))) result = toggle(result, id);
  for (const id of next.filter((c) => !current.includes(c))) result = toggle(result, id);
  return result;
}

export function AppearanceConcernsStep({ value, onChange, onNext, onBack }: AppearanceConcernsStepProps) {
  const selectable = value.selected.filter((c) => c !== "NOT_SURE");
  const labelOf = (id: AppearanceConcernId) => APPEARANCE_CONCERN_CATALOG.find((c) => c.id === id)!.label;

  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">What would you like to improve in your face and skin?</h2>
      <p className="mt-2 text-sm text-muted">
        Select the areas you&apos;d like MogaFace to focus on. There are no right or wrong answers.
      </p>

      <div className="mt-8 space-y-8">
        {APPEARANCE_CONCERN_GROUPS.map((group) => {
          const concerns = APPEARANCE_CONCERN_CATALOG.filter((c) => c.group === group.id);
          const groupSelected = value.selected.filter((id) => concerns.some((c) => c.id === id));
          return (
            <section key={group.id}>
              <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{group.label}</h3>
              <div className="mt-3">
                <MultiChoiceGroup
                  label={group.label}
                  hideLabel
                  options={concerns.map((c) => ({ value: c.id, label: c.label }))}
                  value={groupSelected}
                  onChange={(next) => onChange(applyChange(value, groupSelected, next, toggleConcern))}
                />
              </div>

              {/* Progressive disclosure: details appear only under a selected concern. */}
              {groupSelected.map((id) => {
                const details = detailsOfConcern(id);
                if (details.length === 0) return null;
                const chosen = value.details.filter((d) => details.some((x) => x.id === d));
                return (
                  <div key={id} className="mt-4 rounded-xl border border-border px-4 py-4">
                    <MultiChoiceGroup
                      label="Anything more specific? (optional)"
                      helperText={labelOf(id)}
                      options={details.map((d) => ({ value: d.id, label: d.label }))}
                      value={chosen}
                      onChange={(next) => onChange(applyChange(value, chosen, next, toggleDetail))}
                    />
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {selectable.length >= 2 && (
        <div className="mt-10">
          <MultiChoiceGroup
            label="What is most important to you? (optional)"
            options={selectable.map((id) => ({ value: id, label: labelOf(id) }))}
            value={value.priorities}
            onChange={(next) => onChange(applyChange(value, value.priorities, next, togglePriority))}
            max={MAX_APPEARANCE_PRIORITIES}
            helperText="Choose up to three"
          />
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
