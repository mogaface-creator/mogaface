import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SubmittedView } from "@/components/submitted/SubmittedView";

export const metadata = {
  title: "We're preparing your results — MogaFace",
  description: "Your personalized before & after report is being prepared and will be emailed to you shortly.",
};

export default function SubmittedPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={
          <div className="mx-auto max-w-2xl px-6 py-28 text-center">
            <h1 className="font-serif text-3xl">Preparing your report...</h1>
          </div>
        }>
          <SubmittedView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
