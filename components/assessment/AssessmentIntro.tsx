import { Button } from "@/components/ui/Button";

export function AssessmentIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="text-center">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">A few minutes</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Tell the clinic what you want them to know.</h1>
      <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted">
        Your answers, then three photos. The illustrative after only changes the places you pick. A clinician decides what comes next.
      </p>
      <div className="mt-10 flex justify-center">
        <Button onClick={onBegin}>Begin Assessment</Button>
      </div>
    </div>
  );
}
