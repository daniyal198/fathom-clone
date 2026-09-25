"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquareText } from "lucide-react";
import { TimeChip } from "@/components/ui";
import { cn } from "@/lib/format";
import { usePlayer } from "./player-store";

type Turn = { role: "user" | "assistant"; text: string };

const parseTs = (s: string) => s.split(":").reduce((acc, n) => acc * 60 + Number(n), 0) * 1000;

/** Minimal renderer for the model's answer: "- " bullets, **bold**, and [m:ss] timestamps as seek chips. */
export function RichAnswer({ text }: { text: string }) {
  const p = usePlayer();
  const inline = (line: string, key: string) =>
    line.split(/(\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*[,;–-]\s*\d{1,2}:\d{2}(?::\d{2})?)*\]|\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
      if (/^\[\d{1,2}:\d{2}/.test(part)) {
        // "[12:34]" or a group like "[16:23, 27:08]": one chip per timestamp
        return part
          .slice(1, -1)
          .split(/\s*[,;–-]\s*/)
          .map((ts, j) => <TimeChip key={`${key}-${i}-${j}`} ms={parseTs(ts)} onClick={() => p.seek(parseTs(ts))} className="mx-0.5 align-[1px]" />);
      }
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${key}-${i}`} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={`${key}-${i}`} className="text-ink-3">{part.slice(1, -1)}</em>;
      return part;
    });
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`ul${out.length}`} className="my-1.5 space-y-1 pl-4 [&>li]:list-disc">{list}</ul>);
    list = [];
  };
  lines.forEach((l, i) => {
    const b = l.match(/^\s*[-*•]\s+(.*)/);
    if (b) list.push(<li key={i}>{inline(b[1], `l${i}`)}</li>);
    else {
      flush();
      if (l.trim()) out.push(<p key={i} className="my-1.5">{inline(l, `p${i}`)}</p>);
    }
  });
  flush();
  return <div className="text-[13.5px] leading-relaxed text-ink-2">{out}</div>;
}

export function AskPanel({ meetingId, suggestions }: { meetingId: string; suggestions: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = turns;
    setTurns([...history, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setTurns((t) => [...t.slice(0, -1), { role: "assistant", text: acc }]);
      }
    } catch {
      setTurns((t) => [...t.slice(0, -1), { role: "assistant", text: "_Couldn't reach the AI. Try again._" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {turns.length === 0 ? (
          <div className="pt-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <MessageSquareText size={19} />
            </div>
            <p className="font-semibold">Ask anything about this meeting</p>
            <p className="mt-1 mb-4 text-[13px] text-ink-3">Answers come from the transcript, with timestamps you can jump to.</p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-[13px] text-ink-2 hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13.5px] text-white">{t.text}</div>
                </div>
              ) : (
                <div key={i} className="max-w-[95%]">
                  {t.text ? (
                    <RichAnswer text={t.text} />
                  ) : (
                    <span className="inline-flex gap-1 py-2">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-ink-3" style={{ animationDelay: `${d * 0.2}s` }} />
                      ))}
                    </span>
                  )}
                </div>
              )
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-accent">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(q);
              }
            }}
            rows={1}
            placeholder="What did we decide about…"
            className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent text-[13.5px] outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            disabled={!q.trim() || busy}
            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors", q.trim() && !busy ? "bg-accent text-white" : "bg-sunken text-ink-3")}
            aria-label="Ask"
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
