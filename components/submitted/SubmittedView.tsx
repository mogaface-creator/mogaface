"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function SubmittedView() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("id");

  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [status, setStatus] = useState<"countdown" | "processing" | "done" | "error">("processing");
  const [statusMessage, setStatusMessage] = useState<string>("Preparing your personalised report...");
  const [previewMessage, setPreviewMessage] = useState<string>("");

  // When timer hits 0 (or every 10s if processing), poll check-submission-status
  useEffect(() => {
    if (!submissionId) return;
    if (status === "done" || status === "error") return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/check-submission-status?id=${encodeURIComponent(submissionId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "done") {
          setStatus("done");
          setPreviewMessage(data.previewMessage || "");
          setStatusMessage(data.deliveryWarning ? "Your report is ready to download, but email delivery was unsuccessful. Please use the download button." : "Your report is ready. Check your email if you supplied an address.");
        } else if (data.status === "failed") {
          setStatus("error");setStatusMessage("We could not complete your report. Please contact the clinic with your submission reference.");
        } else if (data.status === "processing") {
          setStatus("processing");
          setStatusMessage("Building your full personalised report...");
        } else if (data.secondsRemaining !== undefined && data.secondsRemaining > 0) {
          setSecondsLeft(data.secondsRemaining);
        }
      } catch {
        // Silently continue polling
      }
    };

    if (secondsLeft === 0 || status === "processing") {
      checkStatus();
      const pollInterval = setInterval(checkStatus, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [secondsLeft, status, submissionId]);

  const triggerInstantProcess = async () => {
    if (!submissionId) return;
    setStatus("processing");
    setStatusMessage("Generating your report right now...");
    try {
      const res = await fetch(`/api/check-submission-status?id=${encodeURIComponent(submissionId)}`);
      const data = await res.json();
      if (data.status === "done") {
        setStatus("done");
        setPreviewMessage(data.previewMessage || "");
      }
    } catch {
      // Continue normal polling
    }
  };

  const downloadReport = async () => {
    if(!submissionId)return;
    const token=sessionStorage.getItem(`mogaface:report:${submissionId}`);
    if(!token){setStatusMessage("Open the emailed PDF, or download from the same browser session used to submit.");return;}
    try{const response=await fetch(`/api/submission-report?id=${encodeURIComponent(submissionId)}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error();const url=URL.createObjectURL(await response.blob());const a=document.createElement("a");a.href=url;a.download="Next-Face-Protocol.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setStatusMessage("The report could not be downloaded. Please use the emailed attachment or contact the clinic.");}
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      {/* Icon Badge */}
      <div className="flex justify-center">
        {status === "done" ? (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-10 w-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </span>
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-10 w-10 animate-pulse"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </span>
        )}
      </div>

      {/* Heading */}
      <div className="mt-8 text-center">
        <p className="eyebrow text-[11px]">
          {status === "done" ? "Report Ready" : "Assessment Received"}
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {status === "done" ? "Your report is ready." : "Your results are being prepared."}
        </h1>
        <div aria-hidden className="mx-auto mt-6 h-px w-16 bg-accent" />

        {status === "done" ? (
          <p className="mx-auto mt-6 max-w-md text-base leading-7 text-body-text">
            Your personalized <strong>Next Face appearance protocol</strong> is ready. Check the note below to see whether an illustrative after photo was included. Check your email if an address was supplied.
          </p>
        ) : (
          <p className="mx-auto mt-6 max-w-md text-base leading-7 text-body-text">
            We&apos;re reviewing your photos and building your personalised report. You&apos;ll receive it by email when processing finishes.
          </p>
        )}
      </div>

      {/* Progress / Status Live Card */}
      {submissionId && (
        <div className="mt-10 rounded-2xl border border-accent/20 bg-surface-warm p-6 text-center shadow-subtle">
          {status === "countdown" && (
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent animate-ping" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">Preparing your report</span>
              </div>
              <div className="mt-3 font-serif text-4xl font-bold text-foreground">
                {secondsLeft}s
              </div>
              <p className="mt-2 text-xs text-muted">
                Processing starts after this countdown
              </p>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={triggerInstantProcess}
                  className="text-xs font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                >
                  Generate &amp; send immediately
                </button>
              </div>
            </div>
          )}

          {status === "processing" && (
            <div>
              <div className="flex items-center justify-center gap-2 text-accent">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm font-semibold text-foreground">Finalizing Your Report...</span>
              </div>
              <p className="mt-2 text-xs text-muted">{statusMessage}</p>
            </div>
          )}

          {status === "done" && (
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Your report has been prepared.
              </p>
              {previewMessage && <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-body-text">{previewMessage}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={downloadReport}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent/90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  View / Download PDF Report
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {status === "error" && <p role="alert" className="mt-6 text-center text-sm">{statusMessage}</p>}
      {status === "done" && <p className="mt-4 text-center text-sm">{statusMessage}</p>}
      {/* What's in your report */}
      <div className="mt-12 rounded-2xl border border-border bg-surface p-8">
        <p className="eyebrow text-[11px]">What&apos;s in your email report</p>
        <ul className="mt-6 space-y-4">
          {[
            "An illustrative comparison when requested and quality-screened",
            "Your selected goals, preferences and original photo views",
            "Available expression-video observations, labelled with their limitations",
            "Detailed hair, skin, grooming, lifestyle and style sections",
            "Treatment discussion options requiring clinician review",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 border-t border-border pt-4 text-sm leading-6 text-body-text">
              <span className="mt-0.5 flex-shrink-0 text-accent font-bold" aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Reassurance */}
      <p className="mt-8 text-center text-sm text-muted">
        Didn&apos;t get the email? Check your spam folder, or{" "}
        <Link href="/assessment?new=1" className="underline decoration-accent underline-offset-4 hover:text-accent">
          start a new assessment
        </Link>
        .
      </p>

      <div className="mt-10 flex justify-center">
        <Link href="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
