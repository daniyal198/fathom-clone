"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Copy, LayoutTemplate, RefreshCw, Sparkles } from "lucide-react";
import { TEMPLATES, templateByKey } from "@/lib/ai/templates";
import type { SummaryContent } from "@/lib/types";
import { clock, cn } from "@/lib/format";
import { Button, TimeChip } from "@/components/ui";
import { usePlayer } from "./player-store";

export function SummaryPanel({
  meetingId,
  title,
  initial,
  defaultTemplate,
  readOnly = false,
  meetingUrl,
}: {
  meetingId: string;
  title: string;
  initial: Record<string, SummaryContent>;
  defaultTemplate: string;
  readOnly?: boolean;
  meetingUrl: string;
}) {
  const p = usePlayer();
  const [summaries, setSummaries] = useState(initial);
  const [current, setCurrent] = useState(initial[defaultTemplate] ? defaultTemplate : initial.general ? "general" : Object.keys(initial)[0] ?? "general");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const content = summaries[current];
  const tpl = templateByKey(current);

  const pick = async (key: string, force = false) => {
    setCurrent(key);
    setError(null);
    if (summaries[key] && !force) return;
    setLoading(key);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: key, force }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not generate notes");
      const data: SummaryContent = await res.json();
      setSummaries((s) => ({ ...s, [key]: data }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const copy = async () => {
    if (!content) return;
    const link = (ms: number | null) => (ms == null ? "" : `${meetingUrl}?t=${ms}`);
    const text = [
      `${title}: ${tpl.name} notes`,
      "",
      content.tldr,
      ...content.sections.flatMap((s) => ["", s.heading, ...s.bullets.map((b) => `• ${b.text}${b.startMs != null ? ` (${clock(b.startMs)})` : ""}`)]),
    ].join("\n");
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html =
      `<h3>${esc(title)}</h3><p><i>${esc(content.tldr)}</i></p>` +
      content.sections
        .map(
          (s) =>
            `<h4>${esc(s.heading)}</h4><ul>${s.bullets
              .map((b) => `<li>${esc(b.text)}${b.startMs != null ? ` <a href="${link(b.startMs)}">${clock(b.startMs)}</a>` : ""}</li>`)
              .join("")}</ul>`
        )
        .join("");
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium hover:bg-sunken">
              <LayoutTemplate size={14} className="text-ink-3" />
              {tpl.name}
              <ChevronDown size={14} className="text-ink-3" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className="z-50 w-[270px] rounded-xl border border-line bg-surface p-1.5 shadow-pop">
              <DropdownMenu.Label className="px-2 py-1.5 text-[11.5px] font-medium text-ink-3">Note template</DropdownMenu.Label>
              {(readOnly ? TEMPLATES.filter((t) => summaries[t.key]) : TEMPLATES).map((t) => (
                <DropdownMenu.Item
                  key={t.key}
                  onSelect={() => pick(t.key)}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 outline-none data-[highlighted]:bg-sunken"
                >
                  <span className="mt-0.5 w-4 text-accent">{t.key === current && <Check size={14} />}</span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-medium">{t.name}</span>
                    <span className="block text-[12px] text-ink-3">{t.blurb}</span>
                  </span>
                  {summaries[t.key] && t.key !== current && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-ok" title="Already generated" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <div className="ml-auto flex items-center gap-1">
          {!readOnly && content && (
            <Button variant="ghost" size="sm" onClick={() => pick(current, true)} disabled={!!loading} title="Regenerate these notes">
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={copy} disabled={!content}>
            {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy notes"}
          </Button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading === current ? (
          <SummarySkeleton name={tpl.name} />
        ) : error && !content ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-danger">
            {error}.{" "}
            <button className="font-medium underline" onClick={() => pick(current)}>
              Try again
            </button>
          </div>
        ) : content ? (
          <div className="animate-fade-up">
            <div className="mb-5 rounded-xl bg-accent-soft/60 px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-accent uppercase">
                <Sparkles size={12} /> TL;DR
              </div>
              <p className="text-[14px] leading-relaxed text-ink">{content.tldr}</p>
            </div>
            {content.sections.map((s) => (
              <section key={s.heading} className="mb-5">
                <h3 className="mb-2 text-[14px] font-semibold">{s.heading}</h3>
                <ul className="space-y-1.5">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="group flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                      <span className="flex-1">
                        {b.text}
                        {b.startMs != null && <TimeChip ms={b.startMs} onClick={() => p.seek(b.startMs!)} className="ml-1.5 align-[1px]" />}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {error && <p className="text-[12.5px] text-danger">{error}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">No notes yet.</p>
        )}
      </div>
    </div>
  );
}

function SummarySkeleton({ name }: { name: string }) {
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-[13px] text-accent">
        <Sparkles size={14} className="animate-pulse" /> Rewriting the notes as “{name}”. Takes a few seconds…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5 animate-pulse">
          <div className="mb-2.5 h-3.5 w-40 rounded bg-sunken" />
          <div className="mb-2 h-3 w-full rounded bg-sunken" />
          <div className="mb-2 h-3 w-11/12 rounded bg-sunken" />
          <div className="h-3 w-3/4 rounded bg-sunken" />
        </div>
      ))}
    </div>
  );
}
