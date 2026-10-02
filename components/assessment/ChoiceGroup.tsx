"use client";

interface Option<T extends string> {
  value: T;
  label: string;
}

function chipClass(selected: boolean, disabled: boolean) {
  if (disabled) return "border-border text-muted/50 cursor-not-allowed";
  if (selected) return "border-accent bg-accent text-accent-foreground";
  return "border-border text-foreground hover:border-accent/50";
}

/** Full-width rows on a phone, compact chips from the sm breakpoint up. */
const TAP = "min-h-12 w-full rounded-full border px-4 text-left text-base transition-colors sm:min-h-0 sm:w-auto sm:px-4 sm:py-2 sm:text-center sm:text-sm";
const TAP_ROW = "mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap";

interface SingleChoiceGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Keeps the label for assistive tech but hides it visually when a heading above already says it. */
  hideLabel?: boolean;
}

export function SingleChoiceGroup<T extends string>({ label, options, value, onChange, hideLabel }: SingleChoiceGroupProps<T>) {
  return (
    <fieldset>
      <legend className={hideLabel ? "sr-only" : "text-sm font-medium"}>{label}</legend>
      <div className={TAP_ROW} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`${TAP} ${chipClass(selected, false)}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface MultiChoiceGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  /** When set, further selections are disabled once this many are selected. */
  max?: number;
  helperText?: string;
  /** Keeps the label for assistive tech but hides it visually (when a heading above already says it). */
  hideLabel?: boolean;
}

export function MultiChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  max,
  helperText,
  hideLabel,
}: MultiChoiceGroupProps<T>) {
  const atMax = typeof max === "number" && value.length >= max;

  const toggle = (option: T) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else if (!atMax) {
      onChange([...value, option]);
    }
  };

  return (
    <fieldset>
      <legend className={hideLabel ? "sr-only" : "text-sm font-medium"}>{label}</legend>
      {(helperText || max) && (
        <p className="mt-1 text-xs text-muted">
          {helperText}
          {max ? ` (${value.length}/${max} selected)` : ""}
        </p>
      )}
      <div className={TAP_ROW}>
        {options.map((option) => {
          const selected = value.includes(option.value);
          const disabled = !selected && atMax;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(option.value)}
              className={`${TAP} ${chipClass(selected, disabled)}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
