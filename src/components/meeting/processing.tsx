"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2 } from "lucide-react";
import type { MeetingRow } from "@/lib/queries";
import { cn } from "@/lib/format";

const STEPS = ["Uploading recording", "Transcribing & identifying speakers", "Writing notes & action items", "Ready"];

export function Processing({ meeting }: { meeting: MeetingRow }) {
  const router = useRouter();
  const failed = meeting.status === "failed";
  useEffect(() => {
    if (failed) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [router, failed]);

  const detail = meeting.statusDetail ?? "";
  const step = /notes|summar|action/i.test(detail) ? 2 : /transcrib|speaker/i.test(detail) ? 1 : 0;

  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> Meetings
      </Link>
      <h1 className="text-[20px] font-semibold tracking-tight">{meeting.title}</h1>
      {failed ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-danger">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <p className="font-medium">We couldn&apos;t process this recording.</p>
            <p className="mt-0.5 text-red-700/80">{detail || "Something went wrong."}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] text-ink-3">Your notes will be ready in about a minute. You can leave this page.</p>
          <ol className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[12px]",
                    i < step ? "border-ok bg-ok text-white" : i === step ? "border-accent text-accent" : "border-line text-ink-3"
                  )}
                >
                  {i < step ? <Check size={14} /> : i === step ? <Loader2 size={14} className="animate-spin" /> : i + 1}
                </span>
                <span className={cn("text-[14px]", i === step ? "font-medium text-ink" : i < step ? "text-ink-2" : "text-ink-3")}>{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
