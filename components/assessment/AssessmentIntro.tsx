import { Button } from "@/components/ui/Button";

export function AssessmentIntro({
  onBegin,
  hasExistingData = false,
  onResume,
}: {
  onBegin: () => void;
  hasExistingData?: boolean;
  onResume?: () => void;
}) {
  return (
    <div className="text-center">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">A few minutes</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Tell the clinic what you want them to know.</h1>
      <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted">
        Eighteen short questions, then three photos. The after photo changes only the places you pick. A clinician decides what comes next.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3">
        <Button onClick={onBegin}>
          {hasExistingData ? "Start Fresh Assessment" : "Begin Assessment"}
        </Button>
        {hasExistingData && onResume && (
          <button
            type="button"
            onClick={onResume}
            className="text-xs text-muted underline decoration-muted/50 underline-offset-4 hover:text-foreground"
          >
            Resume previous draft
          </button>
        )}
      </div>
    </div>
  );
}
