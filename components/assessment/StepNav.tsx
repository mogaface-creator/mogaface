import { Button } from "@/components/ui/Button";

interface StepNavProps {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}

export function StepNav({ onBack, onNext, nextDisabled, nextLabel = "Continue" }: StepNavProps) {
  return (
    <div className="mt-10 flex items-center justify-between">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
