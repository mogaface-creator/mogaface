import { Button } from "@/components/ui/Button";

interface StepNavProps {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  className?: string;
}

export function StepNav({ onBack, onNext, nextDisabled, nextLabel = "Continue", className = "mt-10" }: StepNavProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack} className="min-h-12 shrink-0">
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={() => onNext()} disabled={nextDisabled} className="min-h-12 flex-1 sm:flex-none">
        {nextLabel}
      </Button>
    </div>
  );
}
